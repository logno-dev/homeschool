import { notFound } from 'next/navigation'
import Link from 'next/link'
import AdminLayout from '@/app/components/AdminLayout'
import ScheduleGrid from '@/app/components/ScheduleGrid'
import { requireAdminAccess } from '@/lib/server-auth'
import { getApprovedClassesForSession, getSessionClassrooms, getScheduleWithDetails, getSessionById, ensureSessionClassrooms } from '@/lib/database'

interface AdminSchedulePageProps {
  params: Promise<{ sessionId: string }>
}

export default async function AdminSchedulePage({ params }: AdminSchedulePageProps) {
  const session = await requireAdminAccess()
  const { sessionId } = await params
  const sessionData = await getSessionById(sessionId)

  if (!sessionData) {
    notFound()
  }

  await ensureSessionClassrooms(sessionId)
  const [scheduleEntries, approvedClasses, classrooms] = await Promise.all([
    getScheduleWithDetails(sessionId),
    getApprovedClassesForSession(sessionId),
    getSessionClassrooms(sessionId)
  ])

  const rawStatus = scheduleEntries[0]?.status
  const initialScheduleStatus = rawStatus === 'submitted' || rawStatus === 'published'
    ? rawStatus
    : 'draft'
  const initialScheduleData = { approvedClasses, classrooms }

  const userName = [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') || session.user.email

  return (
    <AdminLayout 
      userName={userName || 'Admin'} 
      activeTab="sessions"
    >
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href="/admin/sessions"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              ← Back to Sessions
            </Link>
            {sessionData && (
              <h1 className="mt-2 text-2xl font-bold text-gray-900">
                Schedule for {sessionData.name}
              </h1>
            )}
          </div>
          
          <ScheduleGrid
            sessionId={sessionId}
            initialScheduleData={initialScheduleData}
            initialScheduleStatus={initialScheduleStatus}
          />
        </div>
      </main>
    </AdminLayout>
  )
}
