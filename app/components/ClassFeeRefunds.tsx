'use client'

import { useEffect, useState } from 'react'
import HistoricalClassRefund from './HistoricalClassRefund'

interface Review {
  charge: { id: string; childName: string; className: string; amountCents: number; refundedCents: number; status: string; billingTreatment: string }
  familyName: string
  sessionName: string
  paidAmount: number | null
  totalFee: number | null
}
interface History {
  id: string; chargeId: string; amountCents: number; method: string; reference: string | null; notes: string; refundedAt: string
}
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

export default function ClassFeeRefunds({ onRecorded }: { onRecorded: () => void }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [history, setHistory] = useState<History[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [requestId, setRequestId] = useState('')
  const [form, setForm] = useState({ amount: '', method: 'paypal', reference: '', notes: '', refundedAt: new Date().toISOString().slice(0, 10) })
  const selected = reviews.find((review) => review.charge.id === selectedId)
  const remaining = selected ? (selected.charge.amountCents - selected.charge.refundedCents) / 100 : 0

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/class-fee-refunds')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setReviews(data.charges)
      setHistory(data.history)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to load refunds')
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const choose = (review: Review) => {
    setSelectedId(review.charge.id)
    setRequestId(crypto.randomUUID())
    setError('')
    setSuccess('')
    setForm({ amount: ((review.charge.amountCents - review.charge.refundedCents) / 100).toFixed(2), method: 'paypal', reference: '', notes: '', refundedAt: new Date().toISOString().slice(0, 10) })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected || saving) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/admin/class-fee-refunds', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: requestId, chargeId: selectedId, amount: form.method === 'retain' ? 0 : Number(form.amount) })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to record refund')
      setSuccess('Decision recorded. The family bill and class reimbursement balance have been updated.')
      setSelectedId('')
      await load()
      onRecorded()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to record refund') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Class fee refund review</h2>
        <p className="mt-2 text-sm text-gray-600">Dropped-class fees remain charged until reviewed. Decide how much to refund, waive an unpaid fee, or retain the fee. Partial refunds retain the remainder.</p>
        <p className="mt-2 text-sm text-gray-600">This records completed refunds; it does not send money through PayPal. Issue the refund externally first, then record its date and reference here.</p>
      </div>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}<button type="button" disabled={saving} onClick={() => { setError(''); void load() }} className="ml-3 underline">Reload</button></div>}
      {success && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{success}</p>}
      <HistoricalClassRefund onRecorded={() => { void load(); onRecorded() }} />
      {loading ? <p role="status">Loading refund reviews…</p> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr>{['Family / session', 'Child / class', 'Original fee', 'Refunded / waived', 'Remaining fee', 'Review'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {reviews.map((review) => <tr key={review.charge.id}>
                <td className="px-4 py-3">{review.familyName}<div className="text-xs text-gray-500">{review.sessionName}</div></td>
                <td className="px-4 py-3">{review.charge.childName}<div className="text-xs text-gray-500">{review.charge.className}</div></td>
                <td className="px-4 py-3">{money(review.charge.amountCents / 100)}</td>
                <td className="px-4 py-3">{money(review.charge.refundedCents / 100)}</td>
                <td className="px-4 py-3">{review.charge.billingTreatment === 'already_removed' ? <span className="text-xs text-gray-500">Already removed from bill</span> : money((review.charge.amountCents - review.charge.refundedCents) / 100)}</td>
                <td className="px-4 py-3"><button type="button" disabled={saving} onClick={() => choose(review)} className="rounded-lg px-3 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">{review.charge.status === 'review' ? 'Review refund' : 'View / adjust'}</button></td>
              </tr>)}
            </tbody>
          </table>
          {!reviews.length && <p className="p-8 text-center text-gray-500">No dropped-class fees to review.</p>}
        </div>
      )}
      {selected && <section className="rounded-xl border border-blue-200 bg-white p-6">
        <h3 className="font-semibold">{selected.familyName}: {selected.charge.childName} — {selected.charge.className}</h3>
        <p className="mt-2 text-sm text-gray-600">{selected.charge.billingTreatment === 'already_removed' ? 'Original fee not yet refunded' : 'Remaining class charge'}: {money(remaining)} · Family paid: {money(selected.paidAmount || 0)} · Bill total: {money(selected.totalFee || 0)}</p>
        {selected.charge.billingTreatment === 'already_removed' && <p className="mt-3 text-sm text-gray-600">This fee was already removed from the bill. Use “Record a historical class refund” above for any further partial refund, with the same original fee.</p>}
        {remaining > 0 && selected.charge.billingTreatment !== 'already_removed' && <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <fieldset disabled={saving} className="contents">
            <label className="text-sm">Decision / refund method<select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value, reference: '' })} className="mt-1 block w-full rounded-lg border p-2">
              <option value="paypal">Record PayPal refund</option><option value="cash">Record cash refund</option><option value="check">Record check refund</option><option value="wire">Record wire refund</option><option value="waiver">Waive unpaid class fee (no money returned)</option>{selected.charge.status === 'review' && <option value="retain">Retain fee — no refund</option>}
            </select></label>
            {form.method !== 'retain' && <label className="text-sm">Amount<input type="number" min="0.01" max={remaining} step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>}
            <label className="text-sm">Refund / decision date<input type="date" required value={form.refundedAt} onChange={(e) => setForm({ ...form, refundedAt: e.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>
            {!['retain', 'waiver'].includes(form.method) && <label className="text-sm">Refund reference {form.method === 'paypal' ? '(required)' : '(optional)'}<input required={form.method === 'paypal'} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>}
            <label className="text-sm sm:col-span-2">Reason / notes<textarea required value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>
            <div className="flex gap-3 sm:col-span-2"><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Recording…' : form.method === 'retain' ? 'Record decision' : form.method === 'waiver' ? 'Apply fee waiver' : 'Record completed refund'}</button><button type="button" onClick={() => setSelectedId('')} className="rounded-lg px-4 py-2 text-sm hover:bg-gray-100">Close</button></div>
          </fieldset>
        </form>}
        <h4 className="mt-6 text-sm font-semibold">Decision history</h4>
        <ul className="mt-2 space-y-3 text-sm">{history.filter((item) => item.chargeId === selectedId).map((item) => <li key={item.id} className="rounded-lg bg-gray-50 p-3"><p>{item.refundedAt} · {item.method} · {money(item.amountCents / 100)}</p><p className="mt-1 whitespace-pre-wrap break-words">{item.notes}</p>{item.reference && <p className="mt-1 break-all text-xs text-gray-500">Reference: {item.reference}</p>}</li>)}</ul>
      </section>}
    </div>
  )
}
