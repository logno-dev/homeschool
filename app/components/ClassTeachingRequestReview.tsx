'use client'

import { useState } from 'react'
import type { ClassTeachingRequest, Session } from '@/lib/schema'

interface ClassTeachingRequestReviewProps {
  initialRequests: (ClassTeachingRequest & { session: Session })[]
}

export default function ClassTeachingRequestReview({ initialRequests }: ClassTeachingRequestReviewProps) {
  const [requests, setRequests] = useState<(ClassTeachingRequest & { session: Session })[]>(initialRequests)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ClassTeachingRequest | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState<Partial<ClassTeachingRequest>>({})
  const [reviewNotes, setReviewNotes] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [sessionFilter, setSessionFilter] = useState<string>('all')

  const filteredRequests = requests.filter(request => {
    const statusMatch = filter === 'all' || request.status === filter
    const sessionMatch = sessionFilter === 'all' || request.sessionId === sessionFilter
    return statusMatch && sessionMatch
  })

  // Get unique sessions for filter dropdown
  const availableSessions = Array.from(
    new Set(requests.map(r => r.session?.id).filter(Boolean))
  ).map(sessionId => requests.find(r => r.session?.id === sessionId)?.session).filter((session): session is Session => Boolean(session))

  const handleReview = async (requestId: string, action: 'approve' | 'reject') => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/class-teaching-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          reviewNotes: reviewNotes.trim() || undefined
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update request')
      }

      const data = await response.json()
      setRequests(requests.map(r => r.id === requestId ? data.request : r))
      setSelectedRequest(null)
      setReviewNotes('')
    } catch (error) {
      console.error('Error updating request:', error)
      alert('Failed to update request')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveChanges = async () => {
    if (!selectedRequest) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/class-teaching-requests/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
      })

      if (!response.ok) {
        throw new Error('Failed to update request')
      }

      const data = await response.json()
      setRequests(requests.map(r => r.id === selectedRequest.id ? data.request : r))
      setSelectedRequest(data.request) // Update the selected request with new data
      setIsEditMode(false)
    } catch (error) {
      console.error('Error updating request:', error)
      alert('Failed to update request')
    } finally {
      setIsLoading(false)
    }
  }

  const gradeOptions = [
    'K',
    '1st',
    '2nd', 
    '3rd',
    '4th',
    '5th',
    '6th',
    '7th',
    '8th',
    'K-2',
    '3-5',
    '6-8',
    'All Ages'
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Rejected
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending Review
          </span>
        )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getStatusCounts = () => {
    return {
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      total: requests.length
    }
  }

  const counts = getStatusCounts()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Class Teaching Request Review</h2>
        <div className="flex items-center space-x-4">
          <select
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Sessions</option>
            {availableSessions.map(session => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </select>
          <div className="text-sm text-gray-600">
            {counts.pending} pending • {counts.approved} approved • {counts.rejected} rejected • {counts.total} total
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'pending', label: 'Pending', count: counts.pending },
            { key: 'approved', label: 'Approved', count: counts.approved },
            { key: 'rejected', label: 'Rejected', count: counts.rejected },
            { key: 'all', label: 'All', count: counts.total }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </nav>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            No {filter === 'all' ? '' : filter} requests found.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredRequests.map((request) => (
              <li key={request.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">
                        {request.className}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(request.status)}
                        {request.status === 'pending' && (
                          <button
                            onClick={() => {
                              setSelectedRequest(request)
                              setIsEditMode(false)
                              setEditFormData({
                                className: request.className,
                                description: request.description,
                                gradeRange: request.gradeRange,
                                maxStudents: request.maxStudents,
                                helpersNeeded: request.helpersNeeded,
                                coTeacher: request.coTeacher,
                                classroomNeeds: request.classroomNeeds,
                                requiresFee: request.requiresFee,
                                feeAmount: request.feeAmount,
                                schedulingRequirements: request.schedulingRequirements
                              })
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium"
                          >
                            Review
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Session:</span> {request.session?.name || 'Unknown'}
                      </div>
                      <div>
                        <span className="font-medium">Grade Range:</span> {request.gradeRange}
                      </div>
                      {request.coTeacher && (
                        <div>
                          <span className="font-medium">Co-Teacher:</span> {request.coTeacher}
                        </div>
                      )}
                      {request.requiresFee && (
                        <div>
                          <span className="font-medium">Supply Fee:</span> ${request.feeAmount}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Submitted:</span> {formatDate(request.createdAt)}
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Description:</span> {request.description}
                      </p>
                    </div>

                    {request.classroomNeeds && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Classroom Needs:</span> {request.classroomNeeds}
                      </div>
                    )}

                    {request.schedulingRequirements && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Scheduling Requirements:</span> {request.schedulingRequirements}
                      </div>
                    )}

                    {request.reviewNotes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <span className="font-medium text-sm text-gray-700">Review Notes:</span>
                        <p className="mt-1 text-sm text-gray-600">{request.reviewNotes}</p>
                        {request.reviewedAt && (
                          <p className="mt-1 text-xs text-gray-500">
                            Reviewed on {formatDate(request.reviewedAt)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {isEditMode ? '✏️ Editing: ' : 'Review: '}{isEditMode ? editFormData.className : selectedRequest.className}
                </h3>
                <button
                  onClick={() => {
                    if (!isEditMode) {
                      // Initialize form data when entering edit mode
                      setEditFormData({
                        className: selectedRequest.className,
                        description: selectedRequest.description,
                        gradeRange: selectedRequest.gradeRange,
                        maxStudents: selectedRequest.maxStudents,
                        helpersNeeded: selectedRequest.helpersNeeded,
                        coTeacher: selectedRequest.coTeacher,
                        classroomNeeds: selectedRequest.classroomNeeds,
                        requiresFee: selectedRequest.requiresFee,
                        feeAmount: selectedRequest.feeAmount,
                        schedulingRequirements: selectedRequest.schedulingRequirements
                      })
                    }
                    setIsEditMode(!isEditMode)
                  }}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 border border-blue-700"
                >
                  {isEditMode ? 'Cancel Edit' : 'Edit Details'}
                </button>
              </div>
              
              {isEditMode ? (
                <div className="space-y-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Class Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={editFormData.className || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, className: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Grade Range *
                      </label>
                      <select
                        required
                        value={gradeOptions.includes(editFormData.gradeRange || '') ? editFormData.gradeRange : 'custom'}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            // Keep current value if it's custom
                          } else {
                            setEditFormData({ ...editFormData, gradeRange: e.target.value })
                          }
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select grade range</option>
                        {gradeOptions.map(grade => (
                          <option key={grade} value={grade}>{grade}</option>
                        ))}
                        <option value="custom">Custom Grade Range</option>
                      </select>
                      {!gradeOptions.includes(editFormData.gradeRange || '') && (
                        <input
                          type="text"
                          value={editFormData.gradeRange || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, gradeRange: e.target.value })}
                          placeholder="Enter custom grade range"
                          className="mt-2 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Students *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="100"
                        value={editFormData.maxStudents || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, maxStudents: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Parent Helpers Needed *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="10"
                        value={editFormData.helpersNeeded || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, helpersNeeded: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Class Description *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={editFormData.description || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Co-Teacher (Optional)
                    </label>
                    <input
                      type="text"
                      value={editFormData.coTeacher || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, coTeacher: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Classroom Needs (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={editFormData.classroomNeeds || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, classroomNeeds: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editFormData.requiresFee || false}
                        onChange={(e) => setEditFormData({ ...editFormData, requiresFee: e.target.checked, feeAmount: e.target.checked ? editFormData.feeAmount : null })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Requires supply fee</span>
                    </label>
                    {editFormData.requiresFee && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editFormData.feeAmount || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, feeAmount: parseFloat(e.target.value) })}
                          className="w-24 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scheduling Requirements (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={editFormData.schedulingRequirements || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, schedulingRequirements: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      onClick={() => setIsEditMode(false)}
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
                    >
                      Cancel Changes
                    </button>
                    <button
                      onClick={handleSaveChanges}
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    >
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Grade Range:</span>
                      <p className="text-gray-600">{selectedRequest.gradeRange}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Max Students:</span>
                      <p className="text-gray-600">{selectedRequest.maxStudents}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Helpers Needed:</span>
                      <p className="text-gray-600">{selectedRequest.helpersNeeded}</p>
                    </div>
                    {selectedRequest.coTeacher && (
                      <div>
                        <span className="font-medium text-gray-700">Co-Teacher:</span>
                        <p className="text-gray-600">{selectedRequest.coTeacher}</p>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <span className="font-medium text-gray-700">Description:</span>
                    <p className="mt-1 text-gray-600">{selectedRequest.description}</p>
                  </div>
                  
                  {selectedRequest.classroomNeeds && (
                    <div>
                      <span className="font-medium text-gray-700">Classroom Needs:</span>
                      <p className="mt-1 text-gray-600">{selectedRequest.classroomNeeds}</p>
                    </div>
                  )}
                  
                  {selectedRequest.requiresFee && (
                    <div>
                      <span className="font-medium text-gray-700">Supply Fee:</span>
                      <p className="mt-1 text-gray-600">${selectedRequest.feeAmount}</p>
                    </div>
                  )}
                  
                  {selectedRequest.schedulingRequirements && (
                    <div>
                      <span className="font-medium text-gray-700">Scheduling Requirements:</span>
                      <p className="mt-1 text-gray-600">{selectedRequest.schedulingRequirements}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes (Optional)
                </label>
                <textarea
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add any notes about your decision..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setSelectedRequest(null)
                    setReviewNotes('')
                    setIsEditMode(false)
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReview(selectedRequest.id, 'reject')}
                  disabled={isLoading || isEditMode}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Reject'}
                </button>
                <button
                  onClick={() => handleReview(selectedRequest.id, 'approve')}
                  disabled={isLoading || isEditMode}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}