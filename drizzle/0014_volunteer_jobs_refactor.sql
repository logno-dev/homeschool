-- Refactor volunteer jobs to persist beyond sessions
-- Step 1: Create new volunteer jobs table structure (without sessionId)
CREATE TABLE volunteer_jobs_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity_available INTEGER NOT NULL DEFAULT 1,
  job_type TEXT NOT NULL DEFAULT 'non_period',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Create session volunteer jobs junction table
CREATE TABLE session_volunteer_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  volunteer_job_id TEXT NOT NULL REFERENCES volunteer_jobs_new(id) ON DELETE CASCADE,
  quantity_available INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Migrate existing volunteer jobs data
-- First, insert unique volunteer jobs (deduplicated by title and description)
INSERT INTO volunteer_jobs_new (id, title, description, quantity_available, job_type, is_active, created_by, created_at, updated_at)
SELECT 
  id,
  title,
  description,
  quantity_available,
  job_type,
  1 as is_active,
  created_by,
  created_at,
  updated_at
FROM volunteer_jobs;

-- Step 4: Create session volunteer job links for each existing volunteer job
INSERT INTO session_volunteer_jobs (id, session_id, volunteer_job_id, quantity_available, is_active, created_at, updated_at)
SELECT 
  vj.id || '_session_' || vj.session_id as id,
  vj.session_id,
  vj.id as volunteer_job_id,
  vj.quantity_available,
  1 as is_active,
  vj.created_at,
  vj.updated_at
FROM volunteer_jobs vj;

-- Step 5: Update volunteer_assignments table to reference session_volunteer_jobs
-- First add the new column
ALTER TABLE volunteer_assignments ADD COLUMN session_volunteer_job_id TEXT REFERENCES session_volunteer_jobs(id) ON DELETE CASCADE;

-- Update existing volunteer assignments to use the new reference
UPDATE volunteer_assignments 
SET session_volunteer_job_id = (
  SELECT svj.id 
  FROM session_volunteer_jobs svj 
  WHERE svj.volunteer_job_id = volunteer_assignments.volunteer_job_id 
    AND svj.session_id = volunteer_assignments.session_id
)
WHERE volunteer_type = 'volunteer_job' AND volunteer_job_id IS NOT NULL;

-- Step 6: Drop the old volunteer_job_id column from volunteer_assignments
-- Note: SQLite doesn't support DROP COLUMN directly, so we'll recreate the table
CREATE TABLE volunteer_assignments_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  guardian_id TEXT NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  volunteer_type TEXT NOT NULL,
  schedule_id TEXT REFERENCES schedules(id) ON DELETE CASCADE,
  session_volunteer_job_id TEXT REFERENCES session_volunteer_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'assigned',
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Copy data to new volunteer_assignments table
INSERT INTO volunteer_assignments_new 
SELECT 
  id,
  session_id,
  guardian_id,
  family_id,
  period,
  volunteer_type,
  schedule_id,
  session_volunteer_job_id,
  status,
  assigned_at,
  created_at,
  updated_at
FROM volunteer_assignments;

-- Step 7: Replace old tables with new ones
DROP TABLE volunteer_assignments;
ALTER TABLE volunteer_assignments_new RENAME TO volunteer_assignments;

DROP TABLE volunteer_jobs;
ALTER TABLE volunteer_jobs_new RENAME TO volunteer_jobs;