-- Migration: Add grade year system to children table
-- This replaces the static grade field with a dynamic system based on grade year and level

-- Add new columns for grade year system
ALTER TABLE children ADD COLUMN grade_year INTEGER;
ALTER TABLE children ADD COLUMN grade_level TEXT;

-- Create an index for efficient grade calculations
CREATE INDEX idx_children_grade_year_level ON children(grade_year, grade_level);

-- Note: The existing 'grade' column is kept for backward compatibility during transition
-- It can be removed in a future migration once all data is migrated and code is updated