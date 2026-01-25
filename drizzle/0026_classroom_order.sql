ALTER TABLE classrooms ADD COLUMN order_index integer DEFAULT 0;
ALTER TABLE session_classrooms ADD COLUMN order_index integer DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, name) - 1 AS idx
  FROM classrooms
)
UPDATE classrooms
SET order_index = (SELECT idx FROM ordered WHERE ordered.id = classrooms.id);

WITH ordered_session AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, name) - 1 AS idx
  FROM session_classrooms
)
UPDATE session_classrooms
SET order_index = (SELECT idx FROM ordered_session WHERE ordered_session.id = session_classrooms.id);
