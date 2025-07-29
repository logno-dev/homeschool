import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { events, guardians } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
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
        updatedAt: events.updatedAt,
        creatorName: guardians.firstName
      })
      .from(events)
      .leftJoin(guardians, eq(events.createdBy, guardians.id))
      .orderBy(desc(events.startDate))

    return NextResponse.json(allEvents)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { session } = auth

    const body = await request.json()
    const {
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      isAllDay,
      eventType,
      sessionId,
      location,
      color,
      isPublic
    } = body

    if (!title || !startDate) {
      return NextResponse.json({ error: 'Title and start date are required' }, { status: 400 })
    }

    const eventId = randomUUID()
    const newEvent = await db.insert(events).values({
      id: eventId,
      title,
      description: description || null,
      startDate,
      endDate: endDate || null,
      startTime: startTime || null,
      endTime: endTime || null,
      isAllDay: isAllDay || false,
      eventType: eventType || 'general',
      sessionId: sessionId || null,
      location: location || null,
      color: color || '#3b82f6',
      isPublic: isPublic !== undefined ? isPublic : true,
      createdBy: session.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning()

    return NextResponse.json(newEvent[0], { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}