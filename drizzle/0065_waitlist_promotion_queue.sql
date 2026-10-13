ALTER TABLE `class_registrations` ADD `waitlist_rank` integer;
--> statement-breakpoint
UPDATE `class_registrations`
SET `waitlist_rank` = (
  SELECT ranked.queue_rank
  FROM (
    SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `schedule_id` ORDER BY `created_at`, `id`) AS queue_rank
    FROM `class_registrations`
    WHERE `status` = 'waitlisted'
  ) AS ranked
  WHERE ranked.id = `class_registrations`.`id`
)
WHERE `status` = 'waitlisted';
--> statement-breakpoint
CREATE UNIQUE INDEX `class_registrations_schedule_waitlist_rank_idx` ON `class_registrations` (`schedule_id`,`waitlist_rank`) WHERE `waitlist_rank` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `class_registrations_waitlist_order_idx` ON `class_registrations` (`schedule_id`,`status`,`waitlist_rank`);
--> statement-breakpoint
CREATE TABLE `waitlist_vacancy_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`schedule_id` text NOT NULL,
	`trigger_registration_id` text,
	`triggered_by` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`open_slots_at_creation` integer NOT NULL,
	`waitlist_count_at_creation` integer NOT NULL,
	`resolution_notes` text,
	`resolved_by` text,
	`resolved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trigger_registration_id`) REFERENCES `class_registrations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`triggered_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `waitlist_vacancy_flags_session_status_idx` ON `waitlist_vacancy_flags` (`session_id`,`status`);
--> statement-breakpoint
CREATE INDEX `waitlist_vacancy_flags_schedule_status_idx` ON `waitlist_vacancy_flags` (`schedule_id`,`status`);
