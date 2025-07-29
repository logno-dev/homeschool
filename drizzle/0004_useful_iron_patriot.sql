CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`class_teaching_request_id` text NOT NULL,
	`classroom_id` text NOT NULL,
	`period` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_teaching_request_id`) REFERENCES `class_teaching_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE cascade
);
