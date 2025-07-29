'use client'

import { useState } from 'react'
import { useToast } from './ToastContainer'

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
  const [showSharingCode, setShowSharingCode] = useState(false)
  const { showSuccess } = useToast()

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showSuccess('Sharing code copied to clipboard!')
    })
  }



  return (
    <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-gray-900">Family Information</h2>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-500">Address</label>
            <p className="text-gray-900">{family.address}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Phone</label>
            <p className="text-gray-900">{family.phone}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Email</label>
            <p className="text-gray-900">{family.email}</p>
          </div>

        </div>



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
                  {family.sharingCode}
                </span>
                <button
                  onClick={() => copyToClipboard(family.sharingCode)}
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