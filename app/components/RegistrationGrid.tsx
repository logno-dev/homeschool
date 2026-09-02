'use client'

import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { useToast } from './ToastContainer'
import { useRegistration } from './RegistrationContext'
import RegistrationCart from './RegistrationCart'
import VolunteerJobsGrid from './VolunteerJobsGrid'
import NonPeriodVolunteerJobs from './NonPeriodVolunteerJobs'
import { isGradeWithinRange } from '@/lib/grades'

interface ClassTeachingRequest {
  id: string
  className: string
  description: string
  gradeRange: string
  gradeRangeFrom?: number | null
  gradeRangeTo?: number | null
  maxStudents: number
  helpersNeeded: number
  coTeacher?: string | null
  classroomNeeds?: string | null
  requiresFee: boolean
  feeAmount?: number | null
}

interface Schedule {
  id: string
  sessionId: string
  period: string
  status: string
}

interface Classroom {
  id: string
  name: string
  description?: string | null
  orderIndex?: number
}

interface Teacher {
  id: string
  firstName: string
  lastName: string
}

interface RosterChild {
  id: string
  firstName: string
  lastName: string
  grade: string
  status?: string
}

interface PendingRosterChild extends RosterChild {
  status?: 'registered' | 'waitlisted'
}

interface Volunteer {
  guardian: {
    id: string
    firstName: string
    lastName: string
  }
  volunteerType: string
}

interface TeachingAssignment {
  guardianId: string
  period: string
  className: string
  volunteerType: string
  guardianName?: string
}

interface EnhancedSchedule {
  schedule: Schedule
  classTeachingRequest: ClassTeachingRequest
  classroom: Classroom
  teacher: Teacher
  currentRegistrations: number
  availableSpots: number
  helpersAvailable: number
  roster: RosterChild[]
  volunteers: Volunteer[]
}

interface Child {
  id: string
  firstName: string
  lastName: string
  grade: string
  dateOfBirth: string
}

