// supabase/functions/generate-shopping-list/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- GENERATE SHOPPING LIST FUNCTION LOADED ---");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShoppingItem {
  name: string;
  quantity: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. SETUP & AUTH
    // 1. SETUP & AUTH
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('APP_SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

    // We get familySize from the frontend to help the AI scale ingredients
    const { familySize } = await req.json();

    if (!supabaseUrl || !supabaseKey || !geminiKey) {
      console.error("Missing secrets in generate-shopping-list:", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        hasGemini: !!geminiKey
      });
      throw new Error("Secrets are not fully set. Check Supabase Dashboard.");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    // 2. GET THE USER'S MEAL PLAN
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError) throw authError;

    const { data: meals, error: dbError } = await supabaseClient
      .from('meal_plan')
      .select('recipe_name')
      .eq('user_id', user.id);

    if (dbError) throw dbError;
    if (!meals || meals.length === 0) {
      throw new Error("No meals found in plan. Generate a plan first!");
    }

    // Create a simple text list: "Chicken Tacos, Oatmeal, ..."
    const mealList = meals.map(m => m.recipe_name).join(", ");

    // 3. ASK AI TO DO THE MATH
    const prompt = `
      I have a meal plan for a family of ${familySize || 4}. 
      The meals are: ${mealList}.

      Please create a consolidated shopping list for these meals.
      
      CRITICAL INSTRUCTIONS:
      1. Deduplicate ingredients (e.g., don't list 'Onion' twice).
      2. Sum the totals of ingredients FIRST. (e.g., if 3 recipes need 0.6 of a chili, sum them to 1.8).
      3. AFTER summing, ROUND UP to the nearest whole purchasable unit (e.g., 1.8 chilis -> 2 chilis).
      4. Ignore basic pantry staples like salt, pepper, and oil.
      
      Respond ONLY with a valid JSON object in this format:
      {
        "items": [
          { "name": "Serrano Chili", "quantity": 2 },
          { "name": "Milk", "quantity": 1 }
        ]
      }
    `;

    // --- Call Gemini (Using gemini-flash-latest) ---
    // 'gemini-flash-latest' is confirmed available.
    const modelName = 'gemini-flash-latest';
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI call failed: ${errText}`);
    }

    const aiData = await aiResponse.json();
    let aiText = aiData.candidates[0].content.parts[0].text;

    // Clean Markdown
    if (aiText.startsWith("```json")) {
      aiText = aiText.substring(7);
      aiText = aiText.substring(0, aiText.lastIndexOf("```"));
    }

    const { items: newIngredients }: { items: ShoppingItem[] } = JSON.parse(aiText);

    // 4. INTELLIGENTLY MERGE WITH EXISTING SHOPPING LIST
    // We get the current list so we don't accidentally delete things the user manually added.

    // A. Get current list from DB
    const { data: currentList } = await supabaseClient
      .from('shopping_list')
      .select('name, quantity, id')
      .eq('user_id', user.id);

    // B. Create a map for fast lookup of existing items
    const processingList = new Map();

    // Load current DB items into map
    currentList?.forEach(item => {
      // Use lowercase key to avoid "Apple" vs "apple" duplicates
      processingList.set(item.name.toLowerCase(), {
        name: item.name,
        quantity: item.quantity,
        id: item.id, // Keep ID so we update the existing row
        user_id: user.id
      });
    });

    // C. Add/Update with AI ingredients
    newIngredients.forEach(newItem => {
      const key = newItem.name.toLowerCase();
      if (processingList.has(key)) {
        // Item exists! Add to the quantity.
        const existing = processingList.get(key);
        existing.quantity += newItem.quantity;
      } else {
        // New item! Create it.
        processingList.set(key, {
          name: newItem.name,
          quantity: newItem.quantity,
          user_id: user.id
        });
      }
    });

    // D. SEPARATE INTO "INSERTS" AND "UPDATES"
    // We split the list to avoid the "null id" error.
    const itemsToUpdate: any[] = [];
    const itemsToInsert: any[] = [];

    for (const item of processingList.values()) {
      if (item.id) {
        itemsToUpdate.push(item);
      } else {
        itemsToInsert.push(item);
      }
    }

    // 5. SAVE TO DATABASE (Two Steps)

    // Step A: Update existing items
    if (itemsToUpdate.length > 0) {
      const { error: updateError } = await supabaseClient
        .from('shopping_list')
        .upsert(itemsToUpdate); // These all have IDs, so upsert works perfectly as an update

      if (updateError) throw updateError;
    }

    // Step B: Insert new items
    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('shopping_list')
        .insert(itemsToInsert); // These have NO IDs, so database will auto-generate them

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        message: "Shopping list updated!",
        count: itemsToUpdate.length + itemsToInsert.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );


  } catch (error) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});