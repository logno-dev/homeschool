ALTER TABLE `report_jobs` ADD `request_key` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `report_jobs_request_key_unique` ON `report_jobs` (`request_key`);
--> statement-breakpoint
CREATE TABLE `queued_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`deduplication_key` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`locked_at` text,
	`last_error` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `queued_jobs_deduplication_key_unique` ON `queued_jobs` (`deduplication_key`);
--> statement-breakpoint
CREATE INDEX `queued_jobs_due_idx` ON `queued_jobs` (`status`, `next_attempt_at`);
--> statement-breakpoint
CREATE TABLE `scheduled_jobs` (
	`name` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`interval_minutes` integer NOT NULL,
	`next_run_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`locked_at` text,
	`last_run_at` text,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scheduled_jobs_due_idx` ON `scheduled_jobs` (`enabled`, `next_run_at`);
