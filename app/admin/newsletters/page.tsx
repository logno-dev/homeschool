'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

interface Newsletter { id: string; kind: string; subject: string; status: string; scheduledAt: string | null; totalRecipients: number; totalSent: number; totalFailed: number; updatedAt: string }
interface Group { id: string; name: string; members: Array<{ id: string }>; isSystem: boolean }

const emptyDraft = { kind: 'newsletter', subject: '', html: '', text: '', includeInactive: false, scheduledAt: '', groupIds: [] as string[] }

function htmlToText(html: string) {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ')
  const element = document.createElement('div')
  element.innerHTML = html
  return element.textContent || ''
}

export default function AdminNewslettersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [newsletterResponse, groupResponse] = await Promise.all([fetch('/api/admin/newsletters'), fetch('/api/admin/groups')])
    const newsletterPayload = await newsletterResponse.json()
    const groupPayload = await groupResponse.json()
    if (!newsletterResponse.ok) throw new Error(newsletterPayload.error || 'Unable to load newsletters')
    setNewsletters(newsletterPayload.newsletters || [])
    setGroups(groupPayload.groups || [])
  }

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/signin'); return }
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load newsletters'))
  }, [loading, user, router])

  const selectNewsletter = async (id: string) => {
    const response = await fetch(`/api/admin/newsletters/${id}`)
    const payload = await response.json()
    if (!response.ok) { setMessage(payload.error || 'Unable to load newsletter'); return }
    setSelectedId(id)
    setDraft({ kind: payload.newsletter.kind || 'newsletter', subject: payload.newsletter.subject, html: payload.newsletter.html, text: payload.newsletter.text, includeInactive: payload.newsletter.includeInactive, scheduledAt: payload.newsletter.scheduledAt ? new Date(payload.newsletter.scheduledAt).toISOString().slice(0, 16) : '', groupIds: payload.groupIds || [] })
  }

  const newNewsletter = (kind: 'newsletter' | 'bulk_email' = 'newsletter') => { setSelectedId(null); setDraft({ ...emptyDraft, kind }); setMessage('') }

  const save = async (status: 'draft' | 'scheduled') => {
    if (!draft.subject.trim() || !draft.html.trim()) { setMessage('Subject and message content are required'); return }
    if (status === 'scheduled' && !draft.scheduledAt) { setMessage('Choose a scheduled send time'); return }
    setBusy(true)
    const url = selectedId ? `/api/admin/newsletters/${selectedId}` : '/api/admin/newsletters'
    const response = await fetch(url, { method: selectedId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, text: htmlToText(draft.html), status }) })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) { setMessage(payload.error || 'Unable to save newsletter'); return }
    setMessage(status === 'scheduled' ? 'Newsletter scheduled. It will send on the next hourly delivery sweep.' : 'Draft saved')
    await load()
    if (!selectedId && payload.newsletter?.id) await selectNewsletter(payload.newsletter.id)
  }

  const cancelSchedule = async () => {
    if (!selectedId) return
    setBusy(true)
    const response = await fetch(`/api/admin/newsletters/${selectedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, status: 'draft' }) })
    setBusy(false)
    if (response.ok) { setMessage('Schedule cancelled'); await load(); await selectNewsletter(selectedId) } else setMessage('Unable to cancel schedule')
  }

  const deleteDraft = async () => {
    if (!selectedId || !confirm('Delete this draft?')) return
    const response = await fetch(`/api/admin/newsletters/${selectedId}`, { method: 'DELETE' })
    if (!response.ok) { setMessage('Unable to delete draft'); return }
    newNewsletter()
    await load()
  }

  if (loading || !user) return <div className="min-h-screen bg-gray-50" />
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  const selectedNewsletter = newsletters.find((entry) => entry.id === selectedId) || (!selectedId ? {
    id: 'new',
    kind: draft.kind,
    subject: draft.kind === 'bulk_email' ? 'New Bulk Email' : 'New Newsletter',
    status: 'draft',
    scheduledAt: null,
    totalRecipients: 0,
    totalSent: 0,
    totalFailed: 0,
    updatedAt: ''
  } : undefined)
  const canEdit = !selectedNewsletter || ['draft', 'scheduled'].includes(selectedNewsletter.status)

  return <AdminLayout userName={userName} activeTab="newsletters"><main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-gray-900">Bulk Email & Newsletters</h1><p className="mt-1 text-sm text-gray-600">Create group-targeted emails and schedule delivery.</p></div><div className="flex gap-2"><button onClick={() => newNewsletter('newsletter')} className={`rounded-md px-4 py-2 text-sm font-semibold ${!selectedId && draft.kind === 'newsletter' ? 'bg-blue-700 text-white' : 'border border-blue-300 text-blue-700'}`}>New Newsletter</button><button onClick={() => newNewsletter('bulk_email')} className={`rounded-md px-4 py-2 text-sm font-semibold ${!selectedId && draft.kind === 'bulk_email' ? 'bg-blue-700 text-white' : 'border border-blue-300 text-blue-700'}`}>New Bulk Email</button></div></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]"><aside className="rounded-lg bg-white p-4 shadow"><h2 className="font-semibold text-gray-900">Drafts & Sends</h2><div className="mt-3 space-y-2">{newsletters.map((entry) => <button key={entry.id} onClick={() => selectNewsletter(entry.id)} className={`w-full rounded-md border px-3 py-3 text-left ${selectedId === entry.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}><p className="truncate text-sm font-medium text-gray-900">{entry.subject || 'Untitled message'}</p><p className="mt-1 text-xs capitalize text-gray-500">{entry.kind === 'bulk_email' ? 'Bulk Email' : 'Newsletter'} · {entry.status}{entry.status === 'sent' ? ` · ${entry.totalSent}/${entry.totalRecipients}` : ''}</p></button>)}{!newsletters.length && <p className="py-4 text-sm text-gray-500">No messages yet.</p>}</div></aside>
      <section className="rounded-lg bg-white p-5 shadow"><h2 className="text-xl font-semibold text-gray-900">{selectedNewsletter?.subject || 'New Newsletter'}</h2><div className="mt-5 space-y-5"><label className="block text-sm font-medium text-gray-700">Subject<input value={draft.subject} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label><div><label className="block text-sm font-medium text-gray-700">Message</label><div className="mt-1 overflow-hidden rounded-md border border-gray-300"><ReactQuill theme="snow" value={draft.html} readOnly={!canEdit || busy} onChange={(html) => setDraft({ ...draft, html })} /></div></div><div><p className="text-sm font-medium text-gray-700">Recipient Groups</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{groups.map((group) => <label key={group.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm"><input type="checkbox" checked={draft.groupIds.includes(group.id)} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...draft, groupIds: event.target.checked ? [...draft.groupIds, group.id] : draft.groupIds.filter((id) => id !== group.id) })} /><span>{group.name}</span><span className="ml-auto text-xs text-gray-500">{group.members.length}</span></label>)}</div><label className="mt-3 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={draft.includeInactive} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...draft, includeInactive: event.target.checked })} />Include inactive users</label></div><label className="block max-w-sm text-sm font-medium text-gray-700">Schedule send time<input type="datetime-local" value={draft.scheduledAt} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...draft, scheduledAt: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /><span className="mt-1 block text-xs font-normal text-gray-500">Delivery begins on the next hourly cron sweep after this time.</span></label></div>
        {message && <p className="mt-5 rounded-md bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
        {canEdit && <div className="mt-6 flex flex-wrap gap-2 border-t pt-5"><button onClick={() => save('draft')} disabled={busy} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Save Draft</button><button onClick={() => save('scheduled')} disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Schedule Send</button>{selectedNewsletter?.status === 'scheduled' && <button onClick={cancelSchedule} disabled={busy} className="rounded-md border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800">Cancel Schedule</button>}{selectedNewsletter?.status === 'draft' && <button onClick={deleteDraft} disabled={busy} className="ml-auto rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Delete Draft</button>}</div>}
      </section></div></main></AdminLayout>
}
