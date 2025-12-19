# Project Architecture: AI Meal Planner & Shopping List

## Tech Stack
- **Frontend:** React (Vite)
- **Backend:** Supabase (PostgreSQL)
- **API:** Supabase Edge Functions (Deno/TypeScript)
- **AI:** Google Gemini API
- **External:** Instacart Developer Platform API

## Database Schema (Supabase)

### Table: `shopping_list`
- `id` (int8, Identity): Primary Key
- `name` (text): Item name
- `quantity` (int8): Item count
- `user_id` (uuid): Foreign key to auth.users

### Table: `meal_plan`
- `id` (int8, Identity): Primary Key
- `user_id` (uuid): Foreign key to auth.users
- `day_of_week` (text): "Monday", etc.
- `meal_type` (text): "Breakfast", "Lunch", "Dinner"
- `recipe_name` (text): Name of the meal
- `recipe_url` (text): Link to online recipe

## Edge Functions

1.  **`meal-planner`**
    - **Input:** `familySize`, `dietaryRestrictions`
    - **Logic:** Calls Gemini AI to generate a 7-day meal plan.
    - **Output:** Saves plan to `meal_plan` table.

2.  **`find-recipe-url`**
    - **Input:** `meal_id`, `recipe_name`
    - **Logic:** Calls Gemini AI to find a real URL for a specific meal.
    - **Output:** Updates `meal_plan` table with the URL.

3.  **`generate-shopping-list`**
    - **Input:** `familySize`
    - **Logic:** Reads entire `meal_plan`, sends to Gemini AI to extract/sum ingredients (e.g. "3x 0.5 onion = 2 onions"), merges with existing `shopping_list`.
    - **Output:** Upserts items to `shopping_list`.

4.  **`checkout-handler`**
    - **Logic:** Reads `shopping_list`, authenticates with Instacart (Client Credentials), creates a cart.
    - **Output:** Returns Instacart checkout URL.

## Current Status
- Frontend has `MealPlanner.jsx` and `App.jsx`.
- Auth is handled by Supabase Auth UI.
- All Edge Functions are deployed.
- **Pending:** Fixing Instacart "Unauthorized" error by switching to Client Credentials flow.