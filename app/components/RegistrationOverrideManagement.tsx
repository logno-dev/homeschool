'use client'

import { useState, useEffect } from 'react'
import Button from './Button'
import Modal from './Modal'
import Toast from './Toast'

interface OverrideRequest {
  id: string
  sessionId: string
  familyId: string
  familyName: string
  status: string
  volunteerRequirementsMet: boolean
  adminOverride: boolean
  adminOverrideReason: string
  overriddenBy: string | null
  overriddenAt: string | null
  createdAt: string
  updatedAt: string
}

interface RegistrationOverrideManagementProps {
  sessionId: string
}

export default function RegistrationOverrideManagement({ sessionId }: RegistrationOverrideManagementProps) {
  const [overrideRequests, setOverrideRequests] = useState<OverrideRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<OverrideRequest | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [action, setAction] = useState<'approve' | 'deny' | null>(null)
  const [reason, setReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ id: string; title: string; message?: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetchOverrideRequests()
  }, [sessionId])

  const fetchOverrideRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/registration-overrides?sessionId=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setOverrideRequests(data.overrideRequests)
      } else {
        throw new Error('Failed to fetch override requests')
      }
    } catch (error) {
      console.error('Error fetching override requests:', error)
      setToast({ id: 'error-1', title: 'Error', message: 'Failed to load override requests', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleAction = (request: OverrideRequest, actionType: 'approve' | 'deny') => {
    setSelectedRequest(request)
    setAction(actionType)
    setReason('')
    setShowModal(true)
  }

  const processAction = async () => {
    if (!selectedRequest || !action) return

    try {
      setProcessing(true)
      const response = await fetch(`/api/admin/registration-overrides/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          reason: reason.trim() || undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        setToast({ id: 'success-1', title: 'Success', message: data.message, type: 'success' })
        setShowModal(false)
        setSelectedRequest(null)
        setAction(null)
        setReason('')
        // Refresh the list
        fetchOverrideRequests()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process request')
      }
    } catch (error) {
      console.error('Error processing action:', error)
      setToast({ 
        id: 'error-2',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to process request', 
        type: 'error' 
      })
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Registration Override Requests</h2>
        <Button
          onClick={fetchOverrideRequests}
          variant="outline"
          size="sm"
        >
          Refresh
        </Button>
      </div>

      {overrideRequests.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No pending override requests</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {overrideRequests.map((request) => (
              <li key={request.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">
                        {request.familyName}
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending Review
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <p><strong>Reason:</strong> {request.adminOverrideReason}</p>
                      <p><strong>Requested:</strong> {formatDate(request.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <Button
                      onClick={() => handleAction(request, 'approve')}
                      variant="primary"
                      size="sm"
                    >
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleAction(request, 'deny')}
                      variant="danger"
                      size="sm"
                    >
                      Deny
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setSelectedRequest(null)
          setAction(null)
          setReason('')
        }}
        title={`${action === 'approve' ? 'Approve' : 'Deny'} Override Request`}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">
              Family: <strong>{selectedRequest?.familyName}</strong>
            </p>
            <p className="text-sm text-gray-600">
              Reason: <strong>{selectedRequest?.adminOverrideReason}</strong>
            </p>
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
              {action === 'approve' ? 'Approval' : 'Denial'} Reason (Optional)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder={`Enter reason for ${action === 'approve' ? 'approval' : 'denial'}...`}
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              onClick={() => {
                setShowModal(false)
                setSelectedRequest(null)
                setAction(null)
                setReason('')
              }}
              variant="outline"
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={processAction}
              variant={action === 'approve' ? 'primary' : 'danger'}
              disabled={processing}
            >
              {processing ? 'Processing...' : `${action === 'approve' ? 'Approve' : 'Deny'} Request`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          id={toast.id}
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}