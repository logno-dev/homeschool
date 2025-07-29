-- Performance optimization indexes for frequently queried columns

-- Indexes for guardians table
CREATE INDEX IF NOT EXISTS idx_guardians_family_id ON guardians(family_id);
CREATE INDEX IF NOT EXISTS idx_guardians_email ON guardians(email);

-- Indexes for children table  
CREATE INDEX IF NOT EXISTS idx_children_family_id ON children(family_id);

-- Indexes for schedules table (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_schedules_session_id ON schedules(session_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_session_status ON schedules(session_id, status);
CREATE INDEX IF NOT EXISTS idx_schedules_classroom_id ON schedules(classroom_id);
CREATE INDEX IF NOT EXISTS idx_schedules_period ON schedules(period);

-- Indexes for class_registrations table (heavy queries)
CREATE INDEX IF NOT EXISTS idx_class_registrations_session_id ON class_registrations(session_id);
CREATE INDEX IF NOT EXISTS idx_class_registrations_schedule_id ON class_registrations(schedule_id);
CREATE INDEX IF NOT EXISTS idx_class_registrations_child_id ON class_registrations(child_id);
CREATE INDEX IF NOT EXISTS idx_class_registrations_family_id ON class_registrations(family_id);
CREATE INDEX IF NOT EXISTS idx_class_registrations_session_schedule ON class_registrations(session_id, schedule_id);

-- Indexes for volunteer_assignments table
CREATE INDEX IF NOT EXISTS idx_volunteer_assignments_session_id ON volunteer_assignments(session_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_assignments_guardian_id ON volunteer_assignments(guardian_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_assignments_schedule_id ON volunteer_assignments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_assignments_session_schedule ON volunteer_assignments(session_id, schedule_id);

-- Indexes for class_teaching_requests table
CREATE INDEX IF NOT EXISTS idx_class_teaching_requests_session_id ON class_teaching_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_class_teaching_requests_guardian_id ON class_teaching_requests(guardian_id);
CREATE INDEX IF NOT EXISTS idx_class_teaching_requests_status ON class_teaching_requests(status);

-- Indexes for sessions table
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_schedules_lookup ON schedules(session_id, status, classroom_id, period);
CREATE INDEX IF NOT EXISTS idx_registrations_lookup ON class_registrations(session_id, schedule_id, status);