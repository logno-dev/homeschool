'use client'

import { useEffect, useState } from 'react'

export default function HistoricalClassRefund({ onRecorded }: { onRecorded: () => void }) {
  const [bills, setBills] = useState<{ id: string; familyName: string; sessionName: string }[]>([])
  const [options, setOptions] = useState<{ students: { id: string; name: string }[]; classes: { id: string; name: string }[]; totalFee: number; paidAmount: number } | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [form, setForm] = useState({ feeId: '', childId: '', classId: '', originalAmount: '', amount: '', billTreatment: 'already_removed', method: 'paypal', reference: '', notes: '', refundedAt: new Date().toISOString().slice(0, 10) })
  useEffect(() => {
    setRequestId(crypto.randomUUID())
    fetch('/api/admin/class-fee-refunds/historical').then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setBills(data.bills)
    }).catch((error) => setError(error.message))
  }, [])
  useEffect(() => {
    setOptions(null)
    if (!form.feeId) return
    const controller = new AbortController()
    fetch(`/api/admin/class-fee-refunds/historical?feeId=${encodeURIComponent(form.feeId)}`, { signal: controller.signal }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (!controller.signal.aborted) setOptions(data)
    }).catch((error) => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [form.feeId])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/admin/class-fee-refunds/historical', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: requestId, amount: Number(form.amount), originalAmount: Number(form.originalAmount) })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setSuccess('Historical refund recorded.')
      setRequestId(crypto.randomUUID())
      setForm({ ...form, feeId: '', childId: '', classId: '', originalAmount: '', amount: '', notes: '', reference: '' })
      onRecorded()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to record refund') }
    finally { setSaving(false) }
  }
  return <details className="rounded-xl border border-gray-200 bg-white p-6">
    <summary className="cursor-pointer font-semibold">Record a historical class refund</summary>
    <p className="mt-3 text-sm text-gray-600">For a class dropped before charge snapshots existed. Enter the original fee from your records, not today's class price. This records money already returned externally.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="mt-3 text-sm text-green-700">{success}</p>}
    <form onSubmit={submit} className="mt-4">
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">Family / session bill<select required value={form.feeId} onChange={(e) => { setError(''); setForm({ ...form, feeId: e.target.value, childId: '', classId: '' }) }} className="mt-1 block w-full rounded-lg border p-2"><option value="">Select bill</option>{bills.map((bill) => <option key={bill.id} value={bill.id}>{bill.familyName} — {bill.sessionName}</option>)}</select></label>
        <label className="text-sm">Child<select required disabled={!options} value={form.childId} onChange={(e) => setForm({ ...form, childId: e.target.value })} className="mt-1 block w-full rounded-lg border p-2"><option value="">Select child</option>{options?.students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm">Dropped class<select required disabled={!options} value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="mt-1 block w-full rounded-lg border p-2"><option value="">Select class</option>{options?.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm">Original class fee<input type="number" required min="0.01" step="0.01" value={form.originalAmount} onChange={(e) => setForm({ ...form, originalAmount: e.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Refund amount<input type="number" required min="0.01" step="0.01" max={form.originalAmount || undefined} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <label className="text-sm sm:col-span-2">How is this fee reflected in the current bill?<select value={form.billTreatment} onChange={(e) => setForm({ ...form, billTreatment: e.target.value })} className="mt-1 block w-full rounded-lg border p-2"><option value="already_removed">Already removed — refund from the available overpayment only</option><option value="still_billed">Still included — reconstruct the missing charge and reduce the bill</option></select></label>
        {options && <p className="text-xs text-gray-500 sm:col-span-2">Current bill: ${options.totalFee.toFixed(2)} · Paid: ${options.paidAmount.toFixed(2)} · Available overpayment: ${Math.max(0, options.paidAmount - options.totalFee).toFixed(2)}</p>}
        <label className="text-sm">Refund method<select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="mt-1 block w-full rounded-lg border p-2"><option value="paypal">PayPal</option><option value="cash">Cash</option><option value="check">Check</option><option value="wire">Wire</option></select></label>
        <label className="text-sm">Refund date<input type="date" required value={form.refundedAt} onChange={(e) => setForm({ ...form, refundedAt: e.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <label className="text-sm sm:col-span-2">Refund reference {form.method === 'paypal' ? '(required)' : '(optional)'}<input required={form.method === 'paypal'} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <label className="text-sm sm:col-span-2">Reason and supporting records<textarea required value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <button type="submit" disabled={!options || saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{saving ? 'Recording…' : 'Record completed historical refund'}</button>
      </fieldset>
    </form>
  </details>
}
