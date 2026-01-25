import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { scholarshipApplications, familySessionFees, feePayments, scholarshipFundTransactions } from '@/lib/schema'
import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function PATCH(request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { applicationId: paramId } = await params
    const resolvedApplicationId = paramId || body?.applicationId
    if (!resolvedApplicationId || typeof resolvedApplicationId !== 'string' || !resolvedApplicationId.trim()) {
      return NextResponse.json({ error: 'Missing scholarship application id.' }, { status: 400 })
    }
    const applicationId = resolvedApplicationId.trim()
    const { action, reviewNotes } = body

    const application = await db
      .select()
      .from(scholarshipApplications)
      .where(eq(scholarshipApplications.id, applicationId))
      .limit(1)

    if (application.length === 0) {
      return NextResponse.json({ error: 'Scholarship application not found' }, { status: 404 })
    }

    const record = application[0]

    if (action === 'reject') {
      await db
        .update(scholarshipApplications)
        .set({
          status: 'rejected',
          reviewNotes: reviewNotes?.trim() || null,
          reviewedBy: auth.session.user.id,
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(scholarshipApplications.id, applicationId))

      return NextResponse.json({ success: true })
    }

    if (action !== 'approve') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (record.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending applications can be approved' }, { status: 400 })
    }

    const feeRecord = await db
      .select()
      .from(familySessionFees)
      .where(and(
        eq(familySessionFees.familyId, record.familyId),
        eq(familySessionFees.sessionId, record.sessionId)
      ))
      .limit(1)

    if (feeRecord.length === 0) {
      return NextResponse.json({ error: 'No fee record found for this family/session.' }, { status: 400 })
    }

    const fee = feeRecord[0]
    const remainingAmount = fee.totalFee - fee.paidAmount

    if (remainingAmount <= 0) {
      return NextResponse.json({ error: 'This family has no outstanding balance.' }, { status: 400 })
    }

    const requestedAmount = record.scholarshipType === 'full'
      ? remainingAmount
      : Math.min(record.requestedAmount || 0, remainingAmount)

    if (!requestedAmount || requestedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid requested amount on application.' }, { status: 400 })
    }

    const balanceResult = await db
      .select({
        balance: sql<number>`COALESCE(SUM(${scholarshipFundTransactions.amount}), 0)`
      })
      .from(scholarshipFundTransactions)

    const balance = balanceResult[0]?.balance || 0
    if (balance < requestedAmount) {
      return NextResponse.json({ error: 'Scholarship fund does not have enough balance for this award.' }, { status: 400 })
    }

    const newPaidAmount = fee.paidAmount + requestedAmount
    const newStatus = newPaidAmount >= fee.totalFee ? 'paid' : 'partial'

    await db
      .update(familySessionFees)
      .set({
        paidAmount: newPaidAmount,
        status: newStatus,
        updatedAt: new Date().toISOString()
      })
      .where(eq(familySessionFees.id, fee.id))

    await db.insert(feePayments).values({
      id: randomUUID(),
      familySessionFeeId: fee.id,
      familyId: fee.familyId,
      sessionId: fee.sessionId,
      amount: requestedAmount,
      paymentDate: new Date().toISOString(),
      paymentMethod: 'scholarship',
      notes: reviewNotes?.trim() || 'Scholarship fund award'
    })

    await db.insert(scholarshipFundTransactions).values({
      id: randomUUID(),
      amount: -requestedAmount,
      transactionType: 'award',
      source: 'admin',
      familyId: record.familyId,
      sessionId: record.sessionId,
      applicationId: record.id,
      notes: reviewNotes?.trim() || 'Scholarship award',
      createdBy: auth.session.user.id,
      createdAt: new Date().toISOString()
    })

    await db
      .update(scholarshipApplications)
      .set({
        status: 'approved',
        approvedAmount: requestedAmount,
        reviewNotes: reviewNotes?.trim() || null,
        reviewedBy: auth.session.user.id,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .where(eq(scholarshipApplications.id, applicationId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating scholarship application:', error)
    const message = error instanceof Error ? error.message : 'Failed to update scholarship application'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
