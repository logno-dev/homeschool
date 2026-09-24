CREATE TABLE `report_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`report_type` text NOT NULL,
	`provider_job_id` text NOT NULL,
	`status` text NOT NULL,
	`template_slug` text NOT NULL,
	`template_version` integer NOT NULL,
	`schema_hash` text NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_jobs_provider_job_id_unique` ON `report_jobs` (`provider_job_id`);
