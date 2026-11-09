import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { getClassTeachingRequestsWithSession } from '@/lib/database'
import { db } from '@/lib/db'
import { children, classCategories, classTeachingRequests, guardians, sessions } from '@/lib/schema'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getGradeRangeFromLabel } from '@/lib/grades'
import { syncTeacherGroupMembership } from '@/lib/user-groups'
import { MAX_CLASS_CAPACITY, MIN_CLASS_CAPACITY, MIN_CLASS_HELPERS, isClassPeriodPreference } from '@/lib/class-teaching'
import { getClassTeachingAssignmentMaps, replaceClassTeachingAssignments } from '@/lib/class-teaching-assignments'

const stringIds = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && Boolean(id)))] : []

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin('class-requests')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const sessionsList = await db.select().from(sessions)
    const teachers = await db.select({ id: guardians.id, familyId: guardians.familyId, firstName: guardians.firstName, lastName: guardians.lastName, email: guardians.email, phone: guardians.phone }).from(guardians)
    const [requests, studentTeachers, categories] = await Promise.all([
      getClassTeachingRequestsWithSession(),
      db.select({ id: children.id, familyId: children.familyId, firstName: children.firstName, lastName: children.lastName, grade: children.grade }).from(children),
      db.select().from(classCategories).orderBy(asc(classCategories.orderIndex), asc(classCategories.name))
    ])
    const teacherNames = new Map(teachers.map((teacher) => [teacher.id, `${teacher.firstName} ${teacher.lastName}`.trim()]))
    const teacherContacts = new Map(teachers.map((teacher) => [teacher.id, { email: teacher.email, phone: teacher.phone }]))
    const studentTeacherNames = new Map(studentTeachers.map((child) => [child.id, `${child.firstName} ${child.lastName}`.trim()]))
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]))
    const assignments = await getClassTeachingAssignmentMaps(requests.map(request => request.id))
    return NextResponse.json({ requests: requests.map((request) => ({ ...request, coTeachers: assignments.coTeachers.get(request.id) || [], studentTeachers: assignments.studentTeachers.get(request.id) || [], coTeacherIds: (assignments.coTeachers.get(request.id) || []).map(item => item.id), studentTeacherChildIds: (assignments.studentTeachers.get(request.id) || []).map(item => item.id), categoryName: request.categoryId ? categoryNames.get(request.categoryId) || null : null, teacherDisplayName: request.teacherName || (request.guardianId ? teacherNames.get(request.guardianId) : null) || 'Unassigned', teacherEmail: request.guardianId ? teacherContacts.get(request.guardianId)?.email || null : null, teacherPhone: request.guardianId ? teacherContacts.get(request.guardianId)?.phone || null : null, studentTeacherDisplayName: request.studentTeacherChildId ? studentTeacherNames.get(request.studentTeacherChildId) || null : null, studentCoTeacherDisplayName: request.studentCoTeacherChildId ? studentTeacherNames.get(request.studentCoTeacherChildId) || null : null })), sessions: sessionsList, teachers, children: studentTeachers, categories })
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
    const maxStudents = Number(body.maxStudents || 15)
    if (!Number.isInteger(maxStudents) || maxStudents < MIN_CLASS_CAPACITY || maxStudents > MAX_CLASS_CAPACITY) return NextResponse.json({ error: `Maximum students must be between ${MIN_CLASS_CAPACITY} and ${MAX_CLASS_CAPACITY}` }, { status: 400 })
    const helpersNeeded = Number(body.helpersNeeded)
    if (!Number.isInteger(helpersNeeded) || helpersNeeded < MIN_CLASS_HELPERS || helpersNeeded > 10) return NextResponse.json({ error: `Helpers needed must be between ${MIN_CLASS_HELPERS} and 10` }, { status: 400 })
    const preferredPeriod = body.preferredPeriod || 'any'
    if (!isClassPeriodPreference(preferredPeriod)) return NextResponse.json({ error: 'Choose a valid preferred hour' }, { status: 400 })
    const [category] = body.categoryId ? await db.select({ id: classCategories.id }).from(classCategories).where(eq(classCategories.id, String(body.categoryId))).limit(1) : []
    if (body.categoryId && !category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

    const [session] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const requestedTeacherId = String(body.teacherId || '')
    const requestedTeacherName = String(body.teacherName || '').trim()
    const requestedCoTeacherId = String(body.coTeacherId || '')
    const requestedCoTeacherName = String(body.coTeacher || '').trim()
    if (!requestedTeacherId && !requestedTeacherName) return NextResponse.json({ error: 'Enter a teacher placeholder when no assigned teacher is selected' }, { status: 400 })
    const [selectedTeacher] = requestedTeacherId
      ? await db.select({ id: guardians.id, familyId: guardians.familyId }).from(guardians).where(eq(guardians.id, requestedTeacherId)).limit(1)
      : []
    if (requestedTeacherId && !selectedTeacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
    const guardianId = selectedTeacher?.id || null
    const coTeacherIds = stringIds(Array.isArray(body.coTeacherIds) ? body.coTeacherIds : requestedCoTeacherId ? [requestedCoTeacherId] : [])
    if (guardianId && coTeacherIds.includes(guardianId)) return NextResponse.json({ error: 'The primary teacher cannot also be a co-teacher' }, { status: 400 })
    const selectedCoTeachers = coTeacherIds.length ? await db.select({ id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName }).from(guardians).where(inArray(guardians.id, coTeacherIds)) : []
    if (selectedCoTeachers.length !== coTeacherIds.length) return NextResponse.json({ error: 'One or more co-teachers were not found' }, { status: 404 })
    const legacyStudentIds = [body.studentTeacherChildId, body.studentCoTeacherChildId].filter((id): id is string => typeof id === 'string' && Boolean(id))
    const studentTeacherChildIds = stringIds(Array.isArray(body.studentTeacherChildIds) ? body.studentTeacherChildIds : legacyStudentIds)
    const selectedStudentTeachers = studentTeacherChildIds.length ? await db.select({ id: children.id, familyId: children.familyId, firstName: children.firstName, lastName: children.lastName, grade: children.grade }).from(children).where(inArray(children.id, studentTeacherChildIds)) : []
    if (selectedStudentTeachers.length !== studentTeacherChildIds.length) return NextResponse.json({ error: 'One or more student teachers were not found' }, { status: 404 })
    const firstCoTeacher = coTeacherIds.length ? selectedCoTeachers.find(item => item.id === coTeacherIds[0]) : undefined

    const now = new Date().toISOString()
    const [created] = await db.insert(classTeachingRequests).values({
      id: randomUUID(),
      sessionId,
      guardianId,
      teacherName: guardianId ? null : requestedTeacherName,
      className,
      categoryId: category?.id || null,
      description,
      gradeRange,
      gradeRangeFrom: resolvedGradeRange.from,
      gradeRangeTo: resolvedGradeRange.to,
      maxStudents,
      helpersNeeded,
      coTeacher: firstCoTeacher ? `${firstCoTeacher.firstName} ${firstCoTeacher.lastName}`.trim() : requestedCoTeacherName || null,
      coTeacherId: coTeacherIds[0] || null,
      studentTeacherChildId: studentTeacherChildIds[0] || null,
      studentCoTeacherChildId: studentTeacherChildIds[1] || null,
      classroomNeeds: String(body.classroomNeeds || '').trim() || null,
      registrationFeeExempt: Boolean(body.registrationFeeExempt),
      requiresFee: Boolean(body.requiresFee),
      feeAmount: body.feeAmount === '' || body.feeAmount === undefined ? null : Number(body.feeAmount),
      preferredPeriod,
      schedulingRequirements: String(body.schedulingRequirements || '').trim() || null,
      status: 'approved',
      reviewedBy: auth.session.user.id,
      reviewedAt: now,
      reviewNotes: 'Created by administrator',
      createdAt: now,
      updatedAt: now
    }).returning()
    await replaceClassTeachingAssignments(created.id, coTeacherIds, studentTeacherChildIds)
    if (guardianId) await syncTeacherGroupMembership(guardianId)
    await Promise.all(coTeacherIds.map(syncTeacherGroupMembership))
    return NextResponse.json({ request: { ...created, coTeacherIds, studentTeacherChildIds, coTeachers: selectedCoTeachers, studentTeachers: selectedStudentTeachers } }, { status: 201 })
  } catch (error) {
    console.error('Error creating admin class:', error)
    return NextResponse.json({ error: 'Failed to create class' }, { status: 500 })
  }
}
