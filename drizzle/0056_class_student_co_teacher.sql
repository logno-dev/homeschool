ALTER TABLE `class_teaching_requests` ADD `student_co_teacher_child_id` text REFERENCES children(id) ON DELETE SET NULL;
