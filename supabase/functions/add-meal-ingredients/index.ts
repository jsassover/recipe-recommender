// supabase/functions/add-meal-ingredients/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- ADD-MEAL-INGREDIENTS FUNCTION V1 ---");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    'coffee', 'tea', 'almond milk', 'oat milk', 'soy milk',
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

    const { meal_id, familySize } = await req.json();

    if (!meal_id) {
      throw new Error("Missing meal_id parameter.");
    }

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Secrets are not fully set. Check Supabase Dashboard.");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError) throw authError;

    // 2. GET THE SPECIFIC MEAL'S INGREDIENTS
    const { data: meal, error: mealError } = await supabaseClient
      .from('meal_plan')
      .select('recipe_name, ingredients, servings')
      .eq('id', meal_id)
      .eq('user_id', user.id)
      .single();

    if (mealError) throw mealError;
    if (!meal) throw new Error("Meal not found.");
    if (!meal.ingredients || meal.ingredients.length === 0) {
      throw new Error("No ingredients found for this meal. Click 'Find Recipe' first to fetch ingredients.");
    }

    // 3. PROCESS INGREDIENTS FROM EDAMAM FORMAT
    // Edamam ingredients format: { text: "1 cup flour", food: "flour", quantity: 1, measure: "cup", weight: 125 }
    const scaleFactor = (familySize || 4) / (meal.servings || 4);

    const processedIngredients: { name: string; quantity: number; category: string }[] = [];

    for (const ing of meal.ingredients) {
      const name = ing.food || ing.text || 'Unknown ingredient';
      // Scale quantity and round up
      const rawQuantity = (ing.quantity || 1) * scaleFactor;
      const quantity = Math.ceil(rawQuantity);
      const category = categorizeIngredient(name);

      processedIngredients.push({ name, quantity, category });
    }

    // 4. GET CURRENT SHOPPING LIST AND MERGE
    const { data: currentList } = await supabaseClient
      .from('shopping_list')
      .select('name, quantity, category, id')
      .eq('user_id', user.id);

    const processingMap = new Map();

    // Load current items
    currentList?.forEach(item => {
      processingMap.set(item.name.toLowerCase(), {
        name: item.name,
        quantity: item.quantity,
        category: item.category || categorizeIngredient(item.name),
        id: item.id,
        user_id: user.id
      });
    });

    // Merge new ingredients
    processedIngredients.forEach(newItem => {
      const key = newItem.name.toLowerCase();

      if (processingMap.has(key)) {
        const existing = processingMap.get(key);
        existing.quantity += newItem.quantity;
        if (newItem.category && newItem.category !== 'Other') {
          existing.category = newItem.category;
        }
      } else {
        processingMap.set(key, {
          name: newItem.name,
          quantity: newItem.quantity,
          category: newItem.category,
          user_id: user.id
        });
      }
    });

    // 5. SEPARATE INTO UPDATES AND INSERTS
    const itemsToUpdate: any[] = [];
    const itemsToInsert: any[] = [];

    for (const item of processingMap.values()) {
      if (item.id) {
        itemsToUpdate.push(item);
      } else {
        itemsToInsert.push(item);
      }
    }

    // 6. SAVE TO DATABASE
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
        message: `Added ingredients from "${meal.recipe_name}" to shopping list!`,
        count: processedIngredients.length
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
