CREATE TABLE `class_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`schedule_id` text NOT NULL,
	`child_id` text NOT NULL,
	`family_id` text NOT NULL,
	`registered_by` text NOT NULL,
	`status` text DEFAULT 'registered' NOT NULL,
	`registered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registered_by`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `volunteer_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`guardian_id` text NOT NULL,
	`family_id` text NOT NULL,
	`period` text NOT NULL,
	`volunteer_type` text NOT NULL,
	`schedule_id` text,
	`volunteer_job_id` text,
	`status` text DEFAULT 'assigned' NOT NULL,
	`assigned_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`volunteer_job_id`) REFERENCES `volunteer_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `family_registration_status` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`family_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`volunteer_requirements_met` integer DEFAULT false NOT NULL,
	`admin_override` integer DEFAULT false NOT NULL,
	`admin_override_reason` text,
	`overridden_by` text,
	`overridden_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`overridden_by`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE no action
);