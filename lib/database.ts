import { eq, and, or, desc, asc, isNull, isNotNull, sql } from 'drizzle-orm'
import { db } from './db'
import { families, guardians, children, feePayments, users, sessions, classrooms, schedules, scheduleDrafts, scheduleDraftEntries, classTeachingRequests, scheduleComments } from './schema'
import type { Family, Guardian, Child, FeePayment, User, Session, Classroom, Schedule, ScheduleDraft, ScheduleDraftEntry, ClassTeachingRequest, ScheduleComment, NewFamily, NewGuardian, NewChild, NewFeePayment, NewUser, NewSession, NewClassroom, NewSchedule, NewScheduleDraft, NewScheduleDraftEntry, NewClassTeachingRequest, NewScheduleComment } from './schema'

// Helper function to generate sharing codes
function generateSharingCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Helper function to generate IDs
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 5)
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
  return await db.select().from(guardians).where(eq(guardians.familyId, familyId))
}

export async function getGuardianById(id: string): Promise<Guardian | null> {
  const result = await db.select().from(guardians).where(eq(guardians.id, id))
  return result[0] || null
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
  const result = await db.select().from(users).where(eq(users.id, id))
  return result[0] || null
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
  return await db.select().from(sessions)
}

export async function getSessionById(id: string): Promise<Session | null> {
  const result = await db.select().from(sessions).where(eq(sessions.id, id))
  return result[0] || null
}

export async function getActiveSession(): Promise<Session | null> {
  const result = await db.select().from(sessions).where(eq(sessions.isActive, true))
  return result[0] || null
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

  const now = new Date()
  const sessionEnd = new Date(activeSession.endDate)
  const regStart = new Date(activeSession.registrationStartDate)
  const regEnd = new Date(activeSession.registrationEndDate)
  const teacherRegStart = activeSession.teacherRegistrationStartDate 
    ? new Date(activeSession.teacherRegistrationStartDate) 
    : null

  // Check if we're within the session period
  if (now > sessionEnd) {
    return { isOpen: false, session: activeSession, reason: 'Session has ended' }
  }

  // Check teacher early registration (for families with approved teaching assignments)
  if (guardianId && teacherRegStart && now >= teacherRegStart && now <= regEnd) {
    const hasTeachingAssignments = await hasFamilyTeachingAssignments(guardianId)
    if (hasTeachingAssignments) {
      return { isOpen: true, session: activeSession }
    }
  }

  // Check regular registration
  if (now >= regStart && now <= regEnd) {
    return { isOpen: true, session: activeSession }
  }

  // Registration hasn't started yet
  if (now < regStart) {
    let startDate = regStart
    
    // Check if this family has teaching assignments and can access early registration
    if (guardianId && teacherRegStart && teacherRegStart < regStart) {
      const hasTeachingAssignments = await hasFamilyTeachingAssignments(guardianId)
      if (hasTeachingAssignments) {
        startDate = teacherRegStart
      }
    }
    
    return { 
      isOpen: false, 
      session: activeSession, 
      reason: `Registration opens on ${startDate.toLocaleDateString()}` 
    }
  }

  // Registration has ended
  return { 
    isOpen: false, 
    session: activeSession, 
    reason: `Registration closed on ${regEnd.toLocaleDateString()}` 
  }
}

// Class teaching registration timing (different from regular registration)
export async function isClassTeachingRegistrationOpen(): Promise<{ isOpen: boolean, session: Session | null, reason?: string }> {
  const activeSession = await getActiveSession()
  
  if (!activeSession) {
    return { isOpen: false, session: null, reason: 'No active session' }
  }

  const now = new Date()
  const sessionEnd = new Date(activeSession.endDate)
  const regStart = new Date(activeSession.registrationStartDate)

  // Check if we're past the session end
  if (now > sessionEnd) {
    return { isOpen: false, session: activeSession, reason: 'Session has ended' }
  }

  // Class teaching registration is open from session creation until regular registration starts
  if (now < regStart) {
    return { isOpen: true, session: activeSession }
  }

  // After regular registration starts, class teaching registration closes
  return { 
    isOpen: false, 
    session: activeSession, 
    reason: `Class teaching registration closed when regular registration opened on ${regStart.toLocaleDateString()}` 
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
      className: classTeachingRequests.className,
      description: classTeachingRequests.description,
      gradeRange: classTeachingRequests.gradeRange,
      coTeacher: classTeachingRequests.coTeacher,
      classroomNeeds: classTeachingRequests.classroomNeeds,
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
      coTeacher: classTeachingRequests.coTeacher,
      classroomNeeds: classTeachingRequests.classroomNeeds,
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
  return await updateClassTeachingRequest(id, {
    status: 'approved',
    reviewedBy: reviewerId,
    reviewedAt: new Date().toISOString(),
    reviewNotes: reviewNotes || null
  })
}

export async function rejectClassTeachingRequest(id: string, reviewerId: string, reviewNotes?: string): Promise<ClassTeachingRequest | null> {
  return await updateClassTeachingRequest(id, {
    status: 'rejected',
    reviewedBy: reviewerId,
    reviewedAt: new Date().toISOString(),
    reviewNotes: reviewNotes || null
  })
}

export async function deleteClassTeachingRequest(id: string): Promise<boolean> {
  const result = await db.delete(classTeachingRequests).where(eq(classTeachingRequests.id, id)).returning()
  return result.length > 0
}

// Classroom management functions
export async function createClassroom(classroomData: Omit<NewClassroom, 'id' | 'createdAt' | 'updatedAt'>): Promise<Classroom> {
  const newClassroom: NewClassroom = {
    ...classroomData,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  const result = await db.insert(classrooms).values(newClassroom).returning()
  return result[0]
}

export async function getClassrooms(): Promise<Classroom[]> {
  return await db.select().from(classrooms)
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
export async function createScheduleEntry(scheduleData: Omit<NewSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Schedule> {
  const newSchedule: NewSchedule = {
    ...scheduleData,
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
  classroom: Classroom 
})[]> {
  const result = await db
    .select({
      id: schedules.id,
      sessionId: schedules.sessionId,
      classTeachingRequestId: schedules.classTeachingRequestId,
      classroomId: schedules.classroomId,
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
        coTeacher: classTeachingRequests.coTeacher,
        classroomNeeds: classTeachingRequests.classroomNeeds,
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
        id: classrooms.id,
        name: classrooms.name,
        description: classrooms.description,
        createdAt: classrooms.createdAt,
        updatedAt: classrooms.updatedAt,
      }
    })
    .from(schedules)
    .leftJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .leftJoin(classrooms, eq(schedules.classroomId, classrooms.id))
    .where(eq(schedules.sessionId, sessionId))
  
  return result as (Schedule & { classTeachingRequest: ClassTeachingRequest, classroom: Classroom })[]
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
      eq(schedules.classroomId, classroomId),
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
      coTeacher: classTeachingRequests.coTeacher,
      classroomNeeds: classTeachingRequests.classroomNeeds,
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
    const newEntries: NewScheduleDraftEntry[] = entries.map(entry => ({
      id: generateId(),
      draftId,
      classTeachingRequestId: entry.classTeachingRequestId,
      classroomId: entry.classroomId,
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
      classroomId: scheduleDraftEntries.classroomId,
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
  // Get guardian to check role
  const guardian = await getGuardianById(guardianId)
  if (!guardian) return []
  
  const isAdminOrMod = guardian.role === 'admin' || guardian.role === 'moderator'
  
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