import { NextResponse } from 'next/server'
import { getActiveSessions } from '@/lib/database'

export async function GET() {
  try {
    const sessions = await getActiveSessions()
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
