'use client'

import { useState, useEffect } from 'react'
import type { Session } from '@/lib/schema'

interface ClassTeachingFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function ClassTeachingForm({ onSuccess, onCancel }: ClassTeachingFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [formData, setFormData] = useState({
    className: '',
    description: '',
    gradeRange: '',
    customGradeRange: '',
    maxStudents: '20',
    helpersNeeded: '1',
    coTeacher: '',
    classroomNeeds: '',
    requiresFee: false,
    feeAmount: '',
    schedulingRequirements: ''
  })
  const [useCustomGradeRange, setUseCustomGradeRange] = useState(false)

  useEffect(() => {
    // Fetch current session info
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/sessions/active')
        if (response.ok) {
          const data = await response.json()
          setCurrentSession(data.session)
        }
      } catch (error) {
        console.error('Error fetching session:', error)
      }
    }
    fetchSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const submitData = {
        ...formData,
        gradeRange: useCustomGradeRange ? formData.customGradeRange : formData.gradeRange,
        maxStudents: parseInt(formData.maxStudents),
        helpersNeeded: parseInt(formData.helpersNeeded),
        feeAmount: formData.requiresFee ? parseFloat(formData.feeAmount) : null
      }

      const response = await fetch('/api/class-teaching-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit request')
      }

      await response.json()
      onSuccess()
    } catch (error) {
      console.error('Error submitting request:', error)
      alert(error instanceof Error ? error.message : 'Failed to submit request')
    } finally {
      setIsLoading(false)
    }
  }

  const gradeOptions = [
    'K',
    '1st',
    '2nd', 
    '3rd',
    '4th',
    '5th',
    '6th',
    '7th',
    '8th',
    'K-2',
    '3-5',
    '6-8',
    'All Ages'
  ]

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow border">
      <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-2">
        Register to Teach a Class
      </h3>
      {currentSession && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 sm:p-4 mb-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Session: {currentSession.name}
          </h4>
          <div className="space-y-1 text-sm text-blue-700">
            <p>
              <span className="font-medium">Session Period:</span> {new Date(currentSession.startDate).toLocaleDateString()} - {new Date(currentSession.endDate).toLocaleDateString()}
            </p>
            <p>
              <span className="font-medium">Registration Opens:</span> {new Date(currentSession.registrationStartDate).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
      <p className="text-sm text-gray-600 mb-6">
        Submit your class teaching request before regular registration opens. Administrators will review and approve classes before the registration period begins.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mobile-optimized form layout */}
        <div className="space-y-6 sm:space-y-0 sm:grid sm:grid-cols-1 md:grid-cols-2 sm:gap-6">
          <div className="space-y-6 sm:space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class Name *
              </label>
              <input
                type="text"
                required
                value={formData.className}
                onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Creative Writing, Science Experiments"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade Range *
              </label>
              <select
                required={!useCustomGradeRange}
                value={useCustomGradeRange ? 'custom' : formData.gradeRange}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setUseCustomGradeRange(true)
                    setFormData({ ...formData, gradeRange: '' })
                  } else {
                    setUseCustomGradeRange(false)
                    setFormData({ ...formData, gradeRange: e.target.value, customGradeRange: '' })
                  }
                }}
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select grade range</option>
                {gradeOptions.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
                <option value="custom">Custom Grade Range</option>
              </select>
              {useCustomGradeRange && (
                <input
                  type="text"
                  required
                  value={formData.customGradeRange}
                  onChange={(e) => setFormData({ ...formData, customGradeRange: e.target.value })}
                  placeholder="e.g., 2nd-4th, Pre-K, 9th-12th"
                  className="mt-3 w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>
          </div>

          <div className="space-y-6 sm:space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Students *
              </label>
              <input
                type="number"
                required
                min="1"
                max="100"
                value={formData.maxStudents}
                onChange={(e) => setFormData({ ...formData, maxStudents: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent Helpers Needed *
              </label>
              <input
                type="number"
                required
                min="0"
                max="10"
                value={formData.helpersNeeded}
                onChange={(e) => setFormData({ ...formData, helpersNeeded: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-2 text-sm text-gray-500">
                {formData.coTeacher.trim() 
                  ? "Number of parent helpers needed (0 if co-teacher is sufficient)" 
                  : "Minimum 1 helper required if no co-teacher"}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Class Description *
          </label>
          <textarea
            required
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe what the class will cover, activities, learning objectives, etc."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Co-Teacher (Optional)
          </label>
          <input
            type="text"
            value={formData.coTeacher}
            onChange={(e) => {
              const newCoTeacher = e.target.value
              setFormData({ 
                ...formData, 
                coTeacher: newCoTeacher,
                // Auto-adjust helpers needed based on co-teacher presence
                helpersNeeded: newCoTeacher.trim() ? '0' : '1'
              })
            }}
            className="w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Name of co-teacher if applicable"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Classroom Needs (Optional)
          </label>
          <textarea
            rows={3}
            value={formData.classroomNeeds}
            onChange={(e) => setFormData({ ...formData, classroomNeeds: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., TV/projector, art supplies, tables for group work, etc."
          />
        </div>

        {/* Mobile-optimized checkbox and fee section */}
        <div className="space-y-4">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="requiresFee"
              checked={formData.requiresFee}
              onChange={(e) => setFormData({ ...formData, requiresFee: e.target.checked, feeAmount: e.target.checked ? formData.feeAmount : '' })}
              className="h-5 w-5 sm:h-4 sm:w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
            />
            <label htmlFor="requiresFee" className="ml-3 sm:ml-2 block text-sm sm:text-sm text-gray-900 leading-5">
              This class requires a supply fee
            </label>
          </div>

          {formData.requiresFee && (
            <div className="pl-8 sm:pl-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supply Fee Amount *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg sm:text-base sm:left-3">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required={formData.requiresFee}
                  value={formData.feeAmount}
                  onChange={(e) => setFormData({ ...formData, feeAmount: e.target.value })}
                  className="w-full border border-gray-300 rounded-md pl-8 pr-4 py-3 text-base sm:text-sm sm:pl-8 sm:pr-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scheduling Requirements (Optional)
          </label>
          <textarea
            rows={3}
            value={formData.schedulingRequirements}
            onChange={(e) => setFormData({ ...formData, schedulingRequirements: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any specific scheduling needs or preferences"
          />
        </div>

        {/* Mobile-optimized button layout */}
        <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-700 px-6 py-3 sm:py-2 rounded-md text-base sm:text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 py-3 sm:py-2 rounded-md text-base sm:text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 sm:h-4 sm:w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </div>
            ) : (
              'Submit Request'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}