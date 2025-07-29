import { NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getGuardianById, getFamilyById, updateFamily } from '@/lib/database'

export async function POST() {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth

    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'This feature is only available in development mode' },
        { status: 403 }
      )
    }

    // Get the guardian record for the current user
    const guardian = await getGuardianById(session.user.id)
    
    if (!guardian) {
      return NextResponse.json(
        { error: 'No family found' },
        { status: 404 }
      )
    }

    // Get the family information
    const family = await getFamilyById(guardian.familyId)
    
    if (!family) {
      return NextResponse.json(
        { error: 'Family not found' },
        { status: 404 }
      )
    }

    // Toggle the fee payment status
    const newStatus = !family.annualFeePaid
    const updatedFamily = await updateFamily(family.id, {
      annualFeePaid: newStatus,
      feePaymentDate: newStatus ? new Date().toISOString() : undefined
    })

    return NextResponse.json({
      message: `Fee payment status ${newStatus ? 'enabled' : 'disabled'}`,
      family: updatedFamily
    })
  } catch (error) {
    console.error('Error toggling fee payment:', error)
    return NextResponse.json(
      { error: 'Failed to toggle fee payment status' },
      { status: 500 }
    )
  }
}