# Future Features & Backend Requirements

This document tracks UI/UX features from the Mealime-inspired redesign that will require backend or Supabase changes.

## Database Changes Needed

### 1. Shopping List Categories
**Feature:** Categorize items (Produce, Dairy, Meat, Pantry, etc.)
**Database Change:**
```sql
ALTER TABLE shopping_list ADD COLUMN category TEXT;
```
**Edge Function:** Update `generate-shopping-list` to assign categories based on ingredient type.

### 2. Recipe Images/Thumbnails
**Feature:** Display meal photos in the meal plan cards
**Database Change:**
```sql
ALTER TABLE meal_plan ADD COLUMN image_url TEXT;
```
**Edge Function:** Update `find-recipe-url` to also extract and store recipe image from Edamam API response.

### 3. User Preferences Persistence
**Feature:** Save family size, dietary restrictions per user (not just session state)
**Database Change:**
```sql
CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  family_size INTEGER DEFAULT 4,
  dietary_restrictions TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Meal Plan History
**Feature:** View previous meal plans (Mealime Pro feature)
**Database Change:**
```sql
ALTER TABLE meal_plan ADD COLUMN week_of DATE;
ALTER TABLE meal_plan ADD COLUMN is_current BOOLEAN DEFAULT TRUE;
```
**Note:** Instead of deleting old plans, mark `is_current = FALSE` when generating new.

### 5. Recipe Favorites
**Feature:** Save favorite recipes for quick re-use
**Database Change:**
```sql
CREATE TABLE favorite_recipes (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  recipe_name TEXT NOT NULL,
  recipe_url TEXT,
  ingredients JSONB,
  servings INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 6. Shopping Item "Checked" State
**Feature:** Persist checked/unchecked state (currently only visual)
**Database Change:**
```sql
ALTER TABLE shopping_list ADD COLUMN is_checked BOOLEAN DEFAULT FALSE;
```

---

## Edge Function Enhancements

### 1. generate-shopping-list
- Add category assignment logic
- Return categorized items for frontend grouping

### 2. find-recipe-url
- Extract and return `image_url` from Edamam response
- Store image URL in database

### 3. New: save-user-preferences
- Save/update user preferences
- Load on app startup

### 4. New: get-meal-plan-history
- Fetch historical meal plans by week

---

## Frontend Features (No Backend Required)

These are already implemented or can be done frontend-only:

- [x] Loading skeletons
- [x] Empty states with icons
- [x] Sticky order button
- [x] Card-based meal layout
- [x] Improved form styling
- [x] Responsive design
- [ ] Toast notifications (replace alerts)
- [ ] Dark mode toggle (CSS variables already support it)
- [ ] Swipe-to-delete on mobile

---

## Priority Order for Implementation

1. **High:** Shopping item categories (improves shopping experience)
2. **High:** Recipe images (visual appeal)
3. **Medium:** User preferences persistence
4. **Medium:** Checked state persistence
5. **Low:** Meal plan history
6. **Low:** Recipe favorites

---

## Notes

- All database changes should include RLS (Row Level Security) policies
- Edge functions need CORS headers for all new endpoints
- Consider adding created_at/updated_at timestamps to all new tables
