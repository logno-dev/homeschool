import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'

import { 
  createClassTeachingRequest, 
  getClassTeachingRequestsByGuardianWithSession,
  getGuardianById,
  getOpenClassTeachingSessions,
  isClassTeachingRegistrationOpen
} from '@/lib/database'
import { getGlobalSetting } from '@/lib/database'
import { sendClassRequestNotificationEmail } from '@/lib/email'
import type { NewClassTeachingRequest } from '@/lib/schema'
import { getGradeRangeFromLabel } from '@/lib/grades'
import { db } from '@/lib/db'
import { children, classCategories, classTeachingRequests } from '@/lib/schema'
import { and, asc, eq, ne } from 'drizzle-orm'
import { CLASS_PERIODS, CLASS_SLOT_GRADE_RANGES, CLASS_SLOT_TARGET, MAX_CLASS_CAPACITY, MAX_TEACHER_CLASS_FEE, MIN_CLASS_CAPACITY, getClassSlotTarget, isClassPeriodPreference, rangesOverlap } from '@/lib/class-teaching'

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get guardian record
    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json(
        { error: 'Guardian record not found' },
        { status: 404 }
      )
    }

    // Get all requests for this guardian with session info
    const openSessions = await getOpenClassTeachingSessions(session.user.id)
    const requestedSessionId = new URL(request.url).searchParams.get('sessionId')
    const selectedSession = openSessions.find((item) => item.id === requestedSessionId) || openSessions[0] || null
    const [requests, familyChildren, allCategories, activeRequests] = await Promise.all([
      getClassTeachingRequestsByGuardianWithSession(guardian.id),
      db.select({ id: children.id, firstName: children.firstName, lastName: children.lastName }).from(children).where(eq(children.familyId, guardian.familyId)),
      db.select().from(classCategories).orderBy(asc(classCategories.orderIndex), asc(classCategories.name)),
      selectedSession
        ? db.select({ id: classTeachingRequests.id, className: classTeachingRequests.className, categoryId: classTeachingRequests.categoryId, gradeRange: classTeachingRequests.gradeRange, gradeRangeFrom: classTeachingRequests.gradeRangeFrom, gradeRangeTo: classTeachingRequests.gradeRangeTo, preferredPeriod: classTeachingRequests.preferredPeriod, status: classTeachingRequests.status }).from(classTeachingRequests).where(and(eq(classTeachingRequests.sessionId, selectedSession.id), ne(classTeachingRequests.status, 'rejected')))
        : Promise.resolve([])
    ])
    const categories = allCategories.filter((category) => category.isActive)
    const childNames = new Map(familyChildren.map((child) => [child.id, `${child.firstName} ${child.lastName}`.trim()]))
    const categoryNames = new Map(allCategories.map((category) => [category.id, category.name]))
    const slots = Object.fromEntries(CLASS_PERIODS.map((period) => [period.id, Object.fromEntries(CLASS_SLOT_GRADE_RANGES.map((range) => [range.value, [] as Array<{ id: string; className: string; categoryName: string | null; gradeRange: string; status: string }>]))]))
    const flexible = Object.fromEntries(CLASS_SLOT_GRADE_RANGES.map((range) => [range.value, [] as Array<{ id: string; className: string; categoryName: string | null; gradeRange: string; status: string }>]))
    for (const classRequest of activeRequests) {
      const summary = { id: classRequest.id, className: classRequest.className, categoryName: classRequest.categoryId ? categoryNames.get(classRequest.categoryId) || null : null, gradeRange: classRequest.gradeRange, status: classRequest.status }
      for (const range of CLASS_SLOT_GRADE_RANGES) {
        if (!rangesOverlap(classRequest.gradeRangeFrom, classRequest.gradeRangeTo, classRequest.gradeRange, range.value)) continue
        if (classRequest.preferredPeriod === 'any') flexible[range.value].push(summary)
        else if (slots[classRequest.preferredPeriod]) slots[classRequest.preferredPeriod][range.value].push(summary)
      }
    }
    return NextResponse.json({
      requests: requests.map((classRequest) => ({ ...classRequest, categoryName: classRequest.categoryId ? categoryNames.get(classRequest.categoryId) || null : null, studentTeacherDisplayName: classRequest.studentTeacherChildId ? childNames.get(classRequest.studentTeacherChildId) || null : null })),
      categories,
      teachingSessions: openSessions,
      selectedSessionId: selectedSession?.id || null,
      slotSummary: { periods: CLASS_PERIODS, gradeRanges: CLASS_SLOT_GRADE_RANGES, target: CLASS_SLOT_TARGET, targets: Object.fromEntries(CLASS_SLOT_GRADE_RANGES.map((range) => [range.value, getClassSlotTarget(range.value)])), slots, flexible }
    })
  } catch (error) {
    console.error('Error fetching class teaching requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get guardian record
    const guardian = await getGuardianById(session.user.id)
    if (!guardian) {
      return NextResponse.json(
        { error: 'Guardian record not found' },
        { status: 404 }
      )
    }

    // Check if class teaching registration is open
    const body = await request.json()
    const requestedSessionId = body.sessionId ? String(body.sessionId) : undefined
    const registrationStatus = await isClassTeachingRegistrationOpen(session.user.id, requestedSessionId)
    if (!registrationStatus.isOpen) {
      return NextResponse.json(
        { error: registrationStatus.reason || 'Class teaching registration is not open' },
        { status: 400 }
      )
    }

    const teachingSession = registrationStatus.session
    if (!teachingSession) {
      return NextResponse.json(
        { error: 'No class teaching session is available' },
        { status: 400 }
      )
    }

    const { 
      className,
      categoryId,
      description,
      gradeRange,
      gradeRangeFrom,
      gradeRangeTo,
      maxStudents,
      helpersNeeded,
      coTeacher,
      studentTeacherChildId,
      classroomNeeds,
       requiresFee,
      feeAmount,
      preferredPeriod,
      schedulingRequirements
    } = body

    // Validate required fields
    if (!className || !description || !gradeRange || !maxStudents) {
      return NextResponse.json(
        { error: 'Class name, description, grade range, and max students are required' },
        { status: 400 }
      )
    }

    const resolvedPeriod = preferredPeriod || 'any'
    if (!isClassPeriodPreference(resolvedPeriod)) {
      return NextResponse.json({ error: 'Choose a valid preferred hour' }, { status: 400 })
    }

    const [category] = categoryId
      ? await db.select({ id: classCategories.id }).from(classCategories).where(and(eq(classCategories.id, String(categoryId)), eq(classCategories.isActive, true))).limit(1)
      : []
    const [configuredCategory] = await db.select({ id: classCategories.id }).from(classCategories).where(eq(classCategories.isActive, true)).limit(1)
    if (configuredCategory && !category) return NextResponse.json({ error: 'Choose a valid category' }, { status: 400 })

    const fallbackRange = getGradeRangeFromLabel(gradeRange)
    const resolvedFrom = typeof gradeRangeFrom === 'number' ? gradeRangeFrom : fallbackRange.from
    const resolvedTo = typeof gradeRangeTo === 'number' ? gradeRangeTo : fallbackRange.to
    if (resolvedFrom !== null && resolvedTo !== null && resolvedFrom > resolvedTo) {
      return NextResponse.json(
        { error: 'Grade range start must be lower than end.' },
        { status: 400 }
      )
    }

    // Validate max students
    const parsedMaxStudents = Number(maxStudents)
    if (!Number.isInteger(parsedMaxStudents) || parsedMaxStudents < MIN_CLASS_CAPACITY || parsedMaxStudents > MAX_CLASS_CAPACITY) {
      return NextResponse.json(
        { error: `Maximum students must be between ${MIN_CLASS_CAPACITY} and ${MAX_CLASS_CAPACITY}` },
        { status: 400 }
      )
    }

    // Validate helpers needed - minimum 1 if no co-teacher
    const finalHelpersNeeded = helpersNeeded || (coTeacher?.trim() ? 0 : 1)
    if (finalHelpersNeeded < 0 || finalHelpersNeeded > 10) {
      return NextResponse.json(
        { error: 'Helpers needed must be between 0 and 10' },
        { status: 400 }
      )
    }

    // Validate fee amount if fee is required
    const parsedFeeAmount = Number(feeAmount)
    if (requiresFee && (!Number.isFinite(parsedFeeAmount) || parsedFeeAmount <= 0 || parsedFeeAmount > MAX_TEACHER_CLASS_FEE)) {
      return NextResponse.json(
        { error: `Class fees must be between $0.01 and $${MAX_TEACHER_CLASS_FEE}. Contact an admin if a higher fee is needed.` },
        { status: 400 }
      )
    }

    if (studentTeacherChildId) {
      const [studentTeacher] = await db.select({ id: children.id }).from(children).where(and(eq(children.id, String(studentTeacherChildId)), eq(children.familyId, guardian.familyId))).limit(1)
      if (!studentTeacher) return NextResponse.json({ error: 'Student teacher must be a child in your family' }, { status: 400 })
    }

    const newRequest: Omit<NewClassTeachingRequest, 'id' | 'createdAt' | 'updatedAt'> = {
      sessionId: teachingSession.id,
      guardianId: guardian.id,
      className: className.trim(),
      categoryId: category?.id || null,
      description: description.trim(),
      gradeRange: gradeRange.trim(),
      gradeRangeFrom: resolvedFrom,
      gradeRangeTo: resolvedTo,
      maxStudents: parsedMaxStudents,
      helpersNeeded: finalHelpersNeeded,
      coTeacher: coTeacher?.trim() || null,
      studentTeacherChildId: studentTeacherChildId ? String(studentTeacherChildId) : null,
      classroomNeeds: classroomNeeds?.trim() || null,
       // Registration fee exemption is controlled by administrators only.
       registrationFeeExempt: false,
       requiresFee: requiresFee || false,
      feeAmount: requiresFee ? parsedFeeAmount : null,
      preferredPeriod: resolvedPeriod,
      schedulingRequirements: schedulingRequirements?.trim() || null,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null
    }

    const createdRequest = await createClassTeachingRequest(newRequest)

    const notificationRecipients = (await getGlobalSetting('class_request_notification_emails'))
      ?.split(',')
      .map((recipient) => recipient.trim())
      .filter(Boolean) || []
    if (notificationRecipients.length) {
      try {
        await sendClassRequestNotificationEmail({
          recipients: notificationRecipients,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          email: session.user.email,
          className: createdRequest.className,
          description: createdRequest.description,
          gradeRange: createdRequest.gradeRange,
          sessionName: teachingSession.name
        })
      } catch (notificationError) {
        console.error('Unable to send class request notification:', notificationError)
      }
    }

    return NextResponse.json({ request: createdRequest }, { status: 201 })
  } catch (error) {
    console.error('Error creating class teaching request:', error)
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    )
  }
}
