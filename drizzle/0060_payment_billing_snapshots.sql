ALTER TABLE fee_payments ADD COLUMN billing_snapshot text;
--> statement-breakpoint
ALTER TABLE family_class_charges ADD COLUMN billing_treatment text NOT NULL DEFAULT 'included';
