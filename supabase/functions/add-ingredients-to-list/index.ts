// supabase/functions/add-ingredients-to-list/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- V2 ADD-INGREDIENTS-TO-LIST (with scaling) ---");

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This is the new structure of our saved ingredients
interface Ingredient {
  food: string;
  quantity: number;
  measure: string | null;
  text: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- 1. GET DATA AND AUTHENTICATE ---
    // *** THIS IS THE CHANGE ***
    // We now get meal_id AND the desired familySize
    const { meal_id, familySize } = await req.json();
    if (!meal_id || !familySize) {
      throw new Error("Missing meal_id or familySize.");
    }

    // Get secrets
    // Get secrets
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('APP_SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing secrets in add-ingredients-to-list:", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      });
      throw new Error("Secrets are not set. Check Supabase Dashboard.");
    }

    // Create authenticated Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    // Get the user's details
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("User not authenticated.");
    }

    // --- 2. FETCH THE SAVED RECIPE DATA ---
    const { data: mealData, error: mealError } = await supabaseClient
      .from('meal_plan')
      .select('ingredients, servings') // Get ingredients AND servings
      .eq('id', meal_id)
      .eq('user_id', user.id)
      .single();

    if (mealError) {
      throw new Error(`Could not find meal: ${mealError.message}`);
    }

    const ingredients: Ingredient[] = mealData.ingredients;
    const servings: number = mealData.servings || 1; // Default to 1 if not set

    if (!ingredients || ingredients.length === 0) {
      throw new Error("This meal has no ingredients saved.");
    }

    // --- 3. CALCULATE SCALING AND TRANSFORM ITEMS ---
    // This is the scaling logic you asked for!
    const scalingFactor = familySize / servings;

    const newShoppingListItems = ingredients.map(ing => {
      // Scale the quantity
      const newQuantity = ing.quantity * scalingFactor;

      // Format the ingredient name with the new, scaled amount
      // e.g., "2.00 cup flour"
      const itemName = `${newQuantity.toFixed(2)} ${ing.measure || ''} ${ing.food}`;

      return {
        name: itemName,
        quantity: 1, // Quantity 1 of the *item* "2.00 cup flour"
        user_id: user.id
      };
    });

    // --- 4. INSERT NEW ITEMS INTO THE SHOPPING LIST ---
    const { error: insertError } = await supabaseClient
      .from('shopping_list')
      .insert(newShoppingListItems);

    if (insertError) {
      throw new Error(`Failed to add items to shopping list: ${insertError.message}`);
    }

    // --- 5. SEND A SUCCESS MESSAGE BACK ---
    return new Response(
      JSON.stringify({ message: `${ingredients.length} items added to your shopping list!` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error("Error in function:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});