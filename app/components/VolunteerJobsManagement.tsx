'use client'

import { useState, useEffect } from 'react'
import ConfirmModal from './ConfirmModal'
import Toast from './Toast'

interface VolunteerJob {
  id: string
  sessionId: string
  title: string
  description: string
  quantityAvailable: number
  jobType: 'period_based' | 'non_period'
  createdBy: string
  createdAt: string
  updatedAt: string
  createdByName: string
  createdByLastName: string
}

interface VolunteerJobsManagementProps {
  sessionId: string
}

export function VolunteerJobsManagement({ sessionId }: VolunteerJobsManagementProps) {
  const [jobs, setJobs] = useState<VolunteerJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingJob, setEditingJob] = useState<VolunteerJob | null>(null)
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ id: string; title: string; type: 'success' | 'error' } | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    quantityAvailable: 1,
    jobType: 'non_period' as 'period_based' | 'non_period'
  })

  useEffect(() => {
    fetchJobs()
  }, [sessionId])

  const fetchJobs = async () => {
    try {
      const response = await fetch(`/api/admin/volunteer-jobs?sessionId=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setJobs(data)
      } else {
        setToast({ id: 'fetch-error', title: 'Failed to fetch volunteer jobs', type: 'error' })
      }
    } catch (error) {
      setToast({ id: 'fetch-error', title: 'Error fetching volunteer jobs', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      quantityAvailable: 1,
      jobType: 'non_period'
    })
    setShowAddForm(false)
    setEditingJob(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.description.trim()) {
      setToast({ id: 'validation-error', title: 'Title and description are required', type: 'error' })
      return
    }

    if (formData.quantityAvailable < 1) {
      setToast({ id: 'validation-error', title: 'Quantity available must be at least 1', type: 'error' })
      return
    }

    try {
      const url = editingJob 
        ? `/api/admin/volunteer-jobs/${editingJob.id}`
        : '/api/admin/volunteer-jobs'
      
      const method = editingJob ? 'PUT' : 'POST'
      
      const body = editingJob 
        ? formData
        : { ...formData, sessionId }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        setToast({ 
          id: 'save-success',
          title: editingJob ? 'Volunteer job updated successfully' : 'Volunteer job created successfully', 
          type: 'success' 
        })
        resetForm()
        fetchJobs()
      } else {
        const error = await response.json()
        setToast({ id: 'save-error', title: error.error || 'Failed to save volunteer job', type: 'error' })
      }
    } catch (error) {
      setToast({ id: 'save-error', title: 'Error saving volunteer job', type: 'error' })
    }
  }

  const handleEdit = (job: VolunteerJob) => {
    setFormData({
      title: job.title,
      description: job.description,
      quantityAvailable: job.quantityAvailable,
      jobType: job.jobType
    })
    setEditingJob(job)
    setShowAddForm(true)
  }

  const handleDelete = async () => {
    if (!deleteJobId) return

    try {
      const response = await fetch(`/api/admin/volunteer-jobs/${deleteJobId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setToast({ id: 'delete-success', title: 'Volunteer job deleted successfully', type: 'success' })
        fetchJobs()
      } else {
        const error = await response.json()
        setToast({ id: 'delete-error', title: error.error || 'Failed to delete volunteer job', type: 'error' })
      }
    } catch (error) {
      setToast({ id: 'delete-error', title: 'Error deleting volunteer job', type: 'error' })
    } finally {
      setDeleteJobId(null)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading volunteer jobs...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Volunteer Jobs</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Add Volunteer Job
        </button>
      </div>

      {showAddForm && (
        <div className="bg-gray-50 p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">
            {editingJob ? 'Edit Volunteer Job' : 'Add New Volunteer Job'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Setup Crew, Cleanup Team, Registration Helper"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description & Expectations *
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the volunteer role, responsibilities, time commitment, and any special requirements..."
                required
              />
            </div>

            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                Number of Positions Available *
              </label>
              <input
                type="number"
                id="quantity"
                min="1"
                value={formData.quantityAvailable}
                onChange={(e) => setFormData({ ...formData, quantityAvailable: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.jobType === 'period_based' 
                  ? 'This is the number of positions available per period (first, second, third).'
                  : 'This is the total number of positions available for this volunteer job.'
                }
              </p>
            </div>

            <div>
              <label htmlFor="jobType" className="block text-sm font-medium text-gray-700 mb-1">
                Job Type *
              </label>
              <select
                id="jobType"
                value={formData.jobType}
                onChange={(e) => setFormData({ ...formData, jobType: e.target.value as 'period_based' | 'non_period' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="non_period">Non-Period Job</option>
                <option value="period_based">Period-Based Job</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                <strong>Period-Based:</strong> Job occurs during each class period (first, second, third). 
                <br />
                <strong>Non-Period:</strong> Job does not relate to specific class periods.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                {editingJob ? 'Update Job' : 'Create Job'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No volunteer jobs have been created yet.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Period-Based Jobs */}
          {jobs.filter(job => job.jobType === 'period_based').length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                Period-Based Jobs
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                These jobs occur during each class period (first, second, third). The quantity represents positions available per period.
              </p>
              <div className="space-y-4">
                {jobs.filter(job => job.jobType === 'period_based').map((job) => (
                  <div key={job.id} className="bg-white p-6 rounded-lg border shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">{job.title}</h4>
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            Period-Based
                          </span>
                        </div>
                        <p className="text-gray-600 mt-2 whitespace-pre-wrap">{job.description}</p>
                        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                          <span>Positions: {job.quantityAvailable} per period</span>
                          <span>Created by: {job.createdByName} {job.createdByLastName}</span>
                          <span>Created: {new Date(job.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(job)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteJobId(job.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Non-Period Jobs */}
          {jobs.filter(job => job.jobType === 'non_period').length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-500 rounded-full"></span>
                Non-Period Jobs
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                These jobs do not relate to specific class periods. The quantity represents total positions available.
              </p>
              <div className="space-y-4">
                {jobs.filter(job => job.jobType === 'non_period').map((job) => (
                  <div key={job.id} className="bg-white p-6 rounded-lg border shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">{job.title}</h4>
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            Non-Period
                          </span>
                        </div>
                        <p className="text-gray-600 mt-2 whitespace-pre-wrap">{job.description}</p>
                        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                          <span>Positions: {job.quantityAvailable}</span>
                          <span>Created by: {job.createdByName} {job.createdByLastName}</span>
                          <span>Created: {new Date(job.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(job)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteJobId(job.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {deleteJobId && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setDeleteJobId(null)}
          onConfirm={handleDelete}
          title="Delete Volunteer Job"
          message="Are you sure you want to delete this volunteer job? This action cannot be undone."
          confirmText="Delete"
          confirmVariant="danger"
        />
      )}

      {toast && (
        <Toast
          id={toast.id}
          title={toast.title}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}