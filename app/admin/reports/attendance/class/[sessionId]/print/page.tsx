import Link from 'next/link'
import { requireAdminAccess } from '@/lib/server-auth'
import { db } from '@/lib/db'
import {
  schedules,
  classTeachingRequests,
  sessionClassrooms,
  guardians,
  classRegistrations,
  children,
  volunteerAssignments
} from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { getSessionById } from '@/lib/database'
import PrintTrigger from '../../../../../reports/classrooms/[sessionId]/print/PrintTrigger'

export const runtime = 'nodejs'

const PERIODS = [
  { id: 'first', name: 'First Hour' },
  { id: 'second', name: 'Second Hour' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'third', name: 'Third Hour' }
]

const WEEKS = 6

interface PrintPageProps {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ print?: string }>
}

export default async function ClassroomAttendancePrintPage({ params, searchParams }: PrintPageProps) {
  await requireAdminAccess()
  const { sessionId } = await params
  const { print } = await searchParams
  const session = await getSessionById(sessionId)

  const [scheduleRows, registrationRows, volunteerRows] = await Promise.all([
    db
      .select({
        scheduleId: schedules.id,
        period: schedules.period,
        className: classTeachingRequests.className,
        classroomName: sessionClassrooms.name,
        teacherId: guardians.id,
        teacherFirstName: guardians.firstName,
        teacherLastName: guardians.lastName
      })
      .from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
      .innerJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
      .where(and(
        eq(schedules.sessionId, sessionId),
        eq(schedules.status, 'published')
      )),
    db
      .select({
        scheduleId: classRegistrations.scheduleId,
        child: {
          id: children.id,
          firstName: children.firstName,
          lastName: children.lastName,
          grade: children.grade
        }
      })
      .from(classRegistrations)
      .innerJoin(children, eq(classRegistrations.childId, children.id))
      .where(and(
        eq(classRegistrations.sessionId, sessionId),
        eq(classRegistrations.status, 'registered')
      )),
    db
      .select({
        scheduleId: volunteerAssignments.scheduleId,
        volunteerType: volunteerAssignments.volunteerType,
        guardian: {
          id: guardians.id,
          firstName: guardians.firstName,
          lastName: guardians.lastName
        }
      })
      .from(volunteerAssignments)
      .innerJoin(guardians, eq(volunteerAssignments.guardianId, guardians.id))
      .where(and(
        eq(volunteerAssignments.sessionId, sessionId),
        eq(volunteerAssignments.status, 'assigned')
      ))
  ])

  const weekDates = (() => {
    if (!session?.startDate) return [] as string[]
    const start = new Date(session.startDate)
    if (Number.isNaN(start.getTime())) return [] as string[]
    return Array.from({ length: WEEKS }).map((_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index * 7)
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric'
      })
    })
  })()

  const rosterBySchedule = new Map<string, typeof registrationRows>()
  registrationRows.forEach((row) => {
    const list = rosterBySchedule.get(row.scheduleId) || []
    list.push(row)
    rosterBySchedule.set(row.scheduleId, list)
  })

  const volunteersBySchedule = new Map<string, typeof volunteerRows>()
  volunteerRows.forEach((row) => {
    if (!row.scheduleId) return
    const list = volunteersBySchedule.get(row.scheduleId) || []
    list.push(row)
    volunteersBySchedule.set(row.scheduleId, list)
  })

  const periodOrder: Record<string, number> = { first: 0, second: 1, lunch: 2, third: 3 }
  const sortedSchedules = [...scheduleRows].sort((a, b) => {
    const roomCompare = a.classroomName.localeCompare(b.classroomName)
    if (roomCompare !== 0) return roomCompare
    const periodCompare = (periodOrder[a.period] ?? 99) - (periodOrder[b.period] ?? 99)
    if (periodCompare !== 0) return periodCompare
    return a.className.localeCompare(b.className)
  })

  return (
    <div className="min-h-screen bg-white text-gray-900 p-10 text-xl">
      <style>{`
        @media print {
          .print-page { break-after: page; page-break-after: always; }
          .print-page:last-of-type { break-after: auto; page-break-after: auto; }
          .print-only-hidden { display: none !important; }
        }
      `}</style>
      <PrintTrigger autoPrint={print === '1'} />
      <header className="mb-10 flex items-start justify-between gap-6 print-only-hidden">
        <div>
          <h1 className="text-4xl font-bold">Class Attendance Sheets</h1>
          {session && (
            <p className="text-lg text-gray-600">Session: {session.name}</p>
          )}
        </div>
        <Link href="/admin/reports" className="text-lg text-blue-600 hover:text-blue-700">
          Back to Reports
        </Link>
      </header>

      <div className="space-y-12">
        {sortedSchedules.map((schedule, index) => {
          const roster = rosterBySchedule.get(schedule.scheduleId) || []
          const volunteers = volunteersBySchedule.get(schedule.scheduleId) || []
          const periodLabel = PERIODS.find((period) => period.id === schedule.period)?.name
          return (
            <section key={schedule.scheduleId} className="print-page space-y-6">
              <div>
                <h2 className="text-3xl font-semibold">{schedule.className}</h2>
                <p className="text-lg text-gray-600">{schedule.classroomName} • {periodLabel || schedule.period}</p>
              </div>
              <table className="min-w-full text-sm border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Role</th>
                    {weekDates.map((date) => (
                      <th key={date} className="px-3 py-2 text-left">{date}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-3 py-2">
                      {schedule.teacherFirstName} {schedule.teacherLastName}
                    </td>
                    <td className="px-3 py-2">Teacher</td>
                    {weekDates.map((date) => (
                      <td key={`teacher-${date}`} className="px-3 py-3 border-l"></td>
                    ))}
                  </tr>
                  {volunteers.map((volunteer) => (
                    <tr key={`${schedule.scheduleId}-${volunteer.guardian.id}`} className="border-t">
                      <td className="px-3 py-2">
                        {volunteer.guardian.firstName} {volunteer.guardian.lastName}
                      </td>
                      <td className="px-3 py-2 capitalize">{volunteer.volunteerType.replace('_', ' ')}</td>
                      {weekDates.map((date) => (
                        <td key={`${volunteer.guardian.id}-${date}`} className="px-3 py-3 border-l"></td>
                      ))}
                    </tr>
                  ))}
                  {roster.map((row) => (
                    <tr key={row.child.id} className="border-t">
                      <td className="px-3 py-2">
                        {row.child.firstName} {row.child.lastName}
                      </td>
                      <td className="px-3 py-2">Student • {row.child.grade}</td>
                      {weekDates.map((date) => (
                        <td key={`${row.child.id}-${date}`} className="px-3 py-3 border-l"></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {index !== scheduleRows.length - 1 && <div className="h-8" />}
            </section>
          )
        })}
      </div>
    </div>
  )
}
