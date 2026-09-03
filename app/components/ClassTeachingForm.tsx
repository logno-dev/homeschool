'use client'

import { useState, useEffect } from 'react'
import type { ClassTeachingRequest, Session } from '@/lib/schema'
import { BUILT_IN_GRADE_RANGES, CHILD_GRADE_OPTIONS, getGradeRangeFromLabel, getGradeIndex, getGradeLabel } from '@/lib/grades'

interface ClassTeachingFormProps {
  onSuccess: () => void
  onCancel: () => void
  initialRequest?: ClassTeachingRequest & { session?: Session }
  mode?: 'create' | 'edit'
}

const GRADE_OPTIONS: readonly string[] = BUILT_IN_GRADE_RANGES.map((option) => option.value)

export default function ClassTeachingForm({
  onSuccess,
  onCancel,
  initialRequest,
  mode = 'create'
}: ClassTeachingFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [formData, setFormData] = useState({
    className: '',
    description: '',
    gradeRange: '',
    gradeRangeFrom: '',
    gradeRangeTo: '',
    maxStudents: '20',
    helpersNeeded: '2',
    coTeacher: '',
    classroomNeeds: '',
    requiresFee: false,
    feeAmount: '',
    schedulingRequirements: ''
  })
  const [useCustomGradeRange, setUseCustomGradeRange] = useState(false)
  const [gradeRangeError, setGradeRangeError] = useState<string | null>(null)

  useEffect(() => {
    if (initialRequest) {
      const fallbackRange = getGradeRangeFromLabel(initialRequest.gradeRange)
      const fromIndex = initialRequest.gradeRangeFrom ?? fallbackRange.from
      const toIndex = initialRequest.gradeRangeTo ?? fallbackRange.to
       const fromLabel = getGradeLabel(fromIndex)
       const toLabel = getGradeLabel(toIndex)
      const isCustomRange = !GRADE_OPTIONS.includes(initialRequest.gradeRange)

      setUseCustomGradeRange(isCustomRange)
      setCurrentSession(initialRequest.session || null)
      setFormData({
        className: initialRequest.className || '',
        description: initialRequest.description || '',
        gradeRange: isCustomRange ? '' : initialRequest.gradeRange,
        gradeRangeFrom: isCustomRange ? fromLabel : '',
        gradeRangeTo: isCustomRange ? toLabel : '',
        maxStudents: String(initialRequest.maxStudents ?? 20),
        helpersNeeded: String(initialRequest.helpersNeeded ?? 1),
        coTeacher: initialRequest.coTeacher || '',
        classroomNeeds: initialRequest.classroomNeeds || '',
        requiresFee: Boolean(initialRequest.requiresFee),
        feeAmount: initialRequest.requiresFee ? String(initialRequest.feeAmount ?? '') : '',
        schedulingRequirements: initialRequest.schedulingRequirements || ''
      })
      return
    }

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
  }, [initialRequest])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (useCustomGradeRange) {
        if (!formData.gradeRangeFrom || !formData.gradeRangeTo) {
          setGradeRangeError('Please select both a starting and ending grade.')
          setIsLoading(false)
          return
        }

        const fromIndex = getGradeIndex(formData.gradeRangeFrom)
        const toIndex = getGradeIndex(formData.gradeRangeTo)
        if (fromIndex === null || toIndex === null || fromIndex > toIndex) {
          setGradeRangeError('Starting grade must be lower than ending grade.')
          setIsLoading(false)
          return
        }
      }

      const submitData = {
        ...formData,
        gradeRange: useCustomGradeRange
          ? `${formData.gradeRangeFrom}-${formData.gradeRangeTo}`
          : formData.gradeRange,
        gradeRangeFrom: useCustomGradeRange
           ? getGradeIndex(formData.gradeRangeFrom)
          : getGradeRangeFromLabel(formData.gradeRange).from,
        gradeRangeTo: useCustomGradeRange
           ? getGradeIndex(formData.gradeRangeTo)
          : getGradeRangeFromLabel(formData.gradeRange).to,
        maxStudents: parseInt(formData.maxStudents),
        helpersNeeded: parseInt(formData.helpersNeeded),
        feeAmount: formData.requiresFee ? parseFloat(formData.feeAmount) : null
      }

      const response = await fetch(
        initialRequest ? `/api/class-teaching-requests/${initialRequest.id}` : '/api/class-teaching-requests',
        {
          method: initialRequest ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submitData),
        }
      )

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

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow border">
      <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-2">
        {mode === 'edit' ? 'Edit Class Request' : 'Register to Teach a Class'}
      </h3>
      {initialRequest?.reviewNotes && (
        <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-900">Staff Feedback</p>
          <p className="mt-1 text-sm text-yellow-800">{initialRequest.reviewNotes}</p>
          {initialRequest.reviewedAt && (
            <p className="mt-2 text-xs text-yellow-700">
              Reviewed on {new Date(initialRequest.reviewedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
      {currentSession && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 sm:p-4 mb-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Session: {currentSession.name}
          </h4>
          <div className="space-y-1 text-sm text-blue-700">
            <p>
              <span className="font-medium">Session Dates:</span> {new Date(currentSession.startDate).toLocaleDateString()} - {new Date(currentSession.endDate).toLocaleDateString()}
            </p>
            <p>
              <span className="font-medium">Registration Opens:</span> {new Date(currentSession.registrationStartDate).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
      <p className="text-sm text-gray-600 mb-6">
        {mode === 'edit'
          ? 'Update your class request while it is still pending review. Administrators will see your latest changes.'
          : 'Submit your class teaching request before regular registration opens. Administrators will review and approve classes before the registration window begins.'}
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
                  setGradeRangeError(null)
                  if (e.target.value === 'custom') {
                    setUseCustomGradeRange(true)
                    setFormData({
                      ...formData,
                      gradeRange: '',
                      gradeRangeFrom: '',
                      gradeRangeTo: '',
                    })
                  } else {
                    setUseCustomGradeRange(false)
                    setFormData({
                      ...formData,
                      gradeRange: e.target.value,
                      gradeRangeFrom: '',
                      gradeRangeTo: ''
                    })
                  }
                }}
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select grade range</option>
                {BUILT_IN_GRADE_RANGES.map((grade) => (
                  <option key={grade.value} value={grade.value}>{grade.label}</option>
                ))}
                <option value="custom">Custom Grade Range</option>
              </select>
              {useCustomGradeRange && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                      <select
                        required
                        value={formData.gradeRangeFrom}
                        onChange={(e) => {
                          setGradeRangeError(null)
                          setFormData({ ...formData, gradeRangeFrom: e.target.value })
                        }}
                        className="w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select grade</option>
                         {CHILD_GRADE_OPTIONS.filter((grade) => grade !== 'Graduated').map((grade) => (
                          <option key={grade} value={grade}>{grade}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                      <select
                        required
                        value={formData.gradeRangeTo}
                        onChange={(e) => {
                          setGradeRangeError(null)
                          setFormData({ ...formData, gradeRangeTo: e.target.value })
                        }}
                        className="w-full border border-gray-300 rounded-md px-4 py-3 text-base sm:text-sm sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select grade</option>
                         {CHILD_GRADE_OPTIONS.filter((grade) => grade !== 'Graduated').map((grade) => (
                          <option key={grade} value={grade}>{grade}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {gradeRangeError && (
                    <p className="text-sm text-red-600">{gradeRangeError}</p>
                  )}
                </div>
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
          <label className="flex items-center gap-3 text-sm text-gray-900">
            <input
              type="checkbox"
              checked={formData.requiresFee}
              onChange={(e) => setFormData({ ...formData, requiresFee: e.target.checked, feeAmount: e.target.checked ? formData.feeAmount : '' })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            This class requires a supply fee
          </label>
          {formData.requiresFee && (
            <div className="mt-3 max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-2">Supply Fee Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input type="number" min="0" step="0.01" required value={formData.feeAmount} onChange={(e) => setFormData({ ...formData, feeAmount: e.target.value })} className="w-full border border-gray-300 rounded-md pl-7 pr-3 py-2" placeholder="0.00" />
              </div>
            </div>
          )}
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
