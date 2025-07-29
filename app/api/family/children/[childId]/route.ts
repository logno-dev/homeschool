import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { children, guardians } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function PUT(
  request: NextRequest,
  { params }: { params: { childId: string } }
) {
  try {
    const session = await getAuthenticatedUser()
    const { childId } = params
    const body = await request.json()

    // Verify the child belongs to the user's family
    const child = await db
      .select({
        child: children,
        guardian: guardians
      })
      .from(children)
      .innerJoin(guardians, eq(children.familyId, guardians.familyId))
      .where(and(
        eq(children.id, childId),
        eq(guardians.id, session.user.id)
      ))
      .limit(1)

    if (!child.length) {
      return NextResponse.json(
        { error: 'Child not found or access denied' },
        { status: 404 }
      )
    }

    // Update the child
    const updatedChild = await db
      .update(children)
      .set({
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth,
        grade: body.grade,
        allergies: body.allergies || null,
        medicalNotes: body.medicalNotes || null,
        emergencyContact: body.emergencyContact || null,
        emergencyPhone: body.emergencyPhone || null,
        updatedAt: new Date().toISOString()
      })
      .where(eq(children.id, childId))
      .returning()

    return NextResponse.json({
      success: true,
      child: updatedChild[0]
    })

  } catch (error) {
    console.error('Error updating child:', error)
    return NextResponse.json(
      { error: 'Failed to update child information' },
      { status: 500 }
    )
  }
}