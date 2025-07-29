-- Add is_active column to volunteer_jobs table
ALTER TABLE volunteer_jobs ADD COLUMN is_active INTEGER DEFAULT 1 NOT NULL;

-- Remove session_id column from volunteer_jobs table (if it exists)
-- Note: SQLite doesn't support DROP COLUMN directly, so we'll recreate the table

-- Create new volunteer_jobs table with correct structure
CREATE TABLE volunteer_jobs_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity_available INTEGER DEFAULT 1 NOT NULL,
  job_type TEXT DEFAULT 'non_period' NOT NULL,
  is_active INTEGER DEFAULT 1 NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (created_by) REFERENCES guardians(id) ON DELETE CASCADE
);

-- Copy data from old table to new table (excluding session_id)
INSERT INTO volunteer_jobs_new (id, title, description, quantity_available, job_type, is_active, created_by, created_at, updated_at)
SELECT id, title, description, quantity_available, job_type, 1, created_by, created_at, updated_at
FROM volunteer_jobs;

-- Drop old table and rename new table
DROP TABLE volunteer_jobs;
ALTER TABLE volunteer_jobs_new RENAME TO volunteer_jobs;

-- Create session_volunteer_jobs table if it doesn't exist
CREATE TABLE IF NOT EXISTS session_volunteer_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  volunteer_job_id TEXT NOT NULL,
  quantity_available INTEGER DEFAULT 1 NOT NULL,
  is_active INTEGER DEFAULT 1 NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (volunteer_job_id) REFERENCES volunteer_jobs(id) ON DELETE CASCADE
);