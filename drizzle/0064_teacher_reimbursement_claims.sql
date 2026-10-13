ALTER TABLE `sessions` ADD `teacher_reimbursement_due_date` text;
--> statement-breakpoint
ALTER TABLE `teacher_reimbursements` ADD `requested_amount` real;
--> statement-breakpoint
ALTER TABLE `teacher_reimbursements` ADD `receipt_pathname` text;
--> statement-breakpoint
ALTER TABLE `teacher_reimbursements` ADD `receipt_filename` text;
--> statement-breakpoint
ALTER TABLE `teacher_reimbursements` ADD `receipt_content_type` text;
--> statement-breakpoint
ALTER TABLE `teacher_reimbursements` ADD `receipt_size` integer;
--> statement-breakpoint
ALTER TABLE `teacher_reimbursements` ADD `submitted_by_teacher` integer NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `teacher_reimbursements` ADD `review_notes` text;
--> statement-breakpoint
ALTER TABLE `teacher_reimbursements` ADD `reviewed_by` text REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `teacher_reimbursements` ADD `reviewed_at` text;
--> statement-breakpoint
CREATE INDEX `teacher_reimbursements_guardian_created_idx` ON `teacher_reimbursements` (`guardian_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `teacher_reimbursements_class_status_idx` ON `teacher_reimbursements` (`class_teaching_request_id`,`status`);
