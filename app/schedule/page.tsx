import { getAuthenticatedUser } from '@/lib/server-auth'
import { getActiveSession, getSessionById } from '@/lib/database'
import { getRegistrationSchedules } from '@/lib/registration-schedules'
import { getRegistrationStatus } from '@/lib/registration-status'
import ScheduleViewer from '@/app/components/ScheduleViewer'

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ sessionId?: string }> }) {
  const session = await getAuthenticatedUser()
  const { sessionId } = await searchParams
  const activeSession = sessionId ? await getSessionById(sessionId) : await getActiveSession()

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Schedule Viewer</h1>
            <p className="mt-2 text-sm text-slate-600">
              There is no active session available. Please check back once a session is published.
            </p>
          </div>
        </main>
      </div>
    )
  }

  const [scheduleData, registrationStatus] = await Promise.all([
    getRegistrationSchedules(activeSession.id),
    getRegistrationStatus(activeSession.id, session.user.id)
  ])

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <ScheduleViewer
          sessionName={activeSession.name}
          sessionId={activeSession.id}
          schedules={scheduleData.schedules}
          classRegistrations={registrationStatus.classRegistrations || []}
          volunteerAssignments={registrationStatus.volunteerAssignments || []}
        />
      </main>
    </div>
  )
}
