import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { teacherReimbursements, classTeachingRequests, sessions, guardians } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { availableClassReimbursement } from '@/lib/reimbursement-balance'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin('payments')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const reimbursements = await db
      .select({
        id: teacherReimbursements.id,
        sessionId: teacherReimbursements.sessionId,
        sessionName: sessions.name,
        classTeachingRequestId: teacherReimbursements.classTeachingRequestId,
        className: classTeachingRequests.className,
        guardianId: teacherReimbursements.guardianId,
        teacherFirstName: guardians.firstName,
        teacherLastName: guardians.lastName,
        amount: teacherReimbursements.amount,
        status: teacherReimbursements.status,
        paidDate: teacherReimbursements.paidDate,
        notes: teacherReimbursements.notes,
        createdAt: teacherReimbursements.createdAt
      })
      .from(teacherReimbursements)
      .leftJoin(classTeachingRequests, eq(teacherReimbursements.classTeachingRequestId, classTeachingRequests.id))
      .leftJoin(sessions, eq(teacherReimbursements.sessionId, sessions.id))
      .leftJoin(guardians, eq(teacherReimbursements.guardianId, guardians.id))
      .orderBy(desc(teacherReimbursements.createdAt))

    return NextResponse.json({ reimbursements })
  } catch (error) {
    console.error('Error fetching reimbursements:', error)
    return NextResponse.json({ error: 'Failed to fetch reimbursements' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin('payments')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { sessionId, classTeachingRequestId, guardianId, amount, notes } = await request.json()

    if (!sessionId || !classTeachingRequestId || !guardianId || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) {
      return NextResponse.json({ error: 'Session, class, teacher, and amount are required' }, { status: 400 })
    }

    const reimbursementId = randomUUID()
    const failure = await db.transaction(async (tx) => {
      const [classRecord] = await tx.select().from(classTeachingRequests).where(eq(classTeachingRequests.id, classTeachingRequestId))
      if (!classRecord || classRecord.sessionId !== sessionId || classRecord.guardianId !== guardianId) return 'Class, session, and teacher do not match.'
      if (amount > await availableClassReimbursement(tx, classTeachingRequestId)) return 'Amount exceeds the remaining reimbursable class fees after refunds and existing reimbursements.'
      await tx.insert(teacherReimbursements).values({
      id: reimbursementId,
      sessionId,
      classTeachingRequestId,
      guardianId,
      amount,
      notes: notes?.trim() || null
      })
      return null
    })
    if (failure) return NextResponse.json({ error: failure }, { status: 409 })

    return NextResponse.json({ success: true, id: reimbursementId })
  } catch (error) {
    console.error('Error creating reimbursement:', error)
    return NextResponse.json({ error: 'Failed to create reimbursement' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin('payments')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id, status, paidDate, amount } = await request.json()

    if (!id || !['pending', 'paid'].includes(status)) {
      return NextResponse.json({ error: 'Reimbursement id and status are required' }, { status: 400 })
    }
    if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001)) {
      return NextResponse.json({ error: 'Amount must be a nonnegative monetary amount.' }, { status: 400 })
    }

    const failure = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(teacherReimbursements).where(eq(teacherReimbursements.id, id))
      if (!existing) return 'Reimbursement not found.'
      if (amount !== undefined && existing.status === 'paid') return 'Paid reimbursements cannot be edited.'
      if ((amount !== undefined || (status === 'paid' && existing.status !== 'paid')) && (amount ?? existing.amount) > await availableClassReimbursement(tx, existing.classTeachingRequestId, existing.id)) {
        return 'This reimbursement exceeds the class balance after refunds. Review its amount before marking it paid.'
      }
      await tx
      .update(teacherReimbursements)
      .set({
        ...(amount !== undefined ? { amount } : {}),
        status,
        paidDate: paidDate || null,
        updatedAt: new Date().toISOString()
      })
      .where(eq(teacherReimbursements.id, id))
      return null
    })
    if (failure) return NextResponse.json({ error: failure }, { status: 409 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating reimbursement:', error)
    return NextResponse.json({ error: 'Failed to update reimbursement' }, { status: 500 })
  }
}
