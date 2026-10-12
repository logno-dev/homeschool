ALTER TABLE `sessions` ADD `class_teaching_access_mode` text DEFAULT 'open' NOT NULL;
--> statement-breakpoint
ALTER TABLE `sessions` ADD `class_teaching_allowed_group_ids` text DEFAULT '[]' NOT NULL;
