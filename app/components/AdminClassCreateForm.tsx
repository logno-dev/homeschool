'use client'

import { useState } from 'react'
import type { Session } from '@/lib/schema'
import { BUILT_IN_GRADE_RANGES, CHILD_GRADE_OPTIONS, getGradeIndex } from '@/lib/grades'
import SessionOptions from './SessionOptions'

interface Teacher { id: string; firstName: string; lastName: string; email: string }
interface Props { sessions: Session[]; teachers: Teacher[]; onCreated: () => void }
interface ScheduleDraft { id: string; name: string; updatedAt: string }
interface DraftEntry { classTeachingRequestId: string; classroomId: string; sessionClassroomId?: string | null; period: string }
interface SessionClassroom { id: string; name: string }

const HOURS = [
  { id: 'first', label: 'First Hour' },
  { id: 'second', label: 'Second Hour' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'third', label: 'Third Hour' }
]

const gradeOptions = BUILT_IN_GRADE_RANGES
const initialForm = {
  sessionId: '', className: '', description: '', gradeRange: '', gradeRangeFrom: '', gradeRangeTo: '', maxStudents: '20', helpersNeeded: '2',
  teacherId: '', teacherName: 'Staff Instructor', coTeacherId: '', coTeacher: '', classroomNeeds: '', registrationFeeExempt: false, requiresFee: false, feeAmount: '', schedulingRequirements: ''
}

