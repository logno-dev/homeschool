import { desc, eq } from 'drizzle-orm'
import { db, client } from '@/lib/db'
import { events, sessions, sessionRegistrationWindows, userGroups } from '@/lib/schema'
import { getAppTimezone, parseAppDate } from '@/lib/app-time'
import { getUserGroups } from '@/lib/user-groups'

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

export async function fetchCalendarEvents(viewerUserId?: string): Promise<CalendarEvent[]> {
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

    const viewerGroupIds = viewerUserId ? new Set((await getUserGroups(viewerUserId)).map(({ group }) => group.id)) : new Set<string>()
    const registrationWindows = viewerUserId ? await db.select({ window: sessionRegistrationWindows, group: userGroups }).from(sessionRegistrationWindows).innerJoin(userGroups, eq(sessionRegistrationWindows.groupId, userGroups.id)) : []

    const sessionEvents: CalendarEvent[] = sessionDates.flatMap((session) => {
      const generatedEvents: CalendarEvent[] = [
      {
        id: `session-start-${session.id}`,
        title: `${session.name} Starts`,
        description: `${session.name} session starts`,
        startDate: session.startDate,
        endDate: null,
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
        id: `session-end-${session.id}`,
        title: `${session.name} Ends`,
        description: `${session.name} session ends`,
        startDate: session.endDate,
        endDate: null,
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
      }
    ]

    registrationWindows.filter(({ window }) => window.sessionId === session.id && viewerGroupIds.has(window.groupId)).forEach(({ window, group }) => {
      generatedEvents.push({
        id: `registration-open-${window.id}`,
        title: `${session.name} Registration Opens (${group.name})`,
        description: `Registration opens for the ${group.name} group`,
        startDate: window.startDate,
        endDate: null,
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
      })
      generatedEvents.push({
        id: `registration-close-${window.id}`,
        title: `${session.name} Registration Closes (${group.name})`,
        description: `Registration closes for the ${group.name} group`,
        startDate: window.endDate,
        endDate: null,
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
      })
    })

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

export async function getNextUpcomingEvent(eventsList: CalendarEvent[]): Promise<CalendarEvent | null> {
  const now = new Date()
  const timezone = await getAppTimezone()
  const eventDate = (value: string) => parseAppDate(value, timezone)
  const upcomingEvents = eventsList
    .filter((event) => eventDate(event.startDate) >= now)
    .sort((a, b) => eventDate(a.startDate).getTime() - eventDate(b.startDate).getTime())

  return upcomingEvents[0] ?? null
}
