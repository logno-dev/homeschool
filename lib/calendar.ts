import type { CalendarEvent } from './events'

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatCalendarDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }): string {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
}

export function formatEventDate(event: CalendarEvent): string {
  const start = event.startDate.slice(0, 10)
  const end = (event.endDate || event.startDate).slice(0, 10)
  return start === end ? formatCalendarDate(start) : `${formatCalendarDate(start)} – ${formatCalendarDate(end)}`
}

export function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) return 'All day'
  const time = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number)
    return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
  }
  if (!event.startTime) return 'Time to be announced'
  return `${time(event.startTime)}${event.endTime ? ` – ${time(event.endTime)}` : ''}`
}

export function sortCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.isAllDay ? '' : a.startTime || '23:59').localeCompare(b.isAllDay ? '' : b.startTime || '23:59') || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
}

export function eventsForDay(events: CalendarEvent[], date: string): CalendarEvent[] {
  return sortCalendarEvents(events.filter(event => date >= event.startDate.slice(0, 10) && date <= (event.endDate || event.startDate).slice(0, 10)))
}

export function eventHref(event: CalendarEvent): string {
  return `/events/${encodeURIComponent(event.id)}`
}

export function calendarDayHref(events: CalendarEvent[], date: string): string {
  const dayEvents = eventsForDay(events, date)
  return dayEvents.length === 1 ? eventHref(dayEvents[0]) : `/calendar/${date}`
}

export function upcomingEventGroups(events: CalendarEvent[], today: string) {
  const groups = new Map<string, CalendarEvent[]>()
  for (const event of sortCalendarEvents(events)) {
    if ((event.endDate || event.startDate).slice(0, 10) < today) continue
    const day = event.startDate.slice(0, 10) < today ? today : event.startDate.slice(0, 10)
    groups.set(day, [...(groups.get(day) || []), event])
  }
  return Array.from(groups, ([date, items]) => ({ date, events: items }))
}

export function descriptionPreview(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}

export function descriptionEditorHtml(value: string): string {
  if (/<\/?[a-z][^>]*>/i.test(value)) return value
  return value ? `<p>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>')}</p>` : ''
}
