import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import { 
  createScheduleDraft,
  getScheduleDrafts,
  detectScheduleConflicts
} from '@/lib/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Get drafts and conflicts
    const [drafts, conflicts] = await Promise.all([
      getScheduleDrafts(sessionId, userId || undefined),
      detectScheduleConflicts(sessionId)
    ])

    return NextResponse.json({ 
      drafts,
      conflicts: conflicts.conflicts
    })
  } catch (error) {
    console.error('Error fetching schedule drafts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedule drafts' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { session } = auth

    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Draft name is required' },
        { status: 400 }
      )
    }

    const draft = await createScheduleDraft({
      sessionId,
      createdBy: session.user.id,
      name,
      description: description || null,
      isActive: true
    })

    return NextResponse.json({ draft }, { status: 201 })
  } catch (error) {
    console.error('Error creating schedule draft:', error)
    return NextResponse.json(
      { error: 'Failed to create schedule draft' },
      { status: 500 }
    )
  }
}
