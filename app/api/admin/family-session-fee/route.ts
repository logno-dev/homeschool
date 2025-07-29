import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { familySessionFees, families, sessions } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')
    const sessionId = searchParams.get('sessionId')

    if (!familyId || !sessionId) {
      return NextResponse.json(
        { error: 'familyId and sessionId are required' },
        { status: 400 }
      )
    }

    // Get the family session fee details
    const familySessionFee = await db
      .select({
        id: familySessionFees.id,
        familyId: familySessionFees.familyId,
        sessionId: familySessionFees.sessionId,
        familyName: families.name,
        sessionName: sessions.name,
        totalFee: familySessionFees.totalFee,
        paidAmount: familySessionFees.paidAmount,
        status: familySessionFees.status,
        dueDate: familySessionFees.dueDate
      })
      .from(familySessionFees)
      .leftJoin(families, eq(familySessionFees.familyId, families.id))
      .leftJoin(sessions, eq(familySessionFees.sessionId, sessions.id))
      .where(
        and(
          eq(familySessionFees.familyId, familyId),
          eq(familySessionFees.sessionId, sessionId)
        )
      )
      .limit(1)

    if (familySessionFee.length === 0) {
      return NextResponse.json(
        { error: 'No fee record found for this family and session' },
        { status: 404 }
      )
    }

    const fee = familySessionFee[0]
    const remainingBalance = Math.max(0, fee.totalFee - fee.paidAmount)

    return NextResponse.json({
      ...fee,
      remainingBalance
    })

  } catch (error) {
    console.error('Error fetching family session fee:', error)
    return NextResponse.json(
      { error: 'Failed to fetch family session fee' },
      { status: 500 }
    )
  }
}