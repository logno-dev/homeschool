import { desc, eq } from 'drizzle-orm'
import { db, client } from '@/lib/db'
import { events, sessions } from '@/lib/schema'

export interface CalendarEvent {
  id: string
  title: string
  description?: string | null
  startDate: string
  endDate?: string | null
  startTime?: string | null
  endTime?: string | null
  isAllDay: boolean
  eventType: string
  sessionId?: string | null
  location?: string | null
  color: string
  isPublic: boolean
  createdBy?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const tableCheck = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('events', 'sessions')"
    )
    const availableTables = new Set(tableCheck.rows.map((row) => row.name as string))

    if (!availableTables.has('events') || !availableTables.has('sessions')) {
      return []
    }

    const allEvents = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        startDate: events.startDate,
        endDate: events.endDate,
        startTime: events.startTime,
        endTime: events.endTime,
        isAllDay: events.isAllDay,
        eventType: events.eventType,
        sessionId: events.sessionId,
        location: events.location,
        color: events.color,
        isPublic: events.isPublic,
        createdBy: events.createdBy,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt
      })
      .from(events)
      .where(eq(events.isPublic, true))
      .orderBy(desc(events.startDate))

    const sessionDates = await db
      .select({
        id: sessions.id,
        name: sessions.name,
        startDate: sessions.startDate,
        endDate: sessions.endDate,
        registrationStartDate: sessions.registrationStartDate,
        registrationEndDate: sessions.registrationEndDate,
        teacherRegistrationStartDate: sessions.teacherRegistrationStartDate,
        isActive: sessions.isActive
      })
      .from(sessions)

    const sessionEvents: CalendarEvent[] = sessionDates.flatMap((session) => {
      const generatedEvents: CalendarEvent[] = [
      {
        id: `session-${session.id}`,
        title: `${session.name} Session`,
        description: `${session.name} session period`,
        startDate: session.startDate,
        endDate: session.endDate,
        startTime: null,
        endTime: null,
        isAllDay: true,
        eventType: 'session',
        sessionId: session.id,
        location: null,
        color: session.isActive ? '#10b981' : '#6b7280',
        isPublic: true,
        createdBy: null,
        createdAt: null,
        updatedAt: null
      },
      {
        id: `registration-${session.id}`,
        title: `${session.name} Registration`,
        description: `Registration period for ${session.name}`,
        startDate: session.registrationStartDate,
        endDate: session.registrationEndDate,
        startTime: null,
        endTime: null,
        isAllDay: true,
        eventType: 'registration',
        sessionId: session.id,
        location: null,
        color: '#f59e0b',
        isPublic: true,
        createdBy: null,
        createdAt: null,
        updatedAt: null
      }
    ]

    if (session.teacherRegistrationStartDate) {
      generatedEvents.push({
        id: `teacher-registration-${session.id}`,
        title: `${session.name} Teacher Registration`,
        description: `Early registration period for teachers for ${session.name}`,
        startDate: session.teacherRegistrationStartDate,
        endDate: session.registrationStartDate,
        startTime: null,
        endTime: null,
        isAllDay: true,
        eventType: 'registration',
        sessionId: session.id,
        location: null,
        color: '#8b5cf6',
        isPublic: true,
        createdBy: null,
        createdAt: null,
        updatedAt: null
      })
    }

      return generatedEvents
    })

    return [...allEvents, ...sessionEvents]
  } catch (error) {
    const message = String(error)
    if (!message.includes('HTTP status 404')) {
      console.error('Error fetching calendar events:', error)
    }
    return []
  }
}

export function getNextUpcomingEvent(eventsList: CalendarEvent[]): CalendarEvent | null {
  const now = new Date()
  const upcomingEvents = eventsList
    .filter((event) => new Date(event.startDate) >= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

  return upcomingEvents[0] ?? null
}
