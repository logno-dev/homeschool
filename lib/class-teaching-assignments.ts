import 'server-only'
import { randomUUID } from 'crypto'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { children, classCoTeachers, classStudentTeachers, guardians } from '@/lib/schema'

export interface AssignedCoTeacher { id: string; firstName: string; lastName: string; email: string }
export interface AssignedStudentTeacher { id: string; familyId: string; firstName: string; lastName: string; grade: string }

export async function getClassTeachingAssignmentMaps(requestIds: string[]) {
  const ids = [...new Set(requestIds)]
  const [coTeacherRows, studentTeacherRows] = ids.length ? await Promise.all([
    db.select({ requestId: classCoTeachers.classTeachingRequestId, id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName, email: guardians.email })
      .from(classCoTeachers).innerJoin(guardians, eq(classCoTeachers.guardianId, guardians.id)).where(inArray(classCoTeachers.classTeachingRequestId, ids)),
    db.select({ requestId: classStudentTeachers.classTeachingRequestId, id: children.id, familyId: children.familyId, firstName: children.firstName, lastName: children.lastName, grade: children.grade })
      .from(classStudentTeachers).innerJoin(children, eq(classStudentTeachers.childId, children.id)).where(inArray(classStudentTeachers.classTeachingRequestId, ids)),
  ]) : [[], []]
  const coTeachers = new Map<string, AssignedCoTeacher[]>()
  const studentTeachers = new Map<string, AssignedStudentTeacher[]>()
  for (const row of coTeacherRows) coTeachers.set(row.requestId, [...(coTeachers.get(row.requestId) || []), row])
  for (const row of studentTeacherRows) studentTeachers.set(row.requestId, [...(studentTeachers.get(row.requestId) || []), row])
  return { coTeachers, studentTeachers }
}

export async function replaceClassTeachingAssignments(requestId: string, coTeacherIds: string[], studentTeacherChildIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(classCoTeachers).where(eq(classCoTeachers.classTeachingRequestId, requestId))
    await tx.delete(classStudentTeachers).where(eq(classStudentTeachers.classTeachingRequestId, requestId))
    if (coTeacherIds.length) await tx.insert(classCoTeachers).values(coTeacherIds.map(guardianId => ({ id: randomUUID(), classTeachingRequestId: requestId, guardianId })))
    if (studentTeacherChildIds.length) await tx.insert(classStudentTeachers).values(studentTeacherChildIds.map(childId => ({ id: randomUUID(), classTeachingRequestId: requestId, childId })))
  })
}
