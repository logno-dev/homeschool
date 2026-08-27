'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import IndividualEmailComposer from './IndividualEmailComposer'

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

type Mode = 'newsletter' | 'bulk_email' | 'individual'
type Draft = { kind: Mode; subject: string; html: string; text: string; includeInactive: boolean; scheduledAt: string; groupIds: string[]; senderAlias: string; replyToAlias: string }
type Newsletter = { id: string; kind: string; subject: string; status: string; scheduledAt: string | null; totalRecipients: number; totalSent: number; totalFailed: number; updatedAt: string; senderAlias: string | null; replyToAlias: string | null }
type Group = { id: string; name: string; members: Array<{ id: string }>; isSystem: boolean }
type User = { id: string; firstName: string; lastName: string; email: string }

const emptyDraft: Draft = { kind: 'newsletter', subject: '', html: '', text: '', includeInactive: false, scheduledAt: '', groupIds: [], senderAlias: '', replyToAlias: '' }

function htmlToText(html: string) {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ')
  const element = document.createElement('div')
  element.innerHTML = html
  return element.textContent || ''
}

export default function AdminNewslettersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Newsletter[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [aliases, setAliases] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('newsletter')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [messageResponse, groupResponse, configResponse, usersResponse] = await Promise.all([
      fetch('/api/admin/newsletters'), fetch('/api/admin/groups'), fetch('/api/admin/messaging/config'), fetch('/api/admin/users?export=true')
    ])
    const messagePayload = await messageResponse.json()
    const groupPayload = await groupResponse.json()
    const configPayload = await configResponse.json()
    const usersPayload = await usersResponse.json()
    if (!messageResponse.ok) throw new Error(messagePayload.error || 'Unable to load messages')
    setMessages(messagePayload.newsletters || [])
    setGroups(groupPayload.groups || [])
    setAliases(configPayload.aliases || [])
    setUsers(usersPayload.users || [])
  }

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/signin'); return }
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load messages'))
  }, [loading, user, router])

  const newMessage = (nextMode: Mode) => {
    setSelectedId(null)
    setMode(nextMode)
    setDraft({ ...emptyDraft, kind: nextMode === 'individual' ? 'individual' : nextMode })
    setMessage('')
  }

  const selectMessage = async (id: string) => {
    const response = await fetch(`/api/admin/newsletters/${id}`)
    const payload = await response.json()
    if (!response.ok) { setMessage(payload.error || 'Unable to load message'); return }
    const nextMode: Mode = payload.newsletter.kind === 'bulk_email' ? 'bulk_email' : 'newsletter'
    setSelectedId(id)
    setMode(nextMode)
    setDraft({ kind: nextMode, subject: payload.newsletter.subject, html: payload.newsletter.html, text: payload.newsletter.text, includeInactive: payload.newsletter.includeInactive, scheduledAt: payload.newsletter.scheduledAt ? new Date(payload.newsletter.scheduledAt).toISOString().slice(0, 16) : '', groupIds: payload.groupIds || [], senderAlias: payload.newsletter.senderAlias || '', replyToAlias: payload.newsletter.replyToAlias || '' })
  }

  const save = async (status: 'draft' | 'scheduled') => {
    if (!draft.subject.trim() || !draft.html.trim()) { setMessage('Subject and message content are required'); return }
    if (status === 'scheduled' && !draft.scheduledAt) { setMessage('Choose a scheduled send time'); return }
    setBusy(true)
    const url = selectedId ? `/api/admin/newsletters/${selectedId}` : '/api/admin/newsletters'
    const response = await fetch(url, { method: selectedId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, text: htmlToText(draft.html), status }) })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) { setMessage(payload.error || 'Unable to save message'); return }
    setMessage(status === 'scheduled' ? 'Message scheduled' : 'Draft saved')
    await load()
    if (!selectedId && payload.newsletter?.id) await selectMessage(payload.newsletter.id)
  }

  const deleteDraft = async () => {
    if (!selectedId || !confirm('Delete this draft?')) return
    const response = await fetch(`/api/admin/newsletters/${selectedId}`, { method: 'DELETE' })
    if (!response.ok) { setMessage('Unable to delete draft'); return }
    newMessage('newsletter')
    await load()
  }

  if (loading || !user) return <div className="min-h-screen bg-gray-50" />
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  const selectedMessage = messages.find((entry) => entry.id === selectedId)
  const canEdit = !selectedMessage || ['draft', 'scheduled'].includes(selectedMessage.status)
  const modeTitle = mode === 'newsletter' ? 'Newsletter' : mode === 'bulk_email' ? 'Bulk email' : 'Individual email'

  return <AdminLayout userName={userName} activeTab="newsletters">
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Messaging</h1><p className="mt-1 text-sm text-gray-600">Send newsletters, bulk emails, or individual messages.</p></div>
        <div className="flex gap-2"><button onClick={() => newMessage('newsletter')} className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700">New newsletter</button><button onClick={() => newMessage('bulk_email')} className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700">New bulk email</button><button onClick={() => newMessage('individual')} className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700">New individual email</button></div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="rounded-lg bg-white p-4 shadow"><h2 className="font-semibold text-gray-900">Drafts & sends</h2><div className="mt-3 space-y-2">{messages.map((entry) => <button key={entry.id} onClick={() => selectMessage(entry.id)} className={`w-full rounded-md border px-3 py-3 text-left ${selectedId === entry.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}><p className="truncate text-sm font-medium text-gray-900">{entry.subject || 'Untitled message'}</p><p className="mt-1 text-xs capitalize text-gray-500">{entry.kind === 'bulk_email' ? 'Bulk email' : 'Newsletter'} · {entry.status}</p></button>)}{!messages.length && <p className="py-4 text-sm text-gray-500">No messages yet.</p>}</div></aside>
        <section className="rounded-lg bg-white p-5 shadow">
          <div className="border-b border-gray-200"><div className="flex gap-6"><button onClick={() => newMessage('newsletter')} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${mode === 'newsletter' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>Newsletter</button><button onClick={() => newMessage('bulk_email')} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${mode === 'bulk_email' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>Bulk email</button><button onClick={() => newMessage('individual')} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${mode === 'individual' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>Individual email</button></div></div>
          <h2 className="mt-5 text-xl font-semibold text-gray-900">{modeTitle}</h2>
          {mode === 'individual' ? <IndividualEmailComposer users={users} aliases={aliases} /> : <div className="mt-5 space-y-5">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4"><p className="text-sm font-semibold text-gray-800">Recipients</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{groups.map((group) => <label key={group.id} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"><input type="checkbox" checked={draft.groupIds.includes(group.id)} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...draft, groupIds: event.target.checked ? [...draft.groupIds, group.id] : draft.groupIds.filter((id) => id !== group.id) })} /><span>{group.name}</span><span className="ml-auto text-xs text-gray-500">{group.members.length}</span></label>)}</div><label className="mt-3 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={draft.includeInactive} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...draft, includeInactive: event.target.checked })} />Include inactive users</label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">From<select value={draft.senderAlias} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...draft, senderAlias: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">Use configured default</option>{aliases.map((alias) => <option key={alias} value={alias}>{alias}</option>)}</select></label><label className="text-sm font-medium text-gray-700">Reply-to<select value={draft.replyToAlias} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...draft, replyToAlias: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">No reply-to address</option>{aliases.map((alias) => <option key={alias} value={alias}>{alias}</option>)}</select></label></div>
            <label className="block text-sm font-medium text-gray-700">Subject<input value={draft.subject} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
            <div><label className="block text-sm font-medium text-gray-700">Body</label><div className="mt-1 overflow-hidden rounded-md border border-gray-300"><ReactQuill theme="snow" value={draft.html} readOnly={!canEdit || busy} onChange={(html) => setDraft({ ...draft, html })} /></div></div>
            <label className="block max-w-sm text-sm font-medium text-gray-700">Schedule send time<input type="datetime-local" value={draft.scheduledAt} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...draft, scheduledAt: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
            {message && <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
            {canEdit && <div className="flex flex-wrap gap-2 border-t pt-5"><button onClick={() => save('draft')} disabled={busy} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Save draft</button><button onClick={() => save('scheduled')} disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Schedule send</button>{selectedMessage?.status === 'draft' && <button onClick={deleteDraft} disabled={busy} className="ml-auto rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Delete draft</button>}</div>}
          </div>}
        </section>
      </div>
    </main>
  </AdminLayout>
}
