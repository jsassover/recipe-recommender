-- Migration: Add image_url column to meal_plan table
-- Run this in Supabase Dashboard > SQL Editor

-- Add image_url column for recipe thumbnails
ALTER TABLE meal_plan ADD COLUMN IF NOT EXISTS image_url TEXT;
