import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'

import { db } from '@/lib/db'
import { events, sessions } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all public events and session-related dates
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

    // Get session dates to add as automatic events
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

    // Convert session dates to event format
    const sessionEvents = sessionDates.flatMap(session => {
      const events = []
      
      // Session start/end
      events.push({
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
      })

      // Registration period
      events.push({
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
      })

      // Teacher early registration (if exists)
      if (session.teacherRegistrationStartDate) {
        events.push({
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

      return events
    })

    // Combine custom events and session events
    const combinedEvents = [...allEvents, ...sessionEvents]

    return NextResponse.json(combinedEvents)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}