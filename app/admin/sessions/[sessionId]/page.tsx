'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/lib/auth-client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminLayout from '@/app/components/AdminLayout'
import SessionFeeConfig from '@/app/components/SessionFeeConfig'
import type { Session } from '@/lib/schema'

interface Group { id: string; name: string; slug: string }
interface WindowEntry { groupId: string; startDate: string; endDate: string }

export default function AdminSessionDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams<{ sessionId: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [windows, setWindows] = useState<WindowEntry[]>([])
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', description: '', isActive: false })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    const [sessionResponse, groupResponse, windowResponse] = await Promise.all([
      fetch(`/api/admin/sessions/${params.sessionId}`),
      fetch('/api/admin/groups'),
      fetch(`/api/admin/sessions/${params.sessionId}/registration-windows`)
    ])
    const sessionPayload = await sessionResponse.json()
    const groupPayload = await groupResponse.json()
    const windowPayload = await windowResponse.json()
    if (!sessionResponse.ok) throw new Error(sessionPayload.error || 'Session not found')
    const nextSession = sessionPayload.session as Session
    setSession(nextSession)
    setGroups(groupPayload.groups || [])
    setWindows((windowPayload.windows || []).map((entry: WindowEntry) => ({ groupId: entry.groupId, startDate: entry.startDate, endDate: entry.endDate })))
    setForm({ name: nextSession.name, startDate: nextSession.startDate, endDate: nextSession.endDate, description: nextSession.description || '', isActive: nextSession.isActive })
  }

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/signin'); return }
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load session'))
  }, [loading, user, params.sessionId, router])

  const updateWindow = (groupId: string, field: 'startDate' | 'endDate', value: string) => {
    const existing = windows.find((entry) => entry.groupId === groupId) || { groupId, startDate: '', endDate: '' }
    setWindows((current) => [...current.filter((entry) => entry.groupId !== groupId), { ...existing, [field]: value }])
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/sessions/${params.sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to save session')
      const windowResponse = await fetch(`/api/admin/sessions/${params.sessionId}/registration-windows`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ windows: windows.filter((entry) => entry.startDate && entry.endDate) }) })
      if (!windowResponse.ok) throw new Error('Unable to save registration windows')
      setSession(payload.session)
      setMessage('Session updated')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save session')
    } finally {
      setBusy(false)
    }
  }

  const deleteSession = async () => {
    if (!session || !confirm(`Delete "${session.name}"? This removes associated schedules, registrations, and volunteer assignments.`)) return
    setBusy(true)
    const response = await fetch(`/api/admin/sessions/${session.id}`, { method: 'DELETE' })
    if (response.ok) router.push('/admin/sessions')
    else { const payload = await response.json(); setMessage(payload.error || 'Unable to delete session'); setBusy(false) }
  }

  if (loading || !user || !session) return <div className="min-h-screen bg-gray-50" />
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  const displayDate = (value: string) => format(parseISO(value), 'MMM d, yyyy')

  return <AdminLayout userName={userName} activeTab="sessions"><main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between gap-4"><div><Link href="/admin/sessions" className="text-sm text-blue-600 hover:text-blue-800">← Sessions</Link><h1 className="mt-2 text-2xl font-bold text-gray-900">{session.name}</h1><p className="text-sm text-gray-600">{displayDate(session.startDate)} - {displayDate(session.endDate)}</p></div><button onClick={deleteSession} disabled={busy} className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Delete Session</button></div>
    <div className="mt-6 space-y-6"><section className="rounded-lg bg-white p-6 shadow"><h2 className="text-lg font-semibold text-gray-900">Session Details</h2><form onSubmit={save} className="mt-5 space-y-5"><div className="space-y-4"><label className="block text-sm font-medium text-gray-700">Session Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label><label className="block text-sm font-medium text-gray-700">Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label><label className="block text-sm font-medium text-gray-700">Start Date<input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label><label className="block text-sm font-medium text-gray-700">End Date<input required type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label></div><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />Set as active session</label>
      <div className="rounded-md border border-blue-100 bg-blue-50 p-4"><h3 className="text-sm font-semibold text-blue-900">Registration Windows by User Group</h3><p className="mt-1 text-sm text-blue-800">Users can register when any assigned group window is open.</p><div className="mt-4 space-y-3">{groups.map((group) => { const entry = windows.find((window) => window.groupId === group.id) || { groupId: group.id, startDate: '', endDate: '' }; return <div key={group.id} className="grid gap-3 sm:grid-cols-3 sm:items-end"><p className="text-sm font-medium text-gray-900">{group.name}</p><label className="text-xs font-medium text-gray-700">Starts<input type="date" value={entry.startDate} onChange={(event) => updateWindow(group.id, 'startDate', event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-2 text-sm" /></label><label className="text-xs font-medium text-gray-700">Ends<input type="date" value={entry.endDate} onChange={(event) => updateWindow(group.id, 'endDate', event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-2 text-sm" /></label></div> })}</div></div><button disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving...' : 'Save Session'}</button></form>{message && <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}</section><div><SessionFeeConfig sessionId={session.id} sessionName={session.name} inline /></div></div></main></AdminLayout>
}