export default function AdminClassCreateForm({ sessions, teachers, onCreated }: Props) {
  const [form, setForm] = useState(initialForm)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState<ScheduleDraft[]>([])
  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([])
  const [classrooms, setClassrooms] = useState<SessionClassroom[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [selectedHour, setSelectedHour] = useState('')
  const [selectedClassroomId, setSelectedClassroomId] = useState('')
  const [loadingScheduleOptions, setLoadingScheduleOptions] = useState(false)

  const loadScheduleOptions = async (sessionId: string) => {
    setSelectedDraftId('')
    setSelectedHour('')
    setSelectedClassroomId('')
    setDraftEntries([])
    setDrafts([])
    setClassrooms([])
    if (!sessionId) return

    setLoadingScheduleOptions(true)
    try {
      const [draftsResponse, scheduleResponse] = await Promise.all([
        fetch(`/api/admin/schedule/${sessionId}/drafts`),
        fetch(`/api/admin/schedule/${sessionId}`)
      ])
      const draftsPayload = await draftsResponse.json()
      const schedulePayload = await scheduleResponse.json()
      let availableDrafts = draftsPayload.drafts || []

      if (availableDrafts.length === 0) {
        const createResponse = await fetch(`/api/admin/schedule/${sessionId}/drafts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Working Draft', description: 'Default working draft' })
        })
        if (createResponse.ok) {
          const createdPayload = await createResponse.json()
          availableDrafts = [createdPayload.draft]
        }
      }

      setDrafts(availableDrafts)
      setClassrooms(schedulePayload.classrooms || [])
    } catch (error) {
      console.error('Error loading schedule options:', error)
      setMessage('Unable to load schedule options')
    } finally {
      setLoadingScheduleOptions(false)
    }
  }

  const loadDraftEntries = async (draftId: string) => {
    setSelectedDraftId(draftId)
    setSelectedHour('')
    setSelectedClassroomId('')
    setDraftEntries([])
    if (!draftId) return
    const response = await fetch(`/api/admin/schedule/${form.sessionId}/drafts/${draftId}`)
    if (response.ok) {
      const payload = await response.json()
      setDraftEntries(payload.entries || [])
    }
  }

  const availableClassrooms = selectedHour
    ? classrooms.filter((classroom) => !draftEntries.some((entry) =>
      (entry.sessionClassroomId || entry.classroomId) === classroom.id && entry.period === selectedHour
    ))
    : []
  const availableHours = HOURS.filter((hour) => classrooms.some((classroom) =>
    !draftEntries.some((entry) =>
      (entry.sessionClassroomId || entry.classroomId) === classroom.id && entry.period === hour.id
    )
  ))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedDraftId || !selectedHour || !selectedClassroomId) {
      setMessage('Select a schedule draft, hour, and available room')
      return
    }
    setMessage('')
    setBusy(true)
    const customRange = form.gradeRange === 'custom'
    const submitData = { ...form, gradeRange: customRange ? `${form.gradeRangeFrom}-${form.gradeRangeTo}` : form.gradeRange, gradeRangeFrom: customRange ? getGradeIndex(form.gradeRangeFrom) : undefined, gradeRangeTo: customRange ? getGradeIndex(form.gradeRangeTo) : undefined }
    const response = await fetch('/api/admin/class-teaching-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submitData) })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) { setMessage(payload.error || 'Unable to create class'); return }
    const existingEntries = draftEntries.map((entry) => ({
      classTeachingRequestId: entry.classTeachingRequestId,
      classroomId: entry.sessionClassroomId || entry.classroomId,
      period: entry.period
    }))
    const draftResponse = await fetch(`/api/admin/schedule/${form.sessionId}/drafts/${selectedDraftId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: [...existingEntries, {
          classTeachingRequestId: payload.request.id,
          classroomId: selectedClassroomId,
          period: selectedHour
        }]
      })
    })
    if (!draftResponse.ok) { setMessage('Class was created, but could not be added to the selected schedule draft'); return }
    setForm(initialForm)
    setDrafts([])
    setDraftEntries([])
    setClassrooms([])
    setSelectedDraftId('')
    setSelectedHour('')
    setSelectedClassroomId('')
    setOpen(false)
    setMessage('Class created')
    onCreated()
  }

  return (
    <section className="rounded-lg bg-white p-5 shadow">
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="text-lg font-semibold text-gray-900">Create Class</h2><p className="text-sm text-gray-600">Create an approved class directly without a parent teaching request.</p></div>
        <button onClick={() => setOpen((value) => !value)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">{open ? 'Close' : 'New Class'}</button>
      </div>
      {open && <form onSubmit={submit} className="mt-5 space-y-5 border-t pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Session<select required value={form.sessionId} onChange={(event) => { setForm({ ...form, sessionId: event.target.value }); loadScheduleOptions(event.target.value) }} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">Select session...</option><SessionOptions sessions={sessions} /></select></label>
          <label className="text-sm font-medium text-gray-700">Class Name<input required value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">Schedule Draft<select required disabled={loadingScheduleOptions || !form.sessionId} value={selectedDraftId} onChange={(event) => loadDraftEntries(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">{loadingScheduleOptions ? 'Loading drafts...' : 'Select draft...'}</option>{drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.name}</option>)}</select></label>
          <label className="text-sm font-medium text-gray-700">Hour<select required disabled={!selectedDraftId} value={selectedHour} onChange={(event) => { setSelectedHour(event.target.value); setSelectedClassroomId('') }} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">Select hour...</option>{availableHours.map((hour) => <option key={hour.id} value={hour.id}>{hour.label}</option>)}</select></label>
          <label className="text-sm font-medium text-gray-700">Room<select required disabled={!selectedHour} value={selectedClassroomId} onChange={(event) => setSelectedClassroomId(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">Select available room...</option>{availableClassrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}</select></label>
        </div>
        <label className="block text-sm font-medium text-gray-700">Description<textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
        <div className="grid gap-4 sm:grid-cols-3">
         <label className="text-sm font-medium text-gray-700">Grade Range<select required value={form.gradeRange} onChange={(event) => setForm({ ...form, gradeRange: event.target.value, gradeRangeFrom: '', gradeRangeTo: '' })} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">Select grade range...</option>{gradeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="custom">Custom Grade Range</option></select>{form.gradeRange === 'custom' && <div className="mt-2 grid grid-cols-2 gap-2"><select required value={form.gradeRangeFrom} onChange={(event) => setForm({ ...form, gradeRangeFrom: event.target.value })} className="block w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"><option value="">From...</option>{CHILD_GRADE_OPTIONS.filter((grade) => grade !== 'Graduated').map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select><select required value={form.gradeRangeTo} onChange={(event) => setForm({ ...form, gradeRangeTo: event.target.value })} className="block w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"><option value="">To...</option>{CHILD_GRADE_OPTIONS.filter((grade) => grade !== 'Graduated').map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></div>}</label>
          <label className="text-sm font-medium text-gray-700">Max Students<input required type="number" min="1" max="100" value={form.maxStudents} onChange={(event) => setForm({ ...form, maxStudents: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
          <label className="text-sm font-medium text-gray-700">Helpers Needed<input type="number" min="0" max="10" value={form.helpersNeeded} onChange={(event) => setForm({ ...form, helpersNeeded: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Assigned Teacher<select value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value, teacherName: '' })} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">Use placeholder instead</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName} ({teacher.email})</option>)}</select></label>
           <label className="text-sm font-medium text-gray-700">Teacher Placeholder{!form.teacherId && ' *'}<input required={!form.teacherId} value={form.teacherName} disabled={Boolean(form.teacherId)} onChange={(event) => setForm({ ...form, teacherName: event.target.value })} placeholder="e.g. Staff Instructor" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal disabled:bg-gray-100" /></label>
        </div>
         <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">Co-Teacher<select value={form.coTeacherId} onChange={(event) => { const teacher = teachers.find((option) => option.id === event.target.value); setForm({ ...form, coTeacherId: event.target.value, coTeacher: teacher ? `${teacher.firstName} ${teacher.lastName}` : '' }) }} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">Write in below</option>{teachers.filter((teacher) => teacher.id !== form.teacherId).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName} ({teacher.email})</option>)}</select><input value={form.coTeacher} disabled={Boolean(form.coTeacherId)} onChange={(event) => setForm({ ...form, coTeacher: event.target.value })} placeholder="Write-in co-teacher name" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal disabled:bg-gray-100" /></label><label className="text-sm font-medium text-gray-700">Classroom Needs<input value={form.classroomNeeds} onChange={(event) => setForm({ ...form, classroomNeeds: event.target.value })} placeholder="TV/projector, supplies" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label></div>
        <label className="block text-sm font-medium text-gray-700">Scheduling Requirements<textarea value={form.schedulingRequirements} onChange={(event) => setForm({ ...form, schedulingRequirements: event.target.value })} rows={2} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
         <div className="flex flex-wrap items-end gap-4"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.registrationFeeExempt} onChange={(event) => setForm({ ...form, registrationFeeExempt: event.target.checked })} />Exempt from registration fee</label><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.requiresFee} onChange={(event) => setForm({ ...form, requiresFee: event.target.checked })} />Requires class fee</label>{form.requiresFee && <label className="text-sm font-medium text-gray-700">Fee Amount<input required type="number" min="0" step="0.01" value={form.feeAmount} onChange={(event) => setForm({ ...form, feeAmount: event.target.value })} className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>}</div>
        <button disabled={busy} className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating...' : 'Create Approved Class'}</button>
      </form>}
      {message && <p className="mt-4 text-sm text-blue-700">{message}</p>}
    </section>
  )
}
