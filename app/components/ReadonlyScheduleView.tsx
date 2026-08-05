'use client'

interface SessionInfo {
  id: string
  name: string
  startDate: string
  endDate: string
  registrationStartDate: string
  registrationEndDate: string
}

interface ClassRegistration {
  registration: {
    id: string
    childId: string
    status: string
  }
  schedule: {
    id: string
    period: string
  }
  classTeachingRequest: {
    className: string
    description: string
    gradeRange: string
  }
  classroom: {
    name: string
  }
  child: {
    firstName: string
    lastName: string
    grade: string
  }
}

interface VolunteerAssignment {
  assignment: {
    id: string
    period: string
    volunteerType: string
  }
  schedule?: {
    id: string
    period: string
  }
  classTeachingRequest?: {
    className: string
  }
  volunteerJob?: {
    title: string
  } | null
  classroom?: {
    name: string
  }
}

interface ReadonlyScheduleViewProps {
  sessionId: string
  classRegistrations: ClassRegistration[]
  volunteerAssignments: VolunteerAssignment[]
  sessionInfo?: SessionInfo | null
}

const PERIODS = [
  { id: 'first', name: 'First Period' },
  { id: 'second', name: 'Second Period' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'third', name: 'Third Period' }
]

export default function ReadonlyScheduleView({ 
  sessionId, 
  classRegistrations, 
  volunteerAssignments,
  sessionInfo
}: ReadonlyScheduleViewProps) {

  // Group registrations by period
  const registrationsByPeriod = classRegistrations.reduce((acc, reg) => {
    const period = reg.schedule.period
    if (!acc[period]) acc[period] = []
    acc[period].push(reg)
    return acc
  }, {} as Record<string, ClassRegistration[]>)

  // Group volunteer assignments by period
  const volunteersByPeriod = volunteerAssignments.reduce((acc, vol) => {
    const period = vol.assignment.period
    if (!acc[period]) acc[period] = []
    acc[period].push(vol)
    return acc
  }, {} as Record<string, VolunteerAssignment[]>)

  return (
    <div className="space-y-6">
      {/* Session Information */}
      {sessionInfo && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{sessionInfo.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p><strong>Session Dates:</strong> {new Date(sessionInfo.startDate).toLocaleDateString()} - {new Date(sessionInfo.endDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p><strong>Registration Period:</strong> {new Date(sessionInfo.registrationStartDate).toLocaleDateString()} - {new Date(sessionInfo.registrationEndDate).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Family Schedule */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Your Family's Schedule</h3>
          <p className="text-sm text-gray-600 mt-1">Classes and volunteer assignments for this session</p>
        </div>

        {/* Desktop/tablet */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Class Registrations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Volunteer Assignments
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {PERIODS.map((period) => {
                const classRegs = registrationsByPeriod[period.id] || []
                const volunteers = volunteersByPeriod[period.id] || []
                return (
                  <tr key={period.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{period.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      {classRegs.length > 0 ? (
                        <div className="space-y-2">
                          {classRegs.map((reg) => (
                            <div key={reg.registration.id} className="bg-blue-50 rounded-md p-3">
                              <h4 className="font-medium text-blue-900 text-sm">
                                {reg.classTeachingRequest.className}
                              </h4>
                              <p className="text-xs text-blue-700">
                                {reg.child.firstName} {reg.child.lastName} (Grade {reg.child.grade})
                              </p>
                              <p className="text-xs text-blue-700">
                                Room: {reg.classroom.name}
                              </p>
                              <p className="text-xs text-blue-600">
                                Grade Range: {reg.classTeachingRequest.gradeRange}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400 italic">No classes registered</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {volunteers.length > 0 ? (
                        <div className="space-y-2">
                          {volunteers.map((vol) => (
                            <div key={vol.assignment.id} className="bg-green-50 rounded-md p-3">
                              <h4 className="font-medium text-green-900 text-sm">
                                {vol.assignment.volunteerType === 'volunteer_job'
                                  ? vol.volunteerJob?.title || 'General Volunteer'
                                  : vol.classTeachingRequest?.className || 'General Volunteer'}
                              </h4>
                              <p className="text-xs text-green-700">
                                Role: {vol.assignment.volunteerType}
                              </p>
                              {vol.classroom && (
                                <p className="text-xs text-green-700">
                                  Room: {vol.classroom.name}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400 italic">No volunteer assignments</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden">
          <div className="divide-y divide-gray-200">
            {PERIODS.map((period) => {
              const classRegs = registrationsByPeriod[period.id] || []
              const volunteers = volunteersByPeriod[period.id] || []
              return (
                <div key={period.id} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-900">{period.name}</h3>
                    <span className="text-xs text-gray-500">
                      {classRegs.length} class{classRegs.length === 1 ? '' : 'es'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Class Registrations</h4>
                      {classRegs.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {classRegs.map((reg) => (
                            <div key={reg.registration.id} className="bg-blue-50 rounded-md p-3">
                              <h5 className="font-medium text-blue-900 text-sm">
                                {reg.classTeachingRequest.className}
                              </h5>
                              <p className="text-xs text-blue-700">
                                {reg.child.firstName} {reg.child.lastName} (Grade {reg.child.grade})
                              </p>
                              <p className="text-xs text-blue-700">Room: {reg.classroom.name}</p>
                              <p className="text-xs text-blue-600">Grade Range: {reg.classTeachingRequest.gradeRange}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-400 italic">No classes registered</p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Volunteer Assignments</h4>
                      {volunteers.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {volunteers.map((vol) => (
                            <div key={vol.assignment.id} className="bg-green-50 rounded-md p-3">
                              <h5 className="font-medium text-green-900 text-sm">
                                {vol.assignment.volunteerType === 'volunteer_job'
                                  ? vol.volunteerJob?.title || 'General Volunteer'
                                  : vol.classTeachingRequest?.className || 'General Volunteer'}
                              </h5>
                              <p className="text-xs text-green-700">Role: {vol.assignment.volunteerType}</p>
                              {vol.classroom && <p className="text-xs text-green-700">Room: {vol.classroom.name}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-400 italic">No volunteer assignments</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Class Registrations</h4>
            <p className="text-sm text-gray-600">
              {classRegistrations.length} child{classRegistrations.length === 1 ? '' : 'ren'} registered for classes
            </p>
            {classRegistrations.length > 0 && (
              <ul className="mt-2 text-sm text-gray-600">
                {classRegistrations.map((reg) => (
                  <li key={reg.registration.id}>
                    • {reg.child.firstName} {reg.child.lastName} - {reg.classTeachingRequest.className}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Volunteer Commitments</h4>
            <p className="text-sm text-gray-600">
              {volunteerAssignments.length} volunteer assignment{volunteerAssignments.length === 1 ? '' : 's'}
            </p>
            {volunteerAssignments.length > 0 && (
              <ul className="mt-2 text-sm text-gray-600">
                {volunteerAssignments.map((vol) => (
                  <li key={vol.assignment.id}>
                    • {vol.assignment.volunteerType === 'volunteer_job'
                      ? vol.volunteerJob?.title || 'General Volunteer'
                      : vol.classTeachingRequest?.className || 'General Volunteer'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
