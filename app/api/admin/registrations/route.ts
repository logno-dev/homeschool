import { NextResponse } from 'next/server'
import { refreshRegistrationFees } from '@/lib/fee-calculation'
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
  familySessionFees,
  waitlistVacancyFlags
} from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { publishRegistrationUpdate } from '@/lib/registration-events'
import { getStudentTeacherAssignment } from '@/lib/student-teachers'
import { isValidPhoneNumber } from '@/lib/phone'
import { getNextWaitlistRank } from '@/lib/waitlist'

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

    const [registrationRows, scheduleRows, volunteerRows, volunteerJobRows, guardianRows, childRows, classroomRows, familyRows, familyStatusRows, feeRows, vacancyFlagRows] = await Promise.all([
      db
        .select({
           id: classRegistrations.id,
           status: classRegistrations.status,
            holdExpiresAt: classRegistrations.holdExpiresAt,
            waitlistRank: classRegistrations.waitlistRank,
            registeredAt: classRegistrations.registeredAt,
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
          email: guardians.email,
          phone: guardians.phone
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
      }).from(familySessionFees).where(eq(familySessionFees.sessionId, sessionId)),

      db.select().from(waitlistVacancyFlags).where(and(eq(waitlistVacancyFlags.sessionId, sessionId), eq(waitlistVacancyFlags.status, 'open')))
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

    const occupancyTime = new Date().toISOString()
    const vacancyFlags = vacancyFlagRows.map((flag) => {
      const schedule = schedulesResponse.find((item) => item.id === flag.scheduleId)
      const queue = registrationRows.filter((row) => row.schedule.id === flag.scheduleId && row.status === 'waitlisted').sort((a, b) => (a.waitlistRank ?? Number.MAX_SAFE_INTEGER) - (b.waitlistRank ?? Number.MAX_SAFE_INTEGER) || a.registeredAt.localeCompare(b.registeredAt) || a.id.localeCompare(b.id))
      const first = queue[0]
      const family = first ? familyRows.find((item) => item.id === first.child.familyId) : null
      const occupied = registrationRows.filter((row) => row.schedule.id === flag.scheduleId && (['registered', 'pending'].includes(row.status) || (row.status === 'hold' && Boolean(row.holdExpiresAt && row.holdExpiresAt > occupancyTime)))).length
      return {
        ...flag,
        className: schedule?.className || 'Class',
        period: schedule?.period || '',
        currentOpenSlots: schedule ? Math.max(0, schedule.maxStudents - occupied) : 0,
        currentWaitlistCount: queue.length,
        nextStudent: first ? {
          registrationId: first.id,
          childName: `${first.child.firstName} ${first.child.lastName}`,
          familyName: family?.name || 'Family',
          familyEmail: family?.email || '',
          familyPhone: family?.phone || '',
          guardians: guardianRows.filter((guardian) => guardian.familyId === first.child.familyId),
        } : null,
      }
    })

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

      const emergencyContactRow = familyClasses.find((row) => row.emergencyContact && row.emergencyPhone)
        || familyClasses.find((row) => row.emergencyContact || row.emergencyPhone)

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
        emergencyContact: emergencyContactRow?.emergencyContact || null,
        emergencyPhone: emergencyContactRow?.emergencyPhone || null,
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
      familyRegistrations,
      vacancyFlags
    })
  } catch (error) {
    console.error('Error loading admin registrations:', error)
    return NextResponse.json({ error: 'Failed to load registrations' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('registrations')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json()
    const familyId = typeof body.familyId === 'string' ? body.familyId.trim() : ''
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
    const name = typeof body.emergencyContact?.name === 'string' ? body.emergencyContact.name.trim() : ''
    const phone = typeof body.emergencyContact?.phone === 'string' ? body.emergencyContact.phone.trim() : ''

    if (!familyId || !sessionId || !name || !phone) {
      return NextResponse.json({ error: 'Family, session, emergency contact name, and phone are required.' }, { status: 400 })
    }
    if (!isValidPhoneNumber(phone)) {
      return NextResponse.json({ error: 'Use the phone format (555) 123-4567.' }, { status: 400 })
    }

    const updated = await db
      .update(classRegistrations)
      .set({ emergencyContact: name, emergencyPhone: phone, updatedAt: new Date().toISOString() })
      .where(and(eq(classRegistrations.familyId, familyId), eq(classRegistrations.sessionId, sessionId)))
      .returning({ id: classRegistrations.id })

    if (!updated.length) {
      return NextResponse.json({ error: 'This family has no class registrations in the selected session.' }, { status: 404 })
    }

    publishRegistrationUpdate(sessionId)
    return NextResponse.json({ emergencyContact: name, emergencyPhone: phone, updatedCount: updated.length })
  } catch (error) {
    console.error('Error updating family emergency contact:', error)
    return NextResponse.json({ error: 'Failed to update emergency contact' }, { status: 500 })
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
    const allowOverload = body.allowOverload === true

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

    const existingContactRows = await db
      .select({ emergencyContact: classRegistrations.emergencyContact, emergencyPhone: classRegistrations.emergencyPhone })
      .from(classRegistrations)
      .where(and(eq(classRegistrations.familyId, child[0].familyId), eq(classRegistrations.sessionId, sessionId)))
    const existingEmergencyContact = existingContactRows.find((row) => row.emergencyContact && row.emergencyPhone)
      || existingContactRows.find((row) => row.emergencyContact || row.emergencyPhone)

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

    if (status === 'waitlisted') {
      const [existingWaitlist] = await db.select({ id: classRegistrations.id }).from(classRegistrations).where(and(eq(classRegistrations.scheduleId, scheduleId), eq(classRegistrations.childId, childId), eq(classRegistrations.status, 'waitlisted'))).limit(1)
      if (existingWaitlist) return NextResponse.json({ error: 'Child is already on this waitlist' }, { status: 409 })
    }
    if (status === 'registered') {
      const [firstWaitlisted] = await db.select({ id: classRegistrations.id }).from(classRegistrations).where(and(eq(classRegistrations.scheduleId, scheduleId), eq(classRegistrations.status, 'waitlisted'))).limit(1)
      if (firstWaitlisted) return NextResponse.json({ error: 'This class has a waitlist. Promote the first waitlisted student before adding another student.', code: 'WAITLIST_ORDER' }, { status: 409 })
    }

    if (status === 'registered') {
      const studentTeacherAssignment = await getStudentTeacherAssignment(sessionId, childId, scheduleData[0].schedule.period)
      if (studentTeacherAssignment) return NextResponse.json({ error: `Child is the student teacher for ${studentTeacherAssignment.className} during this period` }, { status: 400 })
      const currentCount = await db
        .select()
        .from(classRegistrations)
        .where(and(
          eq(classRegistrations.scheduleId, scheduleId),
          eq(classRegistrations.status, 'registered')
        ))

      if (!allowOverload && currentCount.length >= scheduleData[0].classTeachingRequest.maxStudents) {
        return NextResponse.json({ error: 'Target class is full', code: 'CLASS_FULL', currentRegistrations: currentCount.length, maxStudents: scheduleData[0].classTeachingRequest.maxStudents }, { status: 409 })
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

    const inserted = await db.transaction(async (tx) => {
      const result = await tx
      .insert(classRegistrations)
      .values({
        id: randomUUID(),
        sessionId,
        scheduleId,
        childId,
        familyId: child[0].familyId,
        registeredBy: session.user.id,
        emergencyContact: existingEmergencyContact?.emergencyContact || null,
        emergencyPhone: existingEmergencyContact?.emergencyPhone || null,
        status,
        waitlistRank: status === 'waitlisted' ? await getNextWaitlistRank(tx, scheduleId) : null,
      })
      .returning()
      await refreshRegistrationFees(sessionId, child[0].familyId, tx)
      return result
    })

    publishRegistrationUpdate(sessionId)
    return NextResponse.json({ registration: inserted[0] })
  } catch (error) {
    console.error('Error creating registration:', error)
    return NextResponse.json({ error: 'Failed to create registration' }, { status: 500 })
  }
}
