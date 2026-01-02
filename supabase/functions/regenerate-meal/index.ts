// supabase/functions/regenerate-meal/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- REGENERATE-MEAL FUNCTION V1 ---");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. SETUP & AUTH
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('APP_SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

    const { meal_id, day_of_week, meal_type, dietaryRestrictions, currentRecipeName } = await req.json();

    if (!meal_id || !day_of_week || !meal_type) {
      throw new Error("Missing required parameters: meal_id, day_of_week, meal_type");
    }

    if (!supabaseUrl || !supabaseKey || !geminiKey) {
      throw new Error("Secrets are not fully set. Check Supabase Dashboard.");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError) throw authError;

    // 2. GET CURRENT MEAL PLAN TO AVOID DUPLICATES
    const { data: existingMeals } = await supabaseClient
      .from('meal_plan')
      .select('recipe_name')
      .eq('user_id', user.id);

    const existingRecipes = existingMeals?.map(m => m.recipe_name).filter(n => n !== currentRecipeName) || [];

    // 3. GENERATE NEW MEAL WITH AI
    const prompt = `
      You are a creative, professional chef.

      Generate a SINGLE new ${meal_type.toLowerCase()} recipe for ${day_of_week}.

      CRITICAL INSTRUCTIONS:
      1. Do NOT use generic names like "Oatmeal" or "Sandwich". Be specific (e.g., "Apple Cinnamon Oatmeal", "Turkey Pesto Panini").
      2. Do NOT suggest any of these recipes that are already in the meal plan: ${existingRecipes.join(', ') || 'none'}
      3. ${currentRecipeName ? `The current recipe is "${currentRecipeName}" - suggest something DIFFERENT.` : ''}
      4. Follow these dietary restrictions: ${dietaryRestrictions || 'none'}
      5. Respond ONLY with a valid JSON object in this format:
      {
        "recipe_name": "Your Creative Recipe Name Here"
      }
    `;

    const modelName = 'gemini-flash-latest';
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI call failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      throw new Error("AI returned no text.");
    }

    // Clean Markdown
    if (aiText.startsWith("```json")) {
      aiText = aiText.substring(7);
      aiText = aiText.substring(0, aiText.lastIndexOf("```"));
    }

    const { recipe_name } = JSON.parse(aiText);

    if (!recipe_name) {
      throw new Error("AI did not return a recipe_name.");
    }

    // 4. UPDATE THE MEAL IN DATABASE
    const { error: updateError } = await supabaseClient
      .from('meal_plan')
      .update({
        recipe_name: recipe_name,
        recipe_url: null,
        ingredients: null,
        servings: null,
        image_url: null
      })
      .eq('id', meal_id)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        message: "Meal regenerated successfully!",
        recipe_name: recipe_name
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