interface Guardian {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface RegistrationGridProps {
  sessionId: string
  schedules: EnhancedSchedule[]
  guardians: Guardian[]
  children: Child[]
  volunteerJobs: any[]
  nonPeriodVolunteerJobs: any[]
  teachingAssignments: TeachingAssignment[]
  volunteerJobAssignmentCounts?: Record<string, number>
  costBreakdown?: string | null
}

const PERIODS = [
  { id: 'first', name: 'First Period' },
  { id: 'second', name: 'Second Period' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'third', name: 'Third Period' }
]

export default function RegistrationGrid({
  sessionId,
  schedules,
  guardians,
  children,
  volunteerJobs,
  nonPeriodVolunteerJobs,
  teachingAssignments,
  volunteerJobAssignmentCounts = {},
  costBreakdown = null
}: RegistrationGridProps) {
  const { showSuccess, showError } = useToast()
  const { 
    addChildRegistration, 
    addVolunteerAssignment, 
    pendingRegistrations,
    setSessionId,
    isChildRegisteredInPeriod,
    isGuardianAssignedInPeriod,
    getVolunteerAssignmentForPeriod,
    hasGuardianConflictInPeriod,
    getGuardianConflictDetails,
    isScheduleConflicted,
    getPendingRegistrationsForSchedule
  } = useRegistration()
  const dedupeJobs = <T extends { id: string; sessionVolunteerJobId?: string }>(jobs: T[]) => {
    const seen = new Set<string>()
    return jobs.filter((job) => {
      const key = job.sessionVolunteerJobId || job.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const [scheduleData, setScheduleData] = useState(schedules)
  const [volunteerJobsData, setVolunteerJobsData] = useState(dedupeJobs(volunteerJobs))
  const [nonPeriodJobsData, setNonPeriodJobsData] = useState(dedupeJobs(nonPeriodVolunteerJobs))
  const [jobAssignmentCounts, setJobAssignmentCounts] = useState(volunteerJobAssignmentCounts)
  
  const [selectedClass, setSelectedClass] = useState<EnhancedSchedule | null>(null)
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)
  const [showChildSelectionModal, setShowChildSelectionModal] = useState(false)
  const [registrationMode, setRegistrationMode] = useState<'registered' | 'waitlisted'>('registered')
  const [showVolunteerSelectionModal, setShowVolunteerSelectionModal] = useState(false)

  const classrooms = useMemo(() => {
    return scheduleData.reduce((acc, schedule) => {
      if (!acc.find((room) => room.id === schedule.classroom.id)) {
        acc.push(schedule.classroom)
      }
      return acc
    }, [] as Classroom[])
  }, [scheduleData])

  const orderedClassrooms = useMemo(() => {
    return [...classrooms].sort((a, b) => {
      const orderA = typeof a.orderIndex === 'number' ? a.orderIndex : 0
      const orderB = typeof b.orderIndex === 'number' ? b.orderIndex : 0
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })
  }, [classrooms])

  const groupedSchedules = useMemo(() => {
    return scheduleData.reduce((acc, schedule) => {
      const period = schedule.schedule.period
      if (!acc[period]) {
        acc[period] = {}
      }
      acc[period][schedule.classroom.id] = schedule
      return acc
    }, {} as Record<string, Record<string, EnhancedSchedule>>)
  }, [scheduleData])

  const normalizedTeachingAssignments = useMemo(() => teachingAssignments, [teachingAssignments])

  // Helper function to calculate effective available spots including pending registrations
  const getEffectiveAvailableSpots = (schedule: EnhancedSchedule) => {
    return schedule.availableSpots
  }

  const handleClassClick = (schedule: EnhancedSchedule) => {
    setSelectedClass(schedule)
    setShowRegistrationModal(true)
  }

  const refreshScheduleData = async () => {
    try {
      const response = await fetch(`/api/registration/schedules/${sessionId}`)
      if (!response.ok) {
        console.warn('Registration schedule refresh failed', {
          sessionId,
          status: response.status
        })
        return
      }
      const payload = await response.json()
      console.log('Registration schedule refresh', {
        sessionId,
        volunteerJobs: payload.volunteerJobs?.length,
        nonPeriodJobs: payload.nonPeriodVolunteerJobs?.length,
        volunteerJobAssignmentCounts: Object.keys(payload.volunteerJobAssignmentCounts || {}).length
      })
      setScheduleData(payload.schedules || [])
      setVolunteerJobsData(dedupeJobs(payload.volunteerJobs || []))
      setNonPeriodJobsData(dedupeJobs(payload.nonPeriodVolunteerJobs || []))
      setJobAssignmentCounts(payload.volunteerJobAssignmentCounts || {})
    } catch (error) {
      console.error('Failed to refresh registration data:', error)
    }
  }


  useEffect(() => {
    setSessionId(sessionId)
  }, [sessionId, setSessionId])

  useEffect(() => {
    const source = new EventSource(`/api/registration/stream?sessionId=${sessionId}`)
    source.onmessage = () => {
      refreshScheduleData()
    }
    source.onerror = () => {
      source.close()
    }

    const interval = setInterval(() => {
      refreshScheduleData()
    }, 30000)

    return () => {
      clearInterval(interval)
      source.close()
    }
  }, [sessionId])

  useEffect(() => {
    console.log('Registration jobs payload', {
      periodJobs: volunteerJobsData,
      nonPeriodJobs: nonPeriodJobsData
    })
  }, [volunteerJobsData, nonPeriodJobsData])

  const handleChildRegistration = async (child: Child, schedule: EnhancedSchedule) => {
    // Check if adding this child would exceed available spots
    if (registrationMode === 'registered' && schedule.availableSpots <= 0) {
      showError('Class is full!', `Cannot add ${child.firstName} ${child.lastName} to ${schedule.classTeachingRequest.className} - all spots are taken.`)
      return
    }

    const gradeAllowed = isGradeWithinRange(
      child.grade,
      schedule.classTeachingRequest.gradeRangeFrom,
      schedule.classTeachingRequest.gradeRangeTo,
      schedule.classTeachingRequest.gradeRange
    )

    if (!gradeAllowed) {
      showError(
        'Grade out of range',
        `${child.firstName} ${child.lastName} is outside the listed grade range. You can still submit, but it will require staff approval.`
      )
    }

    const teacher = `${schedule.teacher.firstName} ${schedule.teacher.lastName}`
    try {
      await addChildRegistration({
        scheduleId: schedule.schedule.id,
        childId: child.id,
        className: schedule.classTeachingRequest.className,
        period: schedule.schedule.period,
        teacher,
        classroom: schedule.classroom.name,
        status: registrationMode
      })
      const statusLabel = registrationMode === 'waitlisted' ? 'waitlist' : 'class'
      showSuccess('Added to cart!', `${child.firstName} ${child.lastName} added to the ${statusLabel} for ${schedule.classTeachingRequest.className}`)
      setShowChildSelectionModal(false)
    } catch (error) {
      showError('Unable to reserve spot', error instanceof Error ? error.message : 'Failed to reserve class spot.')
    }
  }

  const handleVolunteerAssignment = async (guardian: Guardian, schedule: EnhancedSchedule) => {
    // Check for conflicts before adding assignment
    if (hasGuardianConflictInPeriod(guardian.id, schedule.schedule.period, normalizedTeachingAssignments)) {
      const conflictDetails = getGuardianConflictDetails(guardian.id, schedule.schedule.period, normalizedTeachingAssignments)
      showError('Conflict detected!', `${guardian.firstName} ${guardian.lastName} is already assigned: ${conflictDetails}`)
      return
    }

    const teacher = `${schedule.teacher.firstName} ${schedule.teacher.lastName}`
    try {
      await addVolunteerAssignment({
        scheduleId: schedule.schedule.id,
        guardianId: guardian.id,
        period: schedule.schedule.period,
        volunteerType: 'helper',
        className: schedule.classTeachingRequest.className,
        teacher,
        classroom: schedule.classroom.name,
        guardianName: `${guardian.firstName} ${guardian.lastName}`
      })
      showSuccess('Added to cart!', `${guardian.firstName} ${guardian.lastName} added as volunteer for ${schedule.classTeachingRequest.className}`)
      setShowVolunteerSelectionModal(false)
    } catch (error) {
      showError('Unable to reserve volunteer slot', error instanceof Error ? error.message : 'Failed to reserve volunteer slot.')
    }
  }

  const pendingRoster = useMemo(() => {
    if (!selectedClass) return []
    const registeredIds = new Set(selectedClass.roster.map((student) => student.id))
    const roster: PendingRosterChild[] = []

    pendingRegistrations
      .filter((registration) => registration.scheduleId === selectedClass.schedule.id)
      .forEach((registration) => {
        const child = children.find((entry) => entry.id === registration.childId)
        if (!child || registeredIds.has(child.id)) return

        roster.push({
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          grade: child.grade,
          status: registration.status
        })
      })

    return roster
  }, [pendingRegistrations, selectedClass, children])



  // groupedSchedules is now memoized above

  return (
    <>
      {/* Desktop Table View - Hidden on mobile */}
      <div className="hidden lg:block bg-white rounded-lg shadow border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classroom
                </th>
                {PERIODS.map((period) => (
                  <th
                    key={period.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {period.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orderedClassrooms.map((classroom) => (
                <tr key={classroom.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{classroom.name}</div>
                    {classroom.description && (
                      <div className="text-sm text-gray-500">{classroom.description}</div>
                    )}
                  </td>
                  {PERIODS.map((period) => {
                    const schedule = groupedSchedules[period.id]?.[classroom.id]
                    
                    return (
                      <td key={period.id} className="px-6 py-4 whitespace-nowrap">
                        {schedule ? (
                          <div
                            onClick={() => handleClassClick(schedule)}
                            className={`rounded-md p-3 transition-colors border ${
                              isScheduleConflicted(schedule.schedule.id)
                                ? 'bg-red-50 border-red-300 hover:bg-red-100 cursor-pointer'
                                : getEffectiveAvailableSpots(schedule) > 0
                                ? 'bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer'
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer'
                            }`}
                          >
                            <h4 className={`font-medium text-sm ${
                              isScheduleConflicted(schedule.schedule.id) 
                                ? 'text-red-900' 
                                : 'text-blue-900'
                            }`}>
                              {isScheduleConflicted(schedule.schedule.id) && '⚠️ '}
                              {schedule.classTeachingRequest.className}
                            </h4>
                            <p className="text-xs text-blue-700">
                              {schedule.teacher.firstName} {schedule.teacher.lastName}
                            </p>
                            <p className="text-xs text-blue-700">
                              Grade: {schedule.classTeachingRequest.gradeRange}
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                              {getEffectiveAvailableSpots(schedule)} spots available
                            </p>
                            {getEffectiveAvailableSpots(schedule) <= 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                Class full — open for waitlist and volunteers
                              </p>
                            )}
                            {schedule.classTeachingRequest.requiresFee && (
                              <p className="text-xs text-red-600 mt-1">
                                Fee: ${schedule.classTeachingRequest.feeAmount}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-gray-300 rounded-md p-3 h-20 flex items-center justify-center text-sm text-gray-400">
                            No class scheduled
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {orderedClassrooms.length === 0 && (
                <tr>
                  <td colSpan={PERIODS.length + 1} className="px-6 py-4 text-center text-gray-500">
                    No classrooms available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View - Visible only on mobile */}
      <div className="lg:hidden space-y-6">
        {PERIODS.map((period) => (
          <div key={period.id} className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{period.name}</h3>
            </div>
            <div className="p-4 space-y-4">
              {orderedClassrooms.map((classroom) => {
                const schedule = groupedSchedules[period.id]?.[classroom.id]
                
                return (
                  <div key={classroom.id} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 border-b">
                      <div className="text-sm font-medium text-gray-900">{classroom.name}</div>
                      {classroom.description && (
                        <div className="text-xs text-gray-500">{classroom.description}</div>
                      )}
                    </div>
                    <div className="p-3">
                      {schedule ? (
                        <div
                          onClick={() => handleClassClick(schedule)}
                          className={`rounded-md p-4 transition-colors border-2 ${
                            isScheduleConflicted(schedule.schedule.id)
                              ? 'bg-red-50 border-red-300 active:bg-red-100'
                              : getEffectiveAvailableSpots(schedule) > 0
                              ? 'bg-blue-50 border-blue-200 active:bg-blue-100'
                              : 'bg-gray-50 border-gray-200'
                          } cursor-pointer touch-manipulation`}
                        >
                          <div className="space-y-2">
                            <h4 className={`font-semibold text-base ${
                              isScheduleConflicted(schedule.schedule.id) 
                                ? 'text-red-900' 
                                : 'text-blue-900'
                            }`}>
                              {isScheduleConflicted(schedule.schedule.id) && '⚠️ '}
                              {schedule.classTeachingRequest.className}
                            </h4>
                            <div className="grid grid-cols-1 gap-1 text-sm">
                              <p className="text-blue-700">
                                <span className="font-medium">Teacher:</span> {schedule.teacher.firstName} {schedule.teacher.lastName}
                              </p>
                              <p className="text-blue-700">
                                <span className="font-medium">Grade:</span> {schedule.classTeachingRequest.gradeRange}
                              </p>
                              <p className="text-blue-600">
                                <span className="font-medium">Available:</span> {getEffectiveAvailableSpots(schedule)} of {schedule.classTeachingRequest.maxStudents} spots
                              </p>
                              {getEffectiveAvailableSpots(schedule) <= 0 && (
                                <p className="text-xs text-gray-500">
                                  Class full — open for waitlist and volunteers
                                </p>
                              )}
                              {schedule.classTeachingRequest.requiresFee && (
                                <p className="text-red-600 font-medium">
                                  Fee: ${schedule.classTeachingRequest.feeAmount}
                                </p>
                              )}
                            </div>
                            {getEffectiveAvailableSpots(schedule) > 0 && (
                              <div className="pt-2 border-t border-blue-200">
                                <p className="text-xs text-blue-600 font-medium">
                                  Tap to register →
                                </p>
                              </div>
                            )}
                            {getEffectiveAvailableSpots(schedule) <= 0 && (
                              <div className="pt-2 border-t border-gray-200">
                                <p className="text-xs text-gray-500 font-medium">
                                  Tap for waitlist or volunteer options →
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
                          <p className="text-sm text-gray-400">No class scheduled</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {classrooms.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No classrooms available for this period.</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {classrooms.length === 0 && (
          <div className="bg-white rounded-lg shadow border p-6 text-center">
            <p className="text-gray-500">No classrooms available.</p>
          </div>
        )}
      </div>

      {/* Registration Modal */}
      <Modal
        isOpen={showRegistrationModal}
        onClose={() => {
          setShowRegistrationModal(false)
          setSelectedClass(null)
        }}
        title="Register for Class"
        size="lg"
      >
        {selectedClass && (
          <div className="space-y-6">
            {/* Class Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {selectedClass.classTeachingRequest.className}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Teacher:</strong> {selectedClass.teacher.firstName} {selectedClass.teacher.lastName}</p>
                  {selectedClass.classTeachingRequest.coTeacher && (
                    <p><strong>Co-teacher:</strong> {selectedClass.classTeachingRequest.coTeacher}</p>
                  )}
                  <p><strong>Grade Range:</strong> {selectedClass.classTeachingRequest.gradeRange}</p>
                  <p><strong>Room:</strong> {selectedClass.classroom.name}</p>
                  <p><strong>Period:</strong> {PERIODS.find(p => p.id === selectedClass.schedule.period)?.name}</p>
                </div>
                <div>
                  <p><strong>Available Spots:</strong> {getEffectiveAvailableSpots(selectedClass)} / {selectedClass.classTeachingRequest.maxStudents}</p>
                  <p><strong>Helpers Needed:</strong> {selectedClass.classTeachingRequest.helpersNeeded}</p>
                  {selectedClass.classTeachingRequest.requiresFee && (
                    <p className="text-red-600"><strong>Fee Required:</strong> ${selectedClass.classTeachingRequest.feeAmount}</p>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <p><strong>Description:</strong></p>
                <p className="text-gray-700">{selectedClass.classTeachingRequest.description}</p>
              </div>
              {selectedClass.classTeachingRequest.classroomNeeds && (
                <div className="mt-3">
                  <p><strong>Classroom Needs:</strong></p>
                  <p className="text-gray-700">{selectedClass.classTeachingRequest.classroomNeeds}</p>
                </div>
              )}
            </div>

            {/* Class Roster */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3">
                Current Roster ({selectedClass.roster.length + pendingRoster.length} students)
                {pendingRoster.length > 0 ? `, ${pendingRoster.length} pending` : ''}
              </h4>
              {selectedClass.roster.length > 0 || pendingRoster.length > 0 ? (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedClass.roster.map((student) => {
                      const status = student.status || 'registered'
                      const isReserved = status === 'hold' || status === 'pending'
                      return (
                        <div key={student.id} className="flex items-center space-x-2 text-sm">
                          <div className={`w-2 h-2 rounded-full ${isReserved ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                          <span>{student.firstName} {student.lastName} (Grade {student.grade})</span>
                          {isReserved && (
                            <span className="text-xs text-amber-700">Reserved</span>
                          )}
                        </div>
                      )
                    })}
                    {pendingRoster.map((student) => (
                      <div key={`pending-${student.id}`} className="flex items-center space-x-2 text-sm">
                        <div className={`w-2 h-2 rounded-full ${student.status === 'waitlisted' ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                        <span>{student.firstName} {student.lastName} (Grade {student.grade})</span>
                        <span className="text-xs text-yellow-700">
                          {student.status === 'waitlisted' ? 'Waitlist' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No students registered yet.</p>
              )}
            </div>

            {/* Current Volunteers */}
            {selectedClass.volunteers.length > 0 && (
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">Current Volunteers</h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="space-y-2">
                    {selectedClass.volunteers.map((volunteer, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>{volunteer.guardian.firstName} {volunteer.guardian.lastName} ({volunteer.volunteerType})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Registration Actions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-semibold text-gray-900">Add to Registration Cart</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Add Children */}
                {getEffectiveAvailableSpots(selectedClass) > 0 && (
                  <button
                    onClick={() => {
                      setRegistrationMode('registered')
                      setShowChildSelectionModal(true)
                    }}
                    className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Child to Class</span>
                  </button>
                )}
                {getEffectiveAvailableSpots(selectedClass) <= 0 && (
                  <button
                    onClick={() => {
                      setRegistrationMode('waitlisted')
                      setShowChildSelectionModal(true)
                    }}
                    className="flex items-center justify-center space-x-2 bg-yellow-600 text-white px-4 py-3 rounded-md hover:bg-yellow-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Join Waitlist</span>
                  </button>
                )}
                
                {/* Add Volunteer */}
                {selectedClass.classTeachingRequest.helpersNeeded > 0 && selectedClass.helpersAvailable > 0 && (
                  <button
                    onClick={() => setShowVolunteerSelectionModal(true)}
                    className="flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Volunteer as Helper</span>
                  </button>
                )}
              </div>
              
              {/* Status Messages */}
              <div className="mt-4 space-y-2">
                {getEffectiveAvailableSpots(selectedClass) <= 0 && (
                  <p className="text-red-500 text-sm">⚠️ This class is full. You can join the waitlist.</p>
                )}
                {selectedClass.classTeachingRequest.helpersNeeded > 0 && selectedClass.helpersAvailable <= 0 && (
                  <p className="text-orange-500 text-sm">⚠️ All helper spots are filled.</p>
                )}
                <p className="text-gray-600 text-sm">
                  💡 Items will be added to your registration cart. Submit all registrations together when ready.
                </p>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={() => {
                  setShowRegistrationModal(false)
                  setSelectedClass(null)
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Child Selection Modal */}
      <Modal
        isOpen={showChildSelectionModal}
        onClose={() => setShowChildSelectionModal(false)}
        title="Select Children to Register"
        size="md"
      >
        {selectedClass && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select children to register for <strong>{selectedClass.classTeachingRequest.className}</strong> 
              during <strong>{PERIODS.find(p => p.id === selectedClass.schedule.period)?.name}</strong>.
            </p>
            
            <div className="space-y-3">
              {children && children
                .filter(child => registrationMode === 'waitlisted' || !isChildRegisteredInPeriod(child.id, selectedClass.schedule.period))
                .map((child) => (
                  <div key={child.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{child.firstName} {child.lastName}</p>
                      <p className="text-sm text-gray-500">Grade {child.grade}</p>
                    </div>
                <button
                  onClick={() => handleChildRegistration(child, selectedClass)}
                  className={`text-white px-3 py-1 rounded-md transition-colors text-sm ${registrationMode === 'waitlisted' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {registrationMode === 'waitlisted' ? 'Add to Waitlist' : 'Add to Cart'}
                </button>
                  </div>
                ))}
              
              {(!children || children.filter(child => !isChildRegisteredInPeriod(child.id, selectedClass.schedule.period)).length === 0) && (
                <p className="text-gray-500 text-center py-4">
                  No available children for this period. All children are either already registered for another class this period or there are no children in your family.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Volunteer Selection Modal */}
      <Modal
        isOpen={showVolunteerSelectionModal}
        onClose={() => setShowVolunteerSelectionModal(false)}
        title="Select Volunteer Helper"
        size="md"
      >
        {selectedClass && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select a guardian to volunteer as a helper for <strong>{selectedClass.classTeachingRequest.className}</strong> 
              during <strong>{PERIODS.find(p => p.id === selectedClass.schedule.period)?.name}</strong>.
            </p>
            
            <div className="space-y-3">
              {guardians && guardians
                .filter(guardian => {
                  const period = selectedClass.schedule.period
                  const currentAssignment = getVolunteerAssignmentForPeriod(period)
                  return !currentAssignment || currentAssignment.guardianId !== guardian.id
                })
                .map((guardian) => (
                  <div key={guardian.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{guardian.firstName} {guardian.lastName}</p>
                      <p className="text-sm text-gray-500">{guardian.email}</p>
                    </div>
                    <button
                      onClick={() => handleVolunteerAssignment(guardian, selectedClass)}
                      className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition-colors text-sm"
                    >
                      Add to Cart
                    </button>
                  </div>
                ))}
              
              {(!guardians || guardians.filter(guardian => {
                const period = selectedClass.schedule.period
                const currentAssignment = getVolunteerAssignmentForPeriod(period)
                return !currentAssignment || currentAssignment.guardianId !== guardian.id
              }).length === 0) && (
                <p className="text-gray-500 text-center py-4">
                  No available guardians for volunteering this period.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Volunteer Jobs Grid */}
      {volunteerJobsData && volunteerJobsData.length > 0 && (
        <VolunteerJobsGrid 
          volunteerJobs={volunteerJobsData}
          guardians={guardians || []}
          schedules={scheduleData || []}
          jobAssignmentCounts={jobAssignmentCounts}
        />
      )}

      {/* Non-Period Volunteer Jobs */}
      {nonPeriodJobsData && nonPeriodJobsData.length > 0 && (
        <NonPeriodVolunteerJobs 
          volunteerJobs={nonPeriodJobsData}
          guardians={guardians || []}
          jobAssignmentCounts={jobAssignmentCounts}
        />
      )}

      {/* Registration Cart */}
      <RegistrationCart sessionId={sessionId} children={children || []} costBreakdown={costBreakdown} />
    </>
  )
}
