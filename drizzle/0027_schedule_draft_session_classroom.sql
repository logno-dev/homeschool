ALTER TABLE schedule_draft_entries ADD COLUMN session_classroom_id text REFERENCES session_classrooms(id);

UPDATE schedule_draft_entries
SET session_classroom_id = (
  SELECT sc.id
  FROM schedule_drafts sd
  JOIN session_classrooms sc
    ON sc.session_id = sd.session_id
   AND sc.classroom_id = schedule_draft_entries.classroom_id
  WHERE sd.id = schedule_draft_entries.draft_id
  LIMIT 1
)
WHERE session_classroom_id IS NULL;
