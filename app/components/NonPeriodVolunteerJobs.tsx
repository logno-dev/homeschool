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

interface NonPeriodVolunteerJobsProps {
  volunteerJobs: VolunteerJob[]
  guardians: Guardian[]
}

export default function NonPeriodVolunteerJobs({ volunteerJobs, guardians }: NonPeriodVolunteerJobsProps) {
  const { showSuccess } = useToast()
  const { 
    addVolunteerAssignment,
    pendingVolunteerAssignments
  } = useRegistration()
  
  const [selectedJob, setSelectedJob] = useState<VolunteerJob | null>(null)
  const [showVolunteerModal, setShowVolunteerModal] = useState(false)

  const handleJobClick = (job: VolunteerJob) => {
    setSelectedJob(job)
    setShowVolunteerModal(true)
  }

  const handleVolunteerAssignment = (guardian: Guardian) => {
    if (!selectedJob) return

    addVolunteerAssignment({
      sessionVolunteerJobId: selectedJob.sessionVolunteerJobId,
      guardianId: guardian.id,
      period: 'non_period', // Special period for non-period jobs
      volunteerType: 'volunteer_job',
      jobTitle: selectedJob.title,
      guardianName: `${guardian.firstName} ${guardian.lastName}`
    })
    
    showSuccess('Added to cart!', `${guardian.firstName} ${guardian.lastName} added as volunteer for ${selectedJob.title}`)
    setShowVolunteerModal(false)
    setSelectedJob(null)
  }

  // Get assignments for this specific job
  const getJobAssignments = (jobId: string) => {
    return pendingVolunteerAssignments.filter(assignment => 
      assignment.sessionVolunteerJobId === jobId && assignment.period === 'non_period'
    )
  }

  if (volunteerJobs.length === 0) {
    return null
  }

  return (
    <>
      <div className="mt-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">General Volunteer Opportunities</h2>
          <p className="mt-2 text-gray-600">These volunteer opportunities are not tied to specific class periods. Click on any available position to sign up a parent/guardian.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {volunteerJobs.map((job) => {
            const assignments = getJobAssignments(job.id)
            const availableSpots = job.quantityAvailable - assignments.length
            
            return (
              <div key={job.id} className="bg-white rounded-lg shadow border overflow-hidden">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{job.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{job.description}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">{availableSpots}</span> of <span className="font-medium">{job.quantityAvailable}</span> spots available
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      availableSpots > 0 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {availableSpots > 0 ? 'Available' : 'Full'}
                    </div>
                  </div>

                  {/* Show current assignments */}
                  {assignments.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Current Volunteers:</h4>
                      <div className="space-y-1">
                        {assignments.map((assignment, index) => (
                          <div key={index} className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                            {assignment.guardianName}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => handleJobClick(job)}
                    disabled={availableSpots <= 0}
                    className={`w-full py-2 px-4 rounded-md transition-colors text-sm font-medium ${
                      availableSpots > 0
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {availableSpots > 0 ? 'Volunteer for this job' : 'No spots available'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Volunteer Selection Modal */}
      <Modal
        isOpen={showVolunteerModal}
        onClose={() => {
          setShowVolunteerModal(false)
          setSelectedJob(null)
        }}
        title="Select Volunteer"
        size="md"
      >
        {selectedJob && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedJob.title}</h3>
              <p className="text-sm text-gray-600 mb-2">{selectedJob.description}</p>
              <p className="text-sm text-gray-500">
                Available spots: <strong>{selectedJob.quantityAvailable - getJobAssignments(selectedJob.id).length}</strong>
              </p>
            </div>
            
            <p className="text-sm text-gray-600">
              Select a guardian to volunteer for this position.
            </p>
            
            <div className="space-y-3">
              {guardians && guardians
                .filter(guardian => {
                  // Filter out guardians already assigned to this specific job
                  return !getJobAssignments(selectedJob.id).some(assignment => 
                    assignment.guardianId === guardian.id
                  )
                })
                .map((guardian) => (
                  <div key={guardian.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{guardian.firstName} {guardian.lastName}</p>
                      <p className="text-sm text-gray-500">{guardian.email}</p>
                    </div>
                    <button
                      onClick={() => handleVolunteerAssignment(guardian)}
                      className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      Assign
                    </button>
                  </div>
                ))}
              
              {(!guardians || guardians.filter(guardian => 
                !getJobAssignments(selectedJob.id).some(assignment => 
                  assignment.guardianId === guardian.id
                )
              ).length === 0) && (
                <p className="text-gray-500 text-center py-4">
                  No available guardians for this volunteer position.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}