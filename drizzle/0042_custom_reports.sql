CREATE TABLE `custom_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`definition` text NOT NULL,
	`created_by` text NOT NULL REFERENCES users(id),
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `custom_reports_created_by_idx` ON `custom_reports` (`created_by`);
