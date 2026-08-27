import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { setGlobalSetting } from '@/lib/database'

const MAX_FORM_SIZE = 10 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin('settings')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const file = (await request.formData()).get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A scholarship application PDF is required' }, { status: 400 })
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Scholarship application uploads must be PDF files' }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_FORM_SIZE) {
      return NextResponse.json({ error: 'Scholarship application PDF must be between 1 byte and 10 MB' }, { status: 400 })
    }

    const blob = await put(`scholarship-forms/${Date.now()}-${randomUUID()}-${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/pdf'
    })
    await Promise.all([
      setGlobalSetting('scholarship_form_url', blob.url),
      setGlobalSetting('scholarship_form_filename', file.name)
    ])

    return NextResponse.json({ url: blob.url, filename: file.name, uploadedBy: auth.session.user.id })
  } catch (error) {
    console.error('Error uploading scholarship form:', error)
    return NextResponse.json({ error: 'Failed to upload scholarship form. Verify Blob storage is configured.' }, { status: 500 })
  }
}
