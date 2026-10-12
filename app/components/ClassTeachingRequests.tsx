'use client'

import { useState, useEffect, useRef } from 'react'
import ClassTeachingForm from './ClassTeachingForm'
import type { ClassTeachingRequest, Session } from '@/lib/schema'
import { CLASS_PERIODS, CLASS_SLOT_GRADE_RANGES, CLASS_SLOT_TARGET } from '@/lib/class-teaching'

type DisplayRequest = ClassTeachingRequest & { session: Session; categoryName?: string | null; studentTeacherDisplayName?: string | null }
type SlotRequest = { id: string; className: string; categoryName: string | null; gradeRange: string; status: string }
type SlotSummary = {
  periods: Array<{ id: string; label: string }>
  gradeRanges: Array<{ value: string; label: string }>
  target: number
  slots: Record<string, Record<string, SlotRequest[]>>
  flexible: Record<string, SlotRequest[]>
}

const EMPTY_SLOT_SUMMARY: SlotSummary = {
  periods: CLASS_PERIODS.map((period) => ({ ...period })),
  gradeRanges: CLASS_SLOT_GRADE_RANGES.map((range) => ({ ...range })),
  target: CLASS_SLOT_TARGET,
  slots: Object.fromEntries(CLASS_PERIODS.map((period) => [period.id, Object.fromEntries(CLASS_SLOT_GRADE_RANGES.map((range) => [range.value, []]))])),
  flexible: Object.fromEntries(CLASS_SLOT_GRADE_RANGES.map((range) => [range.value, []]))
}

