import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { 
  getClassTeachingRequestById,
  approveClassTeachingRequest,
  rejectClassTeachingRequest,
  updateClassTeachingRequest,
  getGuardianById
} from '@/lib/database'
import { getGradeRangeFromLabel } from '@/lib/grades'
import { db } from '@/lib/db'
import { children, classCategories, guardians } from '@/lib/schema'
import { syncTeacherGroupMembership } from '@/lib/user-groups'
import { and, eq, inArray } from 'drizzle-orm'
import { MAX_CLASS_CAPACITY, MIN_CLASS_CAPACITY, MIN_CLASS_HELPERS, isClassPeriodPreference } from '@/lib/class-teaching'
import { getClassTeachingAssignmentMaps, replaceClassTeachingAssignments } from '@/lib/class-teaching-assignments'

const stringIds = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && Boolean(id)))] : []

export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('class-requests')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { requestId } = await params
    const teachingRequest = await getClassTeachingRequestById(requestId)
    
    if (!teachingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ request: teachingRequest })
  } catch (error) {
    console.error('Error fetching class teaching request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch request' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('class-requests')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { session } = auth

    const body = await request.json()
    const { action, reviewNotes, ...editData } = body

    const { requestId } = await params
    
    let updatedRequest

    // If action is provided, handle approval/rejection
    if (action) {
      if (!['approve', 'reject', 'request_changes'].includes(action)) {
        return NextResponse.json(
          { error: 'Valid action (approve, reject, or request_changes) is required' },
          { status: 400 }
        )
      }

      const reviewer = await getGuardianById(session.user.id)
      if (!reviewer) {
        return NextResponse.json(
          { error: 'A guardian profile is required to review class requests' },
          { status: 400 }
        )
      }

      if (action === 'approve') {
        updatedRequest = await approveClassTeachingRequest(requestId, reviewer.id, reviewNotes)
      } else if (action === 'reject') {
        updatedRequest = await rejectClassTeachingRequest(requestId, reviewer.id, reviewNotes)
      } else {
        updatedRequest = await updateClassTeachingRequest(requestId, {
          status: 'changes_requested',
          reviewedBy: reviewer.id,
          reviewedAt: new Date().toISOString(),
          reviewNotes: reviewNotes?.trim() || null
        })
      }
    } else {
      // Handle editing the request fields
      const updateData: any = {}
      const currentRequest = await getClassTeachingRequestById(requestId)
      let coTeacherIds: string[] | undefined
      let studentTeacherChildIds: string[] | undefined
      let previousCoTeacherIds: string[] = []
      let selectedCoTeachers: Array<{ id: string; firstName: string; lastName: string; email: string }> = []
      if (Array.isArray(editData.coTeacherIds)) {
        const nextCoTeacherIds = stringIds(editData.coTeacherIds)
        coTeacherIds = nextCoTeacherIds
        const primaryTeacherId = String(editData.teacherId || currentRequest?.guardianId || '')
        if (primaryTeacherId && nextCoTeacherIds.includes(primaryTeacherId)) return NextResponse.json({ error: 'The primary teacher cannot also be a co-teacher' }, { status: 400 })
        selectedCoTeachers = nextCoTeacherIds.length ? await db.select({ id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName, email: guardians.email }).from(guardians).where(inArray(guardians.id, nextCoTeacherIds)) : []
        if (selectedCoTeachers.length !== nextCoTeacherIds.length) return NextResponse.json({ error: 'One or more co-teachers were not found' }, { status: 404 })
        const first = nextCoTeacherIds.length ? selectedCoTeachers.find(item => item.id === nextCoTeacherIds[0]) : undefined
        updateData.coTeacherId = nextCoTeacherIds[0] || null
        updateData.coTeacher = first ? `${first.firstName} ${first.lastName}`.trim() : null
      }
      if (Array.isArray(editData.studentTeacherChildIds)) {
        const nextStudentTeacherChildIds = stringIds(editData.studentTeacherChildIds)
        studentTeacherChildIds = nextStudentTeacherChildIds
        const selected = nextStudentTeacherChildIds.length ? await db.select({ id: children.id }).from(children).where(inArray(children.id, nextStudentTeacherChildIds)) : []
        if (selected.length !== nextStudentTeacherChildIds.length) return NextResponse.json({ error: 'One or more student teachers were not found' }, { status: 404 })
        updateData.studentTeacherChildId = nextStudentTeacherChildIds[0] || null
        updateData.studentCoTeacherChildId = nextStudentTeacherChildIds[1] || null
      }
      
      if (editData.className !== undefined) updateData.className = editData.className.trim()
      if (editData.categoryId !== undefined) {
        const categoryId = String(editData.categoryId || '')
        const [category] = categoryId ? await db.select({ id: classCategories.id }).from(classCategories).where(eq(classCategories.id, categoryId)).limit(1) : []
        if (categoryId && !category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
        updateData.categoryId = category?.id || null
      }
      if (editData.description !== undefined) updateData.description = editData.description.trim()
      if (editData.gradeRange !== undefined) updateData.gradeRange = editData.gradeRange.trim()
      if (editData.gradeRangeFrom !== undefined) updateData.gradeRangeFrom = editData.gradeRangeFrom
      if (editData.gradeRangeTo !== undefined) updateData.gradeRangeTo = editData.gradeRangeTo
      if (editData.maxStudents !== undefined) {
        const maxStudents = Number(editData.maxStudents)
        if (!Number.isInteger(maxStudents) || maxStudents < MIN_CLASS_CAPACITY || maxStudents > MAX_CLASS_CAPACITY) return NextResponse.json({ error: `Maximum students must be between ${MIN_CLASS_CAPACITY} and ${MAX_CLASS_CAPACITY}` }, { status: 400 })
        updateData.maxStudents = maxStudents
      }
      if (editData.helpersNeeded !== undefined) {
        const helpersNeeded = Number(editData.helpersNeeded)
        if (!Number.isInteger(helpersNeeded) || helpersNeeded < MIN_CLASS_HELPERS || helpersNeeded > 10) return NextResponse.json({ error: `Helpers needed must be between ${MIN_CLASS_HELPERS} and 10` }, { status: 400 })
        updateData.helpersNeeded = helpersNeeded
      }
      if (coTeacherIds === undefined && editData.coTeacherId !== undefined) {
        const coTeacherId = String(editData.coTeacherId || '')
        if (coTeacherId) {
          const [coTeacher] = await db.select({ id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName }).from(guardians).where(eq(guardians.id, coTeacherId)).limit(1)
          if (!coTeacher) return NextResponse.json({ error: 'Co-teacher not found' }, { status: 404 })
          updateData.coTeacher = `${coTeacher.firstName} ${coTeacher.lastName}`.trim()
        }
        updateData.coTeacherId = coTeacherId || null
        if (!coTeacherId) updateData.coTeacher = editData.coTeacher?.trim() || null
        if (coTeacherId !== currentRequest?.coTeacherId && editData.studentCoTeacherChildId === undefined) updateData.studentCoTeacherChildId = null
      } else if (coTeacherIds === undefined && editData.coTeacher !== undefined) {
        updateData.coTeacher = editData.coTeacher?.trim() || null
      }
      if (editData.classroomNeeds !== undefined) updateData.classroomNeeds = editData.classroomNeeds?.trim() || null
      if (editData.registrationFeeExempt !== undefined) updateData.registrationFeeExempt = Boolean(editData.registrationFeeExempt)
      if (editData.requiresFee !== undefined) updateData.requiresFee = editData.requiresFee
      if (editData.feeAmount !== undefined) updateData.feeAmount = editData.requiresFee ? parseFloat(editData.feeAmount) : null
      if (editData.preferredPeriod !== undefined) {
        if (!isClassPeriodPreference(editData.preferredPeriod)) return NextResponse.json({ error: 'Choose a valid preferred hour' }, { status: 400 })
        updateData.preferredPeriod = editData.preferredPeriod
      }
      if (editData.schedulingRequirements !== undefined) updateData.schedulingRequirements = editData.schedulingRequirements?.trim() || null
      if (editData.teacherId !== undefined || editData.teacherName !== undefined) {
        const teacherId = String(editData.teacherId || '')
        if (teacherId) {
          const [teacher] = await db.select({ id: guardians.id }).from(guardians).where(eq(guardians.id, teacherId)).limit(1)
          if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
          updateData.guardianId = teacher.id
          updateData.teacherName = null
          if (teacher.id !== currentRequest?.guardianId && editData.studentTeacherChildId === undefined) updateData.studentTeacherChildId = null
        } else {
          const teacherName = String(editData.teacherName || '').trim()
          if (!teacherName) return NextResponse.json({ error: 'Enter a teacher placeholder when no assigned teacher is selected' }, { status: 400 })
          updateData.guardianId = null
          updateData.teacherName = teacherName
          updateData.studentTeacherChildId = null
        }
      }
      if (studentTeacherChildIds === undefined && editData.studentTeacherChildId !== undefined) {
        const studentTeacherChildId = String(editData.studentTeacherChildId || '')
        const targetGuardianId = updateData.guardianId !== undefined ? updateData.guardianId : currentRequest?.guardianId
        if (studentTeacherChildId && !targetGuardianId) return NextResponse.json({ error: 'Select an assigned parent teacher before choosing a student teacher' }, { status: 400 })
        if (studentTeacherChildId) {
          const [targetGuardian] = await db.select({ familyId: guardians.familyId }).from(guardians).where(eq(guardians.id, targetGuardianId)).limit(1)
          const [studentTeacher] = targetGuardian
            ? await db.select({ id: children.id }).from(children).where(and(eq(children.id, studentTeacherChildId), eq(children.familyId, targetGuardian.familyId))).limit(1)
            : []
          if (!studentTeacher) return NextResponse.json({ error: "Student teacher must belong to the selected teacher's family" }, { status: 400 })
        }
        updateData.studentTeacherChildId = studentTeacherChildId || null
      }
      if (studentTeacherChildIds === undefined && editData.studentCoTeacherChildId !== undefined) {
        const studentCoTeacherChildId = String(editData.studentCoTeacherChildId || '')
        const targetCoTeacherId = updateData.coTeacherId !== undefined ? updateData.coTeacherId : currentRequest?.coTeacherId
        if (studentCoTeacherChildId && !targetCoTeacherId) return NextResponse.json({ error: 'Select the student co-teacher parent first' }, { status: 400 })
        if (studentCoTeacherChildId) {
          const [targetCoTeacher] = await db.select({ familyId: guardians.familyId }).from(guardians).where(eq(guardians.id, targetCoTeacherId)).limit(1)
          const [studentCoTeacher] = targetCoTeacher
            ? await db.select({ id: children.id }).from(children).where(and(eq(children.id, studentCoTeacherChildId), eq(children.familyId, targetCoTeacher.familyId))).limit(1)
            : []
          if (!studentCoTeacher) return NextResponse.json({ error: "Student co-teacher must belong to the selected co-teacher parent's family" }, { status: 400 })
        }
        updateData.studentCoTeacherChildId = studentCoTeacherChildId || null
      }
      const effectiveStudentTeacherId = updateData.studentTeacherChildId !== undefined ? updateData.studentTeacherChildId : currentRequest?.studentTeacherChildId
      const effectiveStudentCoTeacherId = updateData.studentCoTeacherChildId !== undefined ? updateData.studentCoTeacherChildId : currentRequest?.studentCoTeacherChildId
      if (effectiveStudentTeacherId && effectiveStudentTeacherId === effectiveStudentCoTeacherId) return NextResponse.json({ error: 'The same child cannot be both student teacher and student co-teacher' }, { status: 400 })

      if (updateData.gradeRange && (updateData.gradeRangeFrom === undefined || updateData.gradeRangeTo === undefined)) {
        const fallbackRange = getGradeRangeFromLabel(updateData.gradeRange)
        if (updateData.gradeRangeFrom === undefined) {
          updateData.gradeRangeFrom = fallbackRange.from
        }
        if (updateData.gradeRangeTo === undefined) {
          updateData.gradeRangeTo = fallbackRange.to
        }
      }

      if (updateData.gradeRangeFrom !== undefined && updateData.gradeRangeTo !== undefined) {
        if (updateData.gradeRangeFrom !== null && updateData.gradeRangeTo !== null && updateData.gradeRangeFrom > updateData.gradeRangeTo) {
          return NextResponse.json(
            { error: 'Grade range start must be lower than end.' },
            { status: 400 }
          )
        }
      }

      const previousRequest = currentRequest
      updatedRequest = await updateClassTeachingRequest(requestId, updateData)
      if (updatedRequest) {
        if (coTeacherIds !== undefined || studentTeacherChildIds !== undefined) {
          const currentAssignments = await getClassTeachingAssignmentMaps([requestId])
          previousCoTeacherIds = (currentAssignments.coTeachers.get(requestId) || []).map(item => item.id)
          await replaceClassTeachingAssignments(requestId, coTeacherIds ?? (currentAssignments.coTeachers.get(requestId) || []).map(item => item.id), studentTeacherChildIds ?? (currentAssignments.studentTeachers.get(requestId) || []).map(item => item.id))
        }
        if (updatedRequest.guardianId) await syncTeacherGroupMembership(updatedRequest.guardianId)
        if (previousRequest?.guardianId && previousRequest.guardianId !== updatedRequest.guardianId) await syncTeacherGroupMembership(previousRequest.guardianId)
        if (updatedRequest.coTeacherId) await syncTeacherGroupMembership(updatedRequest.coTeacherId)
        if (previousRequest?.coTeacherId && previousRequest.coTeacherId !== updatedRequest.coTeacherId) await syncTeacherGroupMembership(previousRequest.coTeacherId)
        await Promise.all((coTeacherIds || []).map(syncTeacherGroupMembership))
        await Promise.all(previousCoTeacherIds.filter(id => !(coTeacherIds || []).includes(id)).map(syncTeacherGroupMembership))
      }
    }

    if (!updatedRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    const assignments = await getClassTeachingAssignmentMaps([updatedRequest.id])
    await Promise.all((assignments.coTeachers.get(updatedRequest.id) || []).map(item => syncTeacherGroupMembership(item.id)))
    return NextResponse.json({ request: { ...updatedRequest, coTeachers: assignments.coTeachers.get(updatedRequest.id) || [], studentTeachers: assignments.studentTeachers.get(updatedRequest.id) || [], coTeacherIds: (assignments.coTeachers.get(updatedRequest.id) || []).map(item => item.id), studentTeacherChildIds: (assignments.studentTeachers.get(updatedRequest.id) || []).map(item => item.id) } })
  } catch (error) {
    console.error('Error updating class teaching request:', error)
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    )
  }
}
