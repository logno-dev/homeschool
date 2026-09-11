'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react'
import type { CalendarEvent } from '@/lib/events'
import { calendarDateKey, calendarDayHref, eventsForDay, formatCalendarDate, upcomingEventGroups } from '@/lib/calendar'
import EventCard from './EventCard'

interface CalendarProps {
  events: CalendarEvent[]
  today: string
  initialMonth?: string
  initialView?: 'month' | 'schedule'
}

export default function Calendar({ events, today, initialMonth, initialView = 'month' }: CalendarProps) {
  const [month, setMonth] = useState(() => new Date(`${initialMonth || today.slice(0, 7)}-01T12:00:00`))
  const [view, setView] = useState(initialView)
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  const scheduleGroups = upcomingEventGroups(events, today)
  const monthTitle = formatCalendarDate(calendarDateKey(month), { month: 'long', year: 'numeric' })

  return (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-6" aria-label="Events calendar">
      <header className="mb-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl" aria-live="polite">{view === 'month' ? monthTitle : 'Upcoming events'}</h2>
          <div className="inline-flex rounded-lg bg-gray-100 p-1" role="group" aria-label="Calendar view">
            <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${view === 'month' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <CalendarDays className="h-4 w-4" aria-hidden="true" />Month
            </button>
            <button type="button" aria-pressed={view === 'schedule'} onClick={() => setView('schedule')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${view === 'schedule' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <List className="h-4 w-4" aria-hidden="true" />Schedule
            </button>
          </div>
        </div>
        {view === 'month' ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 sm:text-sm">Select a day to explore its events.</p>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(year, monthIndex - 1, 1, 12))} className="rounded-md p-2 text-gray-600 hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => setMonth(new Date(`${today.slice(0, 7)}-01T12:00:00`))} className="rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">Today</button>
              <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(year, monthIndex + 1, 1, 12))} className="rounded-md p-2 text-gray-600 hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        ) : null}
      </header>

      {view === 'month' ? (
        <>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
              <div key={day} className="min-w-0 py-1 text-center text-xs font-medium text-gray-500 sm:text-sm"><abbr title={day} className="no-underline"><span className="sm:hidden">{day.slice(0, 1)}</span><span className="hidden sm:inline">{day.slice(0, 3)}</span></abbr></div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: cellCount }, (_, index) => {
              const day = index - firstWeekday + 1
              if (day < 1 || day > daysInMonth) return <div key={`empty-${index}`} aria-hidden="true" className="min-w-0 rounded-md bg-gray-50" />
              const date = calendarDateKey(new Date(year, monthIndex, day, 12))
              const dayEvents = eventsForDay(events, date)
              const isToday = date === today
              return (
                <Link key={date} href={calendarDayHref(events, date)} aria-current={isToday ? 'date' : undefined}
                  aria-label={`${formatCalendarDate(date)}, ${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}${dayEvents.length === 1 ? `: ${dayEvents[0].title}` : ''}`}
                  className={`block h-20 min-w-0 overflow-hidden rounded-md border p-1 transition focus-visible:outline-2 focus-visible:outline-blue-600 sm:h-32 sm:p-2 ${isToday ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                  <span className={`mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold sm:h-6 sm:min-w-6 sm:text-sm ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>{day}</span>
                  <div className="mt-2 flex flex-wrap justify-center gap-1 sm:hidden" aria-hidden="true">
                    {dayEvents.slice(0, 3).map(event => <span key={event.id} className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />)}
                    {dayEvents.length > 3 && <span className="text-[9px] leading-none text-gray-500">+{dayEvents.length - 3}</span>}
                  </div>
                  <div className="hidden space-y-1 sm:block">
                    {dayEvents.slice(0, 2).map(event => <div key={event.id} title={event.title} className="truncate rounded border-l-2 bg-gray-50 px-0.5 py-0.5 text-[10px] font-medium text-gray-700 sm:px-1 sm:text-xs" style={{ borderLeftColor: event.color }}>{event.title}</div>)}
                    {dayEvents.length > 2 && <p className="truncate text-[10px] font-medium text-blue-700 sm:text-xs">+{dayEvents.length - 2} more</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {scheduleGroups.map(group => (
            <section key={group.date} aria-label={formatCalendarDate(group.date)} className="relative ml-2 border-l-2 border-blue-100 pb-2 pl-5 sm:ml-3 sm:pl-7">
              <span aria-hidden="true" className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
              <h3 className="mb-3 text-sm font-semibold text-blue-800">
                <Link href={`/calendar/${group.date}`} className="hover:underline">{group.date === today ? 'Today · ' : ''}{formatCalendarDate(group.date, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</Link>
              </h3>
              <div className="space-y-3">{group.events.map(event => <EventCard key={event.id} event={event} />)}</div>
            </section>
          ))}
          {scheduleGroups.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">No upcoming events yet. Check back soon.</p>}
        </div>
      )}
    </section>
  )
}
