import { randomUUID } from 'crypto'
import { del, put } from '@vercel/blob'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classTeachingRequests, guardians, schedules, sessions, teacherReimbursements } from '@/lib/schema'
import { availableClassReimbursement, classReimbursementBalance } from '@/lib/reimbursement-balance'
import { validateReimbursementReceipt } from '@/lib/reimbursement-receipt-files'
import { getAuthenticatedUserSession } from '@/lib/server-auth'
import { getConfiguredDateKey } from '@/lib/app-time'
import { getGlobalSetting } from '@/lib/database'
import { parseReimbursementMethods } from '@/lib/reimbursement-methods'

async function getGuardian(userId: string) {
  return db.select({ id: guardians.id }).from(guardians).where(eq(guardians.id, userId)).limit(1).then((rows) => rows[0])
}

export async function GET() {
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const guardian = await getGuardian(auth.session.user.id)
    if (!guardian) return NextResponse.json({ classes: [], claims: [] })

    const classes = await db.selectDistinct({
      classTeachingRequestId: classTeachingRequests.id,
      className: classTeachingRequests.className,
      sessionId: sessions.id,
      sessionName: sessions.name,
      sessionStartDate: sessions.startDate,
      dueDate: sessions.teacherReimbursementDueDate,
      feeAmount: classTeachingRequests.feeAmount,
    }).from(classTeachingRequests)
      .innerJoin(sessions, eq(classTeachingRequests.sessionId, sessions.id))
      .innerJoin(schedules, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .where(and(
        eq(classTeachingRequests.requiresFee, true),
        eq(schedules.status, 'published'),
        or(eq(classTeachingRequests.guardianId, guardian.id), eq(classTeachingRequests.coTeacherId, guardian.id))
      )).orderBy(desc(sessions.startDate), classTeachingRequests.className)

    const withBalances = await Promise.all(classes.map(async (item) => ({
      ...item,
      ...await classReimbursementBalance(db, item.classTeachingRequestId),
    })))
    const claims = await db.select({
      id: teacherReimbursements.id,
      sessionId: teacherReimbursements.sessionId,
      classTeachingRequestId: teacherReimbursements.classTeachingRequestId,
      className: classTeachingRequests.className,
      sessionName: sessions.name,
      dueDate: sessions.teacherReimbursementDueDate,
      requestedAmount: teacherReimbursements.requestedAmount,
      amount: teacherReimbursements.amount,
      status: teacherReimbursements.status,
      notes: teacherReimbursements.notes,
      reviewNotes: teacherReimbursements.reviewNotes,
      receiptFilename: teacherReimbursements.receiptFilename,
      paymentMethod: teacherReimbursements.paymentMethod,
      paymentDetailsLabel: teacherReimbursements.paymentDetailsLabel,
      paymentDetails: teacherReimbursements.paymentDetails,
      paidDate: teacherReimbursements.paidDate,
      createdAt: teacherReimbursements.createdAt,
    }).from(teacherReimbursements)
      .innerJoin(classTeachingRequests, eq(teacherReimbursements.classTeachingRequestId, classTeachingRequests.id))
      .innerJoin(sessions, eq(teacherReimbursements.sessionId, sessions.id))
      .where(eq(teacherReimbursements.guardianId, guardian.id))
      .orderBy(desc(teacherReimbursements.createdAt))
    const today = await getConfiguredDateKey()
    const methods = parseReimbursementMethods(await getGlobalSetting('teacher_reimbursement_methods'))

    return NextResponse.json({
      classes: withBalances,
      claims: claims.map((claim) => ({ ...claim, isLate: Boolean(claim.dueDate && claim.createdAt.slice(0, 10) > claim.dueDate) })),
      methods,
      today,
    })
  } catch (error) {
    console.error('Error fetching teacher reimbursement claims:', error)
    return NextResponse.json({ error: 'Failed to fetch reimbursement claims' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  let pathname: string | null = null
  try {
    const auth = await getAuthenticatedUserSession()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const guardian = await getGuardian(auth.session.user.id)
    if (!guardian) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 403 })

    const formData = await request.formData()
    const classTeachingRequestId = String(formData.get('classTeachingRequestId') || '')
    const notes = String(formData.get('notes') || '').trim()
    const amount = Number(formData.get('amount'))
    const paymentMethod = String(formData.get('paymentMethod') || '')
    const paymentDetails = String(formData.get('paymentDetails') || '').trim()
    const receipt = formData.get('receipt')
    if (!classTeachingRequestId || !Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) return NextResponse.json({ error: 'Choose a class and enter a valid amount' }, { status: 400 })
    if (!(receipt instanceof File)) return NextResponse.json({ error: 'Upload a receipt image or PDF' }, { status: 400 })
    const methods = parseReimbursementMethods(await getGlobalSetting('teacher_reimbursement_methods'))
    const selectedMethod = methods.find((method) => method.id === paymentMethod)
    if (!selectedMethod || !paymentDetails || paymentDetails.length > 500) return NextResponse.json({ error: 'Choose a reimbursement method and provide its requested payment information' }, { status: 400 })

    const [classRecord] = await db.select({ sessionId: classTeachingRequests.sessionId }).from(classTeachingRequests)
      .innerJoin(schedules, eq(schedules.classTeachingRequestId, classTeachingRequests.id))
      .where(and(
        eq(classTeachingRequests.id, classTeachingRequestId),
        eq(classTeachingRequests.requiresFee, true),
        eq(schedules.status, 'published'),
        or(eq(classTeachingRequests.guardianId, guardian.id), eq(classTeachingRequests.coTeacherId, guardian.id))
      )).limit(1)
    if (!classRecord) return NextResponse.json({ error: 'This class is not eligible for a reimbursement claim' }, { status: 403 })

    const bytes = new Uint8Array(await receipt.arrayBuffer())
    let extension: string
    try { extension = validateReimbursementReceipt(receipt, bytes) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid receipt' }, { status: 400 }) }
    const id = randomUUID()
    const blob = await put(`teacher-reimbursements/${classRecord.sessionId}/${classTeachingRequestId}/${id}.${extension}`, Buffer.from(bytes), { access: 'private', contentType: receipt.type, addRandomSuffix: false })
    pathname = blob.pathname

    const failure = await db.transaction(async (tx) => {
      if (amount > await availableClassReimbursement(tx, classTeachingRequestId)) return 'Amount exceeds the remaining class fees available for reimbursement.'
      await tx.insert(teacherReimbursements).values({
        id,
        sessionId: classRecord.sessionId,
        classTeachingRequestId,
        guardianId: guardian.id,
        amount,
        requestedAmount: amount,
        notes: notes.slice(0, 2000) || null,
        receiptPathname: blob.pathname,
        receiptFilename: receipt.name.slice(0, 255),
        receiptContentType: receipt.type,
        receiptSize: receipt.size,
        paymentMethod: selectedMethod.label,
        paymentDetailsLabel: selectedMethod.detailsLabel,
        paymentDetails,
        submittedByTeacher: true,
      })
      return null
    })
    if (failure) {
      await del(blob.pathname).catch(() => undefined)
      return NextResponse.json({ error: failure }, { status: 409 })
    }
    return NextResponse.json({ success: true, id }, { status: 201 })
  } catch (error) {
    if (pathname) await del(pathname).catch(() => undefined)
    console.error('Error submitting teacher reimbursement claim:', error)
    return NextResponse.json({ error: 'Failed to submit reimbursement claim' }, { status: 500 })
  }
}
