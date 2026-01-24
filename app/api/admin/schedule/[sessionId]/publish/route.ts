import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { updateScheduleStatus } from '@/lib/database'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { sessionId } = await params

    // Update schedule status to published
    await updateScheduleStatus(sessionId, 'published')

    return NextResponse.json({ 
      message: 'Schedule published successfully',
      status: 'published'
    })
  } catch (error) {
    console.error('Error publishing schedule:', error)
    return NextResponse.json(
      { error: 'Failed to publish schedule' },
      { status: 500 }
    )
  }
}
