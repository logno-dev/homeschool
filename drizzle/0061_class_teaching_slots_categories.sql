CREATE TABLE `class_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_categories_name_idx` ON `class_categories` (`name`);
--> statement-breakpoint
ALTER TABLE `class_teaching_requests` ADD `category_id` text REFERENCES class_categories(id) ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `class_teaching_requests` ADD `preferred_period` text DEFAULT 'any' NOT NULL;
