-- Add quantity column to pantry table
ALTER TABLE pantry ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
