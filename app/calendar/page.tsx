import { getAuthenticatedUser } from '@/lib/server-auth'
import { fetchCalendarEvents } from '@/lib/events'
import Calendar from '../components/Calendar'
import { getConfiguredDateKey } from '@/lib/app-time'
import { isCalendarDate } from '@/lib/calendar'

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; view?: string }> }) {
  const session = await getAuthenticatedUser()
  const [events, today, query] = await Promise.all([fetchCalendarEvents(session.user.id), getConfiguredDateKey(), searchParams])
  const initialMonth = query.month && isCalendarDate(`${query.month}-01`) ? query.month : undefined

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Calendar &amp; Events</h1>
            <p className="text-gray-600">View upcoming events and important dates</p>
          </div>
          
          <Calendar events={events} today={today} initialMonth={initialMonth} initialView={query.view === 'schedule' ? 'schedule' : 'month'} />
        </div>
      </main>
    </div>
  )
}
