// supabase/functions/checkout-handler/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- REAL INSTACART CHECKOUT FUNCTION LOADED ---");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This matches the format Instacart expects
interface InstacartLineItem {
  name: string;
  quantity: number;
  unit: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. GET SECRETS
    const instacartKey = Deno.env.get('INSTACART_API_KEY');
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL');
    const supabaseKey = Deno.env.get('APP_SUPABASE_ANON_KEY');

    if (!instacartKey || !supabaseUrl || !supabaseKey) {
      throw new Error("Missing API Keys (Instacart or Supabase).");
    }

    // 2. AUTHENTICATE USER
    // We need to know WHO is ordering to pull THEIR shopping list
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError) throw authError;

    // 3. FETCH SHOPPING LIST
    const { data: items, error: dbError } = await supabaseClient
      .from('shopping_list')
      .select('name, quantity')
      .eq('user_id', user.id);

    if (dbError) throw dbError;
    
    if (!items || items.length === 0) {
      throw new Error("Your shopping list is empty! Add items before ordering.");
    }

    // 4. FORMAT FOR INSTACART
    // We convert your DB rows into the JSON format Instacart requires
    const lineItems: InstacartLineItem[] = items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: 'each' // Defaulting to 'each' is safest for general lists
    }));

    console.log(`Sending ${lineItems.length} items to Instacart...`);

    // 5. CALL INSTACART API
    // This endpoint creates a "Landing Page" with your items pre-filled
    const instacartResponse = await fetch('https://connect.instacart.com/idp/v1/products/products_link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${instacartKey}`
      },
      body: JSON.stringify({
        title: "My Weekly Grocery List",
        line_items: lineItems
      })
    });

    const instacartData = await instacartResponse.json();

    if (!instacartResponse.ok) {
      console.error("Instacart Error:", instacartData);
      throw new Error(`Instacart API Error: ${instacartData.message || 'Unknown error'}`);
    }

    // 6. RETURN THE CHECKOUT URL
    // Instacart returns a 'url' that we send back to the frontend
    const checkoutUrl = instacartData.url;
    
    console.log("Success! Checkout URL generated:", checkoutUrl);

    return new Response(
      JSON.stringify({ checkoutUrl: checkoutUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("Function Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});