import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getRegistrationSchedules } from '@/lib/registration-schedules'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { sessionId } = await params
    const scheduleData = await getRegistrationSchedules(sessionId)

    return NextResponse.json(scheduleData)
  } catch (error) {
    console.error('Error fetching published schedules:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
