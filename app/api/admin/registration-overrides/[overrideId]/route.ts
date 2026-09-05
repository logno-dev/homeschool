import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { 
  familyRegistrationStatus, 
  guardians, 
  classRegistrations, 
  volunteerAssignments,
  schedules,
  classTeachingRequests,
  children,
  familySessionFees,
  sessions
} from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { createOrUpdateFamilySessionFee } from '@/lib/fee-calculation'
import { sendRegistrationConfirmationEmail } from '@/lib/email'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ overrideId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin('registration-overrides')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { session } = auth

    const { overrideId } = await params
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

      // Pending registrations were not included in the original fee calculation.
      try {
        await createOrUpdateFamilySessionFee(overrideRequest.sessionId, overrideRequest.familyId)
      } catch (feeError) {
        console.error('Error calculating fees after override approval:', feeError)
      }

      try {
        const [details] = await db.select({
          email: guardians.email,
          firstName: guardians.firstName,
          sessionName: sessions.name,
          totalFee: familySessionFees.totalFee,
          paidAmount: familySessionFees.paidAmount
        }).from(guardians)
          .innerJoin(sessions, eq(sessions.id, overrideRequest.sessionId))
          .leftJoin(familySessionFees, and(
            eq(familySessionFees.familyId, overrideRequest.familyId),
            eq(familySessionFees.sessionId, overrideRequest.sessionId)
          ))
          .where(eq(guardians.familyId, overrideRequest.familyId))
          .limit(1)
        const registrations = await db.select({ className: classTeachingRequests.className })
          .from(classRegistrations)
          .innerJoin(schedules, eq(classRegistrations.scheduleId, schedules.id))
          .innerJoin(classTeachingRequests, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
          .where(and(
            eq(classRegistrations.familyId, overrideRequest.familyId),
            eq(classRegistrations.sessionId, overrideRequest.sessionId),
            eq(classRegistrations.status, 'registered')
          ))
        if (details) {
          await sendRegistrationConfirmationEmail({
            to: details.email,
            firstName: details.firstName,
            sessionName: details.sessionName,
            classNames: registrations.map((registration) => registration.className).join(', '),
            totalAmount: details.totalFee || 0,
            amountPaid: details.paidAmount || 0,
            balanceDue: Math.max(0, (details.totalFee || 0) - (details.paidAmount || 0))
          })
        }
      } catch (emailError) {
        console.error('Error sending override registration confirmation:', emailError)
      }

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
