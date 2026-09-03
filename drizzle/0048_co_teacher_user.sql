ALTER TABLE `class_teaching_requests` ADD COLUMN `co_teacher_id` text REFERENCES `guardians`(`id`) ON DELETE SET NULL;