export default function ClassTeachingRequests({ openOnly = false, onVisibilityChange }: { openOnly?: boolean; onVisibilityChange?: (visible: boolean) => void }) {
  const [requests, setRequests] = useState<DisplayRequest[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [slotSummary, setSlotSummary] = useState<SlotSummary>(EMPTY_SLOT_SUMMARY)
  const [loadError, setLoadError] = useState('')
  const [teachingSessions, setTeachingSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRequest, setEditingRequest] = useState<DisplayRequest | null>(null)
  const [initialSlot, setInitialSlot] = useState<{ preferredPeriod: string; gradeRange: string } | null>(null)
  const formRef = useRef<HTMLDivElement | null>(null)
  const [registrationStatus, setRegistrationStatus] = useState<{
    isOpen: boolean
    reason?: string
  }>({ isOpen: false })
  const [registrationStatusLoading, setRegistrationStatusLoading] = useState(true)

  useEffect(() => {
    fetchRequests()
    checkRegistrationStatus()
  }, [])

  useEffect(() => {
    if (!isLoading && !registrationStatusLoading) onVisibilityChange?.(!openOnly || registrationStatus.isOpen)
  }, [isLoading, openOnly, onVisibilityChange, registrationStatus.isOpen, registrationStatusLoading])

  const fetchRequests = async (sessionId?: string) => {
    try {
      setLoadError('')
      const response = await fetch(`/api/class-teaching-requests${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load teaching slots')
      setRequests(data.requests || [])
      setCategories(data.categories || [])
      setSlotSummary(data.slotSummary || EMPTY_SLOT_SUMMARY)
      setTeachingSessions(data.teachingSessions || [])
      setSelectedSessionId(data.selectedSessionId || '')
    } catch (error) {
      console.error('Error fetching requests:', error)
      setLoadError(error instanceof Error ? error.message : 'Unable to load teaching slots')
    } finally {
      setIsLoading(false)
    }
  }

  const checkRegistrationStatus = async () => {
    try {
      const response = await fetch('/api/class-teaching-registration/status', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setRegistrationStatus(data)
      }
    } catch (error) {
      console.error('Error checking registration status:', error)
    } finally {
      setRegistrationStatusLoading(false)
    }
  }

  const handleFormSuccess = () => {
    // Refresh the requests to get the session info
    fetchRequests(selectedSessionId)
    setShowForm(false)
    setEditingRequest(null)
    setInitialSlot(null)
  }

  useEffect(() => {
    if ((showForm || editingRequest) && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showForm, editingRequest])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Rejected
          </span>
        )
      case 'changes_requested':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            Changes Requested
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending Review
          </span>
        )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (openOnly && (isLoading || registrationStatusLoading || !registrationStatus.isOpen)) return null

  if (isLoading || registrationStatusLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Class Teaching Requests</h2>
        {registrationStatus.isOpen ? (
          <button
            onClick={() => { setInitialSlot(null); setShowForm(true) }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Register to Teach
          </button>
        ) : (
          <div className="text-sm text-gray-600">
            {registrationStatus.reason || 'Class teaching registration is not currently open'}
          </div>
        )}
      </div>

      {loadError && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Teaching slots could not be refreshed: {loadError}</div>}

      {registrationStatus.isOpen && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold text-slate-900">Teaching Needs</h3>
              {teachingSessions.length > 1 && <label className="text-sm font-medium text-slate-700">Session<select value={selectedSessionId} onChange={(event) => { setShowForm(false); setEditingRequest(null); setInitialSlot(null); fetchRequests(event.target.value) }} className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">{teachingSessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>}
              {teachingSessions.length === 1 && <p className="text-sm font-medium text-slate-700">{teachingSessions[0].name}</p>}
            </div>
            <p className="mt-1 text-sm text-slate-600">We aim for {slotSummary.target} classes in each grade range per hour. Counts include pending and approved proposals; you may still propose a class for a filled area.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead><tr className="border-b border-slate-200"><th className="px-4 py-3 text-left font-medium text-slate-600">Grade range</th>{slotSummary.periods.map((period) => <th key={period.id} className="px-3 py-3 text-center font-medium text-slate-600">{period.label}</th>)}<th className="px-3 py-3 text-center font-medium text-slate-600">Any Hour</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {slotSummary.gradeRanges.map((range) => (
                  <tr key={range.value}>
                    <th className="px-4 py-3 text-left font-medium text-slate-900">{range.label}</th>
                    {slotSummary.periods.map((period) => {
                      const slotRequests = slotSummary.slots[period.id]?.[range.value] || []
                      return <td key={period.id} className="px-2 py-2 align-top"><button type="button" onClick={() => { setEditingRequest(null); setInitialSlot({ preferredPeriod: period.id, gradeRange: range.value }); setShowForm(true) }} className={`w-full rounded-lg border px-3 py-3 text-left transition hover:border-blue-400 hover:bg-blue-50 ${slotRequests.length < slotSummary.target ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><span className="block text-center text-lg font-semibold text-slate-900">{slotRequests.length} <span className="text-xs font-normal text-slate-600">of {slotSummary.target}</span></span>{slotRequests.length > 0 ? <span className="mt-2 block space-y-1 border-t border-slate-200 pt-2">{slotRequests.map((item) => <span key={item.id} className="block rounded bg-white/70 px-2 py-1.5"><span className="block font-medium text-slate-900">{item.className}</span><span className="block text-[11px] text-slate-600">{item.categoryName || item.gradeRange} | {item.status === 'approved' ? 'Approved' : 'In review'}</span></span>)}</span> : <span className="mt-2 block text-center text-xs text-slate-500">No proposals yet</span>}<span className="mt-2 block text-center text-xs font-medium text-blue-700">Propose here</span></button></td>
                    })}
                    <td className="px-2 py-2 align-top"><button type="button" onClick={() => { setEditingRequest(null); setInitialSlot({ preferredPeriod: 'any', gradeRange: range.value }); setShowForm(true) }} className="w-full rounded-lg border border-blue-100 px-3 py-3 text-left text-blue-700 hover:bg-blue-50"><span className="block text-center text-lg font-semibold">{(slotSummary.flexible[range.value] || []).length} <span className="text-xs font-normal">flexible</span></span>{(slotSummary.flexible[range.value] || []).length > 0 ? <span className="mt-2 block space-y-1 border-t border-blue-100 pt-2">{slotSummary.flexible[range.value].map((item) => <span key={item.id} className="block rounded bg-blue-50 px-2 py-1.5"><span className="block font-medium text-slate-900">{item.className}</span><span className="block text-[11px] text-slate-600">{item.categoryName || item.gradeRange} | {item.status === 'approved' ? 'Approved' : 'In review'}</span></span>)}</span> : <span className="mt-2 block text-center text-xs text-slate-500">No flexible proposals</span>}<span className="mt-2 block text-center text-xs font-medium">Propose here</span></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">Classes with expanded grade ranges appear in every standard range they overlap. Click any cell to begin a proposal.</p>
        </section>
      )}

      {(showForm || editingRequest) && (
        <div ref={formRef}>
          <ClassTeachingForm
            key={editingRequest?.id || `${initialSlot?.preferredPeriod || 'blank'}-${initialSlot?.gradeRange || 'blank'}`}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false)
              setEditingRequest(null)
              setInitialSlot(null)
            }}
            initialRequest={editingRequest || undefined}
            session={teachingSessions.find((session) => session.id === selectedSessionId) || null}
            categories={categories}
            initialSlot={initialSlot}
            mode={editingRequest ? 'edit' : 'create'}
          />
        </div>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            {registrationStatus.isOpen 
              ? "You haven't submitted any class teaching requests yet."
              : "No class teaching requests found."
            }
          </p>
          {registrationStatus.isOpen && (
            <div className="mt-4">
              <button
                onClick={() => { setInitialSlot(null); setShowForm(true) }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Submit Your First Request
              </button>
              <p className="mt-2 text-sm text-gray-500">
                Submit your class teaching request before regular registration opens
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {requests.map((request) => (
              <li key={request.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">
                        {request.className}
                      </h3>
                      <div className="flex items-center gap-3">
                        {teachingSessions.some((session) => session.id === request.sessionId) && (request.status === 'pending' || request.status === 'changes_requested') && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowForm(true)
                              setEditingRequest(request)
                              setInitialSlot(null)
                            }}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Grade Range: {request.gradeRange}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Preferred Hour: {slotSummary?.periods.find((period) => period.id === request.preferredPeriod)?.label || 'Any Hour'}{request.categoryName ? ` | ${request.categoryName}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {request.description}
                    </p>
                    
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Session:</span> {request.session?.name || 'Unknown'}
                      </div>
                      <div>
                        <span className="font-medium">Max Students:</span> {request.maxStudents || 'Not specified'}
                      </div>
                      <div>
                        <span className="font-medium">Helpers Needed:</span> {request.helpersNeeded || 0}
                      </div>
                      {request.coTeacher && (
                        <div>
                          <span className="font-medium">Co-Teacher:</span> {request.coTeacher}
                        </div>
                      )}
                      {request.studentTeacherDisplayName && <div><span className="font-medium">Student Teacher:</span> {request.studentTeacherDisplayName}</div>}
                      {request.requiresFee && (
                        <div>
                          <span className="font-medium">Supply Fee:</span> ${request.feeAmount}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Submitted:</span> {formatDate(request.createdAt)}
                      </div>
                    </div>

                    {request.classroomNeeds && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Classroom Needs:</span> {request.classroomNeeds}
                      </div>
                    )}

                    {request.schedulingRequirements && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Scheduling Requirements:</span> {request.schedulingRequirements}
                      </div>
                    )}

                    {request.reviewNotes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <span className="font-medium text-sm text-gray-700">Review Notes:</span>
                        <p className="mt-1 text-sm text-gray-600">{request.reviewNotes}</p>
                        {request.reviewedAt && (
                          <p className="mt-1 text-xs text-gray-500">
                            Reviewed on {formatDate(request.reviewedAt)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
