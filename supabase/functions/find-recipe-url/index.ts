// supabase/functions/find-recipe-url/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- V5 FIND-RECIPE-URL FUNCTION (with image support) ---");

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
    const { meal_id, recipe_name } = await req.json();
    if (!meal_id || !recipe_name) {
      throw new Error("Missing meal_id or recipe_name.");
    }

    // --- 2. GET SECRETS ---
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('APP_SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    const appId = Deno.env.get('EDAMAM_APP_ID');
    const appKey = Deno.env.get('EDAMAM_APP_KEY');

    if (!supabaseUrl || !supabaseKey || !appId || !appKey) {
      console.error("Missing secrets in find-recipe-url:", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        hasAppId: !!appId,
        hasAppKey: !!appKey
      });
      throw new Error("Secrets are not fully set. Check Supabase Dashboard.");
    }

    // Create an authenticated Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("User not authenticated.");
    }

    const simpleUserId = user.id.replaceAll('-', '').substring(0, 8);

    let simpleName = recipe_name;

    // 1. Remove parenthetical descriptions
    simpleName = simpleName.replace(/\([^()]*\)/g, '').trim();

    // 2. Remove secondary ingredients/sides
    simpleName = simpleName.replace(/,.*/, '').trim();

    // 3. Remove prepositional phrases
    simpleName = simpleName.replace(/ on .*/i, '').trim();
    simpleName = simpleName.replace(/ with .*/i, '').trim();
    simpleName = simpleName.replace(/ topped with .*/i, '').trim();
    simpleName = simpleName.replace(/ served with .*/i, '').trim();

    let finalSearchQuery = simpleName.length > 2 ? simpleName : recipe_name;
    console.log("Searching Edamam for:", finalSearchQuery);

    // --- 3. CALL THE EDAMAM API ---
    // Request image field in addition to url, ingredients, and yield
    const buildUrl = (q: string) => `https://api.edamam.com/api/recipes/v2?type=public&q=${encodeURIComponent(q)}&app_id=${appId}&app_key=${appKey}&field=url&field=ingredients&field=yield&field=image&field=images`;

    let searchUrl = buildUrl(finalSearchQuery);
    let edamamResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Edamam-Account-User': simpleUserId }
    });

    if (!edamamResponse.ok) {
      const status = edamamResponse.status;
      const errorDetail = await edamamResponse.text();
      throw new Error(`Failed to call Edamam API. Status: ${status}. Details: ${errorDetail}`);
    }

    let edamamData = await edamamResponse.json();

    // --- RETRY LOGIC: If no hits, try simpler keywords ---
    if (!edamamData.hits || edamamData.hits.length === 0) {
      console.log(`No hits for "${finalSearchQuery}". Retrying with simplified keywords...`);

      const punctuationRemoved = recipe_name.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      const keywords = punctuationRemoved.split(/\s+/).slice(0, 3).join(" ");

      if (keywords !== finalSearchQuery) {
        console.log("Retrying with:", keywords);
        searchUrl = buildUrl(keywords);
        edamamResponse = await fetch(searchUrl, {
          method: 'GET',
          headers: { 'Edamam-Account-User': simpleUserId }
        });

        if (edamamResponse.ok) {
          edamamData = await edamamResponse.json();
        }
      }
    }

    if (!edamamData.hits || edamamData.hits.length === 0) {
      throw new Error(`No recipes found for "${recipe_name}" (searched as "${finalSearchQuery}").`);
    }

    // --- SAFELY EXTRACT DATA FROM THE BEST MATCH ---
    const recipe = edamamData.hits[0]?.recipe;
    const recipeUrl = recipe?.url;
    const ingredients = recipe?.ingredients;
    const servings = recipe?.yield;

    // Extract image URL - try different sizes
    // Edamam provides: image (default), images.THUMBNAIL, images.SMALL, images.REGULAR, images.LARGE
    let imageUrl = recipe?.image || null;

    // Try to get a better quality image if available
    if (recipe?.images) {
      // Prefer REGULAR size (300x300) for meal cards, fall back to others
      imageUrl = recipe.images.REGULAR?.url ||
                 recipe.images.SMALL?.url ||
                 recipe.images.THUMBNAIL?.url ||
                 recipe.image ||
                 null;
    }

    console.log("Found image URL:", imageUrl);

    // Validate that we got the essential data we need
    if (!recipe || !recipeUrl || !ingredients || !servings) {
      throw new Error(`API response for "${recipe_name}" was incomplete or malformed.`);
    }

    // --- 4. SAVE THE URL, INGREDIENTS & IMAGE TO THE DATABASE ---
    const { error: dbError } = await supabaseClient
      .from('meal_plan')
      .update({
        recipe_url: recipeUrl,
        ingredients: ingredients,
        servings: servings,
        image_url: imageUrl
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
        servings: servings,
        imageUrl: imageUrl
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
