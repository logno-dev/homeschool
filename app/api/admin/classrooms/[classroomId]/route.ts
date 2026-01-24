import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { getClassroomById, updateClassroom, deleteClassroom } from '@/lib/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classroomId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { classroomId } = await params
    const classroom = await getClassroomById(classroomId)
    
    if (!classroom) {
      return NextResponse.json(
        { error: 'Classroom not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ classroom })
  } catch (error) {
    console.error('Error fetching classroom:', error)
    return NextResponse.json(
      { error: 'Failed to fetch classroom' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ classroomId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { name, description } = body

    // Validate required fields
    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json(
        { error: 'Classroom name cannot be empty' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null

    const { classroomId } = await params
    const updatedClassroom = await updateClassroom(classroomId, updateData)

    if (!updatedClassroom) {
      return NextResponse.json(
        { error: 'Classroom not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ classroom: updatedClassroom })
  } catch (error) {
    console.error('Error updating classroom:', error)
    return NextResponse.json(
      { error: 'Failed to update classroom' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ classroomId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { classroomId } = await params
    const deleted = await deleteClassroom(classroomId)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Classroom not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Classroom deleted successfully' })
  } catch (error) {
    console.error('Error deleting classroom:', error)
    return NextResponse.json(
      { error: 'Failed to delete classroom' },
      { status: 500 }
    )
  }
}
