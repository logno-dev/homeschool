-- Session fee configuration table
CREATE TABLE `session_fee_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`first_child_fee` real DEFAULT 0 NOT NULL,
	`additional_child_fee` real DEFAULT 0 NOT NULL,
	`due_date` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Family session fees table
CREATE TABLE `family_session_fees` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`family_id` text NOT NULL,
	`registration_fee` real DEFAULT 0 NOT NULL,
	`class_fees` real DEFAULT 0 NOT NULL,
	`total_fee` real DEFAULT 0 NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`due_date` text NOT NULL,
	`calculated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Update fee payments table to link to family session fees
ALTER TABLE `fee_payments` ADD COLUMN `family_session_fee_id` text REFERENCES `family_session_fees`(`id`) ON DELETE cascade;
ALTER TABLE `fee_payments` ADD COLUMN `session_id` text REFERENCES `sessions`(`id`) ON DELETE cascade;

-- Create indexes for better performance
CREATE INDEX `idx_session_fee_configs_session_id` ON `session_fee_configs` (`session_id`);
CREATE INDEX `idx_family_session_fees_session_id` ON `family_session_fees` (`session_id`);
CREATE INDEX `idx_family_session_fees_family_id` ON `family_session_fees` (`family_id`);
CREATE INDEX `idx_family_session_fees_status` ON `family_session_fees` (`status`);
CREATE INDEX `idx_fee_payments_family_session_fee_id` ON `fee_payments` (`family_session_fee_id`);
CREATE INDEX `idx_fee_payments_session_id` ON `fee_payments` (`session_id`);