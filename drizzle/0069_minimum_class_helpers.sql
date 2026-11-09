UPDATE `class_teaching_requests`
SET `helpers_needed` = 3,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `helpers_needed` < 3;
