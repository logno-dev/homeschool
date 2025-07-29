import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateScheduleStatus } from '@/lib/database'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !session.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
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
      return NextResponse.json(
        { error: 'Failed to verify role' },
        { status: 403 }
      )
    }

    const roleData = await roleResponse.json()
    if (!['admin', 'moderator'].includes(roleData.user.role)) {
      return NextResponse.json(
        { error: 'Admin or moderator access required' },
        { status: 403 }
      )
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