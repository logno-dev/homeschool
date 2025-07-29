import { NextResponse } from 'next/server'
import { getSessions } from '@/lib/database'

export async function GET() {
  try {
    const allSessions = await getSessions()
    // For now, return all sessions. In the future, you might want to filter by active status
    const sessions = allSessions
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}