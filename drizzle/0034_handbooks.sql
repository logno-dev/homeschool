CREATE TABLE handbooks (
  id text PRIMARY KEY NOT NULL,
  version text NOT NULL,
  filename text NOT NULL,
  blob_url text NOT NULL,
  pathname text NOT NULL,
  size integer NOT NULL,
  is_active integer NOT NULL DEFAULT 0,
  uploaded_by text NOT NULL REFERENCES users(id),
  uploaded_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX handbooks_is_active_idx ON handbooks(is_active);
CREATE INDEX handbooks_uploaded_at_idx ON handbooks(uploaded_at);
CREATE UNIQUE INDEX handbooks_one_active_idx ON handbooks(is_active) WHERE is_active = 1;
