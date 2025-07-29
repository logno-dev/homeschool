import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  getScheduleWithDetails, 
  getApprovedClassesForSession,
  getClassrooms,
  createScheduleEntry,
  deleteScheduleByClassroomAndPeriod
} from '@/lib/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
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

    // Fetch schedule data, approved classes, and classrooms
    const [scheduleEntries, approvedClasses, classrooms] = await Promise.all([
      getScheduleWithDetails(sessionId),
      getApprovedClassesForSession(sessionId),
      getClassrooms()
    ])

    return NextResponse.json({ 
      scheduleEntries,
      approvedClasses,
      classrooms
    })
  } catch (error) {
    console.error('Error fetching schedule data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedule data' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
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

    const body = await request.json()
    const { classTeachingRequestId, classroomId, period } = body

    // Validate required fields
    if (!classTeachingRequestId || !classroomId || !period) {
      return NextResponse.json(
        { error: 'Class, classroom, and period are required' },
        { status: 400 }
      )
    }

    // Validate period
    const validPeriods = ['first', 'second', 'lunch', 'third']
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period' },
        { status: 400 }
      )
    }

    // Remove any existing class in this slot
    await deleteScheduleByClassroomAndPeriod(sessionId, classroomId, period)

    // Create new schedule entry
    const scheduleEntry = await createScheduleEntry({
      sessionId: sessionId,
      classTeachingRequestId,
      classroomId,
      period
    })

    return NextResponse.json({ scheduleEntry }, { status: 201 })
  } catch (error) {
    console.error('Error creating schedule entry:', error)
    return NextResponse.json(
      { error: 'Failed to create schedule entry' },
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

    const { searchParams } = new URL(request.url)
    const classroomId = searchParams.get('classroomId')
    const period = searchParams.get('period')

    if (!classroomId || !period) {
      return NextResponse.json(
        { error: 'Classroom and period are required' },
        { status: 400 }
      )
    }

    const deleted = await deleteScheduleByClassroomAndPeriod(sessionId, classroomId, period)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Schedule entry not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Schedule entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting schedule entry:', error)
    return NextResponse.json(
      { error: 'Failed to delete schedule entry' },
      { status: 500 }
    )
  }
}