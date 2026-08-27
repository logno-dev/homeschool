import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { scholarshipApplications, familySessionFees, sessions } from '@/lib/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getActiveSession, getGuardianById } from '@/lib/database'
import { put } from '@vercel/blob'

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024

export async function GET() {
  try {
    const session = await getAuthenticatedUser()
    const guardian = await getGuardianById(session.user.id)

    if (!guardian) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const applications = await db
      .select({
        id: scholarshipApplications.id,
        sessionId: scholarshipApplications.sessionId,
        sessionName: sessions.name,
        scholarshipType: scholarshipApplications.scholarshipType,
        requestedAmount: scholarshipApplications.requestedAmount,
        approvedAmount: scholarshipApplications.approvedAmount,
        status: scholarshipApplications.status,
        reviewNotes: scholarshipApplications.reviewNotes,
        supportingDocumentUrl: scholarshipApplications.supportingDocumentUrl,
        supportingDocumentFilename: scholarshipApplications.supportingDocumentFilename,
        createdAt: scholarshipApplications.createdAt
      })
      .from(scholarshipApplications)
      .leftJoin(sessions, eq(scholarshipApplications.sessionId, sessions.id))
      .where(eq(scholarshipApplications.familyId, guardian.familyId))
      .orderBy(desc(scholarshipApplications.createdAt))

    return NextResponse.json({ applications })
  } catch (error) {
    console.error('Error fetching scholarship applications:', error)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedUser()
    const guardian = await getGuardianById(session.user.id)

    if (!guardian) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const contentType = request.headers.get('content-type') || ''
    const formData = contentType.includes('multipart/form-data') ? await request.formData() : null
    const body = formData ? Object.fromEntries(formData.entries()) : await request.json()
    const { sessionId, scholarshipType, requestedAmount, reason, additionalInfo } = body
    const supportingDocument = formData?.get('supportingDocument')
    const activeSession = await getActiveSession()
    const targetSessionId = sessionId || activeSession?.id

    if (!targetSessionId) {
      return NextResponse.json({ error: 'No active session available for scholarship requests.' }, { status: 400 })
    }

    if (!scholarshipType || !['full', 'partial'].includes(scholarshipType)) {
      return NextResponse.json({ error: 'Scholarship type must be full or partial.' }, { status: 400 })
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Please provide a reason for the request.' }, { status: 400 })
    }

    const existingApplication = await db
      .select({ id: scholarshipApplications.id })
      .from(scholarshipApplications)
      .where(and(
        eq(scholarshipApplications.familyId, guardian.familyId),
        eq(scholarshipApplications.sessionId, targetSessionId),
        inArray(scholarshipApplications.status, ['pending', 'approved'])
      ))
      .limit(1)

    if (existingApplication.length > 0) {
      return NextResponse.json({ error: 'A scholarship request already exists for this session.' }, { status: 409 })
    }

    const feeRecord = await db
      .select()
      .from(familySessionFees)
      .where(and(
        eq(familySessionFees.familyId, guardian.familyId),
        eq(familySessionFees.sessionId, targetSessionId)
      ))
      .limit(1)

    if (feeRecord.length === 0) {
      return NextResponse.json({ error: 'No fee record found for this session.' }, { status: 400 })
    }

    const remainingAmount = feeRecord[0].totalFee - feeRecord[0].paidAmount

    if (remainingAmount <= 0) {
      return NextResponse.json({ error: 'Your account has no outstanding balance for this session.' }, { status: 400 })
    }

    let normalizedRequestedAmount = remainingAmount
    if (scholarshipType === 'partial') {
      const requested = Number(requestedAmount)
      if (!requested || requested <= 0) {
        return NextResponse.json({ error: 'Please enter a valid requested amount.' }, { status: 400 })
      }
      if (requested > remainingAmount) {
        return NextResponse.json({ error: 'Requested amount exceeds your outstanding balance.' }, { status: 400 })
      }
      normalizedRequestedAmount = requested
    }

    let supportingDocumentUrl: string | null = null
    let supportingDocumentFilename: string | null = null
    if (supportingDocument instanceof File && supportingDocument.size > 0) {
      if (supportingDocument.type !== 'application/pdf' && !supportingDocument.name.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json({ error: 'Supporting documents must be PDF files.' }, { status: 400 })
      }
      if (supportingDocument.size > MAX_DOCUMENT_SIZE) {
        return NextResponse.json({ error: 'Supporting document must be 10 MB or smaller.' }, { status: 400 })
      }
      const blob = await put(`scholarship-submissions/${Date.now()}-${randomUUID()}-${supportingDocument.name}`, supportingDocument, {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'application/pdf'
      })
      supportingDocumentUrl = blob.url
      supportingDocumentFilename = supportingDocument.name
    }

    const applicationId = randomUUID()
    await db.insert(scholarshipApplications).values({
      id: applicationId,
      familyId: guardian.familyId,
      sessionId: targetSessionId,
      guardianId: guardian.id,
      scholarshipType,
      requestedAmount: normalizedRequestedAmount,
      reason: reason.trim(),
      additionalInfo: additionalInfo?.trim() || null,
      supportingDocumentUrl,
      supportingDocumentFilename,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error submitting scholarship application:', error)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}
