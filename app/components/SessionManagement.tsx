'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { Session } from '@/lib/schema'
import { useToast } from './ToastContainer'
import Modal from './Modal'

interface SessionManagementProps {
  initialSessions: Session[]
  groups: Array<{ id: string; name: string; slug: string }>
}

export default function SessionManagement({ initialSessions, groups }: SessionManagementProps) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [registrationWindows, setRegistrationWindows] = useState<Array<{ groupId: string; startDate: string; endDate: string }>>([])
  
  const router = useRouter()
  const { showError } = useToast()
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    classTeachingRegistrationStartDate: '',
    classTeachingRegistrationEndDate: '',
    description: '',
    isActive: false
  })

  const resetForm = () => {
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      classTeachingRegistrationStartDate: '',
      classTeachingRegistrationEndDate: '',
      description: '',
      isActive: false
    })
    setEditingSession(null)
    setRegistrationWindows([])
    setShowForm(false)
  }

  const handleEdit = async (session: Session) => {
    // Convert dates to local timezone for form inputs
    const formatDateForInput = (dateString: string) => {
      const date = parseISO(dateString)
      return format(date, 'yyyy-MM-dd')
    }

    setFormData({
      name: session.name,
      startDate: formatDateForInput(session.startDate),
      endDate: formatDateForInput(session.endDate),
      classTeachingRegistrationStartDate: session.classTeachingRegistrationStartDate ? formatDateForInput(session.classTeachingRegistrationStartDate) : '',
      classTeachingRegistrationEndDate: session.classTeachingRegistrationEndDate ? formatDateForInput(session.classTeachingRegistrationEndDate) : '',
      description: session.description || '',
      isActive: session.isActive
    })
    setEditingSession(session)
    setShowForm(true)
    try {
      const response = await fetch(`/api/admin/sessions/${session.id}/registration-windows`)
      const payload = await response.json()
      setRegistrationWindows((payload.windows || []).map((window: { groupId: string; startDate: string; endDate: string }) => ({
        groupId: window.groupId,
        startDate: window.startDate,
        endDate: window.endDate
      })))
    } catch {
      setRegistrationWindows([])
    }
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
        classTeachingRegistrationStartDate: formatDateForSubmission(formData.classTeachingRegistrationStartDate),
        classTeachingRegistrationEndDate: formatDateForSubmission(formData.classTeachingRegistrationEndDate),
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
      const savedSession = data.session
      const windowsResponse = await fetch(`/api/admin/sessions/${savedSession.id}/registration-windows`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windows: registrationWindows.filter((window) => window.startDate && window.endDate) })
      })
      if (!windowsResponse.ok) {
        throw new Error('Failed to save registration windows')
      }
      
      if (editingSession) {
        setSessions(sessions.map(s => s.id === editingSession.id ? savedSession : s))
      } else {
        setSessions([...sessions, savedSession])
      }

      resetForm()
    } catch (error) {
      console.error('Error saving session:', error)
      showError('Failed to save session')
    } finally {
      setIsLoading(false)
    }
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

  const sortedSessions = [...sessions].sort(
    (a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime()
  )
  const isPastSession = (session: Session) => {
    const endOfSession = new Date(`${session.endDate}T23:59:59`)
    return endOfSession < new Date()
  }
  const currentSessions = sortedSessions.filter((session) => !isPastSession(session))
  const pastSessions = sortedSessions.filter(isPastSession)

  const renderSession = (session: Session) => (
    <li key={session.id} className="px-4 sm:px-6 py-4">
      {/* Mobile-first layout: stack everything vertically */}
      <div className="space-y-4">
        {/* Session header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
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
        </div>

        {/* Description */}
        {session.description && (
          <p className="text-sm text-gray-600">{session.description}</p>
        )}

        {/* Session info - stacked vertically on mobile, grid on larger screens */}
        <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 text-sm text-gray-600">
          <div className="flex flex-col sm:block">
            <span className="font-medium text-gray-900">Session Dates</span>
            <span className="mt-1">{formatDate(session.startDate)} - {formatDate(session.endDate)}</span>
          </div>
          <div className="flex flex-col sm:block">
            <span className="font-medium text-gray-900">Created</span>
            <span className="mt-1">{formatDate(session.createdAt)}</span>
          </div>
        </div>

        {/* Action buttons - stacked on mobile, horizontal on larger screens */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 pt-2 border-t border-gray-100 sm:border-t-0">
          <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-2">
            <button
              onClick={() => router.push(`/admin/schedule/${session.id}`)}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-3 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors min-h-[44px] flex items-center justify-center"
            >
              Schedule
            </button>
            {!session.isActive && (
              <button
                onClick={() => handleSetActive(session.id)}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-3 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors min-h-[44px] flex items-center justify-center"
              >
                Set Active
              </button>
            )}
            <Link href={`/admin/sessions/${session.id}`} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium min-h-[44px] flex items-center justify-center">Manage</Link>
          </div>
        </div>
      </div>
    </li>
  )


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Session Management</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 sm:py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center"
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

            <div className="rounded-md border border-amber-100 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-900">Parent Class-Teaching Request Window</h3>
              <p className="mt-1 text-sm text-amber-800">Controls when parents may submit requests for classes they want to teach. This is separate from student registration windows.</p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-gray-700">Opens<input type="date" required value={formData.classTeachingRegistrationStartDate} onChange={(e) => setFormData({ ...formData, classTeachingRegistrationStartDate: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" /></label>
                <label className="block text-sm font-medium text-gray-700">Closes<input type="date" required value={formData.classTeachingRegistrationEndDate} onChange={(e) => setFormData({ ...formData, classTeachingRegistrationEndDate: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" /></label>
              </div>
            </div>

            <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-blue-900">Registration Windows by User Group</h3>
              <p className="mt-1 text-sm text-blue-800">Users with multiple groups can register when any of their group windows is open.</p>
              <div className="mt-4 space-y-3">
                {groups.map((group) => {
                  const window = registrationWindows.find((entry) => entry.groupId === group.id) || { groupId: group.id, startDate: '', endDate: '' }
                  const updateWindow = (field: 'startDate' | 'endDate', value: string) => {
                    setRegistrationWindows((current) => [...current.filter((entry) => entry.groupId !== group.id), { ...window, [field]: value }])
                  }
                  return (
                    <div key={group.id} className="grid gap-3 sm:grid-cols-3 sm:items-end">
                      <p className="text-sm font-medium text-gray-900">{group.name}</p>
                      <label className="text-xs font-medium text-gray-700">Starts<input type="date" value={window.startDate} onChange={(event) => updateWindow('startDate', event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-2 text-sm" /></label>
                      <label className="text-xs font-medium text-gray-700">Ends<input type="date" value={window.endDate} onChange={(event) => updateWindow('endDate', event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-2 text-sm" /></label>
                    </div>
                  )
                })}
              </div>
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

            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-700 px-4 py-3 sm:py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 sm:py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors min-h-[44px] flex items-center justify-center"
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
            <>
              {currentSessions.map(renderSession)}
              {pastSessions.length > 0 && (
                <li className="border-t border-gray-200">
                  <details>
                    <summary className="cursor-pointer px-4 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:px-6">
                      Past Sessions ({pastSessions.length})
                    </summary>
                    <ul className="divide-y divide-gray-200 border-t border-gray-200">
                      {pastSessions.map(renderSession)}
                    </ul>
                  </details>
                </li>
              )}
            </>
          )}
        </ul>
      </div>

    </div>
  )
}
