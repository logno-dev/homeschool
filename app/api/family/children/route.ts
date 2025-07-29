import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { children, guardians } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()
    const body = await request.json()

    // Get the user's family ID
    const guardian = await db
      .select({ familyId: guardians.familyId })
      .from(guardians)
      .where(eq(guardians.id, session.user.id))
      .limit(1)

    if (!guardian.length) {
      return NextResponse.json(
        { error: 'Guardian not found' },
        { status: 404 }
      )
    }

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.dateOfBirth || !body.grade) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName, dateOfBirth, grade' },
        { status: 400 }
      )
    }

    // Create the new child
    const newChild = await db
      .insert(children)
      .values({
        id: randomUUID(),
        familyId: guardian[0].familyId,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth,
        grade: body.grade,
        allergies: body.allergies || null,
        medicalNotes: body.medicalNotes || null,
        emergencyContact: body.emergencyContact || null,
        emergencyPhone: body.emergencyPhone || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .returning()

    return NextResponse.json({
      success: true,
      child: newChild[0]
    })

  } catch (error) {
    console.error('Error adding child:', error)
    return NextResponse.json(
      { error: 'Failed to add child' },
      { status: 500 }
    )
  }
}