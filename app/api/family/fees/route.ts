import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { familySessionFees, familyFeeCredits, sessions } from '@/lib/schema'
import { and, eq, lt, or } from 'drizzle-orm'
import { getGuardianById } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/family/fees called')
    const session = await getAuthenticatedUser()
    console.log('Session user ID:', session.user.id)
    
    const currentGuardian = await getGuardianById(session.user.id)
    console.log('Guardian found:', currentGuardian ? 'Yes' : 'No')

    if (!currentGuardian) {
      console.log('No guardian found for user ID:', session.user.id)
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }
    
    const familyId = currentGuardian.familyId
    console.log('Family ID:', familyId)

    const [familyFees, creditRows] = await Promise.all([
      db
        .select({
          id: familySessionFees.id,
          sessionId: familySessionFees.sessionId,
          sessionName: sessions.name,
          registrationFee: familySessionFees.registrationFee,
          classFees: familySessionFees.classFees,
          totalFee: familySessionFees.totalFee,
          paidAmount: familySessionFees.paidAmount,
          overpaymentAmount: familySessionFees.overpaymentAmount,
          overpaymentStatus: familySessionFees.overpaymentStatus,
          status: familySessionFees.status,
          dueDate: familySessionFees.dueDate,
          calculatedAt: familySessionFees.calculatedAt,
          createdAt: familySessionFees.createdAt,
          updatedAt: familySessionFees.updatedAt
        })
        .from(familySessionFees)
        .innerJoin(sessions, eq(familySessionFees.sessionId, sessions.id))
        .where(and(
          eq(familySessionFees.familyId, familyId),
          or(
            eq(sessions.isActive, true),
            lt(familySessionFees.paidAmount, familySessionFees.totalFee)
          )
        ))
        .orderBy(familySessionFees.createdAt),
      db
        .select({ amount: familyFeeCredits.amount })
        .from(familyFeeCredits)
        .where(and(
          eq(familyFeeCredits.familyId, familyId),
          eq(familyFeeCredits.status, 'available')
        ))
    ])

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
    return NextResponse.json({
      fees: feesWithCalculations,
      accountCredit: creditRows.reduce((total, credit) => total + credit.amount, 0)
    })
  } catch (error) {
    console.error('Error fetching family fees:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}
