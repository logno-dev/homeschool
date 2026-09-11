import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import {
  classRegistrations,
  schedules,
  classTeachingRequests,
  sessionClassrooms,
  children,
  guardians,
  volunteerAssignments,
  volunteerJobs,
  sessionVolunteerJobs,
  families,
  familyRegistrationStatus,
  familySessionFees
} from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { publishRegistrationUpdate } from '@/lib/registration-events'

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('registrations')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const [registrationRows, scheduleRows, volunteerRows, volunteerJobRows, guardianRows, childRows, classroomRows, familyRows, familyStatusRows, feeRows] = await Promise.all([
      db
        .select({
           id: classRegistrations.id,
           status: classRegistrations.status,
           holdExpiresAt: classRegistrations.holdExpiresAt,
           emergencyContact: classRegistrations.emergencyContact,
           emergencyPhone: classRegistrations.emergencyPhone,
           createdAt: classRegistrations.createdAt,
          child: {
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            grade: children.grade,
            familyId: children.familyId
          },
          schedule: {
            id: schedules.id,
            period: schedules.period
          },
          classTeachingRequest: {
            className: classTeachingRequests.className,
            teacherName: classTeachingRequests.teacherName
          },
          classroom: {
            name: sessionClassrooms.name
          }
        })
        .from(classRegistrations)
        .innerJoin(children, eq(classRegistrations.childId, children.id))
        .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
        .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .innerJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
        .where(eq(classRegistrations.sessionId, sessionId)),

      db
        .select({
          id: schedules.id,
          classroomId: sessionClassrooms.id,
          period: schedules.period,
           className: classTeachingRequests.className,
           teacherName: classTeachingRequests.teacherName,
           classroom: sessionClassrooms.name,
          teacherFirstName: guardians.firstName,
           teacherLastName: guardians.lastName,
           maxStudents: classTeachingRequests.maxStudents
        })
        .from(schedules)
        .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .innerJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
        .leftJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
        .where(eq(schedules.sessionId, sessionId)),

      db
        .select({
          id: volunteerAssignments.id,
          familyId: volunteerAssignments.familyId,
          period: volunteerAssignments.period,
          volunteerType: volunteerAssignments.volunteerType,
          status: volunteerAssignments.status,
          holdExpiresAt: volunteerAssignments.holdExpiresAt,
          guardian: {
            id: guardians.id,
            firstName: guardians.firstName,
            lastName: guardians.lastName
          },
          scheduleId: volunteerAssignments.scheduleId,
          volunteerJobId: volunteerAssignments.volunteerJobId,
           className: classTeachingRequests.className,
           teacherName: classTeachingRequests.teacherName,
           classroom: sessionClassrooms.name,
          jobTitle: volunteerJobs.title
        })
        .from(volunteerAssignments)
        .leftJoin(guardians, eq(volunteerAssignments.guardianId, guardians.id))
        .leftJoin(schedules, eq(volunteerAssignments.scheduleId, schedules.id))
        .leftJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
        .leftJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
        .leftJoin(volunteerJobs, eq(volunteerAssignments.volunteerJobId, volunteerJobs.id))
        .where(eq(volunteerAssignments.sessionId, sessionId)),

      db
        .select({
          id: volunteerJobs.id,
          title: volunteerJobs.title,
          jobType: volunteerJobs.jobType,
          quantityAvailable: sessionVolunteerJobs.quantityAvailable
        })
        .from(sessionVolunteerJobs)
        .innerJoin(volunteerJobs, eq(sessionVolunteerJobs.volunteerJobId, volunteerJobs.id))
        .where(and(
          eq(sessionVolunteerJobs.sessionId, sessionId),
          eq(sessionVolunteerJobs.isActive, true)
        )),

      db
        .select({
          id: guardians.id,
          familyId: guardians.familyId,
          firstName: guardians.firstName,
          lastName: guardians.lastName,
          email: guardians.email
        })
        .from(guardians),

      db
        .select({
          id: children.id,
          firstName: children.firstName,
          lastName: children.lastName,
          grade: children.grade,
          familyId: children.familyId
        })
        .from(children),

      db
        .select({
          id: sessionClassrooms.id,
          name: sessionClassrooms.name,
          classroomId: sessionClassrooms.classroomId
        })
        .from(sessionClassrooms)
        .where(eq(sessionClassrooms.sessionId, sessionId)),

      db.select({ id: families.id, name: families.name, email: families.email, phone: families.phone }).from(families),

      db.select({
        id: familyRegistrationStatus.id,
        familyId: familyRegistrationStatus.familyId,
        status: familyRegistrationStatus.status,
        volunteerRequirementsMet: familyRegistrationStatus.volunteerRequirementsMet,
        adminOverride: familyRegistrationStatus.adminOverride,
        adminOverrideReason: familyRegistrationStatus.adminOverrideReason,
        overriddenBy: familyRegistrationStatus.overriddenBy,
        overriddenAt: familyRegistrationStatus.overriddenAt,
        completedAt: familyRegistrationStatus.completedAt,
        createdAt: familyRegistrationStatus.createdAt,
        updatedAt: familyRegistrationStatus.updatedAt
      }).from(familyRegistrationStatus).where(eq(familyRegistrationStatus.sessionId, sessionId)),

      db.select({
        id: familySessionFees.id,
        familyId: familySessionFees.familyId,
        totalFee: familySessionFees.totalFee,
        registrationFee: familySessionFees.registrationFee,
        classFees: familySessionFees.classFees,
        paidAmount: familySessionFees.paidAmount,
        status: familySessionFees.status,
        dueDate: familySessionFees.dueDate,
        overpaymentAmount: familySessionFees.overpaymentAmount,
        overpaymentStatus: familySessionFees.overpaymentStatus
      }).from(familySessionFees).where(eq(familySessionFees.sessionId, sessionId))
    ])

    const registrationCountMap = registrationRows.reduce((acc, row) => {
      acc[row.schedule.id] = (acc[row.schedule.id] || 0) + (row.status === 'registered' ? 1 : 0)
      return acc
    }, {} as Record<string, number>)

    const schedulesResponse = scheduleRows.map((row) => ({
      id: row.id,
      classroomId: row.classroomId,
      period: row.period,
      className: row.className,
      classroom: row.classroom,
       teacher: row.teacherName || `${row.teacherFirstName} ${row.teacherLastName}`,
      maxStudents: row.maxStudents,
      currentRegistrations: registrationCountMap[row.id] || 0
    }))

    const volunteerAssignmentsResponse = volunteerRows.map((row) => ({
      id: row.id,
      familyId: row.familyId,
      period: row.period,
      volunteerType: row.volunteerType,
      status: row.status,
      holdExpiresAt: row.holdExpiresAt,
      guardian: row.guardian,
      schedule: row.scheduleId
        ? {
            id: row.scheduleId,
            period: row.period,
            className: row.className || 'Class',
            classroom: row.classroom || 'Room',
             teacher: row.className ? (row.teacherName || 'Teacher') : 'Teacher'
          }
        : null,
      volunteerJob: row.volunteerJobId
        ? {
            id: row.volunteerJobId,
            title: row.jobTitle || 'Volunteer Job'
          }
        : null
    }))

    const now = new Date().toISOString()
    const isActiveClass = (row: typeof registrationRows[number]) => ['registered', 'waitlisted', 'pending'].includes(row.status)
      || (row.status === 'hold' && (!row.holdExpiresAt || row.holdExpiresAt > now))
    const isActiveVolunteer = (row: typeof volunteerRows[number]) => ['assigned', 'completed', 'pending'].includes(row.status)
      || (row.status === 'hold' && (!row.holdExpiresAt || row.holdExpiresAt > now))
    const activeRegistrationRows = registrationRows.filter(isActiveClass)
    const activeVolunteerRows = volunteerRows.filter(isActiveVolunteer)
    const familyIds = new Set([
      ...activeRegistrationRows.map((row) => row.child.familyId),
      ...activeVolunteerRows.map((row) => row.familyId),
      ...familyStatusRows.map((row) => row.familyId),
      ...feeRows.map((row) => row.familyId)
    ])
    const familyStatusByFamily = new Map<string, typeof familyStatusRows[number]>()
    for (const row of familyStatusRows) {
      const current = familyStatusByFamily.get(row.familyId)
      if (!current || row.updatedAt > current.updatedAt) familyStatusByFamily.set(row.familyId, row)
    }
    const feeByFamily = new Map(feeRows.map((row) => [row.familyId, row]))
    const familyRegistrations = familyRows.filter((family) => familyIds.has(family.id)).map((family) => {
      const familyClasses = activeRegistrationRows.filter((row) => row.child.familyId === family.id)
      const familyVolunteers = activeVolunteerRows.filter((row) => row.familyId === family.id)
      const status = familyStatusByFamily.get(family.id) || null
      const fee = feeByFamily.get(family.id) || null
      const hasCartRows = [...familyClasses, ...familyVolunteers].some((row) => row.status === 'hold' && Boolean(row.holdExpiresAt))
      const needsResolution = [...familyClasses, ...familyVolunteers].some((row) => row.status === 'hold' && !row.holdExpiresAt)
      const hasPendingRows = [...familyClasses, ...familyVolunteers].some((row) => row.status === 'pending')
      const registrationState = status?.status === 'admin_override' ? 'override_needed'
        : status?.status === 'denied' ? 'override_denied'
        : status?.status === 'completed' || status?.status === 'approved' ? 'complete'
        : ['in_progress', 'incomplete'].includes(status?.status || '') ? 'in_progress'
        : hasPendingRows ? 'override_needed'
        : hasCartRows ? 'in_cart'
        : fee ? 'complete'
        : 'in_progress'
      const paymentState = !fee ? 'not_generated'
        : fee.totalFee <= 0 ? 'no_payment_due'
        : fee.paidAmount >= fee.totalFee ? 'paid'
        : fee.dueDate < now.slice(0, 10) ? 'overdue'
        : fee.paidAmount > 0 ? 'partial'
        : 'unpaid'

      return {
        familyId: family.id,
        familyName: family.name,
        email: family.email,
        phone: family.phone,
        registrationState,
        paymentState,
        hasCart: hasCartRows,
        needsResolution,
        status,
        fee: fee ? { ...fee, remainingBalance: Math.max(0, fee.totalFee - fee.paidAmount) } : null,
        emergencyContact: familyClasses.find((row) => row.emergencyContact)?.emergencyContact || null,
        emergencyPhone: familyClasses.find((row) => row.emergencyPhone)?.emergencyPhone || null,
        guardians: guardianRows.filter((guardian) => guardian.familyId === family.id),
        classes: familyClasses.map((row) => ({
          id: row.id,
          status: row.status,
          holdExpiresAt: row.holdExpiresAt,
          child: row.child,
          schedule: row.schedule,
          className: row.classTeachingRequest.className,
          teacherName: row.classTeachingRequest.teacherName,
          classroom: row.classroom.name
        })),
        volunteerAssignments: familyVolunteers.map((row) => ({
          id: row.id,
          status: row.status,
          holdExpiresAt: row.holdExpiresAt,
          period: row.period,
          volunteerType: row.volunteerType,
          guardian: row.guardian,
          className: row.className,
          classroom: row.classroom,
          volunteerJobTitle: row.jobTitle
        }))
      }
    }).sort((a, b) => a.familyName.localeCompare(b.familyName))

    return NextResponse.json({
      registrations: registrationRows,
      schedules: schedulesResponse,
      volunteerAssignments: volunteerAssignmentsResponse,
      volunteerJobs: volunteerJobRows,
      guardians: guardianRows,
      children: childRows,
      classrooms: classroomRows,
      familyRegistrations
    })
  } catch (error) {
    console.error('Error loading admin registrations:', error)
    return NextResponse.json({ error: 'Failed to load registrations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('registrations')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { session } = auth
    const body = await request.json()
    const { sessionId, scheduleId, childId, status = 'registered' } = body

    if (!sessionId || !scheduleId || !childId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const child = await db
      .select({ id: children.id, familyId: children.familyId })
      .from(children)
      .where(eq(children.id, childId))
      .limit(1)

    if (!child.length) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 })
    }

    const scheduleData = await db
      .select({
        schedule: schedules,
        classTeachingRequest: classTeachingRequests
      })
      .from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .where(eq(schedules.id, scheduleId))
      .limit(1)

    if (!scheduleData.length) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    if (status === 'registered') {
      const currentCount = await db
        .select()
        .from(classRegistrations)
        .where(and(
          eq(classRegistrations.scheduleId, scheduleId),
          eq(classRegistrations.status, 'registered')
        ))

      if (currentCount.length >= scheduleData[0].classTeachingRequest.maxStudents) {
        return NextResponse.json({ error: 'Target class is full' }, { status: 400 })
      }

      const existingRegistration = await db
        .select()
        .from(classRegistrations)
        .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
        .where(and(
          eq(classRegistrations.childId, childId),
          eq(classRegistrations.sessionId, sessionId),
          eq(schedules.period, scheduleData[0].schedule.period),
          eq(classRegistrations.status, 'registered')
        ))
        .limit(1)

      if (existingRegistration.length) {
        return NextResponse.json({ error: 'Child already registered for this period' }, { status: 400 })
      }
    }

    const inserted = await db
      .insert(classRegistrations)
      .values({
        id: randomUUID(),
        sessionId,
        scheduleId,
        childId,
        familyId: child[0].familyId,
        registeredBy: session.user.id,
        status
      })
      .returning()

    publishRegistrationUpdate(sessionId)
    return NextResponse.json({ registration: inserted[0] })
  } catch (error) {
    console.error('Error creating registration:', error)
    return NextResponse.json({ error: 'Failed to create registration' }, { status: 500 })
  }
}
