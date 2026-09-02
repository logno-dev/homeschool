ALTER TABLE family_session_fees ADD COLUMN overpayment_amount real NOT NULL DEFAULT 0;
ALTER TABLE family_session_fees ADD COLUMN overpayment_status text NOT NULL DEFAULT 'none';
ALTER TABLE family_session_fees ADD COLUMN overpayment_resolved_at text;
ALTER TABLE family_session_fees ADD COLUMN overpayment_resolved_by text REFERENCES guardians(id) ON DELETE SET NULL;
ALTER TABLE family_session_fees ADD COLUMN overpayment_resolution_notes text;

CREATE TABLE family_fee_credits (
  id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  source_fee_id text REFERENCES family_session_fees(id) ON DELETE SET NULL,
  amount real NOT NULL,
  status text NOT NULL DEFAULT 'available',
  notes text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
