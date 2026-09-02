import { eq, and, or, desc, asc, isNull, isNotNull, sql } from 'drizzle-orm'
import { db, client, hasDatabaseConnection } from './db'
import { families, guardians, children, feePayments, users, sessions, classrooms, sessionClassrooms, schedules, scheduleDrafts, scheduleDraftEntries, classTeachingRequests, scheduleComments, globalSettings, volunteerJobs, sessionVolunteerJobs, faqs } from './schema'
import type { Family, Guardian, Child, FeePayment, User, Session, Classroom, SessionClassroom, Schedule, ScheduleDraft, ScheduleDraftEntry, ClassTeachingRequest, ScheduleComment, NewFamily, NewGuardian, NewChild, NewFeePayment, NewUser, NewSession, NewClassroom, NewSessionClassroom, NewSchedule, NewScheduleDraft, NewScheduleDraftEntry, NewClassTeachingRequest, NewScheduleComment, NewSessionVolunteerJob } from './schema'
import { incrementGradeValue } from './grades'
import { getRegistrationAccess } from './user-groups'
import { getAppTimezone, parseAppDate } from './app-time'

// Helper function to generate sharing codes
function generateSharingCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Helper function to generate IDs
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 5)
}

let guardiansTableAvailable: boolean | null = null
let usersTableAvailable: boolean | null = null
let sessionsTableAvailable: boolean | null = null
let globalSettingsTableAvailable: boolean | null = null

export async function hasGuardiansTable(): Promise<boolean> {
  if (guardiansTableAvailable !== null) {
    return guardiansTableAvailable
  }

  if (!await hasDatabaseConnection()) {
    guardiansTableAvailable = false
    return guardiansTableAvailable
  }

  try {
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='guardians'"
    )
    guardiansTableAvailable = result.rows.length > 0
  } catch (error) {
    const message = String(error)
    if (!message.includes('HTTP status 404')) {
      console.error('Error checking guardians table:', error)
    }
    guardiansTableAvailable = false
  }

  return guardiansTableAvailable
}

export async function hasUsersTable(): Promise<boolean> {
  if (usersTableAvailable !== null) {
    return usersTableAvailable
  }

  if (!await hasDatabaseConnection()) {
    usersTableAvailable = false
    return usersTableAvailable
  }

  try {
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    )
    usersTableAvailable = result.rows.length > 0
  } catch (error) {
    const message = String(error)
    if (!message.includes('HTTP status 404')) {
      console.error('Error checking users table:', error)
    }
    usersTableAvailable = false
  }

  return usersTableAvailable
}

export async function hasSessionsTable(): Promise<boolean> {
  if (sessionsTableAvailable !== null) {
    return sessionsTableAvailable
  }

  if (!await hasDatabaseConnection()) {
    sessionsTableAvailable = false
    return sessionsTableAvailable
  }

  try {
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
    )
    sessionsTableAvailable = result.rows.length > 0
  } catch (error) {
    const message = String(error)
    if (!message.includes('HTTP status 404')) {
      console.error('Error checking sessions table:', error)
    }
    sessionsTableAvailable = false
  }

  return sessionsTableAvailable
}

export async function hasGlobalSettingsTable(): Promise<boolean> {
  if (globalSettingsTableAvailable !== null) {
    return globalSettingsTableAvailable
  }

  if (!await hasDatabaseConnection()) {
    globalSettingsTableAvailable = false
    return globalSettingsTableAvailable
  }

  try {
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='global_settings'"
    )
    globalSettingsTableAvailable = result.rows.length > 0
  } catch (error) {
    const message = String(error)
    if (!message.includes('HTTP status 404')) {
      console.error('Error checking global settings table:', error)
    }
    globalSettingsTableAvailable = false
  }

  return globalSettingsTableAvailable
}

export async function getGlobalSetting(key: string): Promise<string | null> {
  if (!await hasGlobalSettingsTable()) {
    return null
  }

  const result = await db
    .select({ value: globalSettings.value })
    .from(globalSettings)
    .where(eq(globalSettings.key, key))
    .limit(1)

  return result[0]?.value ?? null
}

export async function setGlobalSetting(key: string, value: string | null): Promise<void> {
  if (!await hasGlobalSettingsTable()) {
    return
  }

  const now = new Date().toISOString()

  await db
    .insert(globalSettings)
    .values({
      key,
      value,
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: globalSettings.key,
      set: {
        value,
        updatedAt: now
      }
    })
}

export async function getGradeIncrementSettings() {
  const [incrementDate, lastRun] = await Promise.all([
    getGlobalSetting('grade_increment_date'),
    getGlobalSetting('grade_increment_last_run')
  ])

  return { incrementDate, lastRun }
}

export async function setGradeIncrementDate(value: string | null) {
  await setGlobalSetting('grade_increment_date', value)
}

export async function setGradeIncrementLastRun(value: string | null) {
  await setGlobalSetting('grade_increment_last_run', value)
}

export async function getFaqsByVisibility(visibility: 'public' | 'private') {
  try {
    return await db
      .select()
      .from(faqs)
      .where(eq(faqs.visibility, visibility))
      .orderBy(asc(faqs.orderIndex), asc(faqs.createdAt))
  } catch (error) {
    const message = String(error)
    if (!message.includes('no such table') && !message.includes('SQLITE_UNKNOWN')) {
      console.error('Error fetching FAQs:', error)
    }
    return []
  }
}

