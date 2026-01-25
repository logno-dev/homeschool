import Link from 'next/link'
import { Fragment } from 'react'
import { requireAdminAccess } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { families, guardians, children } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSessionById } from '@/lib/database'
import PrintTrigger from '../../../../classrooms/[sessionId]/print/PrintTrigger'

export const runtime = 'nodejs'

const WEEKS = 6

interface PrintPageProps {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ print?: string }>
}

export default async function OverallAttendancePrintPage({ params, searchParams }: PrintPageProps) {
  await requireAdminAccess()
  const { sessionId } = await params
  const { print } = await searchParams
  const session = await getSessionById(sessionId)

  const [familyRows, guardianRows, childRows] = await Promise.all([
    db.select().from(families),
    db.select().from(guardians),
    db.select().from(children)
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

  const familiesGrouped = familyRows
    .map((family) => {
      const familyGuardians = guardianRows.filter((guardian) => guardian.familyId === family.id)
      const familyChildren = childRows.filter((child) => child.familyId === family.id)
      return { family, guardians: familyGuardians, children: familyChildren }
    })
    .sort((a, b) => a.family.name.localeCompare(b.family.name))

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
          <h1 className="text-4xl font-bold">Overall Attendance</h1>
          {session && (
            <p className="text-lg text-gray-600">Session: {session.name}</p>
          )}
        </div>
        <Link href="/admin/reports" className="text-lg text-blue-600 hover:text-blue-700">
          Back to Reports
        </Link>
      </header>

      <div className="space-y-6">
        <table className="min-w-full text-sm border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Student</th>
              <th className="px-3 py-2 text-left">Grade</th>
              {weekDates.map((date) => (
                <th key={date} className="px-3 py-2 text-left">{date}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {familiesGrouped.map(({ family, guardians: familyGuardians, children: familyChildren }) => (
              <Fragment key={family.id}>
                {familyChildren.map((child) => (
                  <tr key={child.id} className="border-t">
                    <td className="px-3 py-2">{child.firstName} {child.lastName}</td>
                    <td className="px-3 py-2">{child.grade}</td>
                    {weekDates.map((date) => (
                      <td key={`${child.id}-${date}`} className="px-3 py-3 border-l"></td>
                    ))}
                  </tr>
                ))}
                {familyChildren.length === 0 && (
                  <tr className="border-t">
                    <td className="px-3 py-3 text-gray-500" colSpan={weekDates.length + 2}>
                      No students on file.
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
