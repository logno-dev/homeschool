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
    </div>
  )
}
