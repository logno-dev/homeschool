import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateScheduleStatus } from '@/lib/database'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or moderator
    const roleResponse = await fetch(`${process.env.AUTH_API_URL}/api/user/${session.user.id}/role`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.AUTH_API_KEY!,
        'Authorization': `Bearer ${session.accessToken}`,
      },
    })

    if (!roleResponse.ok) {
      return NextResponse.json({ error: 'Failed to verify user role' }, { status: 403 })
    }

    const roleData = await roleResponse.json()
    
    if (!['admin', 'moderator'].includes(roleData.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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