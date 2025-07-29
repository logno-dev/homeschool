'use client'

import { useState, useEffect } from 'react'
import ClassTeachingForm from './ClassTeachingForm'
import type { ClassTeachingRequest, Session } from '@/lib/schema'

export default function ClassTeachingRequests() {
  const [requests, setRequests] = useState<(ClassTeachingRequest & { session: Session })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [registrationStatus, setRegistrationStatus] = useState<{
    isOpen: boolean
    reason?: string
  }>({ isOpen: false })

  useEffect(() => {
    fetchRequests()
    checkRegistrationStatus()
  }, [])

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/class-teaching-requests')
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests || [])
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkRegistrationStatus = async () => {
    try {
      const response = await fetch('/api/class-teaching-registration/status')
      if (response.ok) {
        const data = await response.json()
        setRegistrationStatus(data)
      }
    } catch (error) {
      console.error('Error checking registration status:', error)
    }
  }

  const handleFormSuccess = () => {
    // Refresh the requests to get the session info
    fetchRequests()
    setShowForm(false)
  }

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

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Class Teaching Requests</h2>
        {registrationStatus.isOpen ? (
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Register to Teach
          </button>
        ) : (
          <div className="text-sm text-gray-600">
            {registrationStatus.reason || 'Class teaching registration is not currently open'}
          </div>
        )}
      </div>

      {showForm && (
        <ClassTeachingForm
          onSuccess={handleFormSuccess}
          onCancel={() => setShowForm(false)}
        />
      )}

      {requests.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            {registrationStatus.isOpen 
              ? "You haven't submitted any class teaching requests yet."
              : "No class teaching requests found."
            }
          </p>
          {registrationStatus.isOpen && (
            <div className="mt-4">
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Submit Your First Request
              </button>
              <p className="mt-2 text-sm text-gray-500">
                Submit your class teaching request before regular registration opens
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {requests.map((request) => (
              <li key={request.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">
                        {request.className}
                      </h3>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Grade Range: {request.gradeRange}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {request.description}
                    </p>
                    
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Session:</span> {request.session?.name || 'Unknown'}
                      </div>
                      <div>
                        <span className="font-medium">Max Students:</span> {request.maxStudents || 'Not specified'}
                      </div>
                      <div>
                        <span className="font-medium">Helpers Needed:</span> {request.helpersNeeded || 0}
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
    </div>
  )
}