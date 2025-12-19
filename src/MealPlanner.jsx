// src/MealPlanner.jsx
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// Helper to group meals by day
function groupMealsByDay(meals) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const grouped = {};

  // Initialize all days
  for (const day of days) {
    grouped[day] = { Breakfast: null, Lunch: null, Dinner: null };
  }

  // Fill in meals from the database
  for (const meal of meals) {
    if (grouped[meal.day_of_week]) {
      grouped[meal.day_of_week][meal.meal_type] = {
        id: meal.id,
        recipe_name: meal.recipe_name,
        recipe_url: meal.recipe_url,
        user_id: meal.user_id
      };
    }
  }
  return grouped;
}

export default function MealPlanner() {
  const [mealPlan, setMealPlan] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [familySize, setFamilySize] = useState(4);
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");

  useEffect(() => {
    fetchPlan();
  }, []);

  // 1. Fetch Plan
  const fetchPlan = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('meal_plan')
      .select('id, day_of_week, meal_type, recipe_name, recipe_url, user_id')
      .order('day_of_week');
      
    if (error) {
      console.error('Error fetching meal plan:', error);
      setError('Could not fetch meal plan.');
    } else {
      setMealPlan(groupMealsByDay(data));
    }
    setLoading(false);
  };

  // 2. Generate New Plan (AI)
  const generateNewPlan = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke('meal-planner', {
      body: { familySize, dietaryRestrictions }
    });

    if (error) {
      console.error('Error generating plan:', error);
      setError('Could not generate new plan. Please try again.');
    } else {
      console.log('Generate response:', data);
      await fetchPlan(); 
    }
    setLoading(false);
  };
  
  // 3. Handle Text Change
  const handleMealNameChange = (day, mealType, newName) => {
    setMealPlan(prevPlan => ({
      ...prevPlan,
      [day]: {
        ...prevPlan[day],
        [mealType]: {
          ...prevPlan[day][mealType],
          recipe_name: newName,
          recipe_url: null 
        }
      }
    }));
  };

  // 4. Save Changes
  const saveChanges = async () => {
    setLoading(true);
    setError(null);
    
    const updates = [];
    Object.values(mealPlan).forEach(day => {
      if (day.Breakfast) updates.push(day.Breakfast);
      if (day.Lunch) updates.push(day.Lunch);
      if (day.Dinner) updates.push(day.Dinner);
    });

    const { error } = await supabase
      .from('meal_plan')
      .upsert(updates, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('Error saving changes:', error);
      setError('Could not save your changes.');
    } else {
      await fetchPlan(); 
    }
    setLoading(false);
  };

  // 5. Find Recipe URL (AI)
  const findRecipe = async (day, mealType) => {
    setLoading(true);
    setError(null);
    
    const meal = mealPlan[day][mealType];
    if (!meal) return;

    await saveChanges();
    
    const { data, error } = await supabase.functions.invoke('find-recipe-url', {
      body: { meal_id: meal.id, recipe_name: meal.recipe_name }
    });

    if (error) {
      console.error('Error finding recipe:', error);
      setError('Could not find recipe.');
    } else if (data.newUrl) {
      setMealPlan(prevPlan => ({
        ...prevPlan,
        [day]: {
          ...prevPlan[day],
          [mealType]: {
            ...prevPlan[day][mealType],
            recipe_url: data.newUrl,
          }
        }
      }));
    }
    setLoading(false);
  };

  // --- 6. NEW FUNCTION: ADD TO SHOPPING LIST ---
  const addIngredientsToShoppingList = async () => {
    setLoading(true);
    setError(null);
    
    // Call the new 'generate-shopping-list' function
    const { data, error } = await supabase.functions.invoke('generate-shopping-list', {
      body: { familySize } // Send family size so AI knows how to scale ingredients
    });

    if (error) {
      console.error('Error adding to list:', error);
      setError('Could not update shopping list. Check logs.');
    } else {
      alert("Success! Added " + data.count + " items to your Shopping List.");
      // Optional: You could trigger a reload of the shopping list component here if they were connected
    }
    setLoading(false);
  };

  const days = Object.keys(mealPlan);

  const renderMealCell = (day, mealType) => {
    const meal = mealPlan[day]?.[mealType];
    
    if (!meal) {
      return <td style={{ border: '1px solid #ccc', padding: '8px' }}>...</td>;
    }

    return (
      <td style={{ border: '1px solid #ccc', padding: '8px', verticalAlign: 'top' }}>
        <input
          type="text"
          style={{ width: '100%', border: 'none', padding: '0', boxSizing: 'border-box', fontSize: '16px' }}
          value={meal.recipe_name || ''}
          onChange={(e) => handleMealNameChange(day, mealType, e.target.value)}
        />
        
        <button 
          onClick={() => findRecipe(day, mealType)} 
          disabled={loading || !meal.id}
          style={{ fontSize: '10px', padding: '2px 4px', marginTop: '5px' }}
        >
          {loading ? '...' : 'Find Recipe'}
        </button>

        {meal.recipe_url && (
          <div style={{marginTop: '5px'}}>
            <a href={meal.recipe_url} target="_blank" rel="noopener noreferrer">
              View Recipe
            </a>
          </div>
        )}
      </td>
    );
  };

  return (
    <div style={{ marginTop: '30px' }}>
      <h2>Weekly Meal Plan</h2>
      <div style={{ margin: '20px 0' }}>
        <div>
          <label htmlFor="family-size">Family Size: </label>
          <input 
            type="number" 
            id="family-size"
            min="1"
            value={familySize}
            onChange={(e) => setFamilySize(Number(e.target.value))}
          />
        </div>
        <div style={{ marginTop: '10px' }}>
          <label htmlFor="restrictions">Dietary Restrictions: </label>
          <input 
            type="text" 
            id="restrictions"
            placeholder="e.g., gluten-free, vegetarian"
            value={dietaryRestrictions}
            onChange={(e) => setDietaryRestrictions(e.target.value)}
          />
        </div>
      </div>
      
      <button onClick={generateNewPlan} disabled={loading}>
        {loading ? 'Generating...' : 'Generate New Weekly Plan'}
      </button>
      <button onClick={saveChanges} disabled={loading} style={{ marginLeft: '10px' }}>
        {loading ? 'Saving...' : 'Save Changes'}
      </button>

      {/* --- NEW GREEN BUTTON --- */}
      <div style={{ marginTop: '15px' }}>
        <button 
          onClick={addIngredientsToShoppingList} 
          disabled={loading}
          style={{ 
            backgroundColor: '#2e7d32', // Green
            color: 'white', 
            padding: '10px 20px', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          {loading ? 'Processing...' : '➕ Add Weekly Ingredients to Shopping List'}
        </button>
      </div>
      {/* ------------------------ */}
      
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {loading && days.length === 0 && <p>Loading meal plan...</p>}
      
      {!loading && days.length === 0 && (
        <p>No meal plan found. Generate one!</p>
      )}

      <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>Day</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>Breakfast</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>Lunch</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>Dinner</th>
          </tr>
        </thead>
        <tbody>
          {days.map(day => (
            <tr key={day}>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}><strong>{day}</strong></td>
              {renderMealCell(day, 'Breakfast')}
              {renderMealCell(day, 'Lunch')}
              {renderMealCell(day, 'Dinner')}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}