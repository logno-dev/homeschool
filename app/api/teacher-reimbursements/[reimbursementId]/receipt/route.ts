import { get } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { teacherReimbursements } from '@/lib/schema'
import { getAuthenticatedAdmin, getAuthenticatedUserSession } from '@/lib/server-auth'

export async function GET(_request: Request, { params }: { params: Promise<{ reimbursementId: string }> }) {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { reimbursementId } = await params
  const [claim] = await db.select({
    guardianId: teacherReimbursements.guardianId,
    filename: teacherReimbursements.receiptFilename,
    pathname: teacherReimbursements.receiptPathname,
    contentType: teacherReimbursements.receiptContentType,
  }).from(teacherReimbursements).where(eq(teacherReimbursements.id, reimbursementId)).limit(1)
  if (!claim?.pathname || !claim.filename || !claim.contentType) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
  if (claim.guardianId !== auth.session.user.id) {
    const admin = await getAuthenticatedAdmin('payments')
    if ('error' in admin) return NextResponse.json({ error: 'You do not have access to this receipt' }, { status: 403 })
  }
  const blob = await get(claim.pathname, { access: 'private' })
  if (!blob || blob.statusCode === 304 || !blob.stream) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
  const safeFilename = claim.filename.replace(/["\r\n]/g, '_')
  return new Response(blob.stream, { headers: { 'Content-Type': claim.contentType, 'Content-Disposition': `inline; filename="${safeFilename}"`, 'Cache-Control': 'private, no-store' } })
}
