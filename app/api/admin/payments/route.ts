import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { 
  feePayments, 
  familySessionFees, 
  families, 
  sessions 
} from '@/lib/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Query to get all payment data with family and session information
    const paymentsData = await db
      .select({
        id: feePayments.id,
        familyId: feePayments.familyId,
        familyName: families.name,
        sessionId: feePayments.sessionId,
        sessionName: sessions.name,
        amount: feePayments.amount,
        paymentDate: feePayments.paymentDate,
        paymentMethod: feePayments.paymentMethod,
        notes: feePayments.notes,
        // Get family session fee data if available
        familySessionFeeId: feePayments.familySessionFeeId,
        totalFee: sql<number>`COALESCE(${familySessionFees.totalFee}, 0)`,
        paidAmount: sql<number>`COALESCE(${familySessionFees.paidAmount}, 0)`,
        status: sql<string>`COALESCE(${familySessionFees.status}, 'unknown')`,
      })
      .from(feePayments)
      .leftJoin(families, eq(feePayments.familyId, families.id))
      .leftJoin(sessions, eq(feePayments.sessionId, sessions.id))
      .leftJoin(familySessionFees, eq(feePayments.familySessionFeeId, familySessionFees.id))
      .orderBy(desc(feePayments.paymentDate))

    // Transform the data to include calculated remaining balance
    const transformedPayments = paymentsData.map(payment => ({
      id: payment.id,
      familyName: payment.familyName || 'Unknown Family',
      sessionName: payment.sessionName || 'No Session',
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      notes: payment.notes,
      status: payment.status,
      totalFee: payment.totalFee,
      paidAmount: payment.paidAmount,
      remainingBalance: Math.max(0, payment.totalFee - payment.paidAmount)
    }))

    return NextResponse.json(transformedPayments)
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
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

    const { familyId, sessionId, amount, paymentDate, paymentMethod, notes } = await request.json()

    // Validate required fields
    if (!familyId || !amount || !paymentDate || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: familyId, amount, paymentDate, paymentMethod' },
        { status: 400 }
      )
    }

    // Validate payment amount is positive
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Validate payment method
    const validPaymentMethods = ['cash', 'check', 'online']
    if (!validPaymentMethods.includes(paymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid payment method. Must be cash, check, or online' },
        { status: 400 }
      )
    }

    // Find the family session fee if sessionId is provided
    let familySessionFeeId = null
    if (sessionId) {
      const familySessionFee = await db
        .select()
        .from(familySessionFees)
        .where(
          sql`${familySessionFees.familyId} = ${familyId} AND ${familySessionFees.sessionId} = ${sessionId}`
        )
        .limit(1)

      if (familySessionFee.length > 0) {
        familySessionFeeId = familySessionFee[0].id
      }
    }

    // Create the payment record
    const paymentId = randomUUID()
    await db.insert(feePayments).values({
      id: paymentId,
      familySessionFeeId,
      familyId,
      sessionId,
      amount,
      paymentDate,
      paymentMethod,
      notes: notes || `Manual payment registered by admin`
    })

    // Update the family session fee if it exists
    if (familySessionFeeId) {
      const currentFee = await db
        .select()
        .from(familySessionFees)
        .where(eq(familySessionFees.id, familySessionFeeId))
        .limit(1)

      if (currentFee.length > 0) {
        const newPaidAmount = currentFee[0].paidAmount + amount
        const newStatus = newPaidAmount >= currentFee[0].totalFee ? 'paid' : 
                         newPaidAmount > 0 ? 'partial' : 'pending'

        await db
          .update(familySessionFees)
          .set({
            paidAmount: newPaidAmount,
            status: newStatus,
            updatedAt: new Date().toISOString()
          })
          .where(eq(familySessionFees.id, familySessionFeeId))
      }
    }

    // Return the created payment
    const createdPayment = await db
      .select({
        id: feePayments.id,
        familyId: feePayments.familyId,
        familyName: families.name,
        sessionId: feePayments.sessionId,
        sessionName: sessions.name,
        amount: feePayments.amount,
        paymentDate: feePayments.paymentDate,
        paymentMethod: feePayments.paymentMethod,
        notes: feePayments.notes,
      })
      .from(feePayments)
      .leftJoin(families, eq(feePayments.familyId, families.id))
      .leftJoin(sessions, eq(feePayments.sessionId, sessions.id))
      .where(eq(feePayments.id, paymentId))
      .limit(1)

    return NextResponse.json({
      success: true,
      payment: createdPayment[0]
    })

  } catch (error) {
    console.error('Error creating manual payment:', error)
    return NextResponse.json(
      { error: 'Failed to create manual payment' },
      { status: 500 }
    )
  }
}