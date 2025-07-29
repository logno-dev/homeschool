import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { createFamily, createGuardian, createChild } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth

    const { family, guardian, children } = await request.json()

    // Validate required fields
    if (!family?.name || !family?.address || !family?.phone || !family?.email) {
      return NextResponse.json(
        { error: 'Family name, address, phone, and email are required' },
        { status: 400 }
      )
    }

    // Create the family
    const newFamily = await createFamily({
      name: family.name,
      address: family.address,
      phone: family.phone,
      email: family.email,
      annualFeePaid: false
    })

    // Create the guardian (current user)
    const newGuardian = await createGuardian({
      id: session.user.id,
      email: session.user.email || '',
      firstName: session.user.name?.split(' ')[0] || '',
      lastName: session.user.name?.split(' ').slice(1).join(' ') || '',
      role: 'user',
      familyId: newFamily.id,
      isMainContact: true,
      phone: guardian?.phone || ''
    })

    // Create children if provided
    const newChildren = []
    if (children && Array.isArray(children)) {
      for (const child of children) {
        if (child.firstName && child.lastName) {
          const newChild = await createChild({
            familyId: newFamily.id,
            firstName: child.firstName,
            lastName: child.lastName,
            dateOfBirth: child.dateOfBirth,
            grade: child.grade,
            allergies: child.allergies || '',
            medicalNotes: child.medicalNotes || '',
            emergencyContact: child.emergencyContact || '',
            emergencyPhone: child.emergencyPhone || ''
          })
          newChildren.push(newChild)
        }
      }
    }

    return NextResponse.json({
      message: 'Family registered successfully',
      family: newFamily,
      guardian: newGuardian,
      children: newChildren,
      sharingCode: newFamily.sharingCode
    }, { status: 201 })
  } catch (error) {
    console.error('Error registering family:', error)
    return NextResponse.json(
      { error: 'Failed to register family' },
      { status: 500 }
    )
  }
}