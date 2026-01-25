CREATE TABLE session_classrooms (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  classroom_id text NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE schedules ADD COLUMN session_classroom_id text REFERENCES session_classrooms(id) ON DELETE SET NULL;

INSERT INTO session_classrooms (id, session_id, classroom_id, name, description, created_at, updated_at)
SELECT
  sessions.id || '_' || classrooms.id,
  sessions.id,
  classrooms.id,
  classrooms.name,
  classrooms.description,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM sessions
CROSS JOIN classrooms
WHERE NOT EXISTS (
  SELECT 1
  FROM session_classrooms
  WHERE session_classrooms.session_id = sessions.id
    AND session_classrooms.classroom_id = classrooms.id
);

UPDATE schedules
SET session_classroom_id = (
  SELECT session_classrooms.id
  FROM session_classrooms
  WHERE session_classrooms.session_id = schedules.session_id
    AND session_classrooms.classroom_id = schedules.classroom_id
  LIMIT 1
)
WHERE session_classroom_id IS NULL;
