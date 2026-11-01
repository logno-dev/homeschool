'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-client'
import AdminLayout from '@/app/components/AdminLayout'
import IndividualEmailComposer from '@/app/admin/newsletters/IndividualEmailComposer'

interface Group { id: string; name: string; slug: string; isSystem: boolean }
interface UserDetails { id: string; email: string; firstName: string; lastName: string; role: string; status: string }
interface UserDocument { id: string; filename: string; documentType: string; blobUrl: string; size: number; createdAt: string }
interface FamilyGuardian { id: string; firstName: string; lastName: string; email: string; phone: string | null; role: string; isMainContact: boolean }
interface FamilyChild { id: string; firstName: string; lastName: string; dateOfBirth: string; grade: string; gradeLevel: string | null; gradeYear: number | null; allergies: string | null; medicalNotes: string | null }
interface FamilyDetails { id: string; name: string; address: string; phone: string; email: string; sharingCode: string; annualFeePaid: boolean; feePaymentDate: string | null; guardians: FamilyGuardian[]; children: FamilyChild[] }

export default function AdminUserDetailsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams<{ userId: string }>()
  const [details, setDetails] = useState<{ user: UserDetails; groups: Group[]; memberships: string[]; documents: UserDocument[]; family: FamilyDetails | null } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [senderAliases, setSenderAliases] = useState<string[]>([])

  const load = async () => {
    const response = await fetch(`/api/admin/users/${params.userId}`)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load user')
    setDetails(payload)
    const configResponse = await fetch('/api/admin/messaging/config')
    if (configResponse.ok) setSenderAliases((await configResponse.json()).aliases || [])
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

  const reactivate = async () => {
    if (!confirm('Reactivate this user? They will be able to sign in immediately.')) return
    setBusy(true)
    const response = await fetch(`/api/admin/users/${params.userId}/reactivate`, { method: 'POST' })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) { setMessage(payload.error || 'Unable to reactivate user'); return }
    setMessage('User reactivated')
    await load()
  }

  const emulate = async () => {
    const response = await fetch(`/api/admin/users/${params.userId}`, { method: 'POST' })
    const payload = await response.json()
    if (!response.ok) { setMessage(payload.error || 'Unable to emulate user'); return }
    window.open(payload.url, '_blank', 'noopener,noreferrer')
  }

  const resetPassword = async () => {
    if (!confirm('Reset this user password and invalidate their active sessions?')) return
    setBusy(true)
    const response = await fetch(`/api/admin/users/${params.userId}/reset-password`, { method: 'POST' })
    const payload = await response.json() as { temporaryPassword?: string; error?: string }
    setBusy(false)
    if (!response.ok) { setMessage(payload.error || 'Unable to reset password'); return }
    setTemporaryPassword(payload.temporaryPassword || '')
    setMessage('Temporary password generated. Give it to the user securely.')
  }

  const copyTemporaryPassword = async () => {
    await navigator.clipboard.writeText(temporaryPassword)
    setMessage('Temporary password copied')
  }

  if (loading || !user || !details) return <div className="min-h-screen bg-gray-50" />
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  const formatDateOnly = (value: string | null) => {
    if (!value) return 'Not provided'
    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
  }

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
            <h2 className="text-lg font-semibold text-gray-900">Family Details</h2>
            {details.family ? <div className="mt-4 space-y-5">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div><h3 className="font-semibold text-blue-950">{details.family.name}</h3><p className="mt-1 text-sm text-blue-900">{details.family.address || 'No address provided'}</p></div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${details.family.annualFeePaid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{details.family.annualFeePaid ? 'Annual fee paid' : 'Annual fee not recorded'}</span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><dt className="font-medium text-blue-950">Family email</dt><dd><a href={`mailto:${details.family.email}`} className="text-blue-700 hover:underline">{details.family.email}</a></dd></div>
                  <div><dt className="font-medium text-blue-950">Family phone</dt><dd><a href={`tel:${details.family.phone.replace(/\D/g, '')}`} className="text-blue-700 hover:underline">{details.family.phone}</a></dd></div>
                  <div><dt className="font-medium text-blue-950">Sharing code</dt><dd className="font-mono text-blue-900">{details.family.sharingCode}</dd></div>
                  {details.family.feePaymentDate && <div><dt className="font-medium text-blue-950">Annual fee date</dt><dd className="text-blue-900">{formatDateOnly(details.family.feePaymentDate)}</dd></div>}
                </dl>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Guardians ({details.family.guardians.length})</h3>
                {details.family.guardians.length ? <div className="mt-2 grid gap-3 sm:grid-cols-2">{details.family.guardians.map((guardian) => <article key={guardian.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3"><p className="font-medium text-gray-900">{guardian.firstName} {guardian.lastName}</p>{guardian.isMainContact && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Main contact</span>}</div>
                  <a href={`mailto:${guardian.email}`} className="mt-2 block text-sm text-blue-700 hover:underline">{guardian.email}</a>
                  <p className="mt-1 text-sm text-gray-600">{guardian.phone ? <a href={`tel:${guardian.phone.replace(/\D/g, '')}`} className="text-blue-700 hover:underline">{guardian.phone}</a> : 'No phone provided'}</p>
                </article>)}</div> : <p className="mt-2 text-sm text-gray-500">No guardians are linked to this family.</p>}
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Children ({details.family.children.length})</h3>
                {details.family.children.length ? <div className="mt-2 grid gap-4 sm:grid-cols-2">{details.family.children.map((child) => <article key={child.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <h4 className="font-semibold text-gray-900">{child.firstName} {child.lastName}</h4>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4"><dt className="font-medium text-gray-600">Grade</dt><dd className="text-gray-900">{child.grade || child.gradeLevel || 'Not provided'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-gray-600">Date of birth</dt><dd className="text-gray-900">{formatDateOnly(child.dateOfBirth)}</dd></div>
                  </dl>
                  <div className={`mt-4 rounded-md p-3 text-sm ${child.allergies?.trim() ? 'bg-red-50 text-red-900' : 'bg-gray-50 text-gray-600'}`}><span className="font-semibold">Allergies / allergens:</span> {child.allergies?.trim() || 'None reported'}</div>
                  <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm text-gray-700"><span className="font-semibold">Medical notes:</span> {child.medicalNotes?.trim() || 'None reported'}</div>
                </article>)}</div> : <p className="mt-2 text-sm text-gray-500">No children are linked to this family.</p>}
              </div>
            </div> : <p className="mt-3 rounded-md bg-gray-50 p-4 text-sm text-gray-500">This user is not linked to a family.</p>}
          </section>

          <section className="mt-8 border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900">Account Management</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">Role<select value={details.user.role === 'staff' ? 'moderator' : details.user.role} onChange={(event) => updateRole(event.target.value)} disabled={busy || details.user.id === user.id} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select></label>
              {details.user.id !== user.id && details.user.status === 'active' && <button onClick={deactivate} disabled={busy} className="self-end rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Deactivate User</button>}
              {details.user.status === 'inactive' && <button onClick={reactivate} disabled={busy} className="self-end rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50">Reactivate User</button>}
            </div>
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-900">Password reset</h3>
              <p className="mt-1 text-sm text-amber-800">Generate a temporary password. The user will be required to choose a new password at sign-in.</p>
              <button onClick={resetPassword} disabled={busy} className="mt-3 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">Reset password</button>
              {temporaryPassword && <div className="mt-3 flex flex-wrap items-center gap-2"><code className="rounded bg-white px-3 py-2 text-sm text-gray-900">{temporaryPassword}</code><button onClick={copyTemporaryPassword} className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">Copy</button></div>}
            </div>
          </section>
          <IndividualEmailComposer users={[details.user]} aliases={senderAliases} initialUserId={details.user.id} />

          <section className="mt-8 border-t pt-6"><h2 className="text-lg font-semibold text-gray-900">Documents</h2><p className="mt-1 text-sm text-gray-600">Invoices and billing statements generated for this user.</p>{details.documents.length ? <div className="mt-4 divide-y rounded-md border">{details.documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-4 px-4 py-3"><div><a href={document.blobUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:text-blue-800">{document.filename}</a><p className="text-xs text-gray-500">{document.documentType.replace('_', ' ')} · {new Date(document.createdAt).toLocaleString()}</p></div><span className="text-xs text-gray-500">{Math.ceil(document.size / 1024)} KB</span></div>)}</div> : <p className="mt-4 text-sm text-gray-500">No generated documents.</p>}</section>

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
