import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { getClassTeachingRequestsWithSession } from '@/lib/database'
import { db } from '@/lib/db'
import { classTeachingRequests, guardians, sessions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getGradeRangeFromLabel } from '@/lib/grades'
import { syncTeacherGroupMembership } from '@/lib/user-groups'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin('class-requests')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const sessionsList = await db.select().from(sessions)
    const teachers = await db.select({ id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName, email: guardians.email }).from(guardians)
    const requests = await getClassTeachingRequestsWithSession()
    const teacherNames = new Map(teachers.map((teacher) => [teacher.id, `${teacher.firstName} ${teacher.lastName}`.trim()]))
    return NextResponse.json({ requests: requests.map((request) => ({ ...request, teacherDisplayName: request.teacherName || teacherNames.get(request.guardianId) || 'Unassigned' })), sessions: sessionsList, teachers })
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
    const auth = await getAuthenticatedAdmin('class-requests')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const body = await request.json()
    const className = String(body.className || '').trim()
    const description = String(body.description || '').trim()
    const gradeRange = String(body.gradeRange || '').trim()
    const sessionId = String(body.sessionId || '')
    if (!className || !description || !gradeRange || !sessionId) return NextResponse.json({ error: 'Session, class name, description, and grade range are required' }, { status: 400 })
    const parsedFrom = body.gradeRangeFrom === undefined || body.gradeRangeFrom === null || body.gradeRangeFrom === '' ? null : Number(body.gradeRangeFrom)
    const parsedTo = body.gradeRangeTo === undefined || body.gradeRangeTo === null || body.gradeRangeTo === '' ? null : Number(body.gradeRangeTo)
    const parsedGradeRange = getGradeRangeFromLabel(gradeRange)
    const resolvedGradeRange = { from: Number.isFinite(parsedFrom) ? parsedFrom : parsedGradeRange.from, to: Number.isFinite(parsedTo) ? parsedTo : parsedGradeRange.to }
    if (resolvedGradeRange.from === null || resolvedGradeRange.to === null) return NextResponse.json({ error: 'Choose a supported grade range' }, { status: 400 })
    if (resolvedGradeRange.from > resolvedGradeRange.to) return NextResponse.json({ error: 'Grade range start must be before its end' }, { status: 400 })

    const [session] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const requestedTeacherId = String(body.teacherId || '')
    const requestedTeacherName = String(body.teacherName || '').trim()
    const requestedCoTeacherId = String(body.coTeacherId || '')
    const requestedCoTeacherName = String(body.coTeacher || '').trim()
    if (!requestedTeacherId && !requestedTeacherName) return NextResponse.json({ error: 'Enter a teacher placeholder when no assigned teacher is selected' }, { status: 400 })
    const [selectedTeacher] = requestedTeacherId
      ? await db.select({ id: guardians.id }).from(guardians).where(eq(guardians.id, requestedTeacherId)).limit(1)
      : []
    const [fallbackTeacher] = await db.select({ id: guardians.id }).from(guardians).limit(1)
    const guardianId = selectedTeacher?.id || fallbackTeacher?.id
    if (!guardianId) return NextResponse.json({ error: 'At least one guardian is required to create a class' }, { status: 400 })
    const [selectedCoTeacher] = requestedCoTeacherId
      ? await db.select({ id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName }).from(guardians).where(eq(guardians.id, requestedCoTeacherId)).limit(1)
      : []
    if (requestedCoTeacherId && !selectedCoTeacher) return NextResponse.json({ error: 'Co-teacher not found' }, { status: 404 })
    if (selectedCoTeacher?.id === selectedTeacher?.id) return NextResponse.json({ error: 'A teacher cannot also be the co-teacher' }, { status: 400 })

    const now = new Date().toISOString()
    const [created] = await db.insert(classTeachingRequests).values({
      id: randomUUID(),
      sessionId,
      guardianId,
      teacherName: requestedTeacherName || null,
      className,
      description,
      gradeRange,
      gradeRangeFrom: resolvedGradeRange.from,
      gradeRangeTo: resolvedGradeRange.to,
      maxStudents: Math.max(1, Number(body.maxStudents || 20)),
      helpersNeeded: Math.max(0, Number(body.helpersNeeded || 0)),
      coTeacher: selectedCoTeacher ? `${selectedCoTeacher.firstName} ${selectedCoTeacher.lastName}`.trim() : requestedCoTeacherName || null,
      coTeacherId: selectedCoTeacher?.id || null,
      classroomNeeds: String(body.classroomNeeds || '').trim() || null,
      registrationFeeExempt: Boolean(body.registrationFeeExempt),
      requiresFee: Boolean(body.requiresFee),
      feeAmount: body.feeAmount === '' || body.feeAmount === undefined ? null : Number(body.feeAmount),
      schedulingRequirements: String(body.schedulingRequirements || '').trim() || null,
      status: 'approved',
      reviewedBy: auth.session.user.id,
      reviewedAt: now,
      reviewNotes: 'Created by administrator',
      createdAt: now,
      updatedAt: now
    }).returning()
    if (requestedTeacherId) await syncTeacherGroupMembership(guardianId)
    if (selectedCoTeacher?.id) await syncTeacherGroupMembership(selectedCoTeacher.id)
    return NextResponse.json({ request: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating admin class:', error)
    return NextResponse.json({ error: 'Failed to create class' }, { status: 500 })
  }
}
