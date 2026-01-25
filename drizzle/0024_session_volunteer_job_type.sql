ALTER TABLE session_volunteer_jobs ADD COLUMN job_type text NOT NULL DEFAULT 'non_period';

UPDATE session_volunteer_jobs
SET job_type = (
  SELECT volunteer_jobs.job_type
  FROM volunteer_jobs
  WHERE volunteer_jobs.id = session_volunteer_jobs.volunteer_job_id
)
WHERE job_type IS NULL OR job_type = 'non_period';
