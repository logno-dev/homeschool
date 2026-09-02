export const runtime = 'nodejs'

import { isAfter, isBefore, parseISO, format } from 'date-fns'
import { redirect } from 'next/navigation'
import { checkAdminRole, getAuthenticatedUser } from '@/lib/server-auth'
import { getSessionById } from '@/lib/database'
import { userBelongsToGroup, getRegistrationAccess } from '@/lib/user-groups'
import { getRegistrationStatus } from '@/lib/registration-status'
import { RegistrationProvider } from '@/app/components/RegistrationContext'
import RegistrationGrid from '@/app/components/RegistrationGrid'
import VolunteerHourCounter from '@/app/components/VolunteerHourCounter'
import ReadonlyScheduleView from '@/app/components/ReadonlyScheduleView'
import { getRegistrationScheduleBundle } from '@/lib/registration'
import Link from 'next/link'
import { db } from '@/lib/db'
import { sessionFeeConfigs } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export default async function RegistrationPage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ modify?: string }> }) {
  const session = await getAuthenticatedUser()
  const { sessionId } = await params
  const { modify } = await searchParams
  const [sessionData, registrationStatus, hasEarlyAccess, groupRegistrationAccess, scheduleBundle, isStaffAdmin, feeConfig] = await Promise.all([
    getSessionById(sessionId),
    getRegistrationStatus(sessionId, session.user.id),
    userBelongsToGroup(session.user.id, 'teacher'),
    getRegistrationAccess(sessionId, session.user.id),
    getRegistrationScheduleBundle(sessionId, session.user.id),
    checkAdminRole(session),
    db.select({ costBreakdown: sessionFeeConfigs.costBreakdown }).from(sessionFeeConfigs).where(eq(sessionFeeConfigs.sessionId, sessionId)).limit(1).then((rows) => rows[0] || null)
  ])

  if (!session?.user?.id) {
    redirect('/signin')
  }

  const classSessionInfo = sessionData
  const hasTeacherInFamily = hasEarlyAccess
  const now = new Date()
  const registrationStart = classSessionInfo ? parseISO(classSessionInfo.registrationStartDate) : null
  const registrationEnd = classSessionInfo ? parseISO(classSessionInfo.registrationEndDate) : null
  const teacherEarlyStart = classSessionInfo?.teacherRegistrationStartDate
    ? parseISO(classSessionInfo.teacherRegistrationStartDate)
    : null

  let canRegister = false
  let reason = ''
  let teacherEarlyAccess = false

  if (registrationStart && registrationEnd) {
    if (isAfter(now, registrationStart) && isBefore(now, registrationEnd)) {
      canRegister = true
    } else if (hasTeacherInFamily && teacherEarlyStart && isAfter(now, teacherEarlyStart) && isBefore(now, registrationStart)) {
      canRegister = true
      teacherEarlyAccess = true
    } else if (isBefore(now, teacherEarlyStart || registrationStart)) {
      if (hasTeacherInFamily && teacherEarlyStart) {
        reason = `Teacher early registration opens ${format(teacherEarlyStart, 'MMM d, yyyy \'at\' h:mm a')}`
      } else {
        reason = `Registration opens ${format(registrationStart, 'MMM d, yyyy \'at\' h:mm a')}`
      }
    } else if (isAfter(now, registrationEnd)) {
      reason = `Registration closed on ${format(registrationEnd, 'MMM d, yyyy \'at\' h:mm a')}`
    }
  }

  canRegister = groupRegistrationAccess.isOpen
  reason = groupRegistrationAccess.reason || ''
  teacherEarlyAccess = groupRegistrationAccess.group?.slug === 'teacher'

  if (isStaffAdmin) {
    canRegister = Boolean(classSessionInfo?.isActive && scheduleBundle.schedules.length > 0)
    reason = canRegister ? '' : 'No active session or published schedule is available.'
  }

  const registrationAccess = {
    canRegister,
    isTeacher: hasTeacherInFamily,
    reason,
    teacherEarlyAccess
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
  const isModifying = modify === '1'
  const editableRegistrations = registrationStatus.classRegistrations.map((entry) => {
    const schedule = scheduleBundle.schedules.find((item) => item.schedule.id === entry.registration.scheduleId)
    return {
      childId: entry.registration.childId,
      scheduleId: entry.registration.scheduleId,
      period: entry.schedule.period,
      className: entry.classTeachingRequest.className,
      teacher: schedule ? `${schedule.teacher.firstName} ${schedule.teacher.lastName}` : '',
      classroom: entry.classroom.name,
      status: entry.registration.status === 'waitlisted' ? 'waitlisted' as const : 'registered' as const
    }
  })
  const editableVolunteerAssignments = registrationStatus.volunteerAssignments.map((entry) => ({
    guardianId: entry.assignment.guardianId,
    guardianName: scheduleBundle.guardians.find((guardian) => guardian.id === entry.assignment.guardianId)
      ? `${scheduleBundle.guardians.find((guardian) => guardian.id === entry.assignment.guardianId)?.firstName} ${scheduleBundle.guardians.find((guardian) => guardian.id === entry.assignment.guardianId)?.lastName}`
      : 'Guardian',
    period: entry.assignment.period,
    volunteerType: entry.assignment.volunteerType,
    scheduleId: entry.assignment.scheduleId || undefined,
    volunteerJobId: entry.assignment.volunteerJobId || undefined,
    className: entry.classTeachingRequest?.className || undefined,
    classroom: entry.classroom?.name || undefined,
    jobTitle: entry.volunteerJob?.title || undefined
  }))
  const editableEmergencyContacts = Object.fromEntries(
    registrationStatus.classRegistrations.map((entry) => [entry.registration.childId, {
      name: entry.registration.emergencyContact || '',
      phone: entry.registration.emergencyPhone || ''
    }])
  )

  return (
    <div className="min-h-screen bg-gray-50 py-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {hasPendingOverride && !isModifying ? (
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
                       <Link href={`/registration/${sessionId}?modify=1`} className="mt-3 inline-flex rounded-md bg-yellow-600 px-3 py-2 font-medium text-white hover:bg-yellow-700">Modify Registration</Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ReadonlyScheduleView 
               sessionId={sessionId}
               classRegistrations={registrationStatus.classRegistrations || []}
              volunteerAssignments={registrationStatus.volunteerAssignments || []}
              sessionInfo={classSessionInfo}
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

             <RegistrationProvider
               teachingAssignments={scheduleBundle.teachingAssignments}
               sessionId={sessionId}
               initialRegistrations={isModifying ? editableRegistrations : scheduleBundle.initialRegistrations}
               initialVolunteerAssignments={isModifying ? editableVolunteerAssignments : scheduleBundle.initialVolunteerAssignments}
            >
              {/* Volunteer Hour Counter */}
              <VolunteerHourCounter teachingAssignments={scheduleBundle.teachingAssignments} />

              <RegistrationGrid
                sessionId={sessionId}
                schedules={scheduleBundle.schedules}
                guardians={scheduleBundle.guardians}
                children={scheduleBundle.children}
                volunteerJobs={scheduleBundle.volunteerJobs}
                nonPeriodVolunteerJobs={scheduleBundle.nonPeriodVolunteerJobs}
                teachingAssignments={scheduleBundle.teachingAssignments}
                 volunteerJobAssignmentCounts={scheduleBundle.volunteerJobAssignmentCounts}
                 costBreakdown={feeConfig?.costBreakdown}
                 modifyRegistration={isModifying}
                 preserveAdminOverride={registrationStatus.registrationState === 'admin_override'}
                 initialEmergencyContacts={isModifying ? editableEmergencyContacts : undefined}
              />
            </RegistrationProvider>
          </div>
        ) : isRegistered && !isModifying ? (
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
                       <div className="mt-3 flex flex-wrap gap-2">
                         <Link href={`/schedule?sessionId=${sessionId}`} className="inline-flex rounded-md border border-green-300 bg-white px-3 py-2 font-medium text-green-700 hover:bg-green-50">View Schedule</Link>
                         <Link href={`/registration/${sessionId}?modify=1`} className="inline-flex rounded-md bg-green-600 px-3 py-2 font-medium text-white hover:bg-green-700">Modify Registration</Link>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ReadonlyScheduleView 
              sessionId={sessionId}
              classRegistrations={registrationStatus.classRegistrations || []}
              volunteerAssignments={registrationStatus.volunteerAssignments || []}
              sessionInfo={classSessionInfo}
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
                    <Link href={`/schedule?sessionId=${sessionId}`} className="mt-3 inline-flex rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">View session schedule</Link>
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
              <h1 className="text-3xl font-bold text-gray-900">{isModifying ? 'Modify Registration' : 'Class Registration'}</h1>
              <p className="mt-2 text-gray-600">{isModifying ? 'Update your class selections and volunteer assignments, then submit the changes.' : 'Click on any available class to register your children.'}</p>
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

             <RegistrationProvider
               teachingAssignments={scheduleBundle.teachingAssignments}
               sessionId={sessionId}
               modifyMode={isModifying}
               initialRegistrations={isModifying ? editableRegistrations : scheduleBundle.initialRegistrations}
               initialVolunteerAssignments={isModifying ? editableVolunteerAssignments : scheduleBundle.initialVolunteerAssignments}
            >
              {/* Volunteer Hour Counter */}
              <VolunteerHourCounter teachingAssignments={scheduleBundle.teachingAssignments} />

              <RegistrationGrid
                sessionId={sessionId}
                schedules={scheduleBundle.schedules}
                guardians={scheduleBundle.guardians}
                children={scheduleBundle.children}
                volunteerJobs={scheduleBundle.volunteerJobs}
                nonPeriodVolunteerJobs={scheduleBundle.nonPeriodVolunteerJobs}
                teachingAssignments={scheduleBundle.teachingAssignments}
                 volunteerJobAssignmentCounts={scheduleBundle.volunteerJobAssignmentCounts}
                 costBreakdown={feeConfig?.costBreakdown}
                 modifyRegistration={isModifying}
                 preserveAdminOverride={registrationStatus.registrationState === 'admin_override'}
                 initialEmergencyContacts={isModifying ? editableEmergencyContacts : undefined}
              />
            </RegistrationProvider>
          </div>
        )}
      </div>
    </div>
  )
}
