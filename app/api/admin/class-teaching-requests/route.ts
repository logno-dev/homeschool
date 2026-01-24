import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { getClassTeachingRequestsWithSession } from '@/lib/database'

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Fetch all class teaching requests with session info
    const requests = await getClassTeachingRequestsWithSession()
    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching class teaching requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}
