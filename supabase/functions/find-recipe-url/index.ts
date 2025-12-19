// supabase/functions/find-recipe-url/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- V4 FIND-RECIPE-URL FUNCTION (Diagnosis) ---");

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- 1. GET DATA AND AUTHENTICATE ---
    const { meal_id, recipe_name } = await req.json(); // Get data from React
    if (!meal_id || !recipe_name) {
      throw new Error("Missing meal_id or recipe_name.");
    }

    // --- 2. GET SECRETS ---
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL');
    const supabaseKey = Deno.env.get('APP_SUPABASE_ANON_KEY');
    const appId = Deno.env.get('EDAMAM_APP_ID');
    const appKey = Deno.env.get('EDAMAM_APP_KEY');

    if (!supabaseUrl || !supabaseKey || !appId || !appKey) {
      throw new Error("Secrets are not fully set.");
    }

    // Create an authenticated Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("User not authenticated.");
    }

    const simpleUserId = user.id.replaceAll('-', '').substring(0, 8); // Truncate to 8 characters

    let simpleName = recipe_name; 
    
    // 1. Remove parenthetical descriptions (e.g., (made with avocado...))
    simpleName = simpleName.replace(/\([^()]*\)/g, '').trim(); 
    
    // 2. Remove secondary ingredients/sides (e.g., , Carrot Sticks)
    simpleName = simpleName.replace(/,.*/, '').trim();             
    
    // 3. Remove prepositional phrases (e.g., on Whole Wheat Bread)
    simpleName = simpleName.replace(/ on .*/i, '').trim();
    simpleName = simpleName.replace(/ with .*/i, '').trim(); 
    
    // Fallback: If the name is now empty, just use the original name
    const finalSearchQuery = simpleName.length > 5 ? simpleName : recipe_name; 
    console.log("Searching Edamam for:", finalSearchQuery);


    // --- 3. CALL THE EDAMAM API ---
    const searchUrl = `https://api.edamam.com/api/recipes/v2?type=public&q=${encodeURIComponent(finalSearchQuery)}&app_id=${appId}&app_key=${appKey}&field=url&field=ingredients&field=yield`;

    const edamamResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: { 
        'Edamam-Account-User': simpleUserId // Pass the unique ID of the logged-in user
      }
    });

    // *** THIS IS THE DIAGNOSTIC FIX ***
    if (!edamamResponse.ok) {
      const status = edamamResponse.status;
      const errorDetail = await edamamResponse.text(); // Read the specific error text
      throw new Error(`Failed to call Edamam API. Status: ${status}. Details: ${errorDetail}`);
    }

    const edamamData = await edamamResponse.json();

    if (!edamamData.hits || edamamData.hits.length === 0) {
      throw new Error(`No recipes found for "${recipe_name}"`);
    }

    // --- SAFELY EXTRACT DATA FROM THE BEST MATCH ---
    // Defensively access nested properties to prevent runtime errors
    const recipe = edamamData.hits[0]?.recipe;
    const recipeUrl = recipe?.url;
    const ingredients = recipe?.ingredients;
    const servings = recipe?.yield;

    // Validate that we got the essential data we need
    if (!recipe || !recipeUrl || !ingredients || !servings) {
      throw new Error(`API response for "${recipe_name}" was incomplete or malformed.`);
    }

    // --- 4. SAVE THE URL & INGREDIENTS TO THE DATABASE ---
    const { error: dbError } = await supabaseClient
      .from('meal_plan')
      .update({ 
        recipe_url: recipeUrl,
        ingredients: ingredients,
        servings: servings
      })
      .eq('id', meal_id); 

    if (dbError) {
      throw dbError;
    }

    // --- 5. SEND THE NEW DATA BACK ---
    return new Response(
      JSON.stringify({ 
        newUrl: recipeUrl,
        ingredients: ingredients,
        servings: servings
      }),
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