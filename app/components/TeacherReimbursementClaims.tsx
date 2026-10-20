'use client'

import { useEffect, useState } from 'react'

interface ReimbursableClass {
  classTeachingRequestId: string
  className: string
  sessionName: string
  dueDate: string | null
  feeAmount: number | null
  collectedAmount: number
  availableAmount: number
}

interface Claim {
  id: string
  className: string
  sessionName: string
  requestedAmount: number | null
  amount: number
  status: string
  notes: string | null
  reviewNotes: string | null
  receiptFilename: string | null
  paymentMethod: string | null
  paymentDetailsLabel: string | null
  paymentDetails: string | null
  paidDate: string | null
  createdAt: string
  isLate: boolean
}

interface ReimbursementMethod {
  id: string
  label: string
  detailsLabel: string
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  paid: 'bg-green-100 text-green-800',
}

export default function TeacherReimbursementClaims({ onVisibilityChange }: { onVisibilityChange?: (visible: boolean) => void }) {
  const [classes, setClasses] = useState<ReimbursableClass[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [methods, setMethods] = useState<ReimbursementMethod[]>([])
  const [today, setToday] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [paymentDetails, setPaymentDetails] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    const response = await fetch('/api/teacher/reimbursements')
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load reimbursement claims')
    const nextClasses = payload.classes || []
    setClasses(nextClasses)
    setClaims(payload.claims || [])
    const nextMethods = payload.methods || []
    setMethods(nextMethods)
    setPaymentMethodId((current) => nextMethods.some((method: ReimbursementMethod) => method.id === current) ? current : nextMethods[0]?.id || '')
    setToday(payload.today || '')
    setSelectedClassId((current) => current || nextClasses.find((item: ReimbursableClass) => item.availableAmount > 0)?.classTeachingRequestId || '')
    onVisibilityChange?.(nextClasses.length > 0 || (payload.claims || []).length > 0)
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load reimbursement claims')).finally(() => setLoading(false))
  }, [])

  const selectedClass = classes.find((item) => item.classTeachingRequestId === selectedClassId)
  const selectedMethod = methods.find((method) => method.id === paymentMethodId)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    if (!receipt) return setMessage('Choose a receipt image or PDF.')
    setSubmitting(true)
    setMessage('')
    try {
      const formData = new FormData()
      formData.set('classTeachingRequestId', selectedClassId)
      formData.set('amount', amount)
      formData.set('notes', notes)
      formData.set('paymentMethod', paymentMethodId)
      formData.set('paymentDetails', paymentDetails)
      formData.set('receipt', receipt)
      const response = await fetch('/api/teacher/reimbursements', { method: 'POST', body: formData })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to submit reimbursement claim')
      setAmount('')
      setNotes('')
      setReceipt(null)
      setPaymentDetails('')
      const input = form.elements.namedItem('receipt') as HTMLInputElement | null
      if (input) input.value = ''
      setMessage('Your reimbursement claim was submitted for review.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit reimbursement claim')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading reimbursement claims...</section>
  if (classes.length === 0 && claims.length === 0) return null

  return <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
    <div className="bg-gradient-to-r from-emerald-900 to-teal-800 px-6 py-5 text-white"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Class Expenses</p><h2 className="mt-1 text-2xl font-semibold">Teacher Reimbursements</h2><p className="mt-1 text-sm text-emerald-100">Submit receipts for supplies purchased with your class fees.</p></div>
    <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <div>
        <h3 className="font-semibold text-slate-900">Submit a claim</h3>
        {classes.some((item) => item.availableAmount > 0) ? <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700">Class<select required value={selectedClassId} onChange={(event) => { setSelectedClassId(event.target.value); setAmount('') }} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="">Choose a class</option>{classes.map((item) => <option key={item.classTeachingRequestId} value={item.classTeachingRequestId} disabled={item.availableAmount <= 0}>{item.sessionName}: {item.className} ({currency.format(item.availableAmount)} available)</option>)}</select></label>
          {selectedClass && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950"><p><strong>{currency.format(selectedClass.availableAmount)}</strong> available from {currency.format(selectedClass.collectedAmount)} in net class fees.</p>{selectedClass.dueDate ? <p className={`mt-1 ${today > selectedClass.dueDate ? 'font-medium text-amber-800' : 'text-emerald-800'}`}>Submission deadline: {new Date(`${selectedClass.dueDate}T12:00:00`).toLocaleDateString()}{today > selectedClass.dueDate ? '. Late submissions are still accepted.' : ''}</p> : <p className="mt-1 text-emerald-800">No submission deadline has been set.</p>}</div>}
          <label className="block text-sm font-medium text-slate-700">Amount<input required type="number" min="0.01" max={selectedClass?.availableAmount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" placeholder="0.00" /></label>
          <label className="block text-sm font-medium text-slate-700">Reimbursement method<select required value={paymentMethodId} onChange={(event) => { setPaymentMethodId(event.target.value); setPaymentDetails('') }} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="">Choose a method</option>{methods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
          {selectedMethod && <label className="block text-sm font-medium text-slate-700">{selectedMethod.detailsLabel}<input required type="text" maxLength={500} value={paymentDetails} onChange={(event) => setPaymentDetails(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label>}
          <label className="block text-sm font-medium text-slate-700">Receipt <span className="font-normal text-slate-500">(PDF or image, up to 10 MB)</span><input required name="receipt" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => setReceipt(event.target.files?.[0] || null)} className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium" /></label>
          <label className="block text-sm font-medium text-slate-700">Purchase notes <span className="font-normal text-slate-500">(optional)</span><textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Briefly describe the supplies purchased" /></label>
          <button disabled={submitting || !selectedClassId} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit for review'}</button>
        </form> : <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">There are no remaining class fees available to claim.</p>}
        {message && <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">Claim history</h3>
        {claims.length === 0 ? <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No reimbursement claims submitted yet.</p> : <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">{claims.map((claim) => <article key={claim.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{claim.className}</p><p className="text-xs text-slate-500">{claim.sessionName} · Submitted {new Date(claim.createdAt).toLocaleDateString()}{claim.isLate ? ' · Late' : ''}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[claim.status] || 'bg-slate-100 text-slate-700'}`}>{claim.status === 'paid' ? 'Reimbursed' : claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}</span></div><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"><span><strong>{currency.format(claim.amount)}</strong>{claim.requestedAmount && claim.requestedAmount !== claim.amount ? ` approved of ${currency.format(claim.requestedAmount)} requested` : ''}</span>{claim.receiptFilename && <a href={`/api/teacher-reimbursements/${claim.id}/receipt`} target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:underline">View receipt</a>}</div>{claim.paymentMethod && <p className="mt-2 text-sm text-slate-700"><strong>{claim.paymentMethod}</strong>{claim.paymentDetails && <> · {claim.paymentDetailsLabel || 'Payment information'}: {claim.paymentDetails}</>}</p>}{claim.reviewNotes && <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-700"><strong>Admin note:</strong> {claim.reviewNotes}</p>}</article>)}</div>}
      </div>
    </div>
  </section>
}
