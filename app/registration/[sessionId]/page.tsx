'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { isAfter, isBefore, parseISO, format } from 'date-fns'
import { useUserSession } from '@/lib/user-session'
import RegistrationGrid from '@/app/components/RegistrationGrid'
import VolunteerHourCounter from '@/app/components/VolunteerHourCounter'
import ReadonlyScheduleView from '@/app/components/ReadonlyScheduleView'

interface ClassSession {
  id: string
  name: string
  startDate: string
  endDate: string
  registrationStartDate: string
  registrationEndDate: string
  teacherRegistrationStartDate?: string
  isActive: boolean
  description?: string
}

export default function RegistrationPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { data: authSession, status } = useSession()
  const { isTeacher } = useUserSession()
  const router = useRouter()
  const [classSessionInfo, setClassSessionInfo] = useState<ClassSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string>('')
  const [registrationStatus, setRegistrationStatus] = useState<any>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [registrationAccess, setRegistrationAccess] = useState<{
    canRegister: boolean
    isTeacher: boolean
    reason?: string
    teacherEarlyAccess?: boolean
  }>({ canRegister: false, isTeacher: false })
  const [familyHasTeacher, setFamilyHasTeacher] = useState(false)

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

    fetchSessionInfo()
  }, [authSession, sessionId, status, router])

  const fetchSessionInfo = async () => {
    try {
      const [sessionRes, statusRes, earlyAccessRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/registration/family-status?sessionId=${sessionId}`),
        fetch(`/api/registration/early-access?sessionId=${sessionId}`)
      ])
      
      let sessionData = null
      if (sessionRes.ok) {
        sessionData = await sessionRes.json()
        setClassSessionInfo(sessionData.session)
      }
      
      let statusData = null
      if (statusRes.ok) {
        statusData = await statusRes.json()
        setRegistrationStatus(statusData)
      }

      let earlyAccessData = null
      if (earlyAccessRes.ok) {
        earlyAccessData = await earlyAccessRes.json()
        setFamilyHasTeacher(earlyAccessData.hasEarlyAccess)
      }

      // Check registration window access
      if (sessionData?.session) {
        const now = new Date()
        const session = sessionData.session
        const hasTeacherInFamily = earlyAccessData?.hasEarlyAccess || false
        
        const registrationStart = parseISO(session.registrationStartDate)
        const registrationEnd = parseISO(session.registrationEndDate)
        const teacherEarlyStart = session.teacherRegistrationStartDate ? parseISO(session.teacherRegistrationStartDate) : null

        let canRegister = false
        let reason = ''
        let teacherEarlyAccess = false

        // Check if we're in the regular registration window
        if (isAfter(now, registrationStart) && isBefore(now, registrationEnd)) {
          canRegister = true
        }
        // Check if we're in the teacher early access window
        else if (hasTeacherInFamily && teacherEarlyStart && isAfter(now, teacherEarlyStart) && isBefore(now, registrationStart)) {
          canRegister = true
          teacherEarlyAccess = true
        }
        // Determine the reason if registration is not available
        else if (isBefore(now, teacherEarlyStart || registrationStart)) {
          if (hasTeacherInFamily && teacherEarlyStart) {
            reason = `Teacher early registration opens ${format(teacherEarlyStart, 'MMM d, yyyy \'at\' h:mm a')}`
          } else {
            reason = `Registration opens ${format(registrationStart, 'MMM d, yyyy \'at\' h:mm a')}`
          }
        } else if (isAfter(now, registrationEnd)) {
          reason = `Registration closed on ${format(registrationEnd, 'MMM d, yyyy \'at\' h:mm a')}`
        }

        setRegistrationAccess({
          canRegister,
          isTeacher: hasTeacherInFamily, // Use the family teacher status instead of individual user status
          reason,
          teacherEarlyAccess
        })
      }
    } catch (error) {
      console.error('Error fetching session info:', error)
    } finally {
      setLoading(false)
      setStatusLoading(false)
    }
  }

  if (loading || statusLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading registration...</div>
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

  // Check if family is already registered
  const isRegistered = registrationStatus && (
    registrationStatus.registrationState === 'completed' || 
    registrationStatus.hasRegistrations
  )

  // Check if family has a pending admin override
  const hasPendingOverride = registrationStatus && registrationStatus.registrationState === 'admin_override'
  
  // Check if family has a denied override
  const hasDeniedOverride = registrationStatus && registrationStatus.registrationState === 'denied'

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {hasPendingOverride ? (
          // Show pending override status with readonly view
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Registration Pending Admin Approval</h1>
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Your registration is pending admin approval
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>You requested an admin override because volunteer requirements weren't fully met. Your class selections are reserved while awaiting approval.</p>
                      {registrationStatus?.status?.adminOverrideReason && (
                        <p className="mt-1"><strong>Reason:</strong> {registrationStatus.status.adminOverrideReason}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ReadonlyScheduleView 
              sessionId={sessionId}
              classRegistrations={registrationStatus.classRegistrations || []}
              volunteerAssignments={registrationStatus.volunteerAssignments || []}
            />
          </div>
        ) : hasDeniedOverride ? (
          // Show message for denied overrides
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Registration Override Denied</h1>
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Your registration override request has been denied
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>You must fulfill the volunteer requirements before registering for classes.</p>
                      {registrationStatus?.status?.adminOverrideReason && (
                        <p className="mt-1"><strong>Reason:</strong> {registrationStatus.status.adminOverrideReason}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {classSessionInfo && (
              <div className="mb-8 bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{classSessionInfo.name}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <p><strong>Session Dates:</strong> {new Date(classSessionInfo.startDate).toLocaleDateString()} - {new Date(classSessionInfo.endDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p><strong>Registration Period:</strong> {new Date(classSessionInfo.registrationStartDate).toLocaleDateString()} - {new Date(classSessionInfo.registrationEndDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Volunteer Hour Counter */}
            <VolunteerHourCounter />

            <RegistrationGrid sessionId={sessionId} />
          </div>
        ) : isRegistered ? (
          // Show readonly view for registered families
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Your Registration</h1>
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Registration Complete
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>Your family is already registered for this session. You can view your schedule and roster below.</p>
                      {registrationStatus.registrationState === 'admin_override' && (
                        <p className="mt-1 font-medium">Note: Your registration is pending admin approval due to volunteer hour requirements.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ReadonlyScheduleView 
              sessionId={sessionId}
              classRegistrations={registrationStatus.classRegistrations || []}
              volunteerAssignments={registrationStatus.volunteerAssignments || []}
            />
          </div>
        ) : !registrationAccess.canRegister ? (
          // Show registration not available message
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Class Registration</h1>
            </div>

            {classSessionInfo && (
              <div className="mb-8 bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{classSessionInfo.name}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <p><strong>Session Dates:</strong> {format(parseISO(classSessionInfo.startDate), 'MMM d, yyyy')} - {format(parseISO(classSessionInfo.endDate), 'MMM d, yyyy')}</p>
                  </div>
                  <div>
                    <p><strong>Registration Period:</strong> {format(parseISO(classSessionInfo.registrationStartDate), 'MMM d, yyyy')} - {format(parseISO(classSessionInfo.registrationEndDate), 'MMM d, yyyy')}</p>
                  </div>
                  {classSessionInfo.teacherRegistrationStartDate && (
                    <div>
                      <p><strong>Teacher Early Access:</strong> {format(parseISO(classSessionInfo.teacherRegistrationStartDate), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Registration Status Message */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Registration Not Available
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>{registrationAccess.reason}</p>
                    {registrationAccess.isTeacher && classSessionInfo?.teacherRegistrationStartDate && (
                      <p className="mt-1 font-medium">
                        Your family has early access (teacher in family) starting {format(parseISO(classSessionInfo.teacherRegistrationStartDate), 'MMM d, yyyy \'at\' h:mm a')}.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Show normal registration interface
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Class Registration</h1>
              <p className="mt-2 text-gray-600">Click on any available class to register your children.</p>
              {registrationAccess.teacherEarlyAccess && (
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Family Teacher Early Access
                </div>
              )}
            </div>

            {classSessionInfo && (
              <div className="mb-8 bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{classSessionInfo.name}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <p><strong>Session Dates:</strong> {format(parseISO(classSessionInfo.startDate), 'MMM d, yyyy')} - {format(parseISO(classSessionInfo.endDate), 'MMM d, yyyy')}</p>
                  </div>
                  <div>
                    <p><strong>Registration Period:</strong> {format(parseISO(classSessionInfo.registrationStartDate), 'MMM d, yyyy')} - {format(parseISO(classSessionInfo.registrationEndDate), 'MMM d, yyyy')}</p>
                  </div>
                  {classSessionInfo.teacherRegistrationStartDate && (
                    <div>
                      <p><strong>Teacher Early Access:</strong> {format(parseISO(classSessionInfo.teacherRegistrationStartDate), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Volunteer Hour Counter */}
            <VolunteerHourCounter />

            <RegistrationGrid sessionId={sessionId} />
          </div>
        )}
      </div>
    </div>
  )
}