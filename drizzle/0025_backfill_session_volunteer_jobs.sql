INSERT INTO session_volunteer_jobs (id, session_id, volunteer_job_id, quantity_available, job_type, is_active, created_at, updated_at)
SELECT
  s.id || '_' || v.id,
  s.id,
  v.id,
  v.quantity_available,
  v.job_type,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM sessions s
JOIN volunteer_jobs v
WHERE v.is_active = 1
  AND NOT EXISTS (
    SELECT 1
    FROM session_volunteer_jobs sj
    WHERE sj.session_id = s.id
      AND sj.volunteer_job_id = v.id
  );
