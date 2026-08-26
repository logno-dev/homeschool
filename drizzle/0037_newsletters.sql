CREATE TABLE newsletters (
  id text PRIMARY KEY NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  text text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  include_inactive integer NOT NULL DEFAULT 0,
  scheduled_at text,
  sent_at text,
  created_by text NOT NULL REFERENCES users(id),
  total_recipients integer NOT NULL DEFAULT 0,
  total_sent integer NOT NULL DEFAULT 0,
  total_failed integer NOT NULL DEFAULT 0,
  last_error text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE TABLE newsletter_groups (
  id text PRIMARY KEY NOT NULL,
  newsletter_id text NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  group_id text NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE UNIQUE INDEX newsletter_groups_newsletter_group_idx ON newsletter_groups(newsletter_id, group_id);
--> statement-breakpoint

CREATE TABLE newsletter_recipients (
  id text PRIMARY KEY NOT NULL,
  newsletter_id text NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  resend_id text,
  error text,
  sent_at text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint

CREATE UNIQUE INDEX newsletter_recipients_newsletter_user_idx ON newsletter_recipients(newsletter_id, user_id);
--> statement-breakpoint
CREATE INDEX newsletter_recipients_pending_idx ON newsletter_recipients(newsletter_id, status);
