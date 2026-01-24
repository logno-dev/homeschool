import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'
import {
  getScheduleDraftById,
  getScheduleDraftEntries,
  saveScheduleDraftEntries,
  deleteScheduleDraft,
  setActiveDraft
} from '@/lib/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string, draftId: string }> }
) {
  try {
    const { draftId } = await params
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const [draft, entries] = await Promise.all([
      getScheduleDraftById(draftId),
      getScheduleDraftEntries(draftId)
    ])

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      draft,
      entries
    })
  } catch (error) {
    console.error('Error fetching schedule draft:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedule draft' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sessionId: string, draftId: string }> }
) {
  try {
    const { draftId } = await params
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { session, role } = auth
    const isAdmin = role === 'admin'

    const body = await request.json()
    const { entries, setActive } = body

    // Verify draft exists and user has permission
    const draft = await getScheduleDraftById(draftId)
    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Only allow the creator or admins to modify
    if (draft.createdBy !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Save entries if provided
    if (entries) {
      await saveScheduleDraftEntries(draftId, entries)
    }

    // Set as active if requested
    if (setActive) {
      await setActiveDraft(draftId, session.user.id)
    }

    return NextResponse.json({ message: 'Draft updated successfully' })
  } catch (error) {
    console.error('Error updating schedule draft:', error)
    return NextResponse.json(
      { error: 'Failed to update schedule draft' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string, draftId: string }> }
) {
  try {
    const { draftId } = await params
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { session, role } = auth
    const isAdmin = role === 'admin'

    // Verify draft exists and user has permission
    const draft = await getScheduleDraftById(draftId)
    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Only allow the creator or admins to delete
    if (draft.createdBy !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    const deleted = await deleteScheduleDraft(draftId)
    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete draft' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Draft deleted successfully' })
  } catch (error) {
    console.error('Error deleting schedule draft:', error)
    return NextResponse.json(
      { error: 'Failed to delete schedule draft' },
      { status: 500 }
    )
  }
}
