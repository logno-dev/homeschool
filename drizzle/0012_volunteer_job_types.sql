-- Add job_type column to volunteer_jobs table
ALTER TABLE volunteer_jobs ADD COLUMN job_type TEXT NOT NULL DEFAULT 'non_period';