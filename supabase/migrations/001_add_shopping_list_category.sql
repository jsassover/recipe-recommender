-- Migration: Add category column to shopping_list table
-- Run this in Supabase Dashboard > SQL Editor

-- Add category column
ALTER TABLE shopping_list ADD COLUMN IF NOT EXISTS category TEXT;

-- Create index for faster category-based queries
CREATE INDEX IF NOT EXISTS idx_shopping_list_category ON shopping_list(category);

-- Update RLS policy to include category in select (if needed)
-- The existing RLS policies should automatically include the new column
