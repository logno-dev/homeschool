'use client'

import { useState } from 'react'
import type { Session } from '@/lib/schema'
import { GRADE_ORDER, PRE_K_LABEL, getGradeIndex } from '@/lib/grades'

interface Teacher { id: string; firstName: string; lastName: string; email: string }
interface Props { sessions: Session[]; teachers: Teacher[]; onCreated: () => void }

const gradeOptions = ['Pre-K', 'Pre-K-2', 'K-2', '3-5', '6-8', '9-12', 'All Ages']
const initialForm = {
  sessionId: '', className: '', description: '', gradeRange: '', gradeRangeFrom: '', gradeRangeTo: '', maxStudents: '20', helpersNeeded: '0',
  teacherId: '', teacherName: '', coTeacher: '', classroomNeeds: '', registrationFeeExempt: false, requiresFee: false, feeAmount: '', schedulingRequirements: ''
}

export default function AdminClassCreateForm({ sessions, teachers, onCreated }: Props) {
  const [form, setForm] = useState(initialForm)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const customRange = form.gradeRange === 'custom'
    const submitData = { ...form, gradeRange: customRange ? `${form.gradeRangeFrom}-${form.gradeRangeTo}` : form.gradeRange, gradeRangeFrom: customRange ? getGradeIndex(form.gradeRangeFrom) : undefined, gradeRangeTo: customRange ? getGradeIndex(form.gradeRangeTo) : undefined }
    const response = await fetch('/api/admin/class-teaching-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submitData) })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) { setMessage(payload.error || 'Unable to create class'); return }
    setForm(initialForm)
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
          <label className="text-sm font-medium text-gray-700">Session<select required value={form.sessionId} onChange={(event) => setForm({ ...form, sessionId: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">Select session...</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>
          <label className="text-sm font-medium text-gray-700">Class Name<input required value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
        </div>
        <label className="block text-sm font-medium text-gray-700">Description<textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">Grade Range<select required value={form.gradeRange} onChange={(event) => setForm({ ...form, gradeRange: event.target.value, gradeRangeFrom: '', gradeRangeTo: '' })} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">Select grade range...</option>{gradeOptions.map((option) => <option key={option} value={option}>{option}</option>)}<option value="custom">Custom Grade Range</option></select>{form.gradeRange === 'custom' && <div className="mt-2 grid grid-cols-2 gap-2"><select required value={form.gradeRangeFrom} onChange={(event) => setForm({ ...form, gradeRangeFrom: event.target.value })} className="block w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"><option value="">From...</option>{[PRE_K_LABEL, ...GRADE_ORDER].map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select><select required value={form.gradeRangeTo} onChange={(event) => setForm({ ...form, gradeRangeTo: event.target.value })} className="block w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"><option value="">To...</option>{[PRE_K_LABEL, ...GRADE_ORDER].map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></div>}</label>
          <label className="text-sm font-medium text-gray-700">Max Students<input required type="number" min="1" max="100" value={form.maxStudents} onChange={(event) => setForm({ ...form, maxStudents: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
          <label className="text-sm font-medium text-gray-700">Helpers Needed<input type="number" min="0" max="10" value={form.helpersNeeded} onChange={(event) => setForm({ ...form, helpersNeeded: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Assigned Teacher<select value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value, teacherName: '' })} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">Use placeholder instead</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName} ({teacher.email})</option>)}</select></label>
          <label className="text-sm font-medium text-gray-700">Teacher Placeholder<input value={form.teacherName} disabled={Boolean(form.teacherId)} onChange={(event) => setForm({ ...form, teacherName: event.target.value })} placeholder="e.g. Staff Instructor" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal disabled:bg-gray-100" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">Co-Teacher<input value={form.coTeacher} onChange={(event) => setForm({ ...form, coTeacher: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-gray-700">Classroom Needs<input value={form.classroomNeeds} onChange={(event) => setForm({ ...form, classroomNeeds: event.target.value })} placeholder="TV, projector, supplies" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label></div>
        <label className="block text-sm font-medium text-gray-700">Scheduling Requirements<textarea value={form.schedulingRequirements} onChange={(event) => setForm({ ...form, schedulingRequirements: event.target.value })} rows={2} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
         <div className="flex flex-wrap items-end gap-4"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.registrationFeeExempt} onChange={(event) => setForm({ ...form, registrationFeeExempt: event.target.checked })} />Exempt from registration fee</label><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.requiresFee} onChange={(event) => setForm({ ...form, requiresFee: event.target.checked })} />Requires class fee</label>{form.requiresFee && <label className="text-sm font-medium text-gray-700">Fee Amount<input required type="number" min="0" step="0.01" value={form.feeAmount} onChange={(event) => setForm({ ...form, feeAmount: event.target.value })} className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>}</div>
        <button disabled={busy} className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating...' : 'Create Approved Class'}</button>
      </form>}
      {message && <p className="mt-4 text-sm text-blue-700">{message}</p>}
    </section>
  )
}
