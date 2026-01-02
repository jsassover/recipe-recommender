// src/MealPlanner.jsx
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// Meal type icons for placeholder
const MEAL_ICONS = {
  'Breakfast': '🍳',
  'Lunch': '🥗',
  'Dinner': '🍽️'
};

// Helper to group meals by day
function groupMealsByDay(meals) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const grouped = {};

  for (const day of days) {
    grouped[day] = { Breakfast: null, Lunch: null, Dinner: null };
  }

  for (const meal of meals) {
    if (grouped[meal.day_of_week]) {
      grouped[meal.day_of_week][meal.meal_type] = {
        id: meal.id,
        recipe_name: meal.recipe_name,
        recipe_url: meal.recipe_url,
        image_url: meal.image_url,
        user_id: meal.user_id
      };
    }
  }
  return grouped;
}

// Loading Skeleton Component
function MealPlanSkeleton() {
  return (
    <div className="meal-plan-grid">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="day-card">
          <div className="day-header">
            <div className="skeleton" style={{ height: '20px', width: '80px' }}></div>
          </div>
          <div className="day-meals">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="meal-cell">
                <div className="skeleton skeleton-text" style={{ width: '60px', height: '12px' }}></div>
                <div className="skeleton" style={{ height: '80px', marginBottom: '8px' }}></div>
                <div className="skeleton" style={{ height: '36px' }}></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MealPlanner() {
  const [mealPlan, setMealPlan] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [familySize, setFamilySize] = useState(4);
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [loadingMealId, setLoadingMealId] = useState(null);

  useEffect(() => {
    fetchPlan();
  }, []);

  const fetchPlan = async () => {
    setError(null);
    const { data, error } = await supabase
      .from('meal_plan')
      .select('id, day_of_week, meal_type, recipe_name, recipe_url, image_url, user_id')
      .order('day_of_week');

    if (error) {
      console.error('Error fetching meal plan:', error);
      setError('Could not fetch meal plan.');
    } else {
      setMealPlan(groupMealsByDay(data));
    }
    setInitialLoading(false);
  };

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

  const handleMealNameChange = (day, mealType, newName) => {
    setMealPlan(prevPlan => ({
      ...prevPlan,
      [day]: {
        ...prevPlan[day],
        [mealType]: {
          ...prevPlan[day][mealType],
          recipe_name: newName,
          recipe_url: null,
          image_url: null
        }
      }
    }));
  };

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

  const findRecipe = async (day, mealType) => {
    const meal = mealPlan[day][mealType];
    if (!meal) return;

    setLoadingMealId(meal.id);
    setError(null);

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
            image_url: data.imageUrl || null
          }
        }
      }));
    }
    setLoadingMealId(null);
  };

  const addIngredientsToShoppingList = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.functions.invoke('generate-shopping-list', {
      body: { familySize }
    });

    if (error) {
      console.error('Error adding to list:', error);
      setError('Could not update shopping list. Check logs.');
    } else {
      alert("Success! Added " + data.count + " items to your Shopping List.");
    }
    setLoading(false);
  };

  const days = Object.keys(mealPlan);

  const renderMealCell = (day, mealType) => {
    const meal = mealPlan[day]?.[mealType];
    const isLoadingThis = loadingMealId === meal?.id;

    if (!meal) {
      return (
        <div className="meal-cell">
          <span className="meal-type-label">{mealType}</span>
          <div className="meal-image-container">
            <div className="meal-image-placeholder">{MEAL_ICONS[mealType]}</div>
          </div>
          <div className="skeleton" style={{ height: '36px' }}></div>
        </div>
      );
    }

    return (
      <div className="meal-cell">
        <span className="meal-type-label">{mealType}</span>

        {/* Meal Image */}
        <div className="meal-image-container">
          {meal.image_url ? (
            <img
              src={meal.image_url}
              alt={meal.recipe_name}
              className="meal-image"
              loading="lazy"
            />
          ) : (
            <div className="meal-image-placeholder">{MEAL_ICONS[mealType]}</div>
          )}
        </div>

        <input
          type="text"
          className="meal-name-input"
          value={meal.recipe_name || ''}
          onChange={(e) => handleMealNameChange(day, mealType, e.target.value)}
          placeholder="Enter meal name..."
        />

        <div className="meal-cell-actions">
          <button
            onClick={() => findRecipe(day, mealType)}
            disabled={loading || isLoadingThis || !meal.id}
            className="btn-secondary btn-sm"
          >
            {isLoadingThis ? (
              <>
                <span className="loading-spinner"></span>
                Finding...
              </>
            ) : (
              'Find Recipe'
            )}
          </button>
        </div>

        {meal.recipe_url && (
          <a
            href={meal.recipe_url}
            target="_blank"
            rel="noopener noreferrer"
            className="recipe-link"
          >
            View Recipe →
          </a>
        )}
      </div>
    );
  };

  return (
    <section className="meal-planner-section">
      <h2>Weekly Meal Plan</h2>

      {/* Settings Panel */}
      <div className="meal-plan-settings">
        <div className="setting-field">
          <label htmlFor="family-size">Family Size</label>
          <input
            type="number"
            id="family-size"
            min="1"
            value={familySize}
            onChange={(e) => setFamilySize(Number(e.target.value))}
          />
        </div>
        <div className="setting-field">
          <label htmlFor="restrictions">Dietary Restrictions</label>
          <input
            type="text"
            id="restrictions"
            placeholder="e.g., gluten-free, vegetarian"
            value={dietaryRestrictions}
            onChange={(e) => setDietaryRestrictions(e.target.value)}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="meal-plan-actions">
        <button
          onClick={generateNewPlan}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? (
            <>
              <span className="loading-spinner"></span>
              Generating...
            </>
          ) : (
            'Generate New Plan'
          )}
        </button>
        <button
          onClick={saveChanges}
          disabled={loading}
          className="btn-secondary"
        >
          Save Changes
        </button>
        <button
          onClick={addIngredientsToShoppingList}
          disabled={loading}
          className="btn-primary"
          style={{ marginLeft: 'auto' }}
        >
          Add Ingredients to List
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Meal Plan Grid */}
      {initialLoading ? (
        <MealPlanSkeleton />
      ) : days.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <h3>No meal plan yet</h3>
          <p>Click "Generate New Plan" to create your weekly meals!</p>
        </div>
      ) : (
        <div className="meal-plan-grid">
          {days.map(day => (
            <div key={day} className="day-card">
              <div className="day-header">
                <h3>{day}</h3>
              </div>
              <div className="day-meals">
                {renderMealCell(day, 'Breakfast')}
                {renderMealCell(day, 'Lunch')}
                {renderMealCell(day, 'Dinner')}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