// Family management functions
export async function createFamily(familyData: Omit<NewFamily, 'id' | 'createdAt' | 'updatedAt' | 'sharingCode'>): Promise<Family> {
  const newFamily: NewFamily = {
    ...familyData,
    id: generateId(),
    sharingCode: generateSharingCode(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.insert(families).values(newFamily).returning()
  return result[0]
}

export async function getFamilies(): Promise<Family[]> {
  return await db.select().from(families)
}

export async function getFamilyById(id: string): Promise<Family | null> {
  const result = await db.select().from(families).where(eq(families.id, id))
  return result[0] || null
}

export async function findFamilyBySharingCode(sharingCode: string): Promise<Family | null> {
  const result = await db.select().from(families).where(eq(families.sharingCode, sharingCode))
  return result[0] || null
}

export async function updateFamily(id: string, updates: Partial<Omit<Family, 'id' | 'createdAt'>>): Promise<Family | null> {
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.update(families)
    .set(updateData)
    .where(eq(families.id, id))
    .returning()
  
  return result[0] || null
}

// Guardian management functions
export async function createGuardian(guardianData: Omit<NewGuardian, 'createdAt' | 'updatedAt'>): Promise<Guardian> {
  const newGuardian: NewGuardian = {
    ...guardianData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.insert(guardians).values(newGuardian).returning()
  return result[0]
}

export async function getGuardiansByFamily(familyId: string): Promise<Guardian[]> {
  if (!await hasGuardiansTable()) {
    return []
  }

  try {
    return await db.select().from(guardians).where(eq(guardians.familyId, familyId))
  } catch (error) {
    console.error('Error fetching guardians by family:', error)
    return []
  }
}

export async function getGuardianById(id: string): Promise<Guardian | null> {
  if (!await hasGuardiansTable()) {
    return null
  }

  try {
    const result = await db.select().from(guardians).where(eq(guardians.id, id))
    return result[0] || null
  } catch (error) {
    console.error('Error fetching guardian by id:', error)
    return null
  }
}

export async function updateGuardian(id: string, updates: Partial<Omit<Guardian, 'id' | 'createdAt'>>): Promise<Guardian | null> {
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.update(guardians)
    .set(updateData)
    .where(eq(guardians.id, id))
    .returning()
  
  return result[0] || null
}

// Child management functions
export async function createChild(childData: Omit<NewChild, 'id' | 'createdAt' | 'updatedAt'>): Promise<Child> {
  const newChild: NewChild = {
    ...childData,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.insert(children).values(newChild).returning()
  return result[0]
}

export async function getChildrenByFamily(familyId: string): Promise<Child[]> {
  return await db.select().from(children).where(eq(children.familyId, familyId))
}

export async function getChildById(id: string): Promise<Child | null> {
  const result = await db.select().from(children).where(eq(children.id, id))
  return result[0] || null
}

export async function updateChild(id: string, updates: Partial<Omit<Child, 'id' | 'createdAt'>>): Promise<Child | null> {
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.update(children)
    .set(updateData)
    .where(eq(children.id, id))
    .returning()
  
  return result[0] || null
}

export async function deleteChild(id: string): Promise<boolean> {
  const result = await db.delete(children).where(eq(children.id, id)).returning()
  return result.length > 0
}

// Fee payment functions
export async function recordFeePayment(paymentData: Omit<NewFeePayment, 'id' | 'createdAt'>): Promise<FeePayment> {
  const newPayment: NewFeePayment = {
    ...paymentData,
    id: generateId(),
    createdAt: new Date().toISOString()
  }
  
  const result = await db.insert(feePayments).values(newPayment).returning()
  
  // Update family fee status
  await updateFamily(paymentData.familyId, { 
    annualFeePaid: true, 
    feePaymentDate: paymentData.paymentDate 
  })
  
  return result[0]
}

export async function getFeePaymentsByFamily(familyId: string): Promise<FeePayment[]> {
  return await db.select().from(feePayments).where(eq(feePayments.familyId, familyId))
}

// User management functions (for backward compatibility)
export async function createUser(userData: Omit<NewUser, 'createdAt' | 'updatedAt'>): Promise<User> {
  const newUser: NewUser = {
    ...userData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.insert(users).values(newUser).returning()
  return result[0]
}

export async function getUsers(): Promise<User[]> {
  return await db.select().from(users)
}

export async function getUserById(id: string): Promise<User | null> {
  if (!await hasUsersTable()) {
    return null
  }

  try {
    const result = await db.select().from(users).where(eq(users.id, id))
    return result[0] || null
  } catch (error) {
    console.error('Error fetching user by id:', error)
    return null
  }
}

export async function getUsersByFamily(familyId: string): Promise<User[]> {
  return await db.select().from(users).where(eq(users.familyId, familyId))
}

export async function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning()
  
  return result[0] || null
}

// Session management functions
export async function createSession(sessionData: Omit<NewSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> {
  const newSession: NewSession = {
    ...sessionData,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.insert(sessions).values(newSession).returning()
  return result[0]
}

export async function getSessions(): Promise<Session[]> {
  if (!await hasSessionsTable()) {
    return []
  }

  try {
    return await db.select().from(sessions)
  } catch (error) {
    const message = String(error)
    if (!message.includes('HTTP status 404')) {
      console.error('Error fetching sessions:', error)
    }
    return []
  }
}

export async function incrementAllStudentGrades(): Promise<{ updated: number }> {
  if (!await hasDatabaseConnection()) {
    return { updated: 0 }
  }

  const allChildren = await db.select({ id: children.id, grade: children.grade }).from(children)
  if (!allChildren.length) {
    return { updated: 0 }
  }

  let updatedCount = 0
  const now = new Date().toISOString()

  await db.transaction(async (tx) => {
    for (const child of allChildren) {
      const nextGrade = incrementGradeValue(child.grade)
      if (!nextGrade || nextGrade === child.grade) {
        continue
      }
      await tx
        .update(children)
        .set({ grade: nextGrade, updatedAt: now })
        .where(eq(children.id, child.id))
      updatedCount += 1
    }
  })

  return { updated: updatedCount }
}

export async function getSessionById(id: string): Promise<Session | null> {
  if (!await hasSessionsTable()) {
    return null
  }

  try {
    const result = await db.select().from(sessions).where(eq(sessions.id, id))
    return result[0] || null
  } catch (error) {
    const message = String(error)
    if (!message.includes('HTTP status 404')) {
      console.error('Error fetching session by id:', error)
    }
    return null
  }
}

export async function getActiveSession(): Promise<Session | null> {
  if (!await hasSessionsTable()) {
    return null
  }

  try {
    const result = await db.select().from(sessions).where(eq(sessions.isActive, true))
    return result[0] || null
  } catch (error) {
    const message = String(error)
    if (!message.includes('HTTP status 404')) {
      console.error('Error fetching active session:', error)
    }
    return null
  }
}

export async function getActiveSessions(): Promise<Session[]> {
  if (!await hasSessionsTable()) {
    return []
  }

  try {
    return await db.select().from(sessions).where(eq(sessions.isActive, true))
  } catch (error) {
    const message = String(error)
    if (!message.includes('HTTP status 404')) {
      console.error('Error fetching active sessions:', error)
    }
    return []
  }
}

export async function updateSession(id: string, updates: Partial<Omit<Session, 'id' | 'createdAt'>>): Promise<Session | null> {
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.update(sessions)
    .set(updateData)
    .where(eq(sessions.id, id))
    .returning()
  
  return result[0] || null
}

export async function deleteSession(id: string): Promise<boolean> {
  const result = await db.delete(sessions).where(eq(sessions.id, id)).returning()
  return result.length > 0
}

export async function setActiveSession(id: string): Promise<Session | null> {
  // First deactivate all sessions
  await db.update(sessions).set({ isActive: false })
  
  // Then activate the specified session
  const result = await db.update(sessions)
    .set({ isActive: true, updatedAt: new Date().toISOString() })
    .where(eq(sessions.id, id))
    .returning()
  
  return result[0] || null
}

// Helper function to check if a guardian's family has approved teaching assignments for the active session
export async function hasFamilyTeachingAssignments(guardianId: string): Promise<boolean> {
  try {
    // Get the guardian's family ID
    const guardian = await db.select({ familyId: guardians.familyId })
      .from(guardians)
      .where(eq(guardians.id, guardianId))
      .limit(1)

    if (!guardian[0]?.familyId) {
      return false
    }

    // Get active session
    const activeSession = await getActiveSession()
    if (!activeSession) {
      return false
    }

    // Check if any guardian in the family has approved teaching assignments for this session
    const teachingAssignments = await db.select({ id: classTeachingRequests.id })
      .from(classTeachingRequests)
      .innerJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
      .where(
        and(
          eq(guardians.familyId, guardian[0].familyId),
          eq(classTeachingRequests.sessionId, activeSession.id),
          eq(classTeachingRequests.status, 'approved')
        )
      )
      .limit(1)

    return teachingAssignments.length > 0
  } catch (error) {
    console.error('Error checking family teaching assignments:', error)
    return false
  }
}

// Registration timing functions
export async function isRegistrationOpen(guardianId?: string): Promise<{ isOpen: boolean, session: Session | null, reason?: string }> {
  const activeSession = await getActiveSession()
  
  if (!activeSession) {
    return { isOpen: false, session: null, reason: 'No active session' }
  }

  if (!guardianId) {
    return { isOpen: false, session: activeSession, reason: 'A user group is required' }
  }
  const access = await getRegistrationAccess(activeSession.id, guardianId)
  return { isOpen: access.isOpen, session: activeSession, reason: access.reason }
}

// Class teaching registration timing (different from regular registration)
export async function isClassTeachingRegistrationOpen(): Promise<{ isOpen: boolean, session: Session | null, reason?: string }> {
  const activeSession = await getActiveSession()
  
  if (!activeSession) {
    return { isOpen: false, session: null, reason: 'No active session' }
  }

  const now = new Date()
  const timezone = await getAppTimezone()
  const sessionStart = parseAppDate(activeSession.classTeachingRegistrationStartDate || activeSession.createdAt, timezone)
  const sessionEnd = parseAppDate(activeSession.classTeachingRegistrationEndDate || activeSession.registrationStartDate, timezone, true)

  if (now < sessionStart) {
    return { isOpen: false, session: activeSession, reason: `Class teaching registration opens on ${sessionStart.toLocaleDateString()}` }
  }

  if (now <= sessionEnd) {
    return { isOpen: true, session: activeSession }
  }

  // After regular registration starts, class teaching registration closes
  return { 
    isOpen: false, 
    session: activeSession, 
    reason: `Class teaching registration closed on ${sessionEnd.toLocaleDateString()}`
  }
}

// Class teaching request functions
export async function createClassTeachingRequest(requestData: Omit<NewClassTeachingRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ClassTeachingRequest> {
  const newRequest: NewClassTeachingRequest = {
    ...requestData,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.insert(classTeachingRequests).values(newRequest).returning()
  return result[0]
}

export async function getClassTeachingRequests(): Promise<ClassTeachingRequest[]> {
  return await db.select().from(classTeachingRequests)
}

export async function getClassTeachingRequestsWithSession(): Promise<(ClassTeachingRequest & { session: Session })[]> {
  const result = await db
    .select({
      id: classTeachingRequests.id,
      sessionId: classTeachingRequests.sessionId,
      guardianId: classTeachingRequests.guardianId,
      teacherName: classTeachingRequests.teacherName,
      className: classTeachingRequests.className,
      description: classTeachingRequests.description,
      gradeRange: classTeachingRequests.gradeRange,
      gradeRangeFrom: classTeachingRequests.gradeRangeFrom,
      gradeRangeTo: classTeachingRequests.gradeRangeTo,
      maxStudents: classTeachingRequests.maxStudents,
      helpersNeeded: classTeachingRequests.helpersNeeded,
      coTeacher: classTeachingRequests.coTeacher,
       classroomNeeds: classTeachingRequests.classroomNeeds,
       registrationFeeExempt: classTeachingRequests.registrationFeeExempt,
       requiresFee: classTeachingRequests.requiresFee,
      feeAmount: classTeachingRequests.feeAmount,
      schedulingRequirements: classTeachingRequests.schedulingRequirements,
      status: classTeachingRequests.status,
      reviewedBy: classTeachingRequests.reviewedBy,
      reviewedAt: classTeachingRequests.reviewedAt,
      reviewNotes: classTeachingRequests.reviewNotes,
      createdAt: classTeachingRequests.createdAt,
      updatedAt: classTeachingRequests.updatedAt,
      session: {
        id: sessions.id,
        name: sessions.name,
        startDate: sessions.startDate,
        endDate: sessions.endDate,
        registrationStartDate: sessions.registrationStartDate,
        registrationEndDate: sessions.registrationEndDate,
        teacherRegistrationStartDate: sessions.teacherRegistrationStartDate,
        isActive: sessions.isActive,
        description: sessions.description,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
      }
    })
    .from(classTeachingRequests)
    .leftJoin(sessions, eq(classTeachingRequests.sessionId, sessions.id))
  
  return result as (ClassTeachingRequest & { session: Session })[]
}

export async function getClassTeachingRequestsBySession(sessionId: string): Promise<ClassTeachingRequest[]> {
  return await db.select().from(classTeachingRequests).where(eq(classTeachingRequests.sessionId, sessionId))
}

export async function getClassTeachingRequestsByGuardian(guardianId: string): Promise<ClassTeachingRequest[]> {
  return await db.select().from(classTeachingRequests).where(eq(classTeachingRequests.guardianId, guardianId))
}

export async function getClassTeachingRequestsByGuardianWithSession(guardianId: string): Promise<(ClassTeachingRequest & { session: Session })[]> {
  const result = await db
    .select({
      id: classTeachingRequests.id,
      sessionId: classTeachingRequests.sessionId,
      guardianId: classTeachingRequests.guardianId,
      className: classTeachingRequests.className,
      description: classTeachingRequests.description,
      gradeRange: classTeachingRequests.gradeRange,
      gradeRangeFrom: classTeachingRequests.gradeRangeFrom,
      gradeRangeTo: classTeachingRequests.gradeRangeTo,
      coTeacher: classTeachingRequests.coTeacher,
       classroomNeeds: classTeachingRequests.classroomNeeds,
       registrationFeeExempt: classTeachingRequests.registrationFeeExempt,
       requiresFee: classTeachingRequests.requiresFee,
      feeAmount: classTeachingRequests.feeAmount,
      schedulingRequirements: classTeachingRequests.schedulingRequirements,
      status: classTeachingRequests.status,
      reviewedBy: classTeachingRequests.reviewedBy,
      reviewedAt: classTeachingRequests.reviewedAt,
      reviewNotes: classTeachingRequests.reviewNotes,
      createdAt: classTeachingRequests.createdAt,
      updatedAt: classTeachingRequests.updatedAt,
      session: {
        id: sessions.id,
        name: sessions.name,
        startDate: sessions.startDate,
        endDate: sessions.endDate,
        registrationStartDate: sessions.registrationStartDate,
        registrationEndDate: sessions.registrationEndDate,
        teacherRegistrationStartDate: sessions.teacherRegistrationStartDate,
        isActive: sessions.isActive,
        description: sessions.description,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
      }
    })
    .from(classTeachingRequests)
    .leftJoin(sessions, eq(classTeachingRequests.sessionId, sessions.id))
    .where(eq(classTeachingRequests.guardianId, guardianId))
  
  return result as (ClassTeachingRequest & { session: Session })[]
}

export async function getClassTeachingRequestById(id: string): Promise<ClassTeachingRequest | null> {
  const result = await db.select().from(classTeachingRequests).where(eq(classTeachingRequests.id, id))
  return result[0] || null
}

export async function updateClassTeachingRequest(id: string, updates: Partial<Omit<ClassTeachingRequest, 'id' | 'createdAt'>>): Promise<ClassTeachingRequest | null> {
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.update(classTeachingRequests)
    .set(updateData)
    .where(eq(classTeachingRequests.id, id))
    .returning()
  
  return result[0] || null
}

export async function approveClassTeachingRequest(id: string, reviewerId: string, reviewNotes?: string): Promise<ClassTeachingRequest | null> {
  const updated = await updateClassTeachingRequest(id, {
    status: 'approved',
    reviewedBy: reviewerId,
    reviewedAt: new Date().toISOString(),
    reviewNotes: reviewNotes || null
  })
  if (updated) {
    const { syncTeacherGroupMembership } = await import('./user-groups')
    await syncTeacherGroupMembership(updated.guardianId)
  }
  return updated
}

export async function rejectClassTeachingRequest(id: string, reviewerId: string, reviewNotes?: string): Promise<ClassTeachingRequest | null> {
  const updated = await updateClassTeachingRequest(id, {
    status: 'rejected',
    reviewedBy: reviewerId,
    reviewedAt: new Date().toISOString(),
    reviewNotes: reviewNotes || null
  })
  if (updated) {
    const { syncTeacherGroupMembership } = await import('./user-groups')
    await syncTeacherGroupMembership(updated.guardianId)
  }
  return updated
}

export async function deleteClassTeachingRequest(id: string): Promise<boolean> {
  const result = await db.delete(classTeachingRequests).where(eq(classTeachingRequests.id, id)).returning()
  return result.length > 0
}

// Classroom management functions
export async function createClassroom(classroomData: Omit<NewClassroom, 'id' | 'createdAt' | 'updatedAt'>): Promise<Classroom> {
  const orderRow = await db
    .select({ maxOrder: sql<number>`max(${classrooms.orderIndex})` })
    .from(classrooms)
  const nextOrder = (orderRow[0]?.maxOrder ?? -1) + 1

  const newClassroom: NewClassroom = {
    ...classroomData,
    id: generateId(),
    orderIndex: nextOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.insert(classrooms).values(newClassroom).returning()
  const created = result[0]

  const activeSession = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.isActive, true))
    .limit(1)

  if (activeSession.length > 0) {
    const now = new Date().toISOString()
    await db.insert(sessionClassrooms).values({
      id: `${activeSession[0].id}_${created.id}`,
      sessionId: activeSession[0].id,
      classroomId: created.id,
      name: created.name,
      description: created.description,
      orderIndex: created.orderIndex,
      createdAt: now,
      updatedAt: now
    })
  }

  return created
}

export async function getClassrooms(): Promise<Classroom[]> {
  return await db
    .select()
    .from(classrooms)
    .orderBy(asc(classrooms.orderIndex), asc(classrooms.createdAt))
}

export async function getSessionClassrooms(sessionId: string): Promise<SessionClassroom[]> {
  return await db
    .select()
    .from(sessionClassrooms)
    .where(eq(sessionClassrooms.sessionId, sessionId))
    .orderBy(asc(sessionClassrooms.orderIndex), asc(sessionClassrooms.createdAt))
}

export async function createSessionClassrooms(sessionId: string): Promise<SessionClassroom[]> {
  const baseClassrooms = await db.select().from(classrooms)
  if (baseClassrooms.length === 0) return []

  const now = new Date().toISOString()
  const rows: NewSessionClassroom[] = baseClassrooms.map((room) => ({
    id: `${sessionId}_${room.id}`,
    sessionId,
    classroomId: room.id,
    name: room.name,
    description: room.description,
    orderIndex: room.orderIndex,
    createdAt: now,
    updatedAt: now
  }))

  const result = await db.insert(sessionClassrooms).values(rows).returning()
  return result
}

export async function ensureSessionClassrooms(sessionId: string): Promise<void> {
  const existing = await db
    .select({ id: sessionClassrooms.id })
    .from(sessionClassrooms)
    .where(eq(sessionClassrooms.sessionId, sessionId))
    .limit(1)

  if (existing.length > 0) return

  await createSessionClassrooms(sessionId)
}

export async function createSessionVolunteerJobs(sessionId: string): Promise<void> {
  const baseJobs = await db.select().from(volunteerJobs).where(eq(volunteerJobs.isActive, true))
  if (baseJobs.length === 0) return

  const now = new Date().toISOString()
  const rows: NewSessionVolunteerJob[] = baseJobs.map((job) => ({
    id: `${sessionId}_${job.id}`,
    sessionId,
    volunteerJobId: job.id,
    quantityAvailable: job.quantityAvailable,
    jobType: job.jobType,
    isActive: true,
    createdAt: now,
    updatedAt: now
  }))

  await db.insert(sessionVolunteerJobs).values(rows)
}

export async function ensureSessionVolunteerJobs(sessionId: string): Promise<void> {
  const existingJobs = await db
    .select({ volunteerJobId: sessionVolunteerJobs.volunteerJobId })
    .from(sessionVolunteerJobs)
    .where(eq(sessionVolunteerJobs.sessionId, sessionId))

  const existingJobIds = new Set(existingJobs.map((job) => job.volunteerJobId))
  const baseJobs = await db.select().from(volunteerJobs).where(eq(volunteerJobs.isActive, true))
  const missingJobs = baseJobs.filter((job) => !existingJobIds.has(job.id))

  await db
    .update(sessionVolunteerJobs)
    .set({
      jobType: sql`(
        SELECT volunteer_jobs.job_type
        FROM volunteer_jobs
        WHERE volunteer_jobs.id = session_volunteer_jobs.volunteer_job_id
      )`
    })
    .where(eq(sessionVolunteerJobs.sessionId, sessionId))

  if (missingJobs.length === 0) return

  const now = new Date().toISOString()
  const rows: NewSessionVolunteerJob[] = missingJobs.map((job) => ({
    id: `${sessionId}_${job.id}`,
    sessionId,
    volunteerJobId: job.id,
    quantityAvailable: job.quantityAvailable,
    jobType: job.jobType,
    isActive: true,
    createdAt: now,
    updatedAt: now
  }))

  await db.insert(sessionVolunteerJobs).values(rows)
}

export async function getClassroomById(id: string): Promise<Classroom | null> {
  const result = await db.select().from(classrooms).where(eq(classrooms.id, id))
  return result[0] || null
}

export async function updateClassroom(id: string, updates: Partial<Omit<Classroom, 'id' | 'createdAt'>>): Promise<Classroom | null> {
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.update(classrooms)
    .set(updateData)
    .where(eq(classrooms.id, id))
    .returning()
  
  return result[0] || null
}

export async function deleteClassroom(id: string): Promise<boolean> {
  const result = await db.delete(classrooms).where(eq(classrooms.id, id)).returning()
  return result.length > 0
}

// Schedule management functions
export async function createScheduleEntry(
  scheduleData: Omit<NewSchedule, 'id' | 'createdAt' | 'updatedAt' | 'classroomId'> & { classroomId?: string }
): Promise<Schedule> {
  let classroomId = scheduleData.classroomId

  if (!classroomId && scheduleData.sessionClassroomId) {
    const sessionRoom = await db
      .select({ classroomId: sessionClassrooms.classroomId })
      .from(sessionClassrooms)
      .where(eq(sessionClassrooms.id, scheduleData.sessionClassroomId))
      .limit(1)

    classroomId = sessionRoom[0]?.classroomId
  }

  if (!classroomId) {
    throw new Error('Missing classroom reference for schedule entry.')
  }

  const newSchedule: NewSchedule = {
    ...scheduleData,
    classroomId,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.insert(schedules).values(newSchedule).returning()
  return result[0]
}

export async function getScheduleBySession(sessionId: string): Promise<Schedule[]> {
  return await db.select().from(schedules).where(eq(schedules.sessionId, sessionId))
}

export async function getScheduleWithDetails(sessionId: string): Promise<(Schedule & { 
  classTeachingRequest: ClassTeachingRequest, 
  classroom: SessionClassroom 
})[]> {
  await ensureSessionClassrooms(sessionId)
  const result = await db
    .select({
      id: schedules.id,
      sessionId: schedules.sessionId,
      classTeachingRequestId: schedules.classTeachingRequestId,
      classroomId: schedules.sessionClassroomId,
      period: schedules.period,
      status: schedules.status,
      createdAt: schedules.createdAt,
      updatedAt: schedules.updatedAt,
      classTeachingRequest: {
        id: classTeachingRequests.id,
        sessionId: classTeachingRequests.sessionId,
        guardianId: classTeachingRequests.guardianId,
        className: classTeachingRequests.className,
        description: classTeachingRequests.description,
        gradeRange: classTeachingRequests.gradeRange,
        gradeRangeFrom: classTeachingRequests.gradeRangeFrom,
        gradeRangeTo: classTeachingRequests.gradeRangeTo,
        coTeacher: classTeachingRequests.coTeacher,
        classroomNeeds: classTeachingRequests.classroomNeeds,
        registrationFeeExempt: classTeachingRequests.registrationFeeExempt,
        requiresFee: classTeachingRequests.requiresFee,
        feeAmount: classTeachingRequests.feeAmount,
        schedulingRequirements: classTeachingRequests.schedulingRequirements,
        status: classTeachingRequests.status,
        reviewedBy: classTeachingRequests.reviewedBy,
        reviewedAt: classTeachingRequests.reviewedAt,
        reviewNotes: classTeachingRequests.reviewNotes,
        createdAt: classTeachingRequests.createdAt,
        updatedAt: classTeachingRequests.updatedAt,
      },
      classroom: {
        id: sessionClassrooms.id,
        name: sessionClassrooms.name,
        description: sessionClassrooms.description,
        createdAt: sessionClassrooms.createdAt,
        updatedAt: sessionClassrooms.updatedAt,
      }
    })
    .from(schedules)
    .leftJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .leftJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
    .where(eq(schedules.sessionId, sessionId))
  
  return result as (Schedule & { classTeachingRequest: ClassTeachingRequest, classroom: SessionClassroom })[]
}

export async function updateScheduleEntry(id: string, updates: Partial<Omit<Schedule, 'id' | 'createdAt'>>): Promise<Schedule | null> {
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.update(schedules)
    .set(updateData)
    .where(eq(schedules.id, id))
    .returning()
  
  return result[0] || null
}

export async function deleteScheduleEntry(id: string): Promise<boolean> {
  const result = await db.delete(schedules).where(eq(schedules.id, id)).returning()
  return result.length > 0
}

export async function deleteScheduleByClassroomAndPeriod(sessionId: string, classroomId: string, period: string): Promise<boolean> {
  const result = await db.delete(schedules)
    .where(and(
      eq(schedules.sessionId, sessionId),
      eq(schedules.sessionClassroomId, classroomId),
      eq(schedules.period, period)
    ))
    .returning()
  
  return result.length > 0
}

export async function getApprovedClassesForSession(sessionId: string): Promise<(ClassTeachingRequest & { session: Session, guardian: { firstName: string, lastName: string } })[]> {
  const result = await db
    .select({
      id: classTeachingRequests.id,
      sessionId: classTeachingRequests.sessionId,
      guardianId: classTeachingRequests.guardianId,
      className: classTeachingRequests.className,
      description: classTeachingRequests.description,
      gradeRange: classTeachingRequests.gradeRange,
      gradeRangeFrom: classTeachingRequests.gradeRangeFrom,
      gradeRangeTo: classTeachingRequests.gradeRangeTo,
      coTeacher: classTeachingRequests.coTeacher,
        classroomNeeds: classTeachingRequests.classroomNeeds,
        registrationFeeExempt: classTeachingRequests.registrationFeeExempt,
        requiresFee: classTeachingRequests.requiresFee,
      feeAmount: classTeachingRequests.feeAmount,
      schedulingRequirements: classTeachingRequests.schedulingRequirements,
      status: classTeachingRequests.status,
      reviewedBy: classTeachingRequests.reviewedBy,
      reviewedAt: classTeachingRequests.reviewedAt,
      reviewNotes: classTeachingRequests.reviewNotes,
      createdAt: classTeachingRequests.createdAt,
      updatedAt: classTeachingRequests.updatedAt,
      session: {
        id: sessions.id,
        name: sessions.name,
        startDate: sessions.startDate,
        endDate: sessions.endDate,
        registrationStartDate: sessions.registrationStartDate,
        registrationEndDate: sessions.registrationEndDate,
        teacherRegistrationStartDate: sessions.teacherRegistrationStartDate,
        isActive: sessions.isActive,
        description: sessions.description,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
      },
      guardian: {
        firstName: guardians.firstName,
        lastName: guardians.lastName,
      }
    })
    .from(classTeachingRequests)
    .leftJoin(sessions, eq(classTeachingRequests.sessionId, sessions.id))
    .leftJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
    .where(and(
      eq(classTeachingRequests.sessionId, sessionId),
      eq(classTeachingRequests.status, 'approved')
    ))
  
  return result as (ClassTeachingRequest & { session: Session, guardian: { firstName: string, lastName: string } })[]
}

// Schedule management functions
export async function updateScheduleStatus(sessionId: string, status: 'draft' | 'submitted' | 'published'): Promise<void> {
  await db.update(schedules)
    .set({ 
      status,
      updatedAt: new Date().toISOString()
    })
    .where(eq(schedules.sessionId, sessionId))
}

// Permission checking functions
export async function canAccessFeature(userId: string, feature: 'class_schedules' | 'class_registration' | 'activities'): Promise<boolean> {
  const user = await getUserById(userId)
  if (!user) return false
  
  // Admins have access to everything
  if (user.role === 'admin') return true
  
  // Check if user's family has paid fees for restricted features
  if (feature === 'class_schedules' || feature === 'class_registration') {
    if (user.familyId) {
      const family = await getFamilyById(user.familyId)
      if (!family?.annualFeePaid) return false
    }
  }
  
  return true
}

// Schedule Draft Management Functions
export async function createScheduleDraft(draftData: Omit<NewScheduleDraft, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScheduleDraft> {
  // Deactivate any existing active draft for this user/session
  await db.update(scheduleDrafts)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(and(
      eq(scheduleDrafts.createdBy, draftData.createdBy),
      eq(scheduleDrafts.sessionId, draftData.sessionId),
      eq(scheduleDrafts.isActive, true)
    ))

  const newDraft: NewScheduleDraft = {
    ...draftData,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.insert(scheduleDrafts).values(newDraft).returning()
  return result[0]
}

export async function getScheduleDrafts(sessionId: string, userId?: string): Promise<(ScheduleDraft & { creator: { firstName: string, lastName: string }, entryCount: number })[]> {
  let whereCondition = eq(scheduleDrafts.sessionId, sessionId)
  
  if (userId) {
    whereCondition = and(
      eq(scheduleDrafts.sessionId, sessionId),
      eq(scheduleDrafts.createdBy, userId)
    )!
  }

  const result = await db
    .select({
      id: scheduleDrafts.id,
      sessionId: scheduleDrafts.sessionId,
      createdBy: scheduleDrafts.createdBy,
      name: scheduleDrafts.name,
      description: scheduleDrafts.description,
      isActive: scheduleDrafts.isActive,
      createdAt: scheduleDrafts.createdAt,
      updatedAt: scheduleDrafts.updatedAt,
      creatorFirstName: guardians.firstName,
      creatorLastName: guardians.lastName,
      entryCount: sql<number>`count(${scheduleDraftEntries.id})`.as('entryCount')
    })
    .from(scheduleDrafts)
    .leftJoin(guardians, eq(scheduleDrafts.createdBy, guardians.id))
    .leftJoin(scheduleDraftEntries, eq(scheduleDrafts.id, scheduleDraftEntries.draftId))
    .where(whereCondition)
    .groupBy(scheduleDrafts.id, guardians.firstName, guardians.lastName)
    .orderBy(desc(scheduleDrafts.updatedAt))

  return result.map(row => ({
    id: row.id,
    sessionId: row.sessionId,
    createdBy: row.createdBy,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    creator: {
      firstName: row.creatorFirstName || '',
      lastName: row.creatorLastName || ''
    },
    entryCount: row.entryCount || 0
  }))
}

export async function getScheduleDraftById(draftId: string): Promise<(ScheduleDraft & { creator: { firstName: string, lastName: string } }) | null> {
  const result = await db
    .select({
      id: scheduleDrafts.id,
      sessionId: scheduleDrafts.sessionId,
      createdBy: scheduleDrafts.createdBy,
      name: scheduleDrafts.name,
      description: scheduleDrafts.description,
      isActive: scheduleDrafts.isActive,
      createdAt: scheduleDrafts.createdAt,
      updatedAt: scheduleDrafts.updatedAt,
      creatorFirstName: guardians.firstName,
      creatorLastName: guardians.lastName,
    })
    .from(scheduleDrafts)
    .leftJoin(guardians, eq(scheduleDrafts.createdBy, guardians.id))
    .where(eq(scheduleDrafts.id, draftId))

  if (result.length === 0) return null

  const row = result[0]
  return {
    id: row.id,
    sessionId: row.sessionId,
    createdBy: row.createdBy,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    creator: {
      firstName: row.creatorFirstName || '',
      lastName: row.creatorLastName || ''
    }
  }
}

export async function getScheduleDraftEntries(draftId: string): Promise<ScheduleDraftEntry[]> {
  return await db
    .select()
    .from(scheduleDraftEntries)
    .where(eq(scheduleDraftEntries.draftId, draftId))
}

export async function saveScheduleDraftEntries(draftId: string, entries: { classTeachingRequestId: string, classroomId: string, period: string }[]): Promise<void> {
  // Delete existing entries for this draft
  await db.delete(scheduleDraftEntries).where(eq(scheduleDraftEntries.draftId, draftId))

  // Insert new entries
  if (entries.length > 0) {
    const draft = await db
      .select({ sessionId: scheduleDrafts.sessionId })
      .from(scheduleDrafts)
      .where(eq(scheduleDrafts.id, draftId))
      .limit(1)

    if (!draft.length) {
      throw new Error('Draft not found')
    }

    const sessionRooms = await db
      .select({ id: sessionClassrooms.id, classroomId: sessionClassrooms.classroomId })
      .from(sessionClassrooms)
      .where(eq(sessionClassrooms.sessionId, draft[0].sessionId))

    const roomLookup = new Map(sessionRooms.map((room) => [room.id, room.classroomId]))

    const newEntries: NewScheduleDraftEntry[] = entries.map(entry => ({
      id: generateId(),
      draftId,
      classTeachingRequestId: entry.classTeachingRequestId,
      classroomId: roomLookup.get(entry.classroomId) || entry.classroomId,
      sessionClassroomId: roomLookup.has(entry.classroomId) ? entry.classroomId : null,
      period: entry.period,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))

    await db.insert(scheduleDraftEntries).values(newEntries)
  }

  // Update draft timestamp
  await db.update(scheduleDrafts)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(scheduleDrafts.id, draftId))
}

export async function deleteScheduleDraft(draftId: string): Promise<boolean> {
  const result = await db.delete(scheduleDrafts).where(eq(scheduleDrafts.id, draftId)).returning()
  return result.length > 0
}

export async function setActiveDraft(draftId: string, userId: string): Promise<void> {
  const draft = await getScheduleDraftById(draftId)
  if (!draft) throw new Error('Draft not found')

  // Deactivate all drafts for this user/session
  await db.update(scheduleDrafts)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(and(
      eq(scheduleDrafts.createdBy, userId),
      eq(scheduleDrafts.sessionId, draft.sessionId)
    ))

  // Activate the selected draft
  await db.update(scheduleDrafts)
    .set({ isActive: true, updatedAt: new Date().toISOString() })
    .where(eq(scheduleDrafts.id, draftId))
}

// Conflict detection function
export async function detectScheduleConflicts(sessionId: string): Promise<{
  conflicts: Array<{
    classroomId: string,
    period: string,
    conflictingDrafts: Array<{
      draftId: string,
      draftName: string,
      creatorName: string,
      classTeachingRequestId: string,
      className: string
    }>
  }>
}> {
  const conflicts: any[] = []
  
  // Get all draft entries for the session
  const allEntries = await db
    .select({
      draftId: scheduleDraftEntries.draftId,
      draftName: scheduleDrafts.name,
      creatorFirstName: guardians.firstName,
      creatorLastName: guardians.lastName,
      classroomId: scheduleDraftEntries.sessionClassroomId,
      period: scheduleDraftEntries.period,
      classTeachingRequestId: scheduleDraftEntries.classTeachingRequestId,
      className: classTeachingRequests.className
    })
    .from(scheduleDraftEntries)
    .leftJoin(scheduleDrafts, eq(scheduleDraftEntries.draftId, scheduleDrafts.id))
    .leftJoin(guardians, eq(scheduleDrafts.createdBy, guardians.id))
    .leftJoin(classTeachingRequests, eq(scheduleDraftEntries.classTeachingRequestId, classTeachingRequests.id))
    .where(eq(scheduleDrafts.sessionId, sessionId))

  // Group by classroom/period to find conflicts
  const slotMap = new Map<string, any[]>()
  
  for (const entry of allEntries) {
    const slotKey = `${entry.classroomId}-${entry.period}`
    if (!slotMap.has(slotKey)) {
      slotMap.set(slotKey, [])
    }
    slotMap.get(slotKey)!.push(entry)
  }

  // Find slots with multiple entries (conflicts)
  for (const [slotKey, entries] of slotMap) {
    if (entries.length > 1) {
      const [classroomId, period] = slotKey.split('-')
      conflicts.push({
        classroomId,
        period,
        conflictingDrafts: entries.map(entry => ({
          draftId: entry.draftId,
          draftName: entry.draftName,
          creatorName: `${entry.creatorFirstName} ${entry.creatorLastName}`,
          classTeachingRequestId: entry.classTeachingRequestId,
          className: entry.className
        }))
      })
    }
  }

  return { conflicts }
}

// Schedule comments functions
export async function createScheduleComment(commentData: Omit<NewScheduleComment, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScheduleComment> {
  const newComment: NewScheduleComment = {
    ...commentData,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.insert(scheduleComments).values(newComment).returning()
  return result[0]
}

export async function getScheduleComments(sessionId: string, guardianId?: string): Promise<(ScheduleComment & { guardian: { firstName: string, lastName: string } })[]> {
  // Get all comments for the session
  // If guardianId is provided and user is not admin/moderator, filter to show:
  // - All public comments
  // - Private comments by the requesting user
  // - Private comments if user is admin/moderator
  
  const result = await db
    .select({
      id: scheduleComments.id,
      sessionId: scheduleComments.sessionId,
      guardianId: scheduleComments.guardianId,
      comment: scheduleComments.comment,
      isPublic: scheduleComments.isPublic,
      createdAt: scheduleComments.createdAt,
      updatedAt: scheduleComments.updatedAt,
      guardian: {
        firstName: guardians.firstName,
        lastName: guardians.lastName
      }
    })
    .from(scheduleComments)
    .innerJoin(guardians, eq(scheduleComments.guardianId, guardians.id))
    .where(eq(scheduleComments.sessionId, sessionId))
    .orderBy(desc(scheduleComments.createdAt))

  return result
}

export async function getScheduleCommentsForTeacher(sessionId: string, guardianId: string): Promise<(ScheduleComment & { guardian: { firstName: string, lastName: string } })[]> {
  const user = await getUserById(guardianId)
  if (!user) return []

  const isAdminOrMod = user.role === 'admin' || user.role === 'moderator'
  
  const result = await db
    .select({
      id: scheduleComments.id,
      sessionId: scheduleComments.sessionId,
      guardianId: scheduleComments.guardianId,
      comment: scheduleComments.comment,
      isPublic: scheduleComments.isPublic,
      createdAt: scheduleComments.createdAt,
      updatedAt: scheduleComments.updatedAt,
      guardian: {
        firstName: guardians.firstName,
        lastName: guardians.lastName
      }
    })
    .from(scheduleComments)
    .innerJoin(guardians, eq(scheduleComments.guardianId, guardians.id))
    .where(
      and(
        eq(scheduleComments.sessionId, sessionId),
        // Show public comments OR private comments if user is admin/mod OR private comments by this user
        or(
          eq(scheduleComments.isPublic, true),
          isAdminOrMod ? sql`1=1` : eq(scheduleComments.guardianId, guardianId)
        )
      )
    )
    .orderBy(desc(scheduleComments.createdAt))

  return result
}

export async function updateScheduleComment(id: string, updates: Partial<Omit<ScheduleComment, 'id' | 'createdAt'>>): Promise<ScheduleComment | null> {
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.update(scheduleComments)
    .set(updateData)
    .where(eq(scheduleComments.id, id))
    .returning()
  
  return result[0] || null
}

export async function deleteScheduleComment(id: string): Promise<boolean> {
  const result = await db.delete(scheduleComments).where(eq(scheduleComments.id, id)).returning()
  return result.length > 0
}
