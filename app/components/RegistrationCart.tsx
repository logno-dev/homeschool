'use client'

import { useEffect, useState } from 'react'
import { useRegistration } from './RegistrationContext'
import { useToast } from './ToastContainer'
import Modal from './Modal'
import { PaymentForm } from './PaymentForm'


const PERIODS = [
  { id: 'first', name: 'First Period' },
  { id: 'second', name: 'Second Period' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'third', name: 'Third Period' }
]



interface RegistrationCartProps {
  sessionId: string
  children: Array<{
    id: string
    firstName: string
    lastName: string
    grade: string
  }>
}

export default function RegistrationCart({ sessionId, children }: RegistrationCartProps) {
  const { 
    pendingRegistrations, 
    pendingVolunteerAssignments, 
    conflicts,
    removeChildRegistration, 
    removeVolunteerAssignment,
    clearAllRegistrations,
    getTotalPendingRegistrations,
    getVolunteerRequirements,
    isVolunteerRequirementsMet,
    setConflicts
  } = useRegistration()
  
  const { showSuccess, showError } = useToast()
  const [showCart, setShowCart] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showAdminOverrideModal, setShowAdminOverrideModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingPaymentFee, setPendingPaymentFee] = useState<{
    id: string
    sessionName: string
    registrationFee: number
    classFees: number
    totalFee: number
    paidAmount: number
    remainingAmount: number
    dueDate: string
    isOverdue: boolean
  } | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideContext, setOverrideContext] = useState<'volunteer' | 'grade_range' | 'mixed'>('volunteer')
  const [gradeRangeConflicts, setGradeRangeConflicts] = useState<string[]>([])
  const [canRequestOverride, setCanRequestOverride] = useState(false)
  const [volunteerHoursInfo, setVolunteerHoursInfo] = useState<{
    requiredHours: number
    fulfilledHours: number
    canRequestOverride: boolean
  } | null>(null)

  const [timeReference, setTimeReference] = useState(Date.now())

  useEffect(() => {
    if (!showCart) return
    const interval = setInterval(() => setTimeReference(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [showCart])

  const formatHoldCountdown = (expiresAt?: string | null) => {
    if (!expiresAt) return null
    const remainingMs = new Date(expiresAt).getTime() - timeReference
    if (Number.isNaN(remainingMs)) return null
    if (remainingMs <= 0) return 'Hold expired'
    const totalMinutes = Math.ceil(remainingMs / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours > 0) {
      return `Hold expires in ${hours}h ${minutes}m`
    }
    return `Hold expires in ${minutes}m`
  }

  const submitAllRegistrations = async (requestAdminOverride = false) => {
    if (pendingRegistrations.length === 0) {
      showError('No registrations to submit', 'Please select some classes first.')
      return
    }

    setSubmitting(true)
    setConflicts([])
    setVolunteerHoursInfo(null)
    setCanRequestOverride(false)
    
    try {
      // Submit all registrations in batch
      const response = await fetch('/api/registration/batch-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          registrations: pendingRegistrations,
          volunteerAssignments: pendingVolunteerAssignments,
          requestAdminOverride
        }),
      })

      const result = await response.json()

      if (response.status === 409) {
        // Path 2: Conflicts detected
        setConflicts(result.conflicts || [])
        showError('Registration Conflicts', 'Some classes or volunteer spots are no longer available. Please review the highlighted conflicts.')
        return
      }

      if (response.status === 400 && (!result.volunteerRequirementsMet || result.canRequestOverride)) {
        // Path 3: Volunteer requirements not met
        if (result.requiredHours !== undefined && result.fulfilledHours !== undefined) {
          setVolunteerHoursInfo({
            requiredHours: result.requiredHours,
            fulfilledHours: result.fulfilledHours,
            canRequestOverride: result.canRequestOverride
          })
        }
        
        if (result.canRequestOverride) {
          const gradeConflicts = Array.isArray(result.conflicts)
            ? result.conflicts.filter((conflict: { type?: string; className?: string }) => conflict.type === 'grade_range')
            : []
          const hasGradeRangeConflicts = gradeConflicts.length > 0
          const hasVolunteerMismatch = result.volunteerRequirementsMet === false
          const context = hasGradeRangeConflicts && hasVolunteerMismatch
            ? 'mixed'
            : hasGradeRangeConflicts
              ? 'grade_range'
              : 'volunteer'
          setOverrideContext(context)
          setGradeRangeConflicts(gradeConflicts
            .map((conflict: { className?: string }) => conflict.className)
            .filter((name: string | undefined): name is string => typeof name === 'string' && name.length > 0))
          setCanRequestOverride(true)
          setShowAdminOverrideModal(true)
        } else {
          showError('Volunteer requirements not met', result.message)
        }
        return
      }

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed')
      }

      // Path 1: Success or Admin Override Requested
      if (result.adminOverrideRequested) {
        showSuccess('Admin Override Requested', result.message)
      } else {
        showSuccess(
          'Registration Complete!', 
          `Successfully registered ${result.registeredCount} child${result.registeredCount === 1 ? '' : 'ren'} and ${result.volunteerCount} volunteer${result.volunteerCount === 1 ? '' : 's'}.`
        )
        await loadPaymentPrompt()
      }
      
      // Clear the cart and close modal
      await clearAllRegistrations(false)
      setShowCart(false)
      setShowAdminOverrideModal(false)

      if (result.adminOverrideRequested) {
        window.location.reload()
      }
      
    } catch (error) {
      console.error('Error submitting registrations:', error)
      showError('Registration failed', error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const loadPaymentPrompt = async () => {
    try {
      const response = await fetch('/api/family/fees')
      if (!response.ok) {
        window.location.reload()
        return
      }

      const payload = await response.json()
      const fee = (payload.fees || []).find((entry: { sessionId: string }) => entry.sessionId === sessionId)

      if (!fee || fee.remainingAmount <= 0) {
        window.location.reload()
        return
      }

      setPendingPaymentFee(fee)
      setShowPaymentModal(true)
    } catch (error) {
      console.error('Failed to load payment data:', error)
      window.location.reload()
    }
  }

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false)
    window.location.reload()
  }

  const handlePaymentDefer = () => {
    showError('Payment deferred', 'Your selections may not be guaranteed if payment is not completed promptly.')
    setShowPaymentModal(false)
    window.location.reload()
  }

  const handleAdminOverrideRequest = async () => {
    if (!overrideReason.trim()) {
      showError('Reason required', 'Please provide a reason for the admin override request.')
      return
    }
    
    await submitAllRegistrations(true)
  }

  const getChildName = (childId: string) => {
    const child = children.find(c => c.id === childId)
    return child ? `${child.firstName} ${child.lastName}` : 'Unknown Child'
  }

  const totalItems = getTotalPendingRegistrations() + pendingVolunteerAssignments.length

  return (
    <>
      {/* Floating Cart Button */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
        <button
          onClick={() => setShowCart(true)}
          className="bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9m-9 0V9a2 2 0 012-2h2m5 0V7a2 2 0 012-2h2m0 0V5a2 2 0 012-2h2" />
          </svg>
          <span className="font-medium">{totalItems}</span>
        </button>
      </div>

      {/* Cart Modal */}
      <Modal
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        title="Registration Cart"
        size="lg"
      >
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Registration Summary</h3>
            <div className="text-sm text-blue-800">
              <p>{pendingRegistrations.length} class registration{pendingRegistrations.length === 1 ? '' : 's'}</p>
              <p>{pendingVolunteerAssignments.length} volunteer assignment{pendingVolunteerAssignments.length === 1 ? '' : 's'}</p>
            </div>
          </div>

          {/* Volunteer Requirements */}
          {pendingRegistrations.length > 0 && (() => {
            const requirements = getVolunteerRequirements()
            return (
              <div className={`rounded-lg p-4 ${isVolunteerRequirementsMet() ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <h3 className={`font-semibold mb-2 ${isVolunteerRequirementsMet() ? 'text-green-900' : 'text-yellow-900'}`}>
                  Volunteer Requirements
                </h3>
                <div className={`text-sm ${isVolunteerRequirementsMet() ? 'text-green-800' : 'text-yellow-800'}`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${isVolunteerRequirementsMet() ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                    <span>
                      <strong>Required:</strong> {requirements.requiredHours} volunteer hour{requirements.requiredHours === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${requirements.fulfilledHours >= requirements.requiredHours ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                    <span>
                      <strong>Assigned:</strong> {requirements.fulfilledHours} volunteer hour{requirements.fulfilledHours === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="text-xs opacity-80">
                    Each period with students needs one volunteer hour. Teaching or period-specific volunteering covers that period, and non-period jobs act as wildcards for any uncovered period.
                  </p>
                  {requirements.periodsWithStudents.length > 0 && (
                    <div className="mt-2 text-xs opacity-75">
                      <span>Students enrolled in: </span>
                      {requirements.periodsWithStudents.map((period, index) => (
                        <span key={period}>
                          {PERIODS.find(p => p.id === period)?.name}
                          {index < requirements.periodsWithStudents.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {!isVolunteerRequirementsMet() && (
                    <p className="mt-3 text-yellow-700 font-medium">
                      ⚠️ You need {requirements.requiredHours - requirements.fulfilledHours} more volunteer hour{requirements.requiredHours - requirements.fulfilledHours === 1 ? '' : 's'}. You can fulfill this by volunteering as a class helper, taking on volunteer jobs, or teaching classes.
                    </p>
                  )}
                  {isVolunteerRequirementsMet() && (
                    <p className="mt-3 text-green-700 font-medium">
                      ✅ All volunteer requirements met!
                    </p>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Conflicts Display */}
          {conflicts.length > 0 && (
            <div className="bg-red-50 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2">Registration Conflicts</h3>
              <div className="space-y-2">
                {conflicts.map((conflict, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></span>
                    <div className="text-sm text-red-800">
                      <p className="font-medium">{conflict.className || conflict.jobTitle}</p>
                      <p>{conflict.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-red-700">
                Please remove the conflicted items and try again, or contact an administrator for assistance.
              </p>
            </div>
          )}

          {/* Volunteer Hours Info */}
          {volunteerHoursInfo && overrideContext !== 'grade_range' && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">Volunteer Requirements Not Met</h3>
              <div className="text-sm text-yellow-800">
                <p>Required volunteer hours: {volunteerHoursInfo.requiredHours}</p>
                <p>Fulfilled volunteer hours: {volunteerHoursInfo.fulfilledHours}</p>
                {volunteerHoursInfo.canRequestOverride && (
                  <p className="mt-2 font-medium">You can request an admin override to proceed with registration.</p>
                )}
              </div>
            </div>
          )}
          {overrideContext === 'grade_range' && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">Grade Range Override Needed</h3>
              <div className="text-sm text-yellow-800">
                <p>One or more students are outside the class grade range.</p>
                {gradeRangeConflicts.length > 0 && (
                  <p className="mt-2 text-sm text-yellow-800">
                    Affected classes: {gradeRangeConflicts.join(', ')}
                  </p>
                )}
                <p className="mt-2 font-medium">You can request an admin override to proceed with registration.</p>
              </div>
            </div>
          )}
          {overrideContext === 'mixed' && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">Override Needed</h3>
              <div className="text-sm text-yellow-800">
                <p>Volunteer requirements are not met and a grade range override is needed.</p>
                {gradeRangeConflicts.length > 0 && (
                  <p className="mt-2 text-sm text-yellow-800">
                    Affected classes: {gradeRangeConflicts.join(', ')}
                  </p>
                )}
                <p className="mt-2 font-medium">You can request an admin override to proceed with registration.</p>
              </div>
            </div>
          )}

          {/* Child Registrations */}
          {pendingRegistrations.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Class Registrations</h4>
              <div className="space-y-3">
                {pendingRegistrations.map((registration, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{registration.className}</p>
                        <p className="text-sm text-gray-600">
                          {getChildName(registration.childId)} • {PERIODS.find(p => p.id === registration.period)?.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {registration.teacher} • {registration.classroom}
                        </p>
                        {registration.status === 'waitlisted' && (
                          <p className="text-xs text-yellow-700 font-medium">Waitlist</p>
                        )}
                        {registration.holdExpiresAt && (
                          <p className="text-xs text-amber-600 mt-1">
                            {formatHoldCountdown(registration.holdExpiresAt)}
                          </p>
                        )}
                      </div>
                        <button
                          onClick={async () => {
                            await removeChildRegistration(registration.childId, registration.period, registration.scheduleId)
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Volunteer Assignments */}
          {pendingVolunteerAssignments.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Volunteer Assignments</h4>
              <div className="space-y-3">
                {pendingVolunteerAssignments.map((assignment, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-green-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {assignment.className || assignment.jobTitle || 'Volunteer Job'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {assignment.guardianName} • {assignment.period === 'non_period' ? 'General Volunteer' : PERIODS.find(p => p.id === assignment.period)?.name} • {assignment.volunteerType}
                        </p>
                        {assignment.teacher && assignment.classroom && (
                          <p className="text-sm text-gray-600">
                            {assignment.teacher} • {assignment.classroom}
                          </p>
                        )}
                        {assignment.holdExpiresAt && (
                          <p className="text-xs text-amber-600 mt-1">
                            {formatHoldCountdown(assignment.holdExpiresAt)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          await removeVolunteerAssignment(assignment.period)
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <button
              onClick={async () => {
                await clearAllRegistrations(true)
                setShowCart(false)
              }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              Clear All
            </button>
            <div className="space-x-3">
              <button
                onClick={() => setShowCart(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
              >
                Continue Shopping
              </button>
              {canRequestOverride ? (
                <button
                  onClick={() => setShowAdminOverrideModal(true)}
                  disabled={submitting}
                  className="bg-yellow-600 text-white px-6 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Request Admin Override
                </button>
              ) : (
                <button
                  onClick={() => submitAllRegistrations()}
                  disabled={submitting || totalItems === 0 || conflicts.length > 0}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Submitting...' : `Submit Registration (${totalItems} items)`}
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {showPaymentModal && pendingPaymentFee && (
        <Modal
          isOpen={showPaymentModal}
          onClose={handlePaymentDefer}
          title={`Pay Session Fee - ${pendingPaymentFee.sessionName}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Payment is due upon registration. If you defer payment, your selections may not be guaranteed.
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Registration Fee:</span>
                  <span className="ml-2 font-medium">${pendingPaymentFee.registrationFee.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Class Fees:</span>
                  <span className="ml-2 font-medium">${pendingPaymentFee.classFees.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Fee:</span>
                  <span className="ml-2 font-medium">${pendingPaymentFee.totalFee.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="ml-2 font-medium">${pendingPaymentFee.paidAmount.toFixed(2)}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Amount Due:</span>
                  <span className="ml-2 font-bold text-lg">${pendingPaymentFee.remainingAmount.toFixed(2)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Due Date:</span>
                  <span className="ml-2 font-medium">{new Date(pendingPaymentFee.dueDate).toLocaleDateString()}</span>
                  {pendingPaymentFee.isOverdue && (
                    <span className="ml-2 text-red-600 font-medium">(OVERDUE)</span>
                  )}
                </div>
              </div>
            </div>

            <PaymentForm
              familySessionFeeId={pendingPaymentFee.id}
              amount={pendingPaymentFee.remainingAmount}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentDefer}
              cancelLabel="Defer Payment"
            />
          </div>
        </Modal>
      )}

      {/* Admin Override Request Modal */}
      <Modal
        isOpen={showAdminOverrideModal}
        onClose={() => setShowAdminOverrideModal(false)}
        title="Request Admin Override"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 rounded-lg p-4">
            {overrideContext === 'grade_range' && (
              <>
                <h3 className="font-semibold text-yellow-900 mb-2">Grade Range Override Needed</h3>
                <div className="text-sm text-yellow-800">
                  <p>One or more students are outside the class grade range.</p>
                  {gradeRangeConflicts.length > 0 && (
                    <p className="mt-2">Affected classes: {gradeRangeConflicts.join(', ')}</p>
                  )}
                </div>
              </>
            )}
            {overrideContext === 'mixed' && (
              <>
                <h3 className="font-semibold text-yellow-900 mb-2">Override Needed</h3>
                <div className="text-sm text-yellow-800">
                  <p>Volunteer requirements are not met and a grade range override is needed.</p>
                  {gradeRangeConflicts.length > 0 && (
                    <p className="mt-2">Affected classes: {gradeRangeConflicts.join(', ')}</p>
                  )}
                  {volunteerHoursInfo && (
                    <p className="mt-2">
                      You need {volunteerHoursInfo.requiredHours - volunteerHoursInfo.fulfilledHours} more volunteer hour{volunteerHoursInfo.requiredHours - volunteerHoursInfo.fulfilledHours === 1 ? '' : 's'}.
                    </p>
                  )}
                </div>
              </>
            )}
            {overrideContext === 'volunteer' && (
              <>
                <h3 className="font-semibold text-yellow-900 mb-2">Volunteer Requirements Not Met</h3>
                <div className="text-sm text-yellow-800">
                  {volunteerHoursInfo && (
                    <>
                      <p>Required volunteer hours: {volunteerHoursInfo.requiredHours}</p>
                      <p>Fulfilled volunteer hours: {volunteerHoursInfo.fulfilledHours}</p>
                      <p className="mt-2">
                        You need {volunteerHoursInfo.requiredHours - volunteerHoursInfo.fulfilledHours} more volunteer hour{volunteerHoursInfo.requiredHours - volunteerHoursInfo.fulfilledHours === 1 ? '' : 's'}. This can be fulfilled by volunteering in specific periods, taking on general volunteer jobs, or teaching classes.
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <label htmlFor="overrideReason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Override Request *
            </label>
            <textarea
              id="overrideReason"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Please explain why you need an admin override (e.g., special circumstances, scheduling conflicts, etc.)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={() => setShowAdminOverrideModal(false)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdminOverrideRequest}
              disabled={submitting || !overrideReason.trim()}
              className="bg-yellow-600 text-white px-6 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting...' : 'Request Override'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
