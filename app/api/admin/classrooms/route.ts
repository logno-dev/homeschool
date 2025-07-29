import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClassrooms, createClassroom } from '@/lib/database'
import type { NewClassroom } from '@/lib/schema'

export async function GET() {
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

    // Fetch all classrooms
    const classrooms = await getClassrooms()
    return NextResponse.json({ classrooms })
  } catch (error) {
    console.error('Error fetching classrooms:', error)
    return NextResponse.json(
      { error: 'Failed to fetch classrooms' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
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

    const body = await request.json()
    const { name, description } = body

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Classroom name is required' },
        { status: 400 }
      )
    }

    const newClassroom: Omit<NewClassroom, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      description: description?.trim() || null
    }

    const createdClassroom = await createClassroom(newClassroom)
    return NextResponse.json({ classroom: createdClassroom }, { status: 201 })
  } catch (error) {
    console.error('Error creating classroom:', error)
    return NextResponse.json(
      { error: 'Failed to create classroom' },
      { status: 500 }
    )
  }
}