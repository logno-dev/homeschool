import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { classStudentTeachers, classTeachingRequests, schedules } from '@/lib/schema'

export async function getStudentTeacherAssignment(sessionId: string, childId: string, period: string) {
  const [assignment] = await db
    .select({ scheduleId: schedules.id, className: classTeachingRequests.className })
    .from(classStudentTeachers)
    .innerJoin(classTeachingRequests, eq(classStudentTeachers.classTeachingRequestId, classTeachingRequests.id))
    .innerJoin(schedules, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .where(and(
      eq(schedules.sessionId, sessionId),
      eq(schedules.status, 'published'),
      eq(schedules.period, period),
      eq(classStudentTeachers.childId, childId)
    ))
    .limit(1)
  return assignment || null
}
