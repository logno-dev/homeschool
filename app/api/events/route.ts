import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'

import { fetchCalendarEvents } from '@/lib/events'

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

    const combinedEvents = await fetchCalendarEvents()

    return NextResponse.json(combinedEvents)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
