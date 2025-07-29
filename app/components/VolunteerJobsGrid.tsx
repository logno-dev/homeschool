'use client'

import { useState } from 'react'
import Modal from './Modal'
import { useToast } from './ToastContainer'
import { useRegistration } from './RegistrationContext'

interface VolunteerJob {
  id: string
  sessionVolunteerJobId: string
  title: string
  description: string
  quantityAvailable: number
  jobType: string
  isActive: boolean
}

interface Guardian {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface VolunteerJobsGridProps {
  volunteerJobs: VolunteerJob[]
  guardians: Guardian[]
  schedules?: any[] // Teaching assignments data for conflict detection
}

const PERIODS = [
  { id: 1, name: 'Period 1' },
  { id: 2, name: 'Period 2' },
  { id: 3, name: 'Period 3' }
]

export default function VolunteerJobsGrid({ volunteerJobs, guardians, schedules = [] }: VolunteerJobsGridProps) {
  const { showSuccess, showError } = useToast()
  const { 
    addVolunteerAssignment, 
    getVolunteerAssignmentForPeriod,
    hasGuardianConflictInPeriod,
    getGuardianConflictDetails
  } = useRegistration()
  
  const [selectedJob, setSelectedJob] = useState<VolunteerJob | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [showVolunteerModal, setShowVolunteerModal] = useState(false)

  // Transform schedules data into teaching assignments for conflict detection
  const teachingAssignments = schedules.map(schedule => ({
    guardianId: schedule.teacher.id,
    period: schedule.schedule.period,
    className: schedule.classTeachingRequest.className,
    volunteerType: 'teacher'
  }))

  const handleJobClick = (job: VolunteerJob, period: number) => {
    setSelectedJob(job)
    setSelectedPeriod(period.toString())
    setShowVolunteerModal(true)
  }

  const handleVolunteerAssignment = (guardian: Guardian) => {
    if (!selectedJob || !selectedPeriod) return

    // Check for conflicts before adding assignment
    if (hasGuardianConflictInPeriod(guardian.id, selectedPeriod, teachingAssignments)) {
      const conflictDetails = getGuardianConflictDetails(guardian.id, selectedPeriod, teachingAssignments)
      showError('Conflict detected!', `${guardian.firstName} ${guardian.lastName} is already assigned: ${conflictDetails}`)
      return
    }

    addVolunteerAssignment({
      sessionVolunteerJobId: selectedJob.sessionVolunteerJobId,
      guardianId: guardian.id,
      period: selectedPeriod,
      volunteerType: 'volunteer_job',
      jobTitle: selectedJob.title,
      guardianName: `${guardian.firstName} ${guardian.lastName}`
    })
    
    showSuccess('Added to cart!', `${guardian.firstName} ${guardian.lastName} added as volunteer for ${selectedJob.title}`)
    setShowVolunteerModal(false)
    setSelectedJob(null)
    setSelectedPeriod('')
  }

  if (volunteerJobs.length === 0) {
    return null
  }

  return (
    <>
      <div className="mt-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Volunteer Jobs</h2>
          <p className="mt-2 text-gray-600">Click on any available volunteer job to sign up a parent/guardian.</p>
        </div>

        {/* Desktop Table View - Hidden on mobile */}
        <div className="hidden lg:block bg-white rounded-lg shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Volunteer Job
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
                {volunteerJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{job.title}</div>
                      <div className="text-sm text-gray-500">{job.description}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {job.quantityAvailable} position{job.quantityAvailable === 1 ? '' : 's'} per period
                      </div>
                    </td>
                    {PERIODS.map((period) => {
                      const currentAssignment = getVolunteerAssignmentForPeriod(period.id.toString())
                      const isAssigned = currentAssignment && currentAssignment.sessionVolunteerJobId === job.sessionVolunteerJobId
                      
                      return (
                        <td key={period.id} className="px-6 py-4 whitespace-nowrap">
                          <div
                            onClick={() => !isAssigned && handleJobClick(job, period.id)}
                            className={`rounded-md p-3 transition-colors border ${
                              isAssigned
                                ? 'bg-green-50 border-green-200'
                                : 'bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer'
                            }`}
                          >
                            {isAssigned ? (
                              <div className="text-center">
                                <div className="text-sm font-medium text-green-800">
                                  {currentAssignment.guardianName}
                                </div>
                                <div className="text-xs text-green-600">Assigned</div>
                              </div>
                            ) : (
                              <div className="text-center">
                                <div className="text-sm font-medium text-blue-800">Available</div>
                                <div className="text-xs text-blue-600">Click to assign</div>
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {volunteerJobs.length === 0 && (
                  <tr>
                    <td colSpan={PERIODS.length + 1} className="px-6 py-4 text-center text-gray-500">
                      No volunteer jobs available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View - Visible only on mobile */}
        <div className="lg:hidden space-y-6">
          {volunteerJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow border overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{job.description}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {job.quantityAvailable} position{job.quantityAvailable === 1 ? '' : 's'} per period
                </p>
              </div>
              
              <div className="p-4 space-y-4">
                {PERIODS.map((period) => {
                  const currentAssignment = getVolunteerAssignmentForPeriod(period.id.toString())
                  const isAssigned = currentAssignment && currentAssignment.sessionVolunteerJobId === job.sessionVolunteerJobId
                  
                  return (
                    <div key={period.id} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 border-b">
                        <h4 className="text-sm font-medium text-gray-900">{period.name}</h4>
                      </div>
                      <div className="p-3">
                        <div
                          onClick={() => !isAssigned && handleJobClick(job, period.id)}
                          className={`rounded-md p-4 transition-colors border-2 ${
                            isAssigned
                              ? 'bg-green-50 border-green-200'
                              : 'bg-blue-50 border-blue-200 active:bg-blue-100 cursor-pointer touch-manipulation'
                          }`}
                        >
                          {isAssigned ? (
                            <div className="text-center">
                              <div className="text-base font-medium text-green-800 mb-1">
                                {currentAssignment.guardianName}
                              </div>
                              <div className="text-sm text-green-600">✓ Assigned</div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <div className="text-base font-medium text-blue-800 mb-1">Available</div>
                              <div className="text-sm text-blue-600">Tap to assign volunteer →</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          
          {volunteerJobs.length === 0 && (
            <div className="bg-white rounded-lg shadow border p-6 text-center">
              <p className="text-gray-500">No volunteer jobs available.</p>
            </div>
          )}
        </div>
      </div>

      {/* Volunteer Selection Modal */}
      <Modal
        isOpen={showVolunteerModal}
        onClose={() => {
          setShowVolunteerModal(false)
          setSelectedJob(null)
          setSelectedPeriod('')
        }}
        title="Select Volunteer"
        size="md"
      >
        {selectedJob && selectedPeriod && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedJob.title}</h3>
              <p className="text-sm text-gray-600 mb-2">{selectedJob.description}</p>
              <p className="text-sm text-gray-500">
                Period: <strong>{PERIODS.find(p => p.id.toString() === selectedPeriod)?.name}</strong>
              </p>
            </div>
            
            <p className="text-sm text-gray-600">
              Select a guardian to volunteer for this job during <strong>{PERIODS.find(p => p.id.toString() === selectedPeriod)?.name}</strong>.
            </p>
            
            <div className="space-y-3">
              {guardians && guardians
                .filter(guardian => {
                  const currentAssignment = getVolunteerAssignmentForPeriod(selectedPeriod)
                  return !currentAssignment || currentAssignment.guardianId !== guardian.id
                })
                .map((guardian) => {
                  const hasConflict = hasGuardianConflictInPeriod(guardian.id, selectedPeriod, teachingAssignments)
                  const conflictDetails = hasConflict ? getGuardianConflictDetails(guardian.id, selectedPeriod, teachingAssignments) : null
                  
                  return (
                    <div key={guardian.id} className={`flex items-center justify-between p-3 border rounded-lg ${hasConflict ? 'bg-red-50 border-red-200' : 'hover:bg-gray-50'}`}>
                      <div>
                        <p className={`font-medium ${hasConflict ? 'text-red-900' : 'text-gray-900'}`}>
                          {guardian.firstName} {guardian.lastName}
                        </p>
                        <p className={`text-sm ${hasConflict ? 'text-red-600' : 'text-gray-500'}`}>
                          {guardian.email}
                        </p>
                        {hasConflict && (
                          <p className="text-xs text-red-600 mt-1">
                            Conflict: {conflictDetails}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleVolunteerAssignment(guardian)}
                        disabled={hasConflict}
                        className={`px-3 py-1 rounded-md transition-colors text-sm ${
                          hasConflict 
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {hasConflict ? 'Conflict' : 'Assign'}
                      </button>
                    </div>
                  )
                })}
              
              {(!guardians || guardians.filter(guardian => {
                const currentAssignment = getVolunteerAssignmentForPeriod(selectedPeriod)
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
    </>
  )
}