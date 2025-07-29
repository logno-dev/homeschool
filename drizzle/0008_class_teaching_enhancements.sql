-- Add new fields to class_teaching_requests table
ALTER TABLE `class_teaching_requests` ADD COLUMN `max_students` integer NOT NULL DEFAULT 20;
ALTER TABLE `class_teaching_requests` ADD COLUMN `helpers_needed` integer NOT NULL DEFAULT 1;