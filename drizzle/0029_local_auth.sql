CREATE TABLE auth_accounts (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  must_reset_password integer DEFAULT 0 NOT NULL,
  reset_token_hash text,
  reset_token_expires_at text,
  is_active integer DEFAULT 1 NOT NULL,
  last_login_at text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE auth_sessions (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at text NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions(expires_at);
