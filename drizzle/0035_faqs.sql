CREATE TABLE faqs (
  id text PRIMARY KEY NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  visibility text NOT NULL DEFAULT 'public',
  order_index integer NOT NULL DEFAULT 0,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX faqs_visibility_order_idx ON faqs(visibility, order_index);
