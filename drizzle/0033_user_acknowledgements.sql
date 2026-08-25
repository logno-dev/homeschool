CREATE TABLE user_acknowledgements (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  release_liability_agreed integer NOT NULL,
  contact_info_release text NOT NULL,
  photography_release text NOT NULL,
  handbook_version text NOT NULL,
  handbook_agreed integer NOT NULL,
  accepted_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX user_acknowledgements_user_id_idx ON user_acknowledgements(user_id);
CREATE INDEX user_acknowledgements_handbook_version_idx ON user_acknowledgements(handbook_version);
