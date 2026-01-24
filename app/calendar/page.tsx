import { getAuthenticatedUser } from '@/lib/server-auth'
import { fetchCalendarEvents } from '@/lib/events'
import Calendar from '../components/Calendar'

export default async function CalendarPage() {
  await getAuthenticatedUser()
  const events = await fetchCalendarEvents()

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <p className="text-gray-600">View upcoming events and important dates</p>
          </div>
          
          <div className="bg-white rounded-lg shadow">
            <Calendar events={events} />
          </div>
        </div>
      </main>
    </div>
  )
}
