'use client'

import { useState } from 'react'

interface Guardian {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  isMainContact: boolean
}

export default function GuardianList({ guardians, currentUserId }: { guardians: Guardian[]; currentUserId: string }) {
  const [members, setMembers] = useState(guardians)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '' })
  const [adding, setAdding] = useState(false)

  const removeGuardian = async (guardian: Guardian) => {
    if (!window.confirm(`Remove ${guardian.firstName} ${guardian.lastName} from this family?`)) return
    setRemovingId(guardian.id)
    const response = await fetch(`/api/family/guardians/${guardian.id}`, { method: 'DELETE' })
    if (response.ok) setMembers((current) => current.filter((member) => member.id !== guardian.id))
    else {
      const payload = await response.json().catch(() => ({}))
      window.alert(payload.error || 'Unable to remove guardian')
    }
    setRemovingId(null)
  }

  const canRemove = members.some((guardian) => guardian.id === currentUserId && guardian.isMainContact)
  const addGuardian = async (event: React.FormEvent) => {
    event.preventDefault()
    setAdding(true)
    const response = await fetch('/api/family/guardians/placeholder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm) })
    if (response.ok) {
      const payload = await response.json()
      setMembers((current) => [...current, payload.guardian])
      setAddForm({ firstName: '', lastName: '', phone: '' })
      setShowAddForm(false)
    } else {
      const payload = await response.json().catch(() => ({}))
      window.alert(payload.error || 'Unable to add guardian')
    }
    setAdding(false)
  }

  return (
    <div className="space-y-3">
      {members.map((guardian) => (
        <div key={guardian.id} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 p-3">
          <div>
            <p className="font-medium text-gray-900">{guardian.firstName} {guardian.lastName}{guardian.isMainContact && <span className="ml-2 inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">Main Contact</span>}</p>
            <p className="text-sm text-gray-500">{guardian.email}</p>
            {guardian.phone && <p className="text-sm text-gray-500">{guardian.phone}</p>}
          </div>
          {canRemove && !guardian.isMainContact && guardian.id !== currentUserId && <button type="button" onClick={() => removeGuardian(guardian)} disabled={removingId === guardian.id} className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50">{removingId === guardian.id ? 'Removing...' : 'Remove'}</button>}
        </div>
      ))}
      {canRemove && (showAddForm ? (
        <form onSubmit={addGuardian} className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">Add guardian without an account</p>
          <div className="grid gap-2 sm:grid-cols-2"><input required value={addForm.firstName} onChange={(event) => setAddForm({ ...addForm, firstName: event.target.value })} placeholder="First name" className="rounded-md border border-gray-300 px-3 py-2 text-sm" /><input required value={addForm.lastName} onChange={(event) => setAddForm({ ...addForm, lastName: event.target.value })} placeholder="Last name" className="rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
          <input type="tel" value={addForm.phone} onChange={(event) => setAddForm({ ...addForm, phone: event.target.value })} placeholder="Phone (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <div className="flex gap-2"><button disabled={adding} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">{adding ? 'Adding...' : 'Add Guardian'}</button><button type="button" onClick={() => setShowAddForm(false)} className="rounded-md border px-3 py-2 text-sm">Cancel</button></div>
        </form>
      ) : <button type="button" onClick={() => setShowAddForm(true)} className="text-sm font-medium text-blue-600 hover:text-blue-800">+ Add guardian without account</button>)}
    </div>
  )
}
