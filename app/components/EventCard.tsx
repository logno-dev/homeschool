import Link from 'next/link'
import type { CalendarEvent } from '@/lib/events'
import { descriptionPreview, eventHref, formatEventDate, formatEventTime } from '@/lib/calendar'

export default function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <Link href={eventHref(event)} className="group block min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-500">
      <div className="flex flex-col sm:flex-row">
        {event.bannerUrl && <img src={event.bannerUrl} alt="" loading="lazy" className="h-36 w-full object-cover sm:h-auto sm:w-40 sm:self-stretch" />}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
            {event.eventType}
          </div>
          <h3 className="break-words text-lg font-semibold text-gray-900 group-hover:text-blue-700">{event.title}</h3>
          <p className="mt-1 text-sm text-gray-600">{formatEventDate(event)} · {formatEventTime(event)}</p>
          {event.location && <p className="mt-1 break-words text-sm text-gray-600">{event.location}</p>}
          {event.description && <p className="mt-3 line-clamp-2 break-words text-sm leading-relaxed text-gray-500">{descriptionPreview(event.description)}</p>}
          <span className="mt-3 inline-block text-sm font-medium text-blue-700">View details <span aria-hidden="true">→</span></span>
        </div>
      </div>
    </Link>
  )
}
