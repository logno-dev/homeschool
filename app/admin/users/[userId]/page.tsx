'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-client'
import AdminLayout from '@/app/components/AdminLayout'

interface Group { id: string; name: string; slug: string; isSystem: boolean }
interface UserDetails { id: string; email: string; firstName: string; lastName: string; role: string; status: string }

export default function AdminUserDetailsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams<{ userId: string }>()
  const [details, setDetails] = useState<{ user: UserDetails; groups: Group[]; memberships: string[] } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const response = await fetch(`/api/admin/users/${params.userId}`)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load user')
    setDetails(payload)
  }

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/signin'); return }
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load user'))
  }, [loading, user, params.userId, router])

  const updateRole = async (role: string) => {
    setBusy(true)
    const response = await fetch(`/api/admin/users/${params.userId}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) { setMessage(payload.error || 'Unable to update role'); return }
    setMessage('Role updated')
    await load()
  }

  const toggleGroup = async (groupId: string, assigned: boolean) => {
    setBusy(true)
    const response = await fetch(`/api/admin/groups/${groupId}/members${assigned ? `?userId=${encodeURIComponent(params.userId)}` : ''}`, {
      method: assigned ? 'DELETE' : 'POST',
      headers: assigned ? undefined : { 'Content-Type': 'application/json' },
      body: assigned ? undefined : JSON.stringify({ userId: params.userId })
    })
    setBusy(false)
    if (!response.ok) { const payload = await response.json(); setMessage(payload.error || 'Unable to update group membership'); return }
    setMessage('Group membership updated')
    await load()
  }

  const deactivate = async () => {
    if (!confirm('Deactivate this user? They will no longer be able to sign in.')) return
    setBusy(true)
    const response = await fetch(`/api/admin/users/${params.userId}`, { method: 'DELETE' })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) { setMessage(payload.error || 'Unable to deactivate user'); return }
    setMessage('User deactivated')
    await load()
  }

  const emulate = async () => {
    const response = await fetch(`/api/admin/users/${params.userId}`, { method: 'POST' })
    const payload = await response.json()
    if (!response.ok) { setMessage(payload.error || 'Unable to emulate user'); return }
    window.open(payload.url, '_blank', 'noopener,noreferrer')
  }

  if (loading || !user || !details) return <div className="min-h-screen bg-gray-50" />
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

  return (
    <AdminLayout userName={userName} activeTab="users">
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <button onClick={() => router.push('/admin/users')} className="text-sm text-blue-600 hover:text-blue-800">← Back to users</button>
        <div className="mt-4 rounded-lg bg-white p-6 shadow">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><h1 className="text-2xl font-bold text-gray-900">{details.user.firstName} {details.user.lastName}</h1><p className="text-gray-600">{details.user.email}</p><p className="mt-1 text-sm text-gray-500">Account: {details.user.status === 'active' ? 'Active' : 'Inactive'}</p></div>
            <button onClick={emulate} disabled={busy || details.user.status !== 'active'} className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">Emulate User</button>
          </div>

          <section className="mt-8 border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900">Account Management</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">Role<select value={details.user.role === 'staff' ? 'moderator' : details.user.role} onChange={(event) => updateRole(event.target.value)} disabled={busy || details.user.id === user.id} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select></label>
              {details.user.id !== user.id && details.user.status === 'active' && <button onClick={deactivate} disabled={busy} className="self-end rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Deactivate User</button>}
            </div>
          </section>

          <section className="mt-8 border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900">User Groups</h2>
            <p className="mt-1 text-sm text-gray-600">Membership controls which registration windows this user can access.</p>
            <div className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200">{details.groups.map((group) => { const assigned = details.memberships.includes(group.id); return <label key={group.id} className="flex items-center justify-between gap-4 px-4 py-3"><span><span className="font-medium text-gray-900">{group.name}</span>{group.isSystem && <span className="ml-2 text-xs text-gray-500">Predefined</span>}</span><input type="checkbox" checked={assigned} disabled={busy} onChange={() => toggleGroup(group.id, assigned)} className="h-4 w-4 rounded border-gray-300 text-blue-600" /></label> })}</div>
          </section>
          {message && <p className="mt-5 rounded-md bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
        </div>
      </main>
    </AdminLayout>
  )
}
