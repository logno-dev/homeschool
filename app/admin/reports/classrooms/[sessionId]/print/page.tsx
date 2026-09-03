import { requireAdminAccess } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { sessionClassrooms, schedules, classTeachingRequests, guardians } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import PrintTrigger from './PrintTrigger'
import Link from 'next/link'
import { getSessionById } from '@/lib/database'

export const runtime = 'nodejs'

const PERIODS = [
  { id: 'first', name: 'First Hour' },
  { id: 'second', name: 'Second Hour' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'third', name: 'Third Hour' }
]

interface PrintPageProps {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ print?: string }>
}

export default async function ClassroomPrintPage({ params, searchParams }: PrintPageProps) {
  await requireAdminAccess()
  const { sessionId } = await params
  const { print } = await searchParams
  const session = await getSessionById(sessionId)

  const [classroomRows, scheduleRows] = await Promise.all([
    db.select().from(sessionClassrooms).where(eq(sessionClassrooms.sessionId, sessionId)),
    db
      .select({
        classroomId: sessionClassrooms.id,
        period: schedules.period,
        className: classTeachingRequests.className
      })
      .from(schedules)
      .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(sessionClassrooms, eq(schedules.sessionClassroomId, sessionClassrooms.id))
      .innerJoin(guardians, eq(classTeachingRequests.guardianId, guardians.id))
      .where(and(
        eq(schedules.sessionId, sessionId),
        eq(schedules.status, 'published')
      ))
  ])

  const scheduleByClassroom = new Map<string, typeof scheduleRows>()
  classroomRows.forEach((classroom) => scheduleByClassroom.set(classroom.id, []))
  scheduleRows.forEach((schedule) => {
    const list = scheduleByClassroom.get(schedule.classroomId) || []
    list.push(schedule)
    scheduleByClassroom.set(schedule.classroomId, list)
  })

  return (
    <div className="min-h-screen bg-white text-gray-900 p-12 text-2xl">
      <style>{`
        @media print {
          .print-page { break-after: page; page-break-after: always; }
          .print-page:last-of-type { break-after: auto; page-break-after: auto; }
          .print-only-hidden { display: none !important; }
        }
      `}</style>
      <PrintTrigger autoPrint={print === '1'} />
      <header className="mb-12 flex items-start justify-between gap-6 print-only-hidden">
        <div>
          <h1 className="text-5xl font-bold">Classroom Schedules</h1>
        {session && (
          <p className="text-xl text-gray-600">Session: {session.name}</p>
        )}
        </div>
        <Link
          href="/admin/reports"
          className="text-lg text-blue-600 hover:text-blue-700"
        >
          Back to Reports
        </Link>
      </header>

      <div className="space-y-10">
        {classroomRows.map((classroom, index) => {
          const schedulesForRoom = scheduleByClassroom.get(classroom.id) || []
          return (
            <section key={classroom.id} className="print-page space-y-8">
              <h2 className="text-4xl font-semibold">{classroom.name}</h2>
              <div className="space-y-4 text-2xl">
                {PERIODS.map((period) => {
                  const schedule = schedulesForRoom.find((item) => item.period === period.id)
                  return (
                    <div key={`${classroom.id}-${period.id}`} className="flex gap-6">
                      <span className="font-semibold min-w-[200px]">{period.name}:</span>
                      <span>{schedule?.className || '—'}</span>
                    </div>
                  )
                })}
              </div>
              {index !== classroomRows.length - 1 && <div className="h-8" />}
            </section>
          )
        })}
      </div>
    </div>
  )
}
