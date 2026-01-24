CREATE TABLE global_settings (
  key text PRIMARY KEY,
  value text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
