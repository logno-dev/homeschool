UPDATE `class_teaching_requests`
SET `grade_range_from` = 0,
    `grade_range_to` = 12,
    `updated_at` = CURRENT_TIMESTAMP
WHERE lower(trim(`grade_range`)) IN ('all ages', 'any age', 'any ages');
