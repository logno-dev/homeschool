import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { families } from '@/lib/schema'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allFamilies = await db.select({
      id: families.id,
      name: families.name
    }).from(families)
    
    return NextResponse.json(allFamilies)
  } catch (error) {
    console.error('Error fetching families:', error)
    return NextResponse.json(
      { error: 'Failed to fetch families' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, address, phone, email } = await request.json()

    // Validate required fields
    if (!name || !address || !phone || !email) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    const [family] = await db.insert(families).values({
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      name,
      address,
      phone,
      email,
      sharingCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      annualFeePaid: false
    }).returning()

    return NextResponse.json(family, { status: 201 })
  } catch (error) {
    console.error('Error creating family:', error)
    return NextResponse.json(
      { error: 'Failed to create family' },
      { status: 500 }
    )
  }
}