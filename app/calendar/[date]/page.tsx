import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { fetchCalendarEvents } from '@/lib/events'
import { eventsForDay, formatCalendarDate, isCalendarDate } from '@/lib/calendar'
import EventCard from '@/app/components/EventCard'

export default async function CalendarDayPage({ params }: { params: Promise<{ date: string }> }) {
  const session = await getAuthenticatedUser()
  const { date } = await params
  if (!isCalendarDate(date)) notFound()
  const events = eventsForDay(await fetchCalendarEvents(session.user.id), date)

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href={`/calendar?month=${date.slice(0, 7)}`} className="text-sm font-medium text-blue-700 hover:underline">← Back to calendar</Link>
      <header className="my-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">On the calendar</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">{formatCalendarDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h1>
        <p className="mt-2 text-gray-600">{events.length} {events.length === 1 ? 'event' : 'events'} on this day</p>
      </header>
      <div className="space-y-4">
        {events.map(event => <EventCard key={event.id} event={event} />)}
        {events.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">Nothing scheduled for this day. Check the calendar for other upcoming events.</div>}
      </div>
    </main>
  )
}
