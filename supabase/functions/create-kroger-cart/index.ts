// supabase/functions/create-kroger-cart/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- V4 CREATE-KROGER-CART (Dynamic Location) ---");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KROGER_API_BASE = 'https://api.kroger.com/v1';

// Helper function to get a Kroger API access token (unchanged)
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

// --- NEW HELPER FUNCTION: CONVERTS ZIP CODE TO STORE ID ---
async function getLocationId(zipCode: string, token: string): Promise<string> {
    const locationSearchUrl = new URL(`${KROGER_API_BASE}/locations`);
    locationSearchUrl.searchParams.set('filter.zipCode', zipCode);
    locationSearchUrl.searchParams.set('filter.limit', '1');

    const response = await fetch(locationSearchUrl.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
        throw new Error(`Kroger Location Search Failed. Status: ${response.status}`);
    }

    const data = await response.json();
    const locationId = data.data?.[0]?.locationId;

    if (!locationId) {
        throw new Error(`Could not find a Kroger store near ZIP code ${zipCode}.`);
    }
    return locationId;
}
// -----------------------------------------------------------

// Helper function to clean search terms (unchanged)
function cleanSearchTerm(term: string): string {
    if (!term) return '';
    let clean = term;
    clean = clean.replace(/^\s*\d+(\/\d+)?(\.\d+)?\s*(cup|oz|lb|tsp|tbsp|quart|gallon|each)\s*/i, '');
    clean = clean.replace(/^\s*\d+(\/\d+)?(\.\d+)?\s*(bag|can|box|package|jar|container|ct)\s*/i, '');
    clean = clean.replace(/\([^()]*\)/g, '').trim();
    clean = clean.replace(/,.*/, '').trim();
    clean = clean.replace(/ on .*/i, '').trim();
    clean = clean.replace(/ with .*/i, '').trim();
    clean = clean.replace(/\s+/g, ' ').trim();

    const words = clean.split(' ');
    if (words.length > 4) {
        return words.slice(0, 3).join(' ');
    }

    return clean;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // --- 1. SUPABASE AUTHENTICATION & SECRETS ---
        const { items: rawItems, zipCode } = await req.json() as { items: { name: string, quantity: number }[], zipCode: string }; // <-- GET ZIP CODE

        const supabaseUrl = Deno.env.get('APP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('APP_SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
        const clientId = Deno.env.get('KROGER_CLIENT_ID');
        const clientSecret = Deno.env.get('KROGER_CLIENT_SECRET');

        if (!supabaseUrl || !supabaseKey || !clientId || !clientSecret) {
            throw new Error("Missing one or more required secrets (Supabase or Kroger).");
        }

        const supabaseClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.get('Authorization')! } }
        });
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated.");
        }

        // --- 2. KROGER API AUTHENTICATION & LOCATION LOOKUP ---
        const krogerToken = await getKrogerToken(clientId, clientSecret);
        const authHeader = { 'Authorization': `Bearer ${krogerToken}` };

        // ** NEW LOGIC: GET LOCATION ID **
        const locationId = await getLocationId(zipCode, krogerToken);
        console.log(`Searching Inventory at dynamically retrieved Store ID: ${locationId}`);
        // --------------------------------

        // --- 3. PROCESS EACH ITEM: FIND UPC ---
        const itemsWithUpc = [];
        for (const item of rawItems) {
            const cleanedName = cleanSearchTerm(item.name);

            if (!cleanedName) {
                console.warn(`Skipping item: "${item.name}" (Cleaned to empty string)`);
                continue;
            }

            // A. Find the product's UPC code
            const productSearchUrl = new URL(`${KROGER_API_BASE}/products`);
            productSearchUrl.searchParams.set('filter.term', cleanedName);
            productSearchUrl.searchParams.set('filter.locationId', locationId); // Use the DYNAMIC ID
            productSearchUrl.searchParams.set('filter.limit', '1');

            const productResponse = await fetch(productSearchUrl.toString(), { headers: authHeader });

            if (!productResponse.ok) {
                console.warn(`Kroger product search failed for "${item.name}" (Search term: ${cleanedName}).`);
                continue;
            }

            const productData = await productResponse.json();
            const productUpc = productData.data?.[0]?.upc;

            if (productUpc) {
                itemsWithUpc.push({
                    upc: productUpc,
                    quantity: item.quantity,
                    name: item.name,
                    searchUsed: cleanedName
                });
            } else {
                console.warn(`No UPC found for "${item.name}" (Search term: ${cleanedName}).`);
            }
        }

        if (itemsWithUpc.length === 0) {
            return new Response(
                JSON.stringify({ success: false, error: "Could not find any products that match the cleaned search terms at your location." }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

        // --- 4. SEND MAPPED PRODUCTS AND LOCATION ID ---
        return new Response(
            JSON.stringify({
                success: true,
                message: "UPC mapping complete. Cart creation requires user authorization.",
                checkoutUrl: `https://kroger.com/cart?action=view`,
                mappedItems: itemsWithUpc,
                locationId: locationId // Return the ID that was used
            }),
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