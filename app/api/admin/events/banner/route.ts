import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { EVENT_IMAGE_TYPES, MAX_EVENT_IMAGE_SIZE, eventImageExtension } from '@/lib/event-images'

export async function POST(request: Request) {
  const auth = await getAuthenticatedAdmin('events')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || !EVENT_IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: 'Choose a JPG, PNG, WebP, or GIF image' }, { status: 400 })
    if (file.size === 0 || file.size > MAX_EVENT_IMAGE_SIZE) return NextResponse.json({ error: 'Banner images must be between 1 byte and 4 MB' }, { status: 400 })
    const extension = eventImageExtension(new Uint8Array(await file.slice(0, 12).arrayBuffer()))
    const contentType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`
    if (!extension || contentType !== file.type) return NextResponse.json({ error: 'The file is not a supported image' }, { status: 400 })

    const blob = await put(`events/${randomUUID()}.${extension}`, file, { access: 'public', contentType, addRandomSuffix: true })
    return NextResponse.json({ url: blob.url }, { status: 201 })
  } catch (error) {
    console.error('Error uploading event banner:', error)
    return NextResponse.json({ error: 'Unable to upload the banner. Please try again.' }, { status: 500 })
  }
}
