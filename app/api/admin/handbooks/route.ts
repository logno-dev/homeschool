import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { handbooks, users } from '@/lib/schema'

const MAX_HANDBOOK_SIZE = 10 * 1024 * 1024

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const records = await db
      .select({
        id: handbooks.id,
        version: handbooks.version,
        filename: handbooks.filename,
        blobUrl: handbooks.blobUrl,
        size: handbooks.size,
        isActive: handbooks.isActive,
        uploadedAt: handbooks.uploadedAt,
        uploadedBy: users.email
      })
      .from(handbooks)
      .leftJoin(users, eq(handbooks.uploadedBy, users.id))
      .orderBy(desc(handbooks.uploadedAt))

    return NextResponse.json({ handbooks: records })
  } catch (error) {
    console.error('Error loading handbooks:', error)
    return NextResponse.json({ error: 'Failed to load handbooks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const version = String(formData.get('version') || '').trim()

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A handbook PDF is required' }, { status: 400 })
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Handbook uploads must be PDF files' }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_HANDBOOK_SIZE) {
      return NextResponse.json({ error: 'Handbook PDF must be between 1 byte and 10 MB' }, { status: 400 })
    }
    if (!version) {
      return NextResponse.json({ error: 'A handbook version is required' }, { status: 400 })
    }

    const blob = await put(`handbooks/${Date.now()}-${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/pdf'
    })
    const uploadedAt = new Date().toISOString()
    const [handbook] = await db.insert(handbooks).values({
      id: randomUUID(),
      version,
      filename: file.name,
      blobUrl: blob.url,
      pathname: blob.pathname,
      size: file.size,
      isActive: false,
      uploadedBy: auth.session.user.id,
      uploadedAt
    }).returning()

    return NextResponse.json({ handbook }, { status: 201 })
  } catch (error) {
    console.error('Error uploading handbook:', error)
    return NextResponse.json({ error: 'Failed to upload handbook. Verify Blob storage is configured.' }, { status: 500 })
  }
}
