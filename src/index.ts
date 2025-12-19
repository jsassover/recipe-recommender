// supabase/functions/create-kroger-cart/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- V1 CREATE-KROGER-CART ---");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KROGER_API_BASE = 'https://api.kroger.com/v1';

interface CartItem {
  name: string;
  quantity: number;
}

// Helper function to get a Kroger API access token
async function getKrogerToken(clientId: string, clientSecret: string): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${KROGER_API_BASE}/connect/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=product.compact',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Kroger Auth Failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- 1. AUTHENTICATION & SETUP ---
    const { items } = await req.json() as { items: CartItem[] };
    if (!items || items.length === 0) {
      throw new Error("No items provided to add to cart.");
    }

    // Get secrets
    const clientId = Deno.env.get('KROGER_CLIENT_ID');
    const clientSecret = Deno.env.get('KROGER_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new Error("Kroger API credentials are not set.");
    }

    // Authenticate with Kroger
    const krogerToken = await getKrogerToken(clientId, clientSecret);
    const authHeader = { 'Authorization': `Bearer ${krogerToken}` };

    // --- 2. FIND A NEARBY STORE (Hardcoded for now, can be dynamic later) ---
    // To add dynamic location, get lat/lon from user and pass to this function
    const locationId = '70300785'; // Example: A Kroger in Cincinnati, OH
    console.log(`Using Kroger Location ID: ${locationId}`);

    // --- 3. PROCESS EACH ITEM: FIND UPC AND ADD TO CART ---
    const itemsToAdd = [];
    for (const item of items) {
      // A. Find the product's UPC code
      const productSearchUrl = new URL(`${KROGER_API_BASE}/products`);
      productSearchUrl.searchParams.set('filter.term', item.name);
      productSearchUrl.searchParams.set('filter.locationId', locationId);
      productSearchUrl.searchParams.set('filter.limit', '1'); // Get the most likely match

      const productResponse = await fetch(productSearchUrl.toString(), { headers: authHeader });

      if (!productResponse.ok) {
        console.warn(`Kroger product search failed for "${item.name}"`);
        continue; // Skip this item if search fails
      }

      const productData = await productResponse.json();
      const productUpc = productData.data?.[0]?.upc;

      if (productUpc) {
        console.log(`Found UPC ${productUpc} for "${item.name}"`);
        itemsToAdd.push({
          upc: productUpc,
          quantity: item.quantity,
        });
      } else {
        console.warn(`No UPC found for "${item.name}". It will not be added to the cart.`);
      }
    }

    if (itemsToAdd.length === 0) {
      throw new Error("Could not find any of the selected products at Kroger.");
    }

    // B. Add all found items to the cart in one call
    const addToCartUrl = `${KROGER_API_BASE}/cart/add`;
    const cartResponse = await fetch(addToCartUrl, {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemsToAdd }),
    });

    if (!cartResponse.ok) {
      const errorBody = await cartResponse.text();
      throw new Error(`Failed to add items to Kroger cart: ${errorBody}`);
    }

    console.log("Successfully added items to Kroger cart.");

    // --- 4. SEND SUCCESS RESPONSE ---
    return new Response(
      JSON.stringify({ success: true, itemsAdded: itemsToAdd.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("Error in create-kroger-cart function:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
