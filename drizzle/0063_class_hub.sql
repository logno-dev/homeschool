CREATE TABLE `class_hub_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL REFERENCES schedules(id) ON DELETE cascade,
	`author_user_id` text NOT NULL REFERENCES users(id),
	`type` text DEFAULT 'note' NOT NULL,
	`title` text NOT NULL,
	`body_html` text NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `class_hub_posts_schedule_published_idx` ON `class_hub_posts` (`schedule_id`,`published_at`);
--> statement-breakpoint
CREATE TABLE `class_hub_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL REFERENCES class_hub_posts(id) ON DELETE cascade,
	`uploaded_by` text NOT NULL REFERENCES users(id),
	`filename` text NOT NULL,
	`pathname` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `class_hub_attachments_post_idx` ON `class_hub_attachments` (`post_id`);
--> statement-breakpoint
CREATE TABLE `class_hub_feedback_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL REFERENCES class_hub_posts(id) ON DELETE cascade,
	`family_id` text NOT NULL REFERENCES families(id) ON DELETE cascade,
	`author_user_id` text NOT NULL REFERENCES users(id),
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_hub_feedback_post_family_idx` ON `class_hub_feedback_responses` (`post_id`,`family_id`);
--> statement-breakpoint
CREATE TABLE `class_hub_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL REFERENCES schedules(id) ON DELETE cascade,
	`family_id` text NOT NULL REFERENCES families(id) ON DELETE cascade,
	`created_by` text NOT NULL REFERENCES users(id),
	`subject` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `class_hub_threads_schedule_family_idx` ON `class_hub_threads` (`schedule_id`,`family_id`);
--> statement-breakpoint
CREATE TABLE `class_hub_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL REFERENCES class_hub_threads(id) ON DELETE cascade,
	`author_user_id` text NOT NULL REFERENCES users(id),
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `class_hub_messages_thread_created_idx` ON `class_hub_messages` (`thread_id`,`created_at`);
