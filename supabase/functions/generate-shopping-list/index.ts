// supabase/functions/generate-shopping-list/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- GENERATE SHOPPING LIST FUNCTION V2 (with categories) ---");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShoppingItem {
  name: string;
  quantity: number;
  category: string;
}

// Category mapping for common ingredients
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Produce': [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'strawberry', 'blueberry', 'raspberry',
    'mango', 'pineapple', 'watermelon', 'melon', 'peach', 'pear', 'plum', 'cherry', 'avocado',
    'tomato', 'potato', 'onion', 'garlic', 'carrot', 'celery', 'broccoli', 'cauliflower',
    'spinach', 'lettuce', 'kale', 'cabbage', 'cucumber', 'zucchini', 'squash', 'pepper',
    'bell pepper', 'jalapeño', 'serrano', 'chili', 'mushroom', 'corn', 'pea', 'bean sprout',
    'asparagus', 'artichoke', 'beet', 'radish', 'turnip', 'eggplant', 'ginger', 'cilantro',
    'parsley', 'basil', 'mint', 'dill', 'rosemary', 'thyme', 'oregano', 'chive', 'scallion',
    'green onion', 'shallot', 'leek', 'fennel', 'arugula', 'romaine', 'fruit', 'vegetable',
    'salad', 'herb', 'fresh'
  ],
  'Meat & Seafood': [
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'bacon', 'sausage', 'ham',
    'steak', 'ground beef', 'ground turkey', 'ground pork', 'ribs', 'brisket',
    'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'fish', 'cod', 'tilapia', 'halibut',
    'trout', 'mahi', 'scallop', 'mussel', 'clam', 'oyster', 'anchovy', 'sardine',
    'meat', 'poultry', 'seafood', 'filet', 'tenderloin', 'wing', 'thigh', 'breast',
    'drumstick', 'chorizo', 'prosciutto', 'pepperoni', 'salami'
  ],
  'Dairy & Eggs': [
    'milk', 'cream', 'half and half', 'butter', 'cheese', 'yogurt', 'sour cream',
    'cottage cheese', 'cream cheese', 'mozzarella', 'cheddar', 'parmesan', 'feta',
    'ricotta', 'brie', 'gouda', 'swiss', 'provolone', 'goat cheese', 'blue cheese',
    'egg', 'whipped cream', 'heavy cream', 'buttermilk', 'ghee', 'dairy'
  ],
  'Bakery & Bread': [
    'bread', 'bagel', 'croissant', 'muffin', 'roll', 'bun', 'tortilla', 'pita',
    'naan', 'baguette', 'sourdough', 'ciabatta', 'focaccia', 'english muffin',
    'wrap', 'flatbread', 'crouton', 'breadcrumb', 'panko', 'cake', 'pie', 'pastry',
    'donut', 'danish', 'scone'
  ],
  'Pantry': [
    'rice', 'pasta', 'noodle', 'spaghetti', 'penne', 'macaroni', 'fettuccine',
    'flour', 'sugar', 'brown sugar', 'powdered sugar', 'honey', 'maple syrup',
    'oil', 'olive oil', 'vegetable oil', 'coconut oil', 'sesame oil',
    'vinegar', 'balsamic', 'soy sauce', 'fish sauce', 'worcestershire',
    'ketchup', 'mustard', 'mayonnaise', 'hot sauce', 'sriracha', 'salsa',
    'tomato sauce', 'tomato paste', 'canned tomato', 'broth', 'stock',
    'beans', 'black beans', 'kidney beans', 'chickpea', 'lentil',
    'peanut butter', 'almond butter', 'jam', 'jelly', 'nutella',
    'cereal', 'oatmeal', 'oat', 'granola', 'quinoa', 'couscous', 'barley',
    'nut', 'almond', 'walnut', 'pecan', 'cashew', 'peanut', 'pistachio',
    'seed', 'sunflower', 'pumpkin seed', 'chia', 'flax',
    'chocolate', 'cocoa', 'vanilla', 'extract', 'baking soda', 'baking powder',
    'yeast', 'cornstarch', 'spice', 'seasoning', 'salt', 'pepper', 'cumin',
    'paprika', 'cinnamon', 'nutmeg', 'turmeric', 'curry', 'chili powder',
    'dried', 'canned', 'jar'
  ],
  'Frozen': [
    'frozen', 'ice cream', 'frozen yogurt', 'popsicle', 'frozen fruit',
    'frozen vegetable', 'frozen pizza', 'frozen meal', 'ice'
  ],
  'Beverages': [
    'water', 'juice', 'orange juice', 'apple juice', 'soda', 'cola', 'sprite',
    'coffee', 'tea', 'milk', 'almond milk', 'oat milk', 'soy milk',
    'wine', 'beer', 'liquor', 'cocktail', 'smoothie', 'lemonade', 'energy drink'
  ]
};

function categorizeIngredient(ingredientName: string): string {
  const lowerName = ingredientName.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return category;
      }
    }
  }

  return 'Other';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. SETUP & AUTH
    const supabaseUrl = Deno.env.get('APP_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('APP_SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

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
      4. Ignore basic pantry staples like salt, pepper, and cooking oil.
      5. For each item, assign a category from: Produce, Meat & Seafood, Dairy & Eggs, Bakery & Bread, Pantry, Frozen, Beverages, Other.

      Respond ONLY with a valid JSON object in this format:
      {
        "items": [
          { "name": "Serrano Chili", "quantity": 2, "category": "Produce" },
          { "name": "Chicken Breast", "quantity": 2, "category": "Meat & Seafood" },
          { "name": "Milk", "quantity": 1, "category": "Dairy & Eggs" }
        ]
      }
    `;

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
    const { data: currentList } = await supabaseClient
      .from('shopping_list')
      .select('name, quantity, category, id')
      .eq('user_id', user.id);

    const processingList = new Map();

    // Load current DB items into map
    currentList?.forEach(item => {
      processingList.set(item.name.toLowerCase(), {
        name: item.name,
        quantity: item.quantity,
        category: item.category || categorizeIngredient(item.name),
        id: item.id,
        user_id: user.id
      });
    });

    // Add/Update with AI ingredients
    newIngredients.forEach(newItem => {
      const key = newItem.name.toLowerCase();
      // Use AI category, but fall back to our categorizer if AI didn't provide one
      const category = newItem.category || categorizeIngredient(newItem.name);

      if (processingList.has(key)) {
        const existing = processingList.get(key);
        existing.quantity += newItem.quantity;
        // Update category if we now have a better one from AI
        if (category && category !== 'Other') {
          existing.category = category;
        }
      } else {
        processingList.set(key, {
          name: newItem.name,
          quantity: newItem.quantity,
          category: category,
          user_id: user.id
        });
      }
    });

    // SEPARATE INTO "INSERTS" AND "UPDATES"
    const itemsToUpdate: any[] = [];
    const itemsToInsert: any[] = [];

    for (const item of processingList.values()) {
      if (item.id) {
        itemsToUpdate.push(item);
      } else {
        itemsToInsert.push(item);
      }
    }

    // 5. SAVE TO DATABASE
    if (itemsToUpdate.length > 0) {
      const { error: updateError } = await supabaseClient
        .from('shopping_list')
        .upsert(itemsToUpdate);

      if (updateError) throw updateError;
    }

    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('shopping_list')
        .insert(itemsToInsert);

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
