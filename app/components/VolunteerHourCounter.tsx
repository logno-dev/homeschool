'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRegistration } from './RegistrationContext'

interface TeachingAssignment {
  guardianId: string
  period: string
  className: string
  volunteerType: string
  guardianName?: string
}

export default function VolunteerHourCounter() {
  const { data: session } = useSession()
  const { 
    pendingRegistrations,
    pendingVolunteerAssignments
  } = useRegistration()
  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([])

  useEffect(() => {
    if (session?.user?.id) {
      fetchTeachingAssignments()
    }
  }, [session?.user?.id])

  const fetchTeachingAssignments = async () => {
    try {
      // Get current session ID from URL or context
      const pathSegments = window.location.pathname.split('/')
      const sessionId = pathSegments[pathSegments.indexOf('registration') + 1]
      
      if (!sessionId) return

      // Fetch both schedules and family status to get family guardian info
      const [schedulesResponse, statusResponse] = await Promise.all([
        fetch(`/api/registration/schedules/${sessionId}`),
        fetch(`/api/registration/family-status?sessionId=${sessionId}`)
      ])

      if (schedulesResponse.ok && statusResponse.ok) {
        const schedulesData = await schedulesResponse.json()
        const statusData = await statusResponse.json()
        const schedules = schedulesData.schedules || []
        
        // Get all family guardian IDs and create a lookup map
        const familyGuardians = statusData.familyGuardians || []
        const familyGuardianIds = familyGuardians.map((g: any) => g.id)
        const guardianLookup = familyGuardians.reduce((acc: any, guardian: any) => {
          acc[guardian.id] = `${guardian.firstName} ${guardian.lastName}`
          return acc
        }, {})
        
        // Filter schedules where any family guardian is the teacher
        const familyTeachingAssignments = schedules
          .filter((schedule: any) => familyGuardianIds.includes(schedule.teacher.id))
          .map((schedule: any) => ({
            guardianId: schedule.teacher.id,
            period: schedule.schedule.period,
            className: schedule.classTeachingRequest.className,
            volunteerType: 'teacher',
            guardianName: guardianLookup[schedule.teacher.id] || 'Unknown'
          }))
        
        setTeachingAssignments(familyTeachingAssignments)
      }
    } catch (error) {
      console.error('Error fetching teaching assignments:', error)
    }
  }

  // Calculate required volunteer hours (1 hour per period with students, excluding lunch)
  const getRequiredVolunteerHours = () => {
    const periodsWithStudents = new Set(
      pendingRegistrations
        .map(r => r.period)
        .filter(period => period !== 'lunch') // Lunch doesn't count for volunteer requirements
    )
    return periodsWithStudents.size
  }

  // Calculate fulfilled volunteer hours
  const getFulfilledVolunteerHours = () => {
    // Count period-based volunteer assignments (excluding non-period jobs)
    const periodBasedHours = pendingVolunteerAssignments.filter(a => a.period !== 'non_period').length
    
    // Count non-period volunteer jobs (each counts as 1 hour regardless of period)
    const nonPeriodHours = pendingVolunteerAssignments.filter(a => a.period === 'non_period').length
    
    // Count teaching assignments (each counts as 1 hour per period)
    const teachingHours = teachingAssignments.filter(t => t.period !== 'lunch').length
    
    return periodBasedHours + nonPeriodHours + teachingHours
  }

  const requiredHours = getRequiredVolunteerHours()
  const fulfilledHours = getFulfilledVolunteerHours()
  const isComplete = fulfilledHours >= requiredHours
  const remainingHours = Math.max(0, requiredHours - fulfilledHours)

  // Always show the counter to provide guidance to users

  return (
    <div className="bg-white rounded-lg shadow border p-6 mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Volunteer Hour Requirements</h2>
          <p className="text-sm text-gray-600">
            {requiredHours > 0 
              ? "Each family must volunteer for 1 hour per period where they have students registered."
              : "Register students for classes to see your volunteer hour requirements. Each period with students requires 1 volunteer hour."
            }
          </p>
        </div>
        
        <div className="flex items-center space-x-8">
          {/* Required Hours */}
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{requiredHours}</div>
            <div className="text-sm text-gray-600">Required Hours</div>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center">
            <div className="w-16 h-16 relative">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                {/* Background circle */}
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-gray-200"
                />
                {/* Progress circle */}
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - (requiredHours > 0 ? fulfilledHours / requiredHours : 0))}`}
                  className={isComplete ? "text-green-500" : "text-blue-500"}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-semibold ${isComplete ? "text-green-600" : "text-blue-600"}`}>
                  {requiredHours > 0 ? Math.round((fulfilledHours / requiredHours) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Fulfilled Hours */}
          <div className="text-center">
            <div className={`text-3xl font-bold ${isComplete ? "text-green-600" : "text-orange-600"}`}>
              {fulfilledHours}
            </div>
            <div className="text-sm text-gray-600">Fulfilled Hours</div>
          </div>

          {/* Status Badge */}
          <div className="text-center">
            {requiredHours === 0 ? (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Register Students
              </div>
            ) : isComplete ? (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Complete
              </div>
            ) : (
              <div className="text-center">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 mb-1">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {remainingHours} More Needed
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breakdown Details */}
      {(requiredHours > 0 || pendingVolunteerAssignments.length > 0) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {/* Required Hours Breakdown */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Required Hours Breakdown:</h4>
              <div className="space-y-1 text-gray-600">
                {Array.from(new Set(pendingRegistrations.map(r => r.period).filter(p => p !== 'lunch'))).map(period => (
                  <div key={period} className="flex justify-between">
                    <span className="capitalize">{period} Period:</span>
                    <span>1 hour</span>
                  </div>
                ))}
                {requiredHours === 0 && (
                  <div className="text-gray-500 italic">No students registered yet</div>
                )}
              </div>
            </div>

            {/* Fulfilled Hours Breakdown */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Fulfilled Hours Breakdown:</h4>
              <div className="space-y-1 text-gray-600">
                {/* Teaching assignments */}
                {teachingAssignments.filter(t => t.period !== 'lunch').map((assignment, index) => (
                  <div key={`teaching-${index}`} className="flex justify-between">
                    <span className="capitalize">{assignment.period} Period ({assignment.guardianName} Teaching {assignment.className}):</span>
                    <span>1 hour</span>
                  </div>
                ))}
                {/* Volunteer assignments */}
                {pendingVolunteerAssignments.filter(a => a.period !== 'non_period').map((assignment, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="capitalize">{assignment.period} Period ({assignment.volunteerType}):</span>
                    <span>1 hour</span>
                  </div>
                ))}
                {pendingVolunteerAssignments.filter(a => a.period === 'non_period').map((assignment, index) => (
                  <div key={`non-period-${index}`} className="flex justify-between">
                    <span>General Volunteer ({assignment.jobTitle}):</span>
                    <span>1 hour</span>
                  </div>
                ))}
                {fulfilledHours === 0 && (
                  <div className="text-gray-500 italic">No volunteer assignments yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}