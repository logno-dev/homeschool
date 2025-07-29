'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import type { Session } from '@/lib/schema'
import { useToast } from './ToastContainer'
import Modal from './Modal'
import ConfirmModal from './ConfirmModal'

interface SessionManagementProps {
  initialSessions: Session[]
}

export default function SessionManagement({ initialSessions }: SessionManagementProps) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null)
  
  const router = useRouter()
  const { showError } = useToast()
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    registrationStartDate: '',
    registrationEndDate: '',
    teacherRegistrationStartDate: '',
    description: '',
    isActive: false
  })

  const resetForm = () => {
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      registrationStartDate: '',
      registrationEndDate: '',
      teacherRegistrationStartDate: '',
      description: '',
      isActive: false
    })
    setEditingSession(null)
    setShowForm(false)
  }

  const handleEdit = (session: Session) => {
    // Convert dates to local timezone for form inputs
    const formatDateForInput = (dateString: string) => {
      const date = parseISO(dateString)
      return format(date, 'yyyy-MM-dd')
    }

    setFormData({
      name: session.name,
      startDate: formatDateForInput(session.startDate),
      endDate: formatDateForInput(session.endDate),
      registrationStartDate: formatDateForInput(session.registrationStartDate),
      registrationEndDate: formatDateForInput(session.registrationEndDate),
      teacherRegistrationStartDate: session.teacherRegistrationStartDate ? formatDateForInput(session.teacherRegistrationStartDate) : '',
      description: session.description || '',
      isActive: session.isActive
    })
    setEditingSession(session)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Convert date strings to proper ISO format to avoid timezone issues
      const formatDateForSubmission = (dateString: string) => {
        if (!dateString) return ''
        // Create date in local timezone and convert to ISO string
        const date = new Date(dateString + 'T00:00:00')
        return date.toISOString().split('T')[0]
      }

      const submissionData = {
        ...formData,
        startDate: formatDateForSubmission(formData.startDate),
        endDate: formatDateForSubmission(formData.endDate),
        registrationStartDate: formatDateForSubmission(formData.registrationStartDate),
        registrationEndDate: formatDateForSubmission(formData.registrationEndDate),
        teacherRegistrationStartDate: formData.teacherRegistrationStartDate 
          ? formatDateForSubmission(formData.teacherRegistrationStartDate) 
          : ''
      }

      const url = editingSession 
        ? `/api/admin/sessions/${editingSession.id}`
        : '/api/admin/sessions'
      
      const method = editingSession ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      })

      if (!response.ok) {
        throw new Error('Failed to save session')
      }

      const data = await response.json()
      
      if (editingSession) {
        setSessions(sessions.map(s => s.id === editingSession.id ? data.session : s))
      } else {
        setSessions([...sessions, data.session])
      }

      resetForm()
    } catch (error) {
      console.error('Error saving session:', error)
      showError('Failed to save session')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteClick = (session: Session) => {
    setSessionToDelete(session)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/sessions/${sessionToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete session')
      }

      setSessions(sessions.filter(s => s.id !== sessionToDelete.id))
      setShowDeleteConfirm(false)
      setSessionToDelete(null)
    } catch (error) {
      console.error('Error deleting session:', error)
      showError('Failed to delete session')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
    setSessionToDelete(null)
  }

  const handleSetActive = async (sessionId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: true }),
      })

      if (!response.ok) {
        throw new Error('Failed to set active session')
      }

      await response.json()
      setSessions(sessions.map(s => ({ ...s, isActive: s.id === sessionId })))
    } catch (error) {
      console.error('Error setting active session:', error)
      showError('Failed to set active session')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'MMM d, yyyy')
  }



  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Session Management</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Add New Session
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingSession ? 'Edit Session' : 'Create New Session'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Session Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Fall 2024"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Session Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Session End Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Registration Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.registrationStartDate}
                  onChange={(e) => setFormData({ ...formData, registrationStartDate: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Registration End Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.registrationEndDate}
                  onChange={(e) => setFormData({ ...formData, registrationEndDate: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Teacher Early Registration Start Date
              </label>
              <input
                type="date"
                value={formData.teacherRegistrationStartDate}
                onChange={(e) => setFormData({ ...formData, teacherRegistrationStartDate: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Optional: Allows teachers to register before regular registration opens
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Set as active session
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : editingSession ? 'Update Session' : 'Create Session'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {sessions.length === 0 ? (
            <li className="px-6 py-4 text-center text-gray-500">
              No sessions found. Create your first session to get started.
            </li>
          ) : (
            sessions.map((session) => (
              <li key={session.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-medium text-gray-900">
                        {session.name}
                        {session.isActive && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        )}
                      </h3>
                    </div>
                    {session.description && (
                      <p className="mt-1 text-sm text-gray-600">{session.description}</p>
                    )}
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Session:</span><br />
                        {formatDate(session.startDate)} - {formatDate(session.endDate)}
                      </div>
                      <div>
                        <span className="font-medium">Registration:</span><br />
                        {formatDate(session.registrationStartDate)} - {formatDate(session.registrationEndDate)}
                      </div>
                      {session.teacherRegistrationStartDate && (
                        <div>
                          <span className="font-medium">Teacher Early:</span><br />
                          {formatDate(session.teacherRegistrationStartDate)}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Created:</span><br />
                        {formatDate(session.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => router.push(`/admin/schedule/${session.id}`)}
                      disabled={isLoading}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50"
                    >
                      Schedule
                    </button>
                    <button
                      onClick={() => router.push(`/admin/sessions/${session.id}/fees`)}
                      disabled={isLoading}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50"
                    >
                      Fee Config
                    </button>
                    {!session.isActive && (
                      <button
                        onClick={() => handleSetActive(session.id)}
                        disabled={isLoading}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50"
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(session)}
                      disabled={isLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(session)}
                      disabled={isLoading}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Session"
        message={
          sessionToDelete 
            ? `Are you sure you want to delete "${sessionToDelete.name}"? This action cannot be undone and will remove all associated data including schedules, registrations, and volunteer assignments.`
            : ''
        }
        confirmText="Delete Session"
        confirmVariant="danger"
        isLoading={isLoading}
      />
    </div>
  )
}