CREATE TABLE user_groups (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  is_system integer NOT NULL DEFAULT 0,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX user_groups_slug_unique ON user_groups(slug);

CREATE TABLE user_group_memberships (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id text NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX user_group_memberships_user_group_idx ON user_group_memberships(user_id, group_id);
CREATE INDEX user_group_memberships_group_idx ON user_group_memberships(group_id);

CREATE TABLE session_registration_windows (
  id text PRIMARY KEY NOT NULL,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  group_id text NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  start_date text NOT NULL,
  end_date text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX session_registration_windows_session_group_idx ON session_registration_windows(session_id, group_id);

INSERT OR IGNORE INTO user_groups (id, name, slug, is_system) VALUES
  ('group-family', 'Family', 'family', 1),
  ('group-teacher', 'Teacher', 'teacher', 1);

INSERT OR IGNORE INTO user_group_memberships (id, user_id, group_id)
SELECT 'family-' || id, id, 'group-family' FROM users;

INSERT OR IGNORE INTO user_group_memberships (id, user_id, group_id)
SELECT 'teacher-' || guardian_id, guardian_id, 'group-teacher'
FROM class_teaching_requests
WHERE status = 'approved';

INSERT OR IGNORE INTO session_registration_windows (id, session_id, group_id, start_date, end_date)
SELECT 'family-window-' || id, id, 'group-family', registration_start_date, registration_end_date FROM sessions;

INSERT OR IGNORE INTO session_registration_windows (id, session_id, group_id, start_date, end_date)
SELECT 'teacher-window-' || id, id, 'group-teacher', teacher_registration_start_date, registration_end_date
FROM sessions WHERE teacher_registration_start_date IS NOT NULL;
