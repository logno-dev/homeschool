'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useUserSession } from '@/lib/user-session'

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

interface EnhancedSchedule {
  schedule: Schedule
  classTeachingRequest: ClassTeachingRequest
  classroom: Classroom
  teacher: Teacher
  currentRegistrations: number
  availableSpots: number
  helpersAvailable: number
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

interface FamilyRegistration {
  [period: string]: {
    [childId: string]: string // scheduleId
  }
}

interface VolunteerAssignment {
  [period: string]: {
    guardianId: string
    scheduleId: string
    type: 'helper' | 'teacher'
  }
}

export default function FamilyRegistrationPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { data: authSession, status } = useSession()
  const router = useRouter()
  const [schedules, setSchedules] = useState<EnhancedSchedule[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [loading, setLoading] = useState(true)
  const [registrations, setRegistrations] = useState<FamilyRegistration>({})
  const [volunteerAssignments, setVolunteerAssignments] = useState<VolunteerAssignment>({})
  const [submitting, setSubmitting] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params
      setSessionId(resolvedParams.sessionId)
    }
    getParams()
  }, [params])

  useEffect(() => {
    // Don't redirect while NextAuth is still loading
    if (status === "loading") return
    
    // Only redirect if we're sure the user is not authenticated
    if (status === "unauthenticated" || !authSession?.user?.id) {
      router.push('/signin')
      return
    }

    if (!sessionId) return

    fetchData()
  }, [authSession, sessionId, status, router])

  const fetchData = async () => {
    try {
      const [schedulesRes, familyRes] = await Promise.all([
        fetch(`/api/registration/schedules/${sessionId}`),
        fetch('/api/family/profile')
      ])

      if (schedulesRes.ok) {
        const schedulesData = await schedulesRes.json()
        setSchedules(schedulesData.schedules || [])
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

  const groupSchedulesByPeriod = (schedules: EnhancedSchedule[]) => {
    return schedules.reduce((acc, schedule) => {
      const period = schedule.schedule.period
      if (!acc[period]) {
        acc[period] = []
      }
      acc[period].push(schedule)
      return acc
    }, {} as Record<string, EnhancedSchedule[]>)
  }

  const handleChildRegistration = (period: string, childId: string, scheduleId: string) => {
    setRegistrations(prev => ({
      ...prev,
      [period]: {
        ...prev[period],
        [childId]: scheduleId
      }
    }))
  }

  const handleVolunteerAssignment = (period: string, guardianId: string, scheduleId: string, type: 'helper' | 'teacher') => {
    setVolunteerAssignments(prev => ({
      ...prev,
      [period]: {
        guardianId,
        scheduleId,
        type
      }
    }))
  }

  const removeChildRegistration = (period: string, childId: string) => {
    setRegistrations(prev => {
      const newRegistrations = { ...prev }
      if (newRegistrations[period]) {
        delete newRegistrations[period][childId]
        if (Object.keys(newRegistrations[period]).length === 0) {
          delete newRegistrations[period]
        }
      }
      return newRegistrations
    })
  }

  const removeVolunteerAssignment = (period: string) => {
    setVolunteerAssignments(prev => {
      const newAssignments = { ...prev }
      delete newAssignments[period]
      return newAssignments
    })
  }

  const submitRegistration = async () => {
    setSubmitting(true)
    try {
      const registrationData = {
        sessionId,
        registrations,
        volunteerAssignments
      }

      const response = await fetch('/api/registration/family', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      })

      if (response.ok) {
        alert('Family registration submitted successfully!')
        router.push(`/registration/${sessionId}`)
      } else {
        const error = await response.json()
        alert(`Registration failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Error submitting registration:', error)
      alert('Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatPeriod = (period: string) => {
    switch (period) {
      case 'first': return 'First Period'
      case 'second': return 'Second Period'
      case 'third': return 'Third Period'
      case 'lunch': return 'Lunch'
      default: return period
    }
  }

  const getRegisteredChildrenForPeriod = (period: string) => {
    return Object.keys(registrations[period] || {})
  }

  const getVolunteerForPeriod = (period: string) => {
    return volunteerAssignments[period]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading family registration...</div>
      </div>
    )
  }

  // Show loading while NextAuth is loading
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!authSession?.user?.id) {
    return null
  }

  const groupedSchedules = groupSchedulesByPeriod(schedules)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Family Registration</h1>
          <p className="mt-2 text-gray-600">Register your children for classes and assign volunteer responsibilities.</p>
        </div>

        {/* Registration Summary */}
        <div className="mb-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Registration Summary</h2>
          {Object.keys(registrations).length === 0 && Object.keys(volunteerAssignments).length === 0 ? (
            <p className="text-gray-500">No registrations or volunteer assignments yet.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(registrations).map(([period, periodRegistrations]) => (
                <div key={period} className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-medium text-gray-900">{formatPeriod(period)}</h3>
                  {Object.entries(periodRegistrations).map(([childId, scheduleId]) => {
                    const child = children.find(c => c.id === childId)
                    const schedule = schedules.find(s => s.schedule.id === scheduleId)
                    return (
                      <p key={childId} className="text-sm text-gray-600">
                        {child?.firstName} {child?.lastName} → {schedule?.classTeachingRequest.className}
                      </p>
                    )
                  })}
                  {volunteerAssignments[period] && (
                    <p className="text-sm text-green-600">
                      Volunteer: {guardians.find(g => g.id === volunteerAssignments[period].guardianId)?.firstName} as {volunteerAssignments[period].type}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {(Object.keys(registrations).length > 0 || Object.keys(volunteerAssignments).length > 0) && (
            <button
              onClick={submitRegistration}
              disabled={submitting}
              className="mt-4 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-6 py-2 rounded-md font-medium"
            >
              {submitting ? 'Submitting...' : 'Submit Family Registration'}
            </button>
          )}
        </div>

        {/* Schedule by Period */}
        <div className="space-y-8">
          {Object.entries(groupedSchedules).map(([period, periodSchedules]) => (
            <div key={period} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b">
                <h2 className="text-xl font-semibold text-gray-900">{formatPeriod(period)}</h2>
                <div className="mt-2 text-sm text-gray-600">
                  Registered: {getRegisteredChildrenForPeriod(period).length} children
                  {getVolunteerForPeriod(period) && (
                    <span className="ml-4 text-green-600">
                      Volunteer: {guardians.find(g => g.id === getVolunteerForPeriod(period).guardianId)?.firstName}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="divide-y divide-gray-200">
                {periodSchedules.map((item) => (
                  <div key={item.schedule.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">
                          {item.classTeachingRequest.className}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                          Teacher: {item.teacher.firstName} {item.teacher.lastName}
                          {item.classTeachingRequest.coTeacher && (
                            <span> & {item.classTeachingRequest.coTeacher}</span>
                          )}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          Room: {item.classroom.name} | Grade Range: {item.classTeachingRequest.gradeRange}
                        </p>
                        <p className="mt-2 text-gray-700">
                          {item.classTeachingRequest.description}
                        </p>
                        {item.classTeachingRequest.requiresFee && (
                          <p className="mt-2 text-sm text-red-600">
                            <strong>Fee Required:</strong> ${item.classTeachingRequest.feeAmount}
                          </p>
                        )}
                      </div>
                      
                      <div className="ml-6 flex-shrink-0">
                        <div className="text-right mb-4">
                          <p className="text-sm text-gray-600">
                            {item.currentRegistrations} / {item.classTeachingRequest.maxStudents} students
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {item.availableSpots} spots available
                          </p>
                        </div>
                        
                        {/* Child Registration Controls */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-900">Register Children:</h4>
                          {children.map((child) => {
                            const isRegistered = registrations[period]?.[child.id] === item.schedule.id
                            const isRegisteredElsewhere = registrations[period]?.[child.id] && registrations[period][child.id] !== item.schedule.id
                            
                            return (
                              <div key={child.id} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`${item.schedule.id}-${child.id}`}
                                  checked={isRegistered}
                                  disabled={isRegisteredElsewhere || item.availableSpots <= 0}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      handleChildRegistration(period, child.id, item.schedule.id)
                                    } else {
                                      removeChildRegistration(period, child.id)
                                    }
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label 
                                  htmlFor={`${item.schedule.id}-${child.id}`}
                                  className={`text-sm ${isRegisteredElsewhere ? 'text-gray-400' : 'text-gray-700'}`}
                                >
                                  {child.firstName} {child.lastName} (Grade {child.grade})
                                </label>
                              </div>
                            )
                          })}
                        </div>
                        
                        {/* Volunteer Assignment Controls */}
                        {item.classTeachingRequest.helpersNeeded > 0 && (
                          <div className="mt-4 space-y-2">
                            <h4 className="text-sm font-medium text-gray-900">Volunteer as Helper:</h4>
                            {guardians.map((guardian) => {
                              const isAssigned = volunteerAssignments[period]?.guardianId === guardian.id && volunteerAssignments[period]?.scheduleId === item.schedule.id
                              const isAssignedElsewhere = volunteerAssignments[period]?.guardianId === guardian.id && volunteerAssignments[period]?.scheduleId !== item.schedule.id
                              
                              return (
                                <div key={guardian.id} className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    name={`volunteer-${period}`}
                                    id={`volunteer-${item.schedule.id}-${guardian.id}`}
                                    checked={isAssigned}
                                    disabled={isAssignedElsewhere}
                                    onChange={() => {
                                      if (isAssigned) {
                                        removeVolunteerAssignment(period)
                                      } else {
                                        handleVolunteerAssignment(period, guardian.id, item.schedule.id, 'helper')
                                      }
                                    }}
                                    className="border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <label 
                                    htmlFor={`volunteer-${item.schedule.id}-${guardian.id}`}
                                    className="text-sm text-gray-700"
                                  >
                                    {guardian.firstName} {guardian.lastName}
                                  </label>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}