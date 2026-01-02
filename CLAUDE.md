# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server with HMR
npm run build        # Production build
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

Supabase Edge Functions are deployed via the Supabase CLI (not npm scripts).

## Architecture Overview

This is an AI-powered meal planning and shopping list application.

**Frontend:** React 18 with Vite
**Backend:** Supabase (PostgreSQL + Edge Functions in Deno/TypeScript)
**AI:** Google Gemini API (meal generation, ingredient extraction)
**External APIs:** Edamam (recipe search), Instacart (checkout)

### Data Flow

```
React Frontend → Supabase Auth → Edge Functions → External APIs
                                       ↓
                              Supabase PostgreSQL
```

### Database Tables

- `shopping_list`: id, name, quantity, user_id
- `meal_plan`: id, user_id, day_of_week, meal_type, recipe_name, recipe_url, ingredients (JSON), servings

### Edge Functions (supabase/functions/)

| Function | Purpose |
|----------|---------|
| `meal-planner` | Generates 7-day meal plans via Gemini AI |
| `regenerate-meal` | Regenerates a single meal via Gemini AI |
| `find-recipe-url` | Searches Edamam for recipe URLs |
| `generate-shopping-list` | Extracts/consolidates ingredients from meal plan |
| `add-meal-ingredients` | Adds a single meal's ingredients to shopping list |
| `add-ingredients-to-list` | Scales recipe ingredients by family size |
| `checkout-handler` | Creates Instacart checkout cart |

### Frontend Components (src/)

- `App.jsx`: Main app with auth, shopping list CRUD, Instacart integration
- `MealPlanner.jsx`: Weekly meal plan UI with Gemini generation and recipe URL lookup
- `supabaseClient.js`: Supabase client initialization

## Environment Variables

**Frontend (.env):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Edge Functions (Supabase Dashboard secrets):**
- `GEMINI_API_KEY`
- `EDAMAM_APP_ID`, `EDAMAM_APP_KEY`
- `INSTACART_API_KEY`
- `APP_SUPABASE_URL`, `APP_SUPABASE_ANON_KEY`

## Key Patterns

- All edge functions verify JWT from Authorization header
- Edge functions use `gemini-flash-latest` model for cost efficiency
- Recipe names are cleaned (remove parentheticals, articles) before Edamam searches
- Shopping list merges use lowercase key maps for deduplication
