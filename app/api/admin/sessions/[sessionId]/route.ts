import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { sessions } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const sessionData = await db.select().from(sessions).where(eq(sessions.id, sessionId))
    
    if (sessionData.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ session: sessionData[0] })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { 
      name, 
      startDate, 
      endDate, 
      registrationStartDate, 
      registrationEndDate, 
      teacherRegistrationStartDate,
      description,
      isActive 
    } = body

    // If setting this session as active, deactivate all other sessions
    if (isActive) {
      await db.update(sessions).set({ isActive: false })
    }

    const updateData = {
      ...(name && { name }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(registrationStartDate && { registrationStartDate }),
      ...(registrationEndDate && { registrationEndDate }),
      ...(teacherRegistrationStartDate !== undefined && { teacherRegistrationStartDate }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date().toISOString(),
    }

    const updatedSession = await db.update(sessions)
      .set(updateData)
      .where(eq(sessions.id, sessionId))
      .returning()

    if (updatedSession.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ session: updatedSession[0] })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const deletedSession = await db.delete(sessions)
      .where(eq(sessions.id, sessionId))
      .returning()

    if (deletedSession.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Session deleted successfully' })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}