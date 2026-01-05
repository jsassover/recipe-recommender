# Project Architecture: AI Meal Planner & Shopping List

## Tech Stack

- **Frontend:** React 18 (Vite)
- **Backend:** Supabase (PostgreSQL + Edge Functions in Deno/TypeScript)
- **AI:** Google Gemini API (`gemini-flash-latest`)
- **External APIs:** Edamam (recipe search), Instacart Developer Platform

## Data Flow

```
React Frontend → Supabase Auth → Edge Functions → External APIs
                                       ↓
                              Supabase PostgreSQL
```

## Database Schema (Supabase)

### Table: `shopping_list`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int8 (Identity) | Primary Key |
| `name` | text | Item name |
| `quantity` | text | Amount (e.g., "2 lbs", "3 cups") |
| `category` | text | Category for grouping (Produce, Dairy, etc.) |
| `user_id` | uuid | Foreign key to auth.users |

### Table: `meal_plan`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int8 (Identity) | Primary Key |
| `user_id` | uuid | Foreign key to auth.users |
| `day_of_week` | text | "Monday", "Tuesday", etc. |
| `meal_type` | text | "Breakfast", "Lunch", "Dinner" |
| `recipe_name` | text | Name of the meal |
| `recipe_url` | text | Link to online recipe |
| `ingredients` | jsonb | Array of ingredient objects |
| `servings` | int | Number of servings |
| `image_url` | text | Recipe thumbnail URL |

### Table: `pantry`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int8 (Identity) | Primary Key |
| `name` | text | Item name (unique per user) |
| `quantity` | int | Quantity on hand |
| `category` | text | Category (default: "Other") |
| `user_id` | uuid | Foreign key to auth.users |
| `created_at` | timestamptz | Creation timestamp |

## Edge Functions

All edge functions are located in `supabase/functions/` and verify JWT from the Authorization header.

| Function | Purpose | Input |
|----------|---------|-------|
| `meal-planner` | Generate 7-day meal plan via Gemini AI | `familySize`, `dietaryRestrictions` |
| `regenerate-meal` | Regenerate a single meal via Gemini AI | `mealId`, `dayOfWeek`, `mealType` |
| `find-recipe-url` | Search Edamam for recipe URL and image | `meal_id`, `recipe_name` |
| `generate-shopping-list` | Extract/consolidate ingredients from meal plan | `familySize` |
| `add-meal-ingredients` | Add a single meal's ingredients to shopping list | `mealId` |
| `add-ingredients-to-list` | Scale recipe ingredients by family size | `ingredients`, `servings`, `familySize` |
| `checkout-handler` | Create Instacart checkout cart | (reads from shopping_list) |

## Frontend Components

```
src/
├── App.jsx                 # Main app with Supabase Auth and React Router
├── MealPlanner.jsx         # Weekly meal plan UI with generation controls
├── supabaseClient.js       # Supabase client initialization
├── pages/
│   ├── MealPlanPage.jsx        # Meal planning tab wrapper
│   ├── ShoppingListPage.jsx    # Shopping list with category grouping
│   └── PantryPage.jsx          # Pantry management UI
└── utils/
    └── categories.js       # Shared category constants
```

## Key Patterns

- **Authentication:** All edge functions verify JWT from Authorization header
- **AI Model:** Uses `gemini-flash-latest` for cost efficiency
- **Recipe Search:** Recipe names are cleaned (remove parentheticals, articles) before Edamam searches
- **Deduplication:** Shopping list merges use lowercase key maps
- **Row Level Security:** All tables have RLS policies restricting access to user's own data

## Environment Variables

### Frontend (.env)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Edge Functions (Supabase Dashboard secrets)

```
GEMINI_API_KEY=
EDAMAM_APP_ID=
EDAMAM_APP_KEY=
INSTACART_API_KEY=
APP_SUPABASE_URL=
APP_SUPABASE_ANON_KEY=
```
