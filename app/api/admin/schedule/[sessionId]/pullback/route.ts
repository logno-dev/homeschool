import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { updateScheduleStatus } from '@/lib/database'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Update all schedule entries for this session back to draft status
    await updateScheduleStatus(sessionId, 'draft')

    return NextResponse.json({ 
      message: 'Schedule pulled back to draft status successfully' 
    })
  } catch (error) {
    console.error('Error pulling back schedule:', error)
    return NextResponse.json(
      { error: 'Failed to pull back schedule' },
      { status: 500 }
    )
  }
}
