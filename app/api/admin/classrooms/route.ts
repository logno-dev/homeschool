import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { getClassrooms, createClassroom } from '@/lib/database'
import type { NewClassroom } from '@/lib/schema'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin('classrooms')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
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
    const auth = await getAuthenticatedAdmin('classrooms')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
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
