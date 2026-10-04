CREATE TABLE family_class_charges (
  id text PRIMARY KEY NOT NULL,
  session_id text NOT NULL,
  family_id text NOT NULL,
  child_id text NOT NULL,
  class_teaching_request_id text NOT NULL,
  child_name text NOT NULL,
  class_name text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  refunded_cents integer NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0 AND refunded_cents <= amount_cents),
  status text NOT NULL DEFAULT 'active',
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX idx_class_charges_family_session ON family_class_charges (family_id, session_id);
--> statement-breakpoint
CREATE INDEX idx_class_charges_class ON family_class_charges (class_teaching_request_id);
--> statement-breakpoint
CREATE TABLE class_fee_refunds (
  id text PRIMARY KEY NOT NULL,
  charge_id text NOT NULL REFERENCES family_class_charges(id),
  payment_id text,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  method text NOT NULL,
  reference text,
  notes text NOT NULL,
  recorded_by text NOT NULL,
  refunded_at text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_class_refund_reference ON class_fee_refunds (method, reference) WHERE reference IS NOT NULL;
--> statement-breakpoint
INSERT INTO family_class_charges (id, session_id, family_id, child_id, class_teaching_request_id, child_name, class_name, amount_cents)
SELECT cr.session_id || ':' || cr.family_id || ':' || cr.child_id || ':' || ctr.id,
  cr.session_id, cr.family_id, cr.child_id, ctr.id, c.first_name, ctr.class_name,
  CAST(ROUND(COALESCE(ctr.fee_amount, 0) * 100) AS INTEGER)
FROM class_registrations cr
JOIN schedules s ON s.id = cr.schedule_id
JOIN class_teaching_requests ctr ON ctr.id = s.class_teaching_request_id
JOIN children c ON c.id = cr.child_id
WHERE cr.status = 'registered'
GROUP BY cr.session_id, cr.family_id, cr.child_id, ctr.id;
