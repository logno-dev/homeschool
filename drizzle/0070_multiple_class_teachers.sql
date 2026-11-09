CREATE TABLE `class_co_teachers` (
  `id` text PRIMARY KEY NOT NULL,
  `class_teaching_request_id` text NOT NULL REFERENCES `class_teaching_requests`(`id`) ON DELETE cascade,
  `guardian_id` text NOT NULL REFERENCES `guardians`(`id`) ON DELETE cascade,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_co_teachers_class_guardian_idx` ON `class_co_teachers` (`class_teaching_request_id`,`guardian_id`);
--> statement-breakpoint
CREATE INDEX `class_co_teachers_guardian_idx` ON `class_co_teachers` (`guardian_id`);
--> statement-breakpoint
CREATE TABLE `class_student_teachers` (
  `id` text PRIMARY KEY NOT NULL,
  `class_teaching_request_id` text NOT NULL REFERENCES `class_teaching_requests`(`id`) ON DELETE cascade,
  `child_id` text NOT NULL REFERENCES `children`(`id`) ON DELETE cascade,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_student_teachers_class_child_idx` ON `class_student_teachers` (`class_teaching_request_id`,`child_id`);
--> statement-breakpoint
CREATE INDEX `class_student_teachers_child_idx` ON `class_student_teachers` (`child_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `class_co_teachers` (`id`, `class_teaching_request_id`, `guardian_id`)
SELECT lower(hex(randomblob(16))), `id`, `co_teacher_id` FROM `class_teaching_requests` WHERE `co_teacher_id` IS NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `class_student_teachers` (`id`, `class_teaching_request_id`, `child_id`)
SELECT lower(hex(randomblob(16))), `id`, `student_teacher_child_id` FROM `class_teaching_requests` WHERE `student_teacher_child_id` IS NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `class_student_teachers` (`id`, `class_teaching_request_id`, `child_id`)
SELECT lower(hex(randomblob(16))), `id`, `student_co_teacher_child_id` FROM `class_teaching_requests` WHERE `student_co_teacher_child_id` IS NOT NULL;
