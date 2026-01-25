CREATE TABLE class_material_charges (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  class_teaching_request_id text NOT NULL REFERENCES class_teaching_requests(id) ON DELETE CASCADE,
  amount real NOT NULL,
  notes text,
  created_by text REFERENCES guardians(id),
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE class_material_payments (
  id text PRIMARY KEY,
  charge_id text NOT NULL REFERENCES class_material_charges(id) ON DELETE CASCADE,
  family_id text REFERENCES families(id) ON DELETE SET NULL,
  payer_name text,
  amount real NOT NULL,
  payment_date text NOT NULL,
  payment_method text NOT NULL,
  notes text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teacher_reimbursements (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  class_teaching_request_id text NOT NULL REFERENCES class_teaching_requests(id) ON DELETE CASCADE,
  guardian_id text NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  amount real NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_date text,
  notes text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
