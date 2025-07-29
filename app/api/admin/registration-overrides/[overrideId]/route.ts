import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { 
  familyRegistrationStatus, 
  guardians, 
  classRegistrations, 
  volunteerAssignments,
  schedules,
  classTeachingRequests,
  children
} from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { overrideId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !session.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is admin using external auth API
    const roleResponse = await fetch(`${process.env.AUTH_API_URL}/api/user/${session.user.id}/role`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.AUTH_API_KEY!,
        'Authorization': `Bearer ${session.accessToken}`,
      },
    })

    if (!roleResponse.ok) {
      return NextResponse.json({ error: 'Failed to verify admin role' }, { status: 403 })
    }

    const roleData = await roleResponse.json()
    if (roleData.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { overrideId } = params
    const body = await request.json()
    const { action, reason } = body // action: 'approve' | 'deny', reason: string

    if (!action || !['approve', 'deny'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Get the override request
    const overrideRequest = await db.query.familyRegistrationStatus.findFirst({
      where: and(
        eq(familyRegistrationStatus.id, overrideId),
        eq(familyRegistrationStatus.status, 'admin_override')
      )
    })

    if (!overrideRequest) {
      return NextResponse.json({ error: 'Override request not found' }, { status: 404 })
    }

    if (action === 'deny') {
      // Delete the pending registrations and update status to denied
      await db.transaction(async (tx) => {
        // Delete pending class registrations
        await tx
          .delete(classRegistrations)
          .where(and(
            eq(classRegistrations.familyId, overrideRequest.familyId),
            eq(classRegistrations.sessionId, overrideRequest.sessionId),
            eq(classRegistrations.status, 'pending')
          ))

        // Delete pending volunteer assignments
        await tx
          .delete(volunteerAssignments)
          .where(and(
            eq(volunteerAssignments.familyId, overrideRequest.familyId),
            eq(volunteerAssignments.sessionId, overrideRequest.sessionId),
            eq(volunteerAssignments.status, 'pending')
          ))

        // Update the override request to denied status
        await tx
          .update(familyRegistrationStatus)
          .set({
            status: 'denied',
            overriddenBy: session.user.id,
            overriddenAt: new Date().toISOString(),
            adminOverrideReason: reason || 'Admin denied the override request'
          })
          .where(eq(familyRegistrationStatus.id, overrideId))
      })

      return NextResponse.json({
        success: true,
        message: 'Override request denied and pending registrations removed.'
      })
    }

    if (action === 'approve') {
      // Update pending registrations to registered status
      await db.transaction(async (tx) => {
        // Update class registrations from pending to registered
        await tx
          .update(classRegistrations)
          .set({ status: 'registered' })
          .where(and(
            eq(classRegistrations.familyId, overrideRequest.familyId),
            eq(classRegistrations.sessionId, overrideRequest.sessionId),
            eq(classRegistrations.status, 'pending')
          ))

        // Update volunteer assignments from pending to assigned
        await tx
          .update(volunteerAssignments)
          .set({ status: 'assigned' })
          .where(and(
            eq(volunteerAssignments.familyId, overrideRequest.familyId),
            eq(volunteerAssignments.sessionId, overrideRequest.sessionId),
            eq(volunteerAssignments.status, 'pending')
          ))

        // Update the override status to completed
        await tx
          .update(familyRegistrationStatus)
          .set({
            status: 'completed',
            overriddenBy: session.user.id,
            overriddenAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            adminOverrideReason: reason || 'Admin approved the override request',
            adminOverride: true,
            volunteerRequirementsMet: true
          })
          .where(eq(familyRegistrationStatus.id, overrideId))
      })

      return NextResponse.json({
        success: true,
        message: 'Override request approved and registration completed.'
      })
    }

  } catch (error) {
    console.error('Error processing override request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}