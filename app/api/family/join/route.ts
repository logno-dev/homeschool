import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { findFamilyBySharingCode, createGuardian, getGuardianById } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth

    const { sharingCode, phone } = await request.json()

    if (!sharingCode) {
      return NextResponse.json(
        { error: 'Sharing code is required' },
        { status: 400 }
      )
    }

    // Find the family by sharing code
    const family = await findFamilyBySharingCode(sharingCode.toUpperCase())
    
    if (!family) {
      return NextResponse.json(
        { error: 'Invalid sharing code' },
        { status: 404 }
      )
    }

    // Check if user is already a guardian of this family
    const existingGuardian = await getGuardianById(session.user.id)
    
    if (existingGuardian && existingGuardian.familyId === family.id) {
      return NextResponse.json(
        { error: 'You are already a member of this family' },
        { status: 400 }
      )
    }

    if (existingGuardian && existingGuardian.familyId !== family.id) {
      return NextResponse.json(
        { error: 'You are already associated with another family' },
        { status: 400 }
      )
    }

    // Create the guardian
    const newGuardian = await createGuardian({
      id: session.user.id,
      email: session.user.email || '',
      firstName: session.user.name?.split(' ')[0] || '',
      lastName: session.user.name?.split(' ').slice(1).join(' ') || '',
      role: 'user',
      familyId: family.id,
      isMainContact: false,
      phone: phone || ''
    })

    return NextResponse.json({
      message: 'Successfully joined family',
      family,
      guardian: newGuardian,
      familyName: family.name
    })
  } catch (error) {
    console.error('Error joining family:', error)
    return NextResponse.json(
      { error: 'Failed to join family' },
      { status: 500 }
    )
  }
}