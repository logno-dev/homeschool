-- Migration: Add draft management tables
-- Created: 2025-01-27

-- Schedule drafts table (for user-specific draft versions)
CREATE TABLE `schedule_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Schedule draft entries table (individual class assignments within a draft)
CREATE TABLE `schedule_draft_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`class_teaching_request_id` text NOT NULL,
	`classroom_id` text NOT NULL,
	`period` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `schedule_drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_teaching_request_id`) REFERENCES `class_teaching_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Create indexes for better performance
CREATE INDEX `idx_schedule_drafts_session_id` ON `schedule_drafts` (`session_id`);
CREATE INDEX `idx_schedule_drafts_created_by` ON `schedule_drafts` (`created_by`);
CREATE INDEX `idx_schedule_drafts_is_active` ON `schedule_drafts` (`is_active`);
CREATE INDEX `idx_schedule_draft_entries_draft_id` ON `schedule_draft_entries` (`draft_id`);
CREATE INDEX `idx_schedule_draft_entries_classroom_period` ON `schedule_draft_entries` (`classroom_id`, `period`);