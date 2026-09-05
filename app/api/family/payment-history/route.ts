import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { feePayments, familySessionFees, sessions, scholarshipFundTransactions, userDocuments } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { getGuardianById } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()

    // Get guardian info to find family
    const guardian = await getGuardianById(session.user.id)

    if (!guardian) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const payments = await db
      .select({
        id: feePayments.id,
        amount: feePayments.amount,
        paymentDate: feePayments.paymentDate,
        paymentMethod: feePayments.paymentMethod,
        notes: feePayments.notes,
        sessionName: sessions.name,
        sessionId: sessions.id,
        totalFee: familySessionFees.totalFee,
        registrationFee: familySessionFees.registrationFee,
        classFees: familySessionFees.classFees
      })
      .from(feePayments)
      .leftJoin(familySessionFees, eq(feePayments.familySessionFeeId, familySessionFees.id))
      .leftJoin(sessions, eq(familySessionFees.sessionId, sessions.id))
      .where(eq(feePayments.familyId, guardian.familyId))
      .orderBy(desc(feePayments.paymentDate))

    const donations = await db.select({
      id: scholarshipFundTransactions.id,
      amount: scholarshipFundTransactions.amount,
      paymentDate: scholarshipFundTransactions.createdAt,
      paymentMethod: scholarshipFundTransactions.source,
      notes: scholarshipFundTransactions.notes,
      sessionName: sessions.name,
      sessionId: scholarshipFundTransactions.sessionId
    }).from(scholarshipFundTransactions)
      .leftJoin(sessions, eq(scholarshipFundTransactions.sessionId, sessions.id))
      .where(eq(scholarshipFundTransactions.familyId, guardian.familyId))
      .orderBy(desc(scholarshipFundTransactions.createdAt))

    let documents: Array<{ id: string; documentType: string; filename: string; blobUrl: string; createdAt: string }> = []
    try {
      documents = await db.select({ id: userDocuments.id, documentType: userDocuments.documentType, filename: userDocuments.filename, blobUrl: userDocuments.blobUrl, createdAt: userDocuments.createdAt }).from(userDocuments).where(eq(userDocuments.familyId, guardian.familyId))
    } catch (error) {
      console.error('Unable to load payment documents. Apply the user_documents migration:', error)
    }
    const findDocument = (date: string, type: string) => documents.filter((document) => document.documentType === type).sort((a, b) => Math.abs(new Date(a.createdAt).getTime() - new Date(date).getTime()) - Math.abs(new Date(b.createdAt).getTime() - new Date(date).getTime()))[0] || null

    return NextResponse.json({
      payments: [...payments.map(payment => ({
        ...payment,
        paymentDate: payment.paymentDate,
        sessionName: payment.sessionName || 'Unknown Session',
        paymentType: 'fee',
        document: findDocument(payment.paymentDate, 'billing_statement')
      })), ...donations.map(donation => ({
        ...donation,
        sessionName: donation.sessionName || 'Scholarship Fund',
        paymentType: 'donation',
        totalFee: donation.amount,
        registrationFee: 0,
        classFees: 0,
        document: findDocument(donation.paymentDate, 'donation_receipt')
      }))].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
    })

  } catch (error) {
    console.error('Error fetching payment history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    )
  }
}
