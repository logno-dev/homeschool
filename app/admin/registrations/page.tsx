'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '../../components/AdminLayout'
import Modal from '../../components/Modal'
import { useToast } from '../../components/ToastContainer'
import type { Session } from '../../../lib/schema'
import SessionOptions from '../../components/SessionOptions'

interface RegistrationRow {
  id: string
  status: string
  child: {
    id: string
    firstName: string
    lastName: string
    grade: string
    familyId: string
  }
  schedule: {
    id: string
    period: string
  }
  classTeachingRequest: {
    className: string
  }
  classroom: {
    name: string
  }
}

interface ScheduleOption {
  id: string
  classroomId: string
  period: string
  className: string
  classroom: string
  teacher: string
  maxStudents: number
  currentRegistrations: number
}

interface VolunteerAssignmentRow {
  id: string
  period: string
  volunteerType: string
  status: string
  guardian: {
    id: string
    firstName: string
    lastName: string
  }
  schedule?: {
    id: string
    period: string
    className: string
    classroom: string
    teacher: string
  } | null
  volunteerJob?: {
    id: string
    title: string
  } | null
}

interface VolunteerJobOption {
  id: string
  title: string
  jobType: string
  quantityAvailable: number
}

interface GuardianOption {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface ChildOption {
  id: string
  firstName: string
  lastName: string
  grade: string
  familyId: string
}

interface ClassroomOption {
  id: string
  name: string
}

interface RegistrationsResponse {
  registrations: RegistrationRow[]
  schedules: ScheduleOption[]
  volunteerAssignments: VolunteerAssignmentRow[]
  volunteerJobs: VolunteerJobOption[]
  guardians: GuardianOption[]
  children: ChildOption[]
  classrooms: ClassroomOption[]
}

const PERIODS = [
  { id: 'first', name: 'First Hour' },
  { id: 'second', name: 'Second Hour' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'third', name: 'Third Hour' }
]

export default function AdminRegistrationsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showSuccess, showError } = useToast()

  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [data, setData] = useState<RegistrationsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleOption | null>(null)
  const [showClassModal, setShowClassModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [selectedRegistration, setSelectedRegistration] = useState<RegistrationRow | null>(null)
  const [targetScheduleId, setTargetScheduleId] = useState('')
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<VolunteerAssignmentRow | null>(null)
  const [assignmentForm, setAssignmentForm] = useState({
    guardianId: '',
    volunteerType: 'helper',
    scheduleId: '',
    volunteerJobId: '',
    period: 'first'
  })
  const [newRegistration, setNewRegistration] = useState({ childId: '', status: 'registered' })

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/signin')
      return
    }

    const loadSessions = async () => {
      try {
        const response = await fetch('/api/admin/sessions')
        if (response.ok) {
          const result = await response.json()
          const loadedSessions: Session[] = result.sessions || []
          setSessions(loadedSessions)
          setSelectedSessionId((current) => {
            if (current) return current
            const activeSession = loadedSessions.find((session) => session.isActive)
            return activeSession?.id || loadedSessions[0]?.id || ''
          })
        }
      } catch (error) {
        console.error('Error loading sessions:', error)
      }
    }

    loadSessions()
  }, [loading, user, router])

  useEffect(() => {
    if (!selectedSessionId) {
      setIsLoading(false)
      return
    }

    const loadRegistrations = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/admin/registrations?sessionId=${selectedSessionId}`)
        if (!response.ok) {
          throw new Error('Failed to load registrations')
        }
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error('Error loading registrations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRegistrations()
  }, [selectedSessionId])

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Admin'

  const scheduleOptions = useMemo(() => data?.schedules ?? [], [data])
  const registrationRows = useMemo(() => data?.registrations ?? [], [data])
  const volunteerAssignments = useMemo(() => data?.volunteerAssignments ?? [], [data])
  const volunteerJobs = useMemo(() => data?.volunteerJobs ?? [], [data])
  const guardians = useMemo(() => data?.guardians ?? [], [data])
  const children = useMemo(() => data?.children ?? [], [data])
  const classrooms = useMemo(() => data?.classrooms ?? [], [data])

  const schedulesByCell = useMemo(() => {
    const map = new Map<string, ScheduleOption>()
    scheduleOptions.forEach((schedule) => {
      map.set(`${schedule.classroomId}-${schedule.period}`, schedule)
    })
    return map
  }, [scheduleOptions])

  const registrationsForSchedule = useMemo(() => {
    if (!selectedSchedule) return []
    return registrationRows.filter((registration) => registration.schedule.id === selectedSchedule.id)
  }, [registrationRows, selectedSchedule])

  const registeredStudents = registrationsForSchedule.filter((registration) => registration.status === 'registered')
  const waitlistedStudents = registrationsForSchedule.filter((registration) => registration.status === 'waitlisted')

  const volunteersForSchedule = useMemo(() => {
    if (!selectedSchedule) return []
    return volunteerAssignments.filter((assignment) => assignment.schedule?.id === selectedSchedule.id && assignment.status === 'assigned')
  }, [volunteerAssignments, selectedSchedule])

  const nonPeriodJobs = useMemo(
    () => volunteerJobs.filter((job) => job.jobType === 'non_period'),
    [volunteerJobs]
  )

  const periodJobs = useMemo(
    () => volunteerJobs.filter((job) => job.jobType === 'period_based'),
    [volunteerJobs]
  )

  const assignmentsByJob = useMemo(() => {
    const map = new Map<string, VolunteerAssignmentRow[]>()
    volunteerAssignments
      .filter((assignment) => assignment.status === 'assigned' && assignment.volunteerJob?.id)
      .forEach((assignment) => {
        const jobId = assignment.volunteerJob?.id
        if (!jobId) return
        const list = map.get(jobId) || []
        list.push(assignment)
        map.set(jobId, list)
      })
    return map
  }, [volunteerAssignments])

  const openClassModal = (schedule: ScheduleOption) => {
    setSelectedSchedule(schedule)
    setShowClassModal(true)
    setNewRegistration({ childId: '', status: 'registered' })
  }

  const refreshData = async () => {
    if (!selectedSessionId) return
    const refreshed = await fetch(`/api/admin/registrations?sessionId=${selectedSessionId}`)
    if (refreshed.ok) {
      setData(await refreshed.json())
    }
  }

  const openMoveModal = (registration: RegistrationRow) => {
    setSelectedRegistration(registration)
    setTargetScheduleId(registration.schedule.id)
    setShowMoveModal(true)
  }

  const handleMoveRegistration = async () => {
    if (!selectedRegistration || !targetScheduleId) return
    try {
      const response = await fetch(`/api/admin/registrations/${selectedRegistration.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: targetScheduleId })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to move registration')
      }
      showSuccess('Registration updated', 'Student moved to new class.')
      setShowMoveModal(false)
      setSelectedRegistration(null)
      setTargetScheduleId('')
      await refreshData()
    } catch (error) {
      showError('Update failed', error instanceof Error ? error.message : 'Unable to update registration')
    }
  }

  const updateRegistrationStatus = async (registrationId: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/registrations/${registrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update registration')
      }
      showSuccess('Registration updated', 'Status updated successfully.')
      await refreshData()
    } catch (error) {
      showError('Update failed', error instanceof Error ? error.message : 'Unable to update registration')
    }
  }

  const handleAddStudent = async () => {
    if (!selectedSchedule || !newRegistration.childId) return
    try {
      const response = await fetch('/api/admin/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          scheduleId: selectedSchedule.id,
          childId: newRegistration.childId,
          status: newRegistration.status
        })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to add student')
      }
      showSuccess('Student added', 'Registration created successfully.')
      setNewRegistration({ childId: '', status: 'registered' })
      await refreshData()
    } catch (error) {
      showError('Add failed', error instanceof Error ? error.message : 'Unable to add student')
    }
  }

  const openAssignmentModal = (assignment?: VolunteerAssignmentRow, job?: VolunteerJobOption) => {
    setEditingAssignment(assignment || null)
    if (assignment) {
      setAssignmentForm({
        guardianId: assignment.guardian.id,
        volunteerType: assignment.volunteerType,
        scheduleId: assignment.volunteerType === 'volunteer_job' ? '' : assignment.schedule?.id || selectedSchedule?.id || '',
        volunteerJobId: assignment.volunteerJob?.id || '',
        period: assignment.period
      })
    } else {
      setAssignmentForm({
        guardianId: '',
        volunteerType: job ? 'volunteer_job' : 'helper',
        scheduleId: job ? '' : selectedSchedule?.id || '',
        volunteerJobId: job?.id || '',
        period: job?.jobType === 'non_period' ? 'non_period' : selectedSchedule?.period || 'first'
      })
    }
    setShowAssignmentModal(true)
  }

  const selectedVolunteerJob = useMemo(
    () => volunteerJobs.find((job) => job.id === assignmentForm.volunteerJobId) || null,
    [volunteerJobs, assignmentForm.volunteerJobId]
  )

  const volunteerPeriodOptions = useMemo(() => {
    if (assignmentForm.volunteerType === 'volunteer_job' && selectedVolunteerJob?.jobType === 'non_period') {
      return [{ id: 'non_period', name: 'General' }]
    }
    return PERIODS
  }, [assignmentForm.volunteerType, selectedVolunteerJob])

  const handleVolunteerJobChange = (jobId: string) => {
    const job = volunteerJobs.find((item) => item.id === jobId)
    setAssignmentForm((prev) => ({
      ...prev,
      volunteerJobId: jobId,
      period: job?.jobType === 'non_period' ? 'non_period' : prev.period
    }))
  }

  const handleSaveAssignment = async () => {
    try {
      const payload = {
        sessionId: selectedSessionId,
        guardianId: assignmentForm.guardianId,
        volunteerType: assignmentForm.volunteerType,
        scheduleId: assignmentForm.volunteerType === 'volunteer_job' ? undefined : assignmentForm.scheduleId,
        volunteerJobId: assignmentForm.volunteerType === 'volunteer_job' ? assignmentForm.volunteerJobId : undefined,
        period: assignmentForm.period
      }

      const url = editingAssignment
        ? `/api/admin/volunteer-assignments/${editingAssignment.id}`
        : '/api/admin/volunteer-assignments'
      const response = await fetch(url, {
        method: editingAssignment ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save assignment')
      }
      showSuccess('Volunteer assignment saved', 'Assignment updated successfully.')
      setShowAssignmentModal(false)
      setEditingAssignment(null)
      await refreshData()
    } catch (error) {
      showError('Assignment failed', error instanceof Error ? error.message : 'Unable to save assignment')
    }
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/admin/volunteer-assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove assignment')
      }
      showSuccess('Assignment removed', 'Volunteer assignment cancelled.')
      await refreshData()
    } catch (error) {
      showError('Remove failed', error instanceof Error ? error.message : 'Unable to remove assignment')
    }
  }

  return (
    <AdminLayout userName={userName} activeTab="registrations">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Registration Management</h1>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select session</option>
              <SessionOptions sessions={sessions} />
            </select>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading registrations...</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Class Schedule</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Classroom</th>
                      {PERIODS.map((period) => (
                        <th key={period.id} className="px-4 py-3 text-left font-medium text-gray-500">
                          {period.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {classrooms.map((classroom) => (
                      <tr key={classroom.id}>
                        <td className="px-4 py-4 font-medium text-gray-900">
                          {classroom.name}
                        </td>
                        {PERIODS.map((period) => {
                          const schedule = schedulesByCell.get(`${classroom.id}-${period.id}`)
                          if (!schedule) {
                            return (
                              <td key={`${classroom.id}-${period.id}`} className="px-4 py-4 text-gray-400">
                                —
                              </td>
                            )
                          }
                          const capacity = `${schedule.currentRegistrations}/${schedule.maxStudents}`
                          return (
                            <td key={`${classroom.id}-${period.id}`} className="px-4 py-4">
                              <button
                                onClick={() => openClassModal(schedule)}
                                className="w-full text-left rounded-md border border-gray-200 p-3 hover:border-blue-400 hover:bg-blue-50 transition"
                              >
                                <div className="font-medium text-gray-900">{schedule.className}</div>
                                <div className="text-xs text-gray-600">{schedule.teacher}</div>
                                <div className="mt-2 text-xs text-gray-500">{capacity} registered</div>
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {classrooms.length === 0 && (
                      <tr>
                        <td className="px-6 py-6 text-center text-gray-500" colSpan={PERIODS.length + 1}>
                          No classrooms found for this session.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {nonPeriodJobs.length > 0 && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">General Volunteer Jobs</h2>
                <p className="text-sm text-gray-500">Volunteer opportunities not tied to a classroom hour.</p>
              </div>
              <div className="divide-y divide-gray-200">
                {nonPeriodJobs.map((job) => {
                  const assignments = assignmentsByJob.get(job.id) || []
                  const availableSpots = job.quantityAvailable - assignments.length
                  return (
                    <div key={job.id} className="px-6 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-gray-900">{job.title}</div>
                          <div className="text-xs text-gray-500">
                            {assignments.length} assigned • {availableSpots} available
                          </div>
                        </div>
                        <button
                          onClick={() => openAssignmentModal(undefined, job)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          Assign Volunteer
                        </button>
                      </div>
                      {assignments.length === 0 ? (
                        <p className="mt-2 text-sm text-gray-500">No volunteers assigned yet.</p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {assignments.map((assignment) => (
                            <li key={assignment.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                              <div>
                                <div className="font-medium text-gray-900">
                                  {assignment.guardian.firstName} {assignment.guardian.lastName}
                                </div>
                                <div className="text-xs text-gray-500">Volunteer Job</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => openAssignmentModal(assignment)}
                                  className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleRemoveAssignment(assignment.id)}
                                  className="text-sm text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {periodJobs.length > 0 && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Hour-Based Volunteer Jobs</h2>
                <p className="text-sm text-gray-500">Volunteer opportunities tied to a specific hour but not a classroom.</p>
              </div>
              <div className="divide-y divide-gray-200">
                {periodJobs.map((job) => {
                  const assignments = assignmentsByJob.get(job.id) || []
                  const availableSpots = job.quantityAvailable - assignments.length
                  return (
                    <div key={job.id} className="px-6 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-gray-900">{job.title}</div>
                          <div className="text-xs text-gray-500">
                            {assignments.length} assigned • {availableSpots} available
                          </div>
                        </div>
                        <button
                          onClick={() => openAssignmentModal(undefined, job)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          Assign Volunteer
                        </button>
                      </div>
                      {assignments.length === 0 ? (
                        <p className="mt-2 text-sm text-gray-500">No volunteers assigned yet.</p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {assignments.map((assignment) => (
                            <li key={assignment.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                              <div>
                                <div className="font-medium text-gray-900">
                                  {assignment.guardian.firstName} {assignment.guardian.lastName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {PERIODS.find((period) => period.id === assignment.period)?.name || assignment.period}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => openAssignmentModal(assignment)}
                                  className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleRemoveAssignment(assignment.id)}
                                  className="text-sm text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <Modal
        isOpen={showClassModal}
        onClose={() => setShowClassModal(false)}
        title={selectedSchedule ? `${selectedSchedule.className} • ${selectedSchedule.classroom}` : 'Class'}
        size="lg"
      >
        {selectedSchedule && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
              <div>
                <p className="font-medium text-gray-900">Teacher</p>
                <p>{selectedSchedule.teacher}</p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Hour</p>
                <p>{PERIODS.find((period) => period.id === selectedSchedule.period)?.name}</p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Capacity</p>
                <p>{selectedSchedule.currentRegistrations}/{selectedSchedule.maxStudents}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900">Registered Students</h3>
              {registeredStudents.length === 0 ? (
                <p className="text-sm text-gray-500 mt-2">No registered students.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {registeredStudents.map((registration) => (
                    <li key={registration.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                      <div>
                        <div className="font-medium text-gray-900">
                          {registration.child.firstName} {registration.child.lastName}
                        </div>
                        <div className="text-xs text-gray-500">Grade {registration.child.grade}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openMoveModal(registration)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          Move
                        </button>
                        <button
                          onClick={() => updateRegistrationStatus(registration.id, 'cancelled')}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Drop
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900">Waitlist</h3>
              {waitlistedStudents.length === 0 ? (
                <p className="text-sm text-gray-500 mt-2">No waitlisted students.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {waitlistedStudents.map((registration) => (
                    <li key={registration.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                      <div>
                        <div className="font-medium text-gray-900">
                          {registration.child.firstName} {registration.child.lastName}
                        </div>
                        <div className="text-xs text-gray-500">Grade {registration.child.grade}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateRegistrationStatus(registration.id, 'registered')}
                          className="text-sm text-green-600 hover:text-green-700"
                        >
                          Promote
                        </button>
                        <button
                          onClick={() => updateRegistrationStatus(registration.id, 'cancelled')}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900">Add Student</h3>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={newRegistration.childId}
                  onChange={(e) => setNewRegistration({ ...newRegistration, childId: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select child</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.firstName} {child.lastName} (Grade {child.grade})
                    </option>
                  ))}
                </select>
                <select
                  value={newRegistration.status}
                  onChange={(e) => setNewRegistration({ ...newRegistration, status: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="registered">Registered</option>
                  <option value="waitlisted">Waitlisted</option>
                </select>
                <button
                  onClick={handleAddStudent}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Volunteers</h3>
                <button
                  onClick={() => openAssignmentModal()}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Add Volunteer
                </button>
              </div>
              {volunteersForSchedule.length === 0 ? (
                <p className="text-sm text-gray-500 mt-2">No volunteers assigned.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {volunteersForSchedule.map((assignment) => (
                    <li key={assignment.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                      <div>
                        <div className="font-medium text-gray-900">
                          {assignment.guardian.firstName} {assignment.guardian.lastName}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">{assignment.volunteerType.replace('_', ' ')}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openAssignmentModal(assignment)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        title="Move Student"
        size="md"
      >
        <div className="space-y-4">
          <select
            value={targetScheduleId}
            onChange={(e) => setTargetScheduleId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Select class</option>
            {scheduleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.className} • {PERIODS.find((period) => period.id === option.period)?.name || option.period} • {option.classroom}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowMoveModal(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleMoveRegistration}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        title={editingAssignment ? 'Edit Volunteer Assignment' : 'Assign Volunteer'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Volunteer</label>
            <select
              value={assignmentForm.guardianId}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, guardianId: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select guardian</option>
              {guardians.map((guardian) => (
                <option key={guardian.id} value={guardian.id}>
                  {guardian.firstName} {guardian.lastName} ({guardian.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Type</label>
            <select
              value={assignmentForm.volunteerType}
              onChange={(e) => setAssignmentForm({
                ...assignmentForm,
                volunteerType: e.target.value,
                scheduleId: e.target.value === 'volunteer_job' ? '' : selectedSchedule?.id || '',
                volunteerJobId: ''
              })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="helper">Class Helper</option>
              <option value="co_teacher">Co-Teacher</option>
              <option value="teacher">Teacher</option>
              <option value="volunteer_job">Volunteer Job</option>
            </select>
          </div>
          {assignmentForm.volunteerType === 'volunteer_job' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volunteer Job</label>
              <select
                value={assignmentForm.volunteerJobId}
                onChange={(e) => handleVolunteerJobChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select job</option>
                {volunteerJobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.title}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select
                value={assignmentForm.scheduleId}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, scheduleId: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select class</option>
                {scheduleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.className} • {PERIODS.find((period) => period.id === option.period)?.name || option.period}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hour</label>
            <select
              value={assignmentForm.period}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, period: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              disabled={assignmentForm.volunteerType !== 'volunteer_job' || selectedVolunteerJob?.jobType === 'non_period'}
            >
              {volunteerPeriodOptions.map((period) => (
                <option key={period.id} value={period.id}>{period.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowAssignmentModal(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAssignment}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
