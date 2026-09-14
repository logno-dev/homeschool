import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { classTeachingRequests, schedules } from '@/lib/schema'

export async function getStudentTeacherAssignment(sessionId: string, childId: string, period: string) {
  const [assignment] = await db
    .select({ scheduleId: schedules.id, className: classTeachingRequests.className })
    .from(schedules)
    .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
    .where(and(
      eq(schedules.sessionId, sessionId),
      eq(schedules.status, 'published'),
      eq(schedules.period, period),
      eq(classTeachingRequests.studentTeacherChildId, childId)
    ))
    .limit(1)
  return assignment || null
}
