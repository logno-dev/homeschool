'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import type { SessionFeeConfig } from '@/lib/schema'
import { useToast } from './ToastContainer'
import Button from './Button'

interface SessionFeeConfigProps {
  sessionId: string
  sessionName: string
}

export default function SessionFeeConfig({ sessionId, sessionName }: SessionFeeConfigProps) {
  const [feeConfig, setFeeConfig] = useState<SessionFeeConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const { showSuccess, showError } = useToast()

  const [formData, setFormData] = useState({
    firstChildFee: 0,
    additionalChildFee: 0,
    dueDate: ''
  })

  useEffect(() => {
    fetchFeeConfig()
  }, [sessionId])

  const fetchFeeConfig = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/admin/sessions/${sessionId}/fees`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch fee configuration')
      }

      const data = await response.json()
      if (data.success && data.feeConfig) {
        setFeeConfig(data.feeConfig)
        setFormData({
          firstChildFee: data.feeConfig.firstChildFee,
          additionalChildFee: data.feeConfig.additionalChildFee,
          dueDate: data.feeConfig.dueDate.split('T')[0] // Convert to date input format
        })
      } else {
        setFeeConfig(null)
        // Set default due date to session start date if available
        setFormData({
          firstChildFee: 0,
          additionalChildFee: 0,
          dueDate: ''
        })
      }
    } catch (error) {
      console.error('Error fetching fee config:', error)
      showError('Failed to load fee configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)

      const response = await fetch(`/api/admin/sessions/${sessionId}/fees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstChildFee: parseFloat(formData.firstChildFee.toString()),
          additionalChildFee: parseFloat(formData.additionalChildFee.toString()),
          dueDate: formData.dueDate
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save fee configuration')
      }

      const data = await response.json()
      showSuccess(data.message)
      setIsEditing(false)
      await fetchFeeConfig() // Refresh the data
    } catch (error) {
      console.error('Error saving fee config:', error)
      showError(error instanceof Error ? error.message : 'Failed to save fee configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (feeConfig) {
      setFormData({
        firstChildFee: feeConfig.firstChildFee,
        additionalChildFee: feeConfig.additionalChildFee,
        dueDate: feeConfig.dueDate.split('T')[0]
      })
    }
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Fee Configuration - {sessionName}</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Fee Configuration - {sessionName}</h3>
        {!isEditing && (
          <Button
            onClick={() => setIsEditing(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {feeConfig ? 'Edit Fees' : 'Configure Fees'}
          </Button>
        )}
      </div>

      {!isEditing && feeConfig ? (
        <div className="space-y-3">
          <div>
            <span className="font-medium">First Child Fee:</span> ${feeConfig.firstChildFee.toFixed(2)}
          </div>
          <div>
            <span className="font-medium">Additional Child Fee:</span> ${feeConfig.additionalChildFee.toFixed(2)}
          </div>
          <div>
            <span className="font-medium">Due Date:</span> {format(parseISO(feeConfig.dueDate), 'MMM d, yyyy')}
          </div>
          <div className="text-sm text-gray-600 mt-4">
            <p>Last updated: {format(parseISO(feeConfig.updatedAt), 'MMM d, yyyy h:mm a')}</p>
          </div>
        </div>
      ) : !isEditing && !feeConfig ? (
        <div className="text-gray-500">
          No fee configuration set for this session. Click "Configure Fees" to set up fees.
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="firstChildFee" className="block text-sm font-medium text-gray-700 mb-1">
              First Child Fee ($)
            </label>
            <input
              type="number"
              id="firstChildFee"
              min="0"
              step="0.01"
              value={formData.firstChildFee}
              onChange={(e) => setFormData({ ...formData, firstChildFee: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="additionalChildFee" className="block text-sm font-medium text-gray-700 mb-1">
              Additional Child Fee ($)
            </label>
            <input
              type="number"
              id="additionalChildFee"
              min="0"
              step="0.01"
              value={formData.additionalChildFee}
              onChange={(e) => setFormData({ ...formData, additionalChildFee: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              id="dueDate"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.dueDate}
              className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
            <Button
              onClick={handleCancel}
              disabled={isSaving}
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              Cancel
            </Button>
          </div>

          <div className="text-sm text-gray-600 mt-4 p-3 bg-blue-50 rounded">
            <p><strong>Fee Structure:</strong></p>
            <p>• First child in family: ${formData.firstChildFee.toFixed(2)}</p>
            <p>• Each additional child: ${formData.additionalChildFee.toFixed(2)}</p>
            <p>• Plus any individual class fees</p>
          </div>
        </div>
      )}
    </div>
  )
}