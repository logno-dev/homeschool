'use client'

import { useState } from 'react'
import { useToast } from './ToastContainer'
import { formatPhoneNumber, isValidPhoneNumber, PHONE_PATTERN } from '@/lib/phone'

interface Family {
  id: string
  name: string
  address: string
  phone: string
  email: string
  sharingCode: string
  createdAt: string
  updatedAt: string
}

interface FamilyActionsProps {
  family: Family
}

export default function FamilyActions({ family }: FamilyActionsProps) {
  const [familyData, setFamilyData] = useState(family)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: family.name,
    address: family.address,
    phone: family.phone,
    email: family.email
  })
  const [showSharingCode, setShowSharingCode] = useState(false)
  const { showSuccess, showError } = useToast()

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showSuccess('Sharing code copied to clipboard!')
    })
  }

  const startEditing = () => {
    setFormData({
      name: familyData.name,
      address: familyData.address,
       phone: formatPhoneNumber(familyData.phone),
      email: familyData.email
    })
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setFormData({
      name: familyData.name,
      address: familyData.address,
       phone: formatPhoneNumber(familyData.phone),
      email: familyData.email
    })
    setIsEditing(false)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isValidPhoneNumber(formData.phone)) {
      showError('Invalid phone number', 'Use the format (555) 123-4567.')
      return
    }
    try {
      setIsSaving(true)
      const response = await fetch('/api/family/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim()
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update family information')
      }

      const data = await response.json()
      setFamilyData(data.family)
      setIsEditing(false)
      showSuccess('Family information updated')
    } catch (error) {
      showError('Update failed', error instanceof Error ? error.message : 'Unable to update family information')
    } finally {
      setIsSaving(false)
    }
  }



  return (
    <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Family Information</h2>
            {isEditing ? (
              <button
                type="button"
                onClick={cancelEditing}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
                disabled={isSaving}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
            )}
          </div>
        </div>
        
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Family Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData(prev => ({ ...prev, name: event.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(event) => setFormData(prev => ({ ...prev, address: event.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Phone</label>
              <input
                 type="tel"
                 inputMode="tel"
                 pattern={PHONE_PATTERN}
                 maxLength={14}
                 value={formData.phone}
                 onChange={(event) => setFormData(prev => ({ ...prev, phone: formatPhoneNumber(event.target.value) }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(event) => setFormData(prev => ({ ...prev, email: event.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Family Name</label>
              <p className="text-gray-900">{familyData.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Address</label>
              <p className="text-gray-900">{familyData.address}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Phone</label>
              <p className="text-gray-900">{familyData.phone}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <p className="text-gray-900">{familyData.email}</p>
            </div>
          </div>
        )}



        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowSharingCode(!showSharingCode)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {showSharingCode ? 'Hide' : 'Show'} Sharing Code
          </button>
          {showSharingCode && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-lg font-mono font-bold text-gray-900">
                  {familyData.sharingCode}
                </span>
                <button
                  onClick={() => copyToClipboard(familyData.sharingCode)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Share this code with other guardians to let them join your family profile.
              </p>
            </div>
          )}
        </div>
      </div>
  )
}
