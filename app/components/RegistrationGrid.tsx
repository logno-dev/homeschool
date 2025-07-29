'use client'

import { useState, useEffect, useMemo, memo } from 'react'
import Modal from './Modal'
import { useToast } from './ToastContainer'
import { useRegistration } from './RegistrationContext'
import RegistrationCart from './RegistrationCart'
import VolunteerJobsGrid from './VolunteerJobsGrid'
import NonPeriodVolunteerJobs from './NonPeriodVolunteerJobs'

interface ClassTeachingRequest {
  id: string
  className: string
  description: string
  gradeRange: string
  maxStudents: number
  helpersNeeded: number
  coTeacher?: string
  classroomNeeds?: string
  requiresFee: boolean
  feeAmount?: number
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
  description?: string
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
}

interface Volunteer {
  guardian: {
    id: string
    firstName: string
    lastName: string
  }
  volunteerType: string
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
}

const PERIODS = [
  { id: 'first', name: 'First Period' },
  { id: 'second', name: 'Second Period' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'third', name: 'Third Period' }
]

export default function RegistrationGrid({ sessionId }: RegistrationGridProps) {
  const { showSuccess, showError } = useToast()
  const { 
    addChildRegistration, 
    addVolunteerAssignment, 
    isChildRegisteredInPeriod,
    isGuardianAssignedInPeriod,
    getVolunteerAssignmentForPeriod,
    hasGuardianConflictInPeriod,
    getGuardianConflictDetails,
    isScheduleConflicted,
    getPendingRegistrationsForSchedule
  } = useRegistration()
  
  const [schedules, setSchedules] = useState<EnhancedSchedule[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [volunteerJobs, setVolunteerJobs] = useState<any[]>([])
  const [nonPeriodVolunteerJobs, setNonPeriodVolunteerJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState<EnhancedSchedule | null>(null)
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)
  const [showChildSelectionModal, setShowChildSelectionModal] = useState(false)
  const [showVolunteerSelectionModal, setShowVolunteerSelectionModal] = useState(false)

  useEffect(() => {
    fetchData()
  }, [sessionId])

  const fetchData = async () => {
    try {
      const [schedulesRes, familyRes] = await Promise.all([
        fetch(`/api/registration/schedules/${sessionId}`),
        fetch('/api/family/profile')
      ])

      if (schedulesRes.ok) {
        const schedulesData = await schedulesRes.json()
        setSchedules(schedulesData.schedules || [])
        setVolunteerJobs(schedulesData.volunteerJobs || [])
        setNonPeriodVolunteerJobs(schedulesData.nonPeriodVolunteerJobs || [])
        
        // Extract unique classrooms from schedules
        const uniqueClassrooms = schedulesData.schedules?.reduce((acc: Classroom[], item: EnhancedSchedule) => {
          if (!acc.find(c => c.id === item.classroom.id)) {
            acc.push(item.classroom)
          }
          return acc
        }, []) || []
        setClassrooms(uniqueClassrooms)
      }

      if (familyRes.ok) {
        const familyData = await familyRes.json()
        setChildren(familyData.children || [])
        setGuardians(familyData.guardians || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const groupedSchedules = useMemo(() => {
    return schedules.reduce((acc, schedule) => {
      const period = schedule.schedule.period
      if (!acc[period]) {
        acc[period] = {}
      }
      acc[period][schedule.classroom.id] = schedule
      return acc
    }, {} as Record<string, Record<string, EnhancedSchedule>>)
  }, [schedules])

  // Transform schedules data into teaching assignments for conflict detection
  const teachingAssignments = useMemo(() => {
    return schedules.map(schedule => ({
      guardianId: schedule.teacher.id,
      period: schedule.schedule.period,
      className: schedule.classTeachingRequest.className,
      volunteerType: 'teacher'
    }))
  }, [schedules])

  // Helper function to calculate effective available spots including pending registrations
  const getEffectiveAvailableSpots = (schedule: EnhancedSchedule) => {
    const pendingRegistrations = getPendingRegistrationsForSchedule(schedule.schedule.id)
    return schedule.availableSpots - pendingRegistrations
  }

  const handleClassClick = (schedule: EnhancedSchedule) => {
    const effectiveSpots = getEffectiveAvailableSpots(schedule)
    if (effectiveSpots > 0) {
      setSelectedClass(schedule)
      setShowRegistrationModal(true)
    }
  }

  const handleChildRegistration = (child: Child, schedule: EnhancedSchedule) => {
    // Check if adding this child would exceed available spots
    const pendingRegistrations = getPendingRegistrationsForSchedule(schedule.schedule.id)
    const totalRegistrations = schedule.currentRegistrations + pendingRegistrations
    
    if (totalRegistrations >= schedule.classTeachingRequest.maxStudents) {
      showError('Class is full!', `Cannot add ${child.firstName} ${child.lastName} to ${schedule.classTeachingRequest.className} - all spots are taken.`)
      return
    }

    const teacher = `${schedule.teacher.firstName} ${schedule.teacher.lastName}`
    addChildRegistration({
      scheduleId: schedule.schedule.id,
      childId: child.id,
      className: schedule.classTeachingRequest.className,
      period: schedule.schedule.period,
      teacher,
      classroom: schedule.classroom.name
    })
    showSuccess('Added to cart!', `${child.firstName} ${child.lastName} added to ${schedule.classTeachingRequest.className}`)
    setShowChildSelectionModal(false)
  }

  const handleVolunteerAssignment = (guardian: Guardian, schedule: EnhancedSchedule) => {
    // Check for conflicts before adding assignment
    if (hasGuardianConflictInPeriod(guardian.id, schedule.schedule.period, teachingAssignments)) {
      const conflictDetails = getGuardianConflictDetails(guardian.id, schedule.schedule.period, teachingAssignments)
      showError('Conflict detected!', `${guardian.firstName} ${guardian.lastName} is already assigned: ${conflictDetails}`)
      return
    }

    const teacher = `${schedule.teacher.firstName} ${schedule.teacher.lastName}`
    addVolunteerAssignment({
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
  }



  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading schedule...</p>
      </div>
    )
  }

  // groupedSchedules is now memoized above

  return (
    <>
      <div className="bg-white rounded-lg shadow border overflow-hidden">
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
              {classrooms.map((classroom) => (
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
                                : 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
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
              {classrooms.length === 0 && (
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
              <h4 className="text-md font-semibold text-gray-900 mb-3">Current Roster ({selectedClass.roster.length} students)</h4>
              {selectedClass.roster.length > 0 ? (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedClass.roster.map((student) => (
                      <div key={student.id} className="flex items-center space-x-2 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{student.firstName} {student.lastName} (Grade {student.grade})</span>
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
                    onClick={() => setShowChildSelectionModal(true)}
                    className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Child to Class</span>
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
                  <p className="text-red-500 text-sm">⚠️ This class is full.</p>
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
                .filter(child => !isChildRegisteredInPeriod(child.id, selectedClass.schedule.period))
                .map((child) => (
                  <div key={child.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{child.firstName} {child.lastName}</p>
                      <p className="text-sm text-gray-500">Grade {child.grade}</p>
                    </div>
                    <button
                      onClick={() => handleChildRegistration(child, selectedClass)}
                      className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      Add to Cart
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
      {volunteerJobs && volunteerJobs.length > 0 && (
        <VolunteerJobsGrid 
          volunteerJobs={volunteerJobs}
          guardians={guardians || []}
          schedules={schedules || []}
        />
      )}

      {/* Non-Period Volunteer Jobs */}
      {nonPeriodVolunteerJobs && nonPeriodVolunteerJobs.length > 0 && (
        <NonPeriodVolunteerJobs 
          volunteerJobs={nonPeriodVolunteerJobs}
          guardians={guardians || []}
        />
      )}

      {/* Registration Cart */}
      <RegistrationCart sessionId={sessionId} children={children || []} />
    </>
  )
}