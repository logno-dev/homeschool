import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { familySessionFees, sessions, guardians } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/family/fees called')
    const session = await getAuthenticatedUser()
    console.log('Session user ID:', session.user.id)
    
    // Get current guardian to find family ID
    const currentGuardian = await db.select().from(guardians).where(eq(guardians.id, session.user.id)).limit(1)
    console.log('Guardian found:', currentGuardian.length > 0 ? 'Yes' : 'No')
    
    if (!currentGuardian[0]) {
      console.log('No guardian found for user ID:', session.user.id)
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }
    
    const familyId = currentGuardian[0].familyId
    console.log('Family ID:', familyId)

    // Get all family session fees with session details
    const familyFees = await db
      .select({
        id: familySessionFees.id,
        sessionId: familySessionFees.sessionId,
        sessionName: sessions.name,
        registrationFee: familySessionFees.registrationFee,
        classFees: familySessionFees.classFees,
        totalFee: familySessionFees.totalFee,
        paidAmount: familySessionFees.paidAmount,
        status: familySessionFees.status,
        dueDate: familySessionFees.dueDate,
        calculatedAt: familySessionFees.calculatedAt,
        createdAt: familySessionFees.createdAt,
        updatedAt: familySessionFees.updatedAt
      })
      .from(familySessionFees)
      .innerJoin(sessions, eq(familySessionFees.sessionId, sessions.id))
      .where(eq(familySessionFees.familyId, familyId))
      .orderBy(familySessionFees.createdAt)

    console.log('Raw family fees:', familyFees.length, 'records')

    // Add calculated fields
    const feesWithCalculations = familyFees.map(fee => {
      const remainingAmount = fee.totalFee - fee.paidAmount
      const isOverdue = new Date() > new Date(fee.dueDate) && remainingAmount > 0
      
      return {
        ...fee,
        remainingAmount,
        isOverdue
      }
    })

    console.log('Returning fees:', feesWithCalculations.length, 'records')
    return NextResponse.json({ fees: feesWithCalculations })
  } catch (error) {
    console.error('Error fetching family fees:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}