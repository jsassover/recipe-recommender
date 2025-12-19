// supabase/functions/meal-planner/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- V6 MEAL-PLANNER FUNCTION LOADED (gemini-2.0-flash) ---");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Meal {
  day_of_week: string;
  meal_type: string;
  recipe_name: string;
  user_id: string; 
}

interface AIResponse {
  plan: Meal[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- 1. SETUP ---
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL');
    const supabaseKey = Deno.env.get('APP_SUPABASE_ANON_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseKey || !geminiKey) {
      throw new Error("Secrets are not fully set.");
    }

    const { familySize, dietaryRestrictions } = await req.json();

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError) throw authError;

    // --- 2. PROMPT ---
const prompt = `
      You are a creative, professional chef and family meal planner. 
      Today is ${new Date().toISOString()}.
      
      Generate a UNIQUE, 7-day, "well-balanced" meal plan for a family of ${familySize}.
      
      The plan is for breakfast, lunch, and dinner.
      
      Please follow these dietary restrictions: ${dietaryRestrictions || 'none'}.
      
      CRITICAL INSTRUCTIONS:
      1. Do NOT use generic names like "Oatmeal" or "Sandwich". Be specific (e.g., "Apple Cinnamon Oatmeal", "Turkey Pesto Panini").
      2. Ensure the meals are varied and distinct from a standard generic plan.
      3. Respond *only* with a valid JSON object in the following format:
      {
        "plan": [
          {"day_of_week": "Monday", "meal_type": "Breakfast", "recipe_name": "Recipe..."},
          ... (etc for all 7 days)
        ]
      }
    `;
    
    // --- 3. CALL GOOGLE AI (Using gemini-2.0-flash) ---
    // We use the v1beta endpoint which supports the newer 2.0 models
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`Failed to call Google AI API: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let aiText = aiData.candidates[0].content.parts[0].text;

    // Clean Markdown
    if (aiText.startsWith("```json")) {
      aiText = aiText.substring(7); 
      aiText = aiText.substring(0, aiText.lastIndexOf("```")); 
    }

    const { plan }: AIResponse = JSON.parse(aiText);

    // --- 4. SAVE TO DB ---
    await supabaseClient
      .from('meal_plan')
      .delete()
      .eq('user_id', user.id);

    const mealsWithUser: Meal[] = plan.map(meal => ({
      ...meal,
      user_id: user.id
    }));

    const { error: dbError } = await supabaseClient
      .from('meal_plan')
      .insert(mealsWithUser);
      
    if (dbError) throw dbError;

    return new Response(
      JSON.stringify({ message: "Meal plan successfully generated!" }),
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