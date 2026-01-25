CREATE TABLE scholarship_applications (
  id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  guardian_id text NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  scholarship_type text NOT NULL,
  requested_amount real,
  reason text NOT NULL,
  additional_info text,
  status text NOT NULL DEFAULT 'pending',
  approved_amount real,
  review_notes text,
  reviewed_by text REFERENCES guardians(id),
  reviewed_at text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scholarship_fund_transactions (
  id text PRIMARY KEY,
  amount real NOT NULL,
  transaction_type text NOT NULL,
  source text NOT NULL,
  family_id text REFERENCES families(id) ON DELETE CASCADE,
  session_id text REFERENCES sessions(id) ON DELETE CASCADE,
  application_id text REFERENCES scholarship_applications(id) ON DELETE SET NULL,
  notes text,
  created_by text REFERENCES guardians(id) ON DELETE SET NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
