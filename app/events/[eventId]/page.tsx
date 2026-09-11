import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAuthenticatedAdmin, getAuthenticatedUser } from '@/lib/server-auth'
import { getCalendarEventById } from '@/lib/events'
import { formatEventDate, formatEventTime } from '@/lib/calendar'
import { sanitizeEventDescription } from '@/lib/event-content'

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getAuthenticatedUser()
  const { eventId } = await params
  const admin = await getAuthenticatedAdmin('events')
  const event = await getCalendarEventById(eventId, session.user.id, !('error' in admin))
  if (!event) notFound()
  const date = event.startDate.slice(0, 10)

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav aria-label="Event navigation" className="mb-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-blue-700">
        <Link href={`/calendar?month=${date.slice(0, 7)}`} className="hover:underline">← Back to calendar</Link>
        <Link href={`/calendar/${date}`} className="hover:underline">All events on this day</Link>
      </nav>
      <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {event.bannerUrl && <img src={event.bannerUrl} alt="" className="aspect-[3/1] w-full object-cover" />}
        <div className="p-5 sm:p-8">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: event.color }} />{event.eventType}
            {!event.isPublic && <span className="rounded-full bg-gray-100 px-2 py-1">Private event · Admin preview</span>}
          </div>
          <h1 className="break-words text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{event.title}</h1>
          <dl className="my-6 grid gap-4 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold text-gray-900">Date</dt><dd className="mt-1 text-gray-600">{formatEventDate(event)}</dd></div>
            <div><dt className="font-semibold text-gray-900">Time</dt><dd className="mt-1 text-gray-600">{formatEventTime(event)}</dd></div>
            {event.location && <div className="sm:col-span-2"><dt className="font-semibold text-gray-900">Location</dt><dd className="mt-1 break-words text-gray-600">{event.location}</dd></div>}
          </dl>
          {event.description ? <div className="event-rich-text text-gray-700"><div className="ql-editor" dangerouslySetInnerHTML={{ __html: sanitizeEventDescription(event.description) }} /></div> : <p className="text-gray-500">More details will be shared soon.</p>}
          {event.eventType === 'registration' && event.sessionId && <Link href={`/registration/${encodeURIComponent(event.sessionId)}`} className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">View registration</Link>}
        </div>
      </article>
    </main>
  )
}
