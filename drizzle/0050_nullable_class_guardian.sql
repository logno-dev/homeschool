-- libSQL supports altering a column without rebuilding the table or cascading
-- deletes into schedules, registrations, or material charges. The existing
-- table-level guardian foreign key is preserved.
ALTER TABLE class_teaching_requests ALTER COLUMN guardian_id TO guardian_id TEXT;
--> statement-breakpoint
-- A nonblank teacher_name denotes a write-in teacher. Linked teachers have no
-- teacher_name and must retain their guardian association.
UPDATE class_teaching_requests
SET guardian_id = NULL
WHERE guardian_id IS NOT NULL AND NULLIF(TRIM(teacher_name), '') IS NOT NULL;
