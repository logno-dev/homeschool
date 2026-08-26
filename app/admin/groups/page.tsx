'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'

interface Member { id: string; email: string; firstName: string; lastName: string }
interface Group { id: string; name: string; slug: string; isSystem: boolean; members: Member[] }
interface UserOption { id: string; email: string; firstName: string; lastName: string }

export default function AdminGroupsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [memberId, setMemberId] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    const [groupsResponse, usersResponse] = await Promise.all([fetch('/api/admin/groups'), fetch('/api/admin/users?export=true')])
    const groupPayload = await groupsResponse.json()
    const userPayload = await usersResponse.json()
    setGroups((groupPayload.groups || []).sort((a: Group, b: Group) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
      return a.name.localeCompare(b.name)
    }))
    setUsers((userPayload.users || []).map((entry: UserOption) => ({ id: entry.id, email: entry.email, firstName: entry.firstName, lastName: entry.lastName })))
    if (!selectedGroupId && groupPayload.groups?.[0]) setSelectedGroupId(groupPayload.groups[0].id)
  }

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/signin'); return }
    load().catch(() => setMessage('Unable to load user groups'))
  }, [loading, user, router])

  const selectedGroup = groups.find((group) => group.id === selectedGroupId)

  const createGroup = async (event: React.FormEvent) => {
    event.preventDefault()
    const response = await fetch('/api/admin/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newGroupName }) })
    const payload = await response.json()
    if (!response.ok) { setMessage(payload.error || 'Unable to create group'); return }
    setNewGroupName(''); setMessage('Group created'); await load()
  }

  const addMember = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedGroupId || !memberId) return
    const response = await fetch(`/api/admin/groups/${selectedGroupId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: memberId }) })
    const payload = await response.json()
    if (!response.ok) { setMessage(payload.error || 'Unable to add member'); return }
    setMemberId(''); setMessage('Member added'); await load()
  }

  const removeMember = async (userId: string) => {
    if (!selectedGroupId || !confirm('Remove this user from the group?')) return
    await fetch(`/api/admin/groups/${selectedGroupId}/members?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' })
    await load()
  }

  const deleteGroup = async () => {
    if (!selectedGroup || selectedGroup.isSystem || !confirm(`Delete ${selectedGroup.name}?`)) return
    const response = await fetch(`/api/admin/groups/${selectedGroup.id}`, { method: 'DELETE' })
    if (response.ok) { setSelectedGroupId(''); await load() } else setMessage('Unable to delete group')
  }

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Admin'
  if (loading || !user) return <div className="min-h-screen bg-gray-50" />

  return (
    <AdminLayout userName={userName} activeTab="groups">
      <main className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8"><div className="px-4 py-6 sm:px-0">
        <h1 className="text-2xl font-bold text-gray-900">User Groups</h1>
        <p className="mt-1 text-sm text-gray-600">Assign users to multiple groups and use groups to control registration windows.</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
           <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-gray-900">Groups</h2><div className="mt-3 space-y-1">{groups.map((group) => <button key={group.id} onClick={() => setSelectedGroupId(group.id)} className={`block w-full rounded-md px-3 py-2 text-left text-sm ${selectedGroupId === group.id ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-gray-50'}`}>{group.name}{group.isSystem && <span className="ml-2 text-xs text-gray-500">Predefined</span>} <span className="float-right text-xs text-gray-500">{group.members.length}</span></button>)}</div><form onSubmit={createGroup} className="mt-5 border-t pt-4"><input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="New group name" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /><button className="mt-2 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">Create Group</button></form></div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">{selectedGroup ? <><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold text-gray-900">{selectedGroup.name}</h2><p className="text-sm text-gray-500">{selectedGroup.isSystem ? 'Predefined system group' : `Slug: ${selectedGroup.slug}`}</p></div>{!selectedGroup.isSystem && <button onClick={deleteGroup} className="text-sm text-red-600">Delete group</button>}</div><form onSubmit={addMember} className="mt-5 flex gap-2"><select value={memberId} onChange={(event) => setMemberId(event.target.value)} required className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="">Add a user...</option>{users.filter((option) => !selectedGroup.members.some((member) => member.id === option.id)).map((option) => <option key={option.id} value={option.id}>{option.firstName} {option.lastName} ({option.email})</option>)}</select><button className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">Add</button></form><div className="mt-5 divide-y divide-gray-200">{selectedGroup.members.map((member) => <div key={member.id} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium text-gray-900">{member.firstName} {member.lastName}</p><p className="text-xs text-gray-500">{member.email}</p></div><button onClick={() => removeMember(member.id)} className="text-sm text-red-600">Remove</button></div>)}{selectedGroup.members.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No members assigned.</p>}</div></> : <p className="text-sm text-gray-500">Select a group.</p>} {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}</div>
        </div>
      </div></main>
    </AdminLayout>
  )
}
