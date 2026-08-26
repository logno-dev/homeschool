import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Families table
export const families = sqliteTable('families', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  sharingCode: text('sharing_code').notNull().unique(),
  annualFeePaid: integer('annual_fee_paid', { mode: 'boolean' }).notNull().default(false),
  feePaymentDate: text('fee_payment_date'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Guardians table
export const guardians = sqliteTable('guardians', {
  id: text('id').primaryKey(), // This matches the auth provider user ID
  email: text('email').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: text('role').notNull().default('user'), // user, admin, moderator, member
  familyId: text('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  isMainContact: integer('is_main_contact', { mode: 'boolean' }).notNull().default(false),
  phone: text('phone'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Children table
export const children = sqliteTable('children', {
  id: text('id').primaryKey(),
  familyId: text('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  dateOfBirth: text('date_of_birth').notNull(),
  grade: text('grade').notNull(), // Legacy field - kept for backward compatibility
  gradeYear: integer('grade_year'), // Year the child was in the specified grade level
  gradeLevel: text('grade_level'), // Grade level they were in that year (K, 1, 2, etc.)
  allergies: text('allergies'),
  medicalNotes: text('medical_notes'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const globalSettings = sqliteTable('global_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

// Sessions table (for school sessions like Fall, Spring, Winter)
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // e.g., "Fall 2024", "Spring 2025"
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  registrationStartDate: text('registration_start_date').notNull(),
  registrationEndDate: text('registration_end_date').notNull(),
  teacherRegistrationStartDate: text('teacher_registration_start_date'), // Early registration for teachers
  classTeachingRegistrationStartDate: text('class_teaching_registration_start_date'),
  classTeachingRegistrationEndDate: text('class_teaching_registration_end_date'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false), // Only one active session at a time
  description: text('description'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const userGroups = sqliteTable('user_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const userGroupMemberships = sqliteTable('user_group_memberships', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  groupId: text('group_id').notNull().references(() => userGroups.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const sessionRegistrationWindows = sqliteTable('session_registration_windows', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  groupId: text('group_id').notNull().references(() => userGroups.id, { onDelete: 'cascade' }),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const newsletters = sqliteTable('newsletters', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull().default('newsletter'),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text').notNull(),
  status: text('status').notNull().default('draft'),
  includeInactive: integer('include_inactive', { mode: 'boolean' }).notNull().default(false),
  scheduledAt: text('scheduled_at'),
  sentAt: text('sent_at'),
  createdBy: text('created_by').notNull().references(() => users.id),
  totalRecipients: integer('total_recipients').notNull().default(0),
  totalSent: integer('total_sent').notNull().default(0),
  totalFailed: integer('total_failed').notNull().default(0),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const newsletterGroups = sqliteTable('newsletter_groups', {
  id: text('id').primaryKey(),
  newsletterId: text('newsletter_id').notNull().references(() => newsletters.id, { onDelete: 'cascade' }),
  groupId: text('group_id').notNull().references(() => userGroups.id, { onDelete: 'cascade' }),
})

export const newsletterRecipients = sqliteTable('newsletter_recipients', {
  id: text('id').primaryKey(),
  newsletterId: text('newsletter_id').notNull().references(() => newsletters.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  status: text('status').notNull().default('pending'),
  resendId: text('resend_id'),
  error: text('error'),
  sentAt: text('sent_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Classrooms table
export const classrooms = sqliteTable('classrooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const sessionClassrooms = sqliteTable('session_classrooms', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Schedule table (for assigning approved classes to classroom/period slots)
export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  classTeachingRequestId: text('class_teaching_request_id').notNull().references(() => classTeachingRequests.id, { onDelete: 'cascade' }),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  sessionClassroomId: text('session_classroom_id').references(() => sessionClassrooms.id, { onDelete: 'set null' }),
  period: text('period').notNull(), // 'first', 'second', 'lunch', 'third'
  status: text('status').notNull().default('draft'), // 'draft', 'submitted', 'published'
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Schedule drafts table (for user-specific draft versions)
export const scheduleDrafts = sqliteTable('schedule_drafts', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').notNull().references(() => guardians.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // User-defined name for the draft
  description: text('description'), // Optional description
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false), // Only one active draft per user per session
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Schedule draft entries table (individual class assignments within a draft)
export const scheduleDraftEntries = sqliteTable('schedule_draft_entries', {
  id: text('id').primaryKey(),
  draftId: text('draft_id').notNull().references(() => scheduleDrafts.id, { onDelete: 'cascade' }),
  classTeachingRequestId: text('class_teaching_request_id').notNull().references(() => classTeachingRequests.id, { onDelete: 'cascade' }),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  sessionClassroomId: text('session_classroom_id').references(() => sessionClassrooms.id, { onDelete: 'set null' }),
  period: text('period').notNull(), // 'first', 'second', 'lunch', 'third'
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Class teaching requests table
export const classTeachingRequests = sqliteTable('class_teaching_requests', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  guardianId: text('guardian_id').notNull().references(() => guardians.id, { onDelete: 'cascade' }),
  teacherName: text('teacher_name'),
  className: text('class_name').notNull(),
  description: text('description').notNull(),
  gradeRange: text('grade_range').notNull(), // e.g., "K-2", "3-5", "6-8", or custom input
  gradeRangeFrom: integer('grade_range_from'),
  gradeRangeTo: integer('grade_range_to'),
  maxStudents: integer('max_students').notNull().default(20), // Maximum number of students allowed
  helpersNeeded: integer('helpers_needed').notNull().default(1), // Number of parent helpers needed (min 1 if no co-teacher)
  coTeacher: text('co_teacher'), // Optional co-teacher name
  classroomNeeds: text('classroom_needs'), // e.g., "TV, projector, art supplies"
  requiresFee: integer('requires_fee', { mode: 'boolean' }).notNull().default(false),
  feeAmount: real('fee_amount'), // Dollar amount if fee is required
  schedulingRequirements: text('scheduling_requirements'), // Optional scheduling notes
  status: text('status').notNull().default('pending'), // pending, approved, rejected
  reviewedBy: text('reviewed_by').references(() => guardians.id), // Admin/moderator who reviewed
  reviewedAt: text('reviewed_at'),
  reviewNotes: text('review_notes'), // Optional notes from reviewer
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Schedule comments table (for teacher feedback on submitted schedules)
export const scheduleComments = sqliteTable('schedule_comments', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  guardianId: text('guardian_id').notNull().references(() => guardians.id, { onDelete: 'cascade' }),
  comment: text('comment').notNull(),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false), // false = private (only commenter, mods, admins), true = public (all teachers)
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Volunteer jobs table (for managing volunteer opportunities - persists across sessions)
export const volunteerJobs = sqliteTable('volunteer_jobs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(), // Detailed description and expectations
  quantityAvailable: integer('quantity_available').notNull().default(1), // Number of positions available
  jobType: text('job_type').notNull().default('non_period'), // 'period_based' or 'non_period'
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true), // Whether this job is currently available
  createdBy: text('created_by').notNull().references(() => guardians.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Session volunteer jobs table (for linking volunteer jobs to specific sessions)
export const sessionVolunteerJobs = sqliteTable('session_volunteer_jobs', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  volunteerJobId: text('volunteer_job_id').notNull().references(() => volunteerJobs.id, { onDelete: 'cascade' }),
  quantityAvailable: integer('quantity_available').notNull().default(1), // Override quantity for this session
  jobType: text('job_type').notNull().default('non_period'), // 'period_based' or 'non_period'
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true), // Whether this job is active for this session
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Class registrations table (for tracking student enrollments in classes)
export const classRegistrations = sqliteTable('class_registrations', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  scheduleId: text('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  childId: text('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  familyId: text('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  registeredBy: text('registered_by').notNull().references(() => guardians.id, { onDelete: 'cascade' }),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),
  status: text('status').notNull().default('registered'), // registered, waitlisted, cancelled, pending, hold
  holdExpiresAt: text('hold_expires_at'),
  registeredAt: text('registered_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Volunteer assignments table (for tracking guardian volunteer commitments)
export const volunteerAssignments = sqliteTable('volunteer_assignments', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  guardianId: text('guardian_id').notNull().references(() => guardians.id, { onDelete: 'cascade' }),
  familyId: text('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  period: text('period').notNull(), // 'first', 'second', 'third' (lunch doesn't count for volunteer requirements)
  volunteerType: text('volunteer_type').notNull(), // 'teacher', 'helper', 'co_teacher', 'volunteer_job'
  // Reference to the specific volunteer opportunity (one of these will be populated based on type)
  scheduleId: text('schedule_id').references(() => schedules.id, { onDelete: 'cascade' }), // For teacher/helper/co_teacher
  volunteerJobId: text('volunteer_job_id').references(() => volunteerJobs.id, { onDelete: 'cascade' }), // For volunteer_job
  status: text('status').notNull().default('assigned'), // assigned, completed, cancelled, pending, hold
  holdExpiresAt: text('hold_expires_at'),
  assignedAt: text('assigned_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Family registration status table (for tracking overall registration status and admin overrides)
export const familyRegistrationStatus = sqliteTable('family_registration_status', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  familyId: text('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('in_progress'), // in_progress, completed, incomplete, admin_override
  volunteerRequirementsMet: integer('volunteer_requirements_met', { mode: 'boolean' }).notNull().default(false),
  adminOverride: integer('admin_override', { mode: 'boolean' }).notNull().default(false),
  adminOverrideReason: text('admin_override_reason'), // Reason for admin override
  overriddenBy: text('overridden_by').references(() => guardians.id), // Admin who granted override
  overriddenAt: text('overridden_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Session fee configuration table (for configuring fees per session)
export const sessionFeeConfigs = sqliteTable('session_fee_configs', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  firstChildFee: real('first_child_fee').notNull().default(0), // Fee for first child in family
  additionalChildFee: real('additional_child_fee').notNull().default(0), // Fee for each additional child
  pricingRules: text('pricing_rules').notNull().default('[]'),
  dueDate: text('due_date').notNull(), // When fees are due (before session starts)
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Family session fees table (for tracking calculated fees per family per session)
export const familySessionFees = sqliteTable('family_session_fees', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  familyId: text('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  registrationFee: real('registration_fee').notNull().default(0), // Base registration fee (first child + additional children)
  classFees: real('class_fees').notNull().default(0), // Sum of all class fees for this family
  totalFee: real('total_fee').notNull().default(0), // Total amount due (registration + class fees)
  paidAmount: real('paid_amount').notNull().default(0), // Amount paid so far
  status: text('status').notNull().default('pending'), // pending, partial, paid, overdue
  dueDate: text('due_date').notNull(), // When this fee is due
  calculatedAt: text('calculated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Fee payments table (for tracking payment history)
export const feePayments = sqliteTable('fee_payments', {
  id: text('id').primaryKey(),
  familySessionFeeId: text('family_session_fee_id').references(() => familySessionFees.id, { onDelete: 'cascade' }), // Link to specific session fee
  familyId: text('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'cascade' }), // Optional session reference
  amount: real('amount').notNull(),
  paymentDate: text('payment_date').notNull(),
  paymentMethod: text('payment_method').notNull(), // cash, check, online
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const classMaterialCharges = sqliteTable('class_material_charges', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  classTeachingRequestId: text('class_teaching_request_id').notNull().references(() => classTeachingRequests.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  notes: text('notes'),
  createdBy: text('created_by').references(() => guardians.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const classMaterialPayments = sqliteTable('class_material_payments', {
  id: text('id').primaryKey(),
  chargeId: text('charge_id').notNull().references(() => classMaterialCharges.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  payerName: text('payer_name'),
  amount: real('amount').notNull(),
  paymentDate: text('payment_date').notNull(),
  paymentMethod: text('payment_method').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const teacherReimbursements = sqliteTable('teacher_reimbursements', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  classTeachingRequestId: text('class_teaching_request_id').notNull().references(() => classTeachingRequests.id, { onDelete: 'cascade' }),
  guardianId: text('guardian_id').notNull().references(() => guardians.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  status: text('status').notNull().default('pending'), // pending, paid
  paidDate: text('paid_date'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const scholarshipApplications = sqliteTable('scholarship_applications', {
  id: text('id').primaryKey(),
  familyId: text('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  guardianId: text('guardian_id').notNull().references(() => guardians.id, { onDelete: 'cascade' }),
  scholarshipType: text('scholarship_type').notNull(), // full, partial
  requestedAmount: real('requested_amount'),
  reason: text('reason').notNull(),
  additionalInfo: text('additional_info'),
  status: text('status').notNull().default('pending'), // pending, approved, rejected, withdrawn
  approvedAmount: real('approved_amount'),
  reviewNotes: text('review_notes'),
  reviewedBy: text('reviewed_by').references(() => guardians.id),
  reviewedAt: text('reviewed_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const scholarshipFundTransactions = sqliteTable('scholarship_fund_transactions', {
  id: text('id').primaryKey(),
  amount: real('amount').notNull(),
  transactionType: text('transaction_type').notNull(), // donation, award, adjustment
  source: text('source').notNull(), // online, cash, admin
  familyId: text('family_id').references(() => families.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  applicationId: text('application_id').references(() => scholarshipApplications.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdBy: text('created_by').references(() => guardians.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Events table (for calendar events and important dates)
export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  startDate: text('start_date').notNull(), // ISO date string
  endDate: text('end_date'), // Optional end date for multi-day events
  startTime: text('start_time'), // Optional time (HH:MM format)
  endTime: text('end_time'), // Optional end time
  isAllDay: integer('is_all_day', { mode: 'boolean' }).notNull().default(false),
  eventType: text('event_type').notNull().default('general'), // general, session, registration, deadline, holiday
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'cascade' }), // Optional link to session
  location: text('location'), // Optional location
  color: text('color').notNull().default('#3b82f6'), // Hex color for calendar display
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true), // Whether visible to all users
  createdBy: text('created_by').notNull().references(() => guardians.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const faqs = sqliteTable('faqs', {
  id: text('id').primaryKey(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  visibility: text('visibility').notNull().default('public'), // public, private
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Users table (keeping for backward compatibility with existing auth system)
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: text('role').notNull().default('user'),
  activationStatus: text('activation_status').notNull().default('active'), // active, pending, under_review, rejected, parked
  familyId: text('family_id').references(() => families.id),
  dateOfBirth: text('date_of_birth'),
  grade: text('grade'),
  emergencyContact: text('emergency_contact'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const userAcknowledgements = sqliteTable('user_acknowledgements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  releaseLiabilityAgreed: integer('release_liability_agreed', { mode: 'boolean' }).notNull(),
  contactInfoRelease: text('contact_info_release').notNull(), // agree, do_not_agree
  photographyRelease: text('photography_release').notNull(), // agree, do_not_agree
  handbookVersion: text('handbook_version').notNull(),
  handbookAgreed: integer('handbook_agreed', { mode: 'boolean' }).notNull(),
  acceptedAt: text('accepted_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const handbooks = sqliteTable('handbooks', {
  id: text('id').primaryKey(),
  version: text('version').notNull(),
  filename: text('filename').notNull(),
  blobUrl: text('blob_url').notNull(),
  pathname: text('pathname').notNull(),
  size: integer('size').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  uploadedAt: text('uploaded_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const authAccounts = sqliteTable('auth_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  mustResetPassword: integer('must_reset_password', { mode: 'boolean' }).notNull().default(false),
  resetTokenHash: text('reset_token_hash'),
  resetTokenExpiresAt: text('reset_token_expires_at'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const authSessions = sqliteTable('auth_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const customReports = sqliteTable('custom_reports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  definition: text('definition').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Type exports for TypeScript
export type Family = typeof families.$inferSelect
export type Guardian = typeof guardians.$inferSelect
export type Child = typeof children.$inferSelect
export type Session = typeof sessions.$inferSelect
export type UserGroup = typeof userGroups.$inferSelect
export type UserGroupMembership = typeof userGroupMemberships.$inferSelect
export type CustomReport = typeof customReports.$inferSelect
export type SessionRegistrationWindow = typeof sessionRegistrationWindows.$inferSelect
export type Classroom = typeof classrooms.$inferSelect
export type SessionClassroom = typeof sessionClassrooms.$inferSelect
export type Schedule = typeof schedules.$inferSelect
export type ScheduleDraft = typeof scheduleDrafts.$inferSelect
export type ScheduleDraftEntry = typeof scheduleDraftEntries.$inferSelect
export type ClassTeachingRequest = typeof classTeachingRequests.$inferSelect
export type ScheduleComment = typeof scheduleComments.$inferSelect
export type VolunteerJob = typeof volunteerJobs.$inferSelect
export type SessionVolunteerJob = typeof sessionVolunteerJobs.$inferSelect
export type ClassRegistration = typeof classRegistrations.$inferSelect
export type VolunteerAssignment = typeof volunteerAssignments.$inferSelect
export type FamilyRegistrationStatus = typeof familyRegistrationStatus.$inferSelect
export type SessionFeeConfig = typeof sessionFeeConfigs.$inferSelect
export type FamilySessionFee = typeof familySessionFees.$inferSelect
export type FeePayment = typeof feePayments.$inferSelect
export type ClassMaterialCharge = typeof classMaterialCharges.$inferSelect
export type ClassMaterialPayment = typeof classMaterialPayments.$inferSelect
export type TeacherReimbursement = typeof teacherReimbursements.$inferSelect
export type ScholarshipApplication = typeof scholarshipApplications.$inferSelect
export type ScholarshipFundTransaction = typeof scholarshipFundTransactions.$inferSelect
export type Event = typeof events.$inferSelect
export type Faq = typeof faqs.$inferSelect
export type User = typeof users.$inferSelect
export type UserAcknowledgement = typeof userAcknowledgements.$inferSelect
export type Handbook = typeof handbooks.$inferSelect
export type AuthAccount = typeof authAccounts.$inferSelect
export type AuthSession = typeof authSessions.$inferSelect

export type NewFamily = typeof families.$inferInsert
export type NewGuardian = typeof guardians.$inferInsert
export type NewChild = typeof children.$inferInsert
export type NewSession = typeof sessions.$inferInsert
export type NewClassroom = typeof classrooms.$inferInsert
export type NewSessionClassroom = typeof sessionClassrooms.$inferInsert
export type NewSchedule = typeof schedules.$inferInsert
export type NewScheduleDraft = typeof scheduleDrafts.$inferInsert
export type NewScheduleDraftEntry = typeof scheduleDraftEntries.$inferInsert
export type NewClassTeachingRequest = typeof classTeachingRequests.$inferInsert
export type NewScheduleComment = typeof scheduleComments.$inferInsert
export type NewVolunteerJob = typeof volunteerJobs.$inferInsert
export type NewSessionVolunteerJob = typeof sessionVolunteerJobs.$inferInsert
export type NewClassRegistration = typeof classRegistrations.$inferInsert
export type NewVolunteerAssignment = typeof volunteerAssignments.$inferInsert
export type NewFamilyRegistrationStatus = typeof familyRegistrationStatus.$inferInsert
export type NewSessionFeeConfig = typeof sessionFeeConfigs.$inferInsert
export type NewFamilySessionFee = typeof familySessionFees.$inferInsert
export type NewFeePayment = typeof feePayments.$inferInsert
export type NewClassMaterialCharge = typeof classMaterialCharges.$inferInsert
export type NewClassMaterialPayment = typeof classMaterialPayments.$inferInsert
export type NewTeacherReimbursement = typeof teacherReimbursements.$inferInsert
export type NewScholarshipApplication = typeof scholarshipApplications.$inferInsert
export type NewScholarshipFundTransaction = typeof scholarshipFundTransactions.$inferInsert
export type NewEvent = typeof events.$inferInsert
export type NewFaq = typeof faqs.$inferInsert
export type NewUser = typeof users.$inferInsert
export type NewUserAcknowledgement = typeof userAcknowledgements.$inferInsert
export type NewHandbook = typeof handbooks.$inferInsert
export type NewAuthAccount = typeof authAccounts.$inferInsert
export type NewAuthSession = typeof authSessions.$inferInsert
