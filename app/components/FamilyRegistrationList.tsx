'use client'

import { useMemo, useState } from 'react'
import Modal from './Modal'

interface Person {
  id: string
  firstName: string
  lastName: string
  email?: string
}

interface FamilyStatus {
  status: string
  volunteerRequirementsMet: boolean
  adminOverride: boolean
  adminOverrideReason: string | null
  overriddenBy: string | null
  overriddenAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

interface FamilyFee {
  totalFee: number
  registrationFee: number
  classFees: number
  paidAmount: number
  remainingBalance: number
  status: string
  dueDate: string
  overpaymentAmount: number
  overpaymentStatus: string
}

export interface FamilyRegistrationSummary {
  familyId: string
  familyName: string
  email: string
  phone: string
  registrationState: 'in_cart' | 'in_progress' | 'complete' | 'override_needed' | 'override_denied'
  paymentState: 'not_generated' | 'no_payment_due' | 'paid' | 'partial' | 'unpaid' | 'overdue'
  hasCart: boolean
  needsResolution: boolean
  status: FamilyStatus | null
  fee: FamilyFee | null
  emergencyContact: string | null
  emergencyPhone: string | null
  guardians: Person[]
  classes: Array<{
    id: string
    status: string
    holdExpiresAt: string | null
    child: Person & { grade: string }
    schedule: { id: string; period: string }
    className: string
    teacherName: string | null
    classroom: string
  }>
  volunteerAssignments: Array<{
    id: string
    status: string
    holdExpiresAt: string | null
    period: string
    volunteerType: string
    guardian: Person
    className: string | null
    classroom: string | null
    volunteerJobTitle: string | null
  }>
}

const registrationBadges = {
  in_cart: ['In cart', 'bg-blue-100 text-blue-800'],
  in_progress: ['Incomplete', 'bg-amber-100 text-amber-800'],
  complete: ['Complete', 'bg-green-100 text-green-800'],
  override_needed: ['Override needed', 'bg-purple-100 text-purple-800'],
  override_denied: ['Override denied', 'bg-red-100 text-red-800']
} as const

const paymentBadges = {
  not_generated: ['No fee generated', 'bg-gray-100 text-gray-700'],
  no_payment_due: ['No payment due', 'bg-gray-100 text-gray-700'],
  paid: ['Paid', 'bg-green-100 text-green-800'],
  partial: ['Partially paid', 'bg-amber-100 text-amber-800'],
  unpaid: ['Unpaid', 'bg-red-100 text-red-800'],
  overdue: ['Overdue', 'bg-red-100 text-red-800']
} as const

const periodNames: Record<string, string> = { first: 'First Hour', second: 'Second Hour', lunch: 'Lunch', third: 'Third Hour', non_period: 'General' }
const money = (amount: number) => amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function Badge({ value, config }: { value: string; config: Record<string, readonly [string, string]> }) {
  const [label, classes] = config[value] || [value.replaceAll('_', ' '), 'bg-gray-100 text-gray-700']
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>
}

function itemStatus(status: string, holdExpiresAt: string | null) {
  if (status === 'hold') return holdExpiresAt ? 'In cart' : 'Needs reassignment'
  if (status === 'pending') return 'Pending approval'
  return status.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

export default function FamilyRegistrationList({ families }: { families: FamilyRegistrationSummary[] }) {
  const [selectedFamily, setSelectedFamily] = useState<FamilyRegistrationSummary | null>(null)
  const [query, setQuery] = useState('')
  const filteredFamilies = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return families
    return families.filter((family) => [family.familyName, family.email, ...family.guardians.map((guardian) => `${guardian.firstName} ${guardian.lastName}`)].some((value) => value.toLowerCase().includes(normalized)))
  }, [families, query])

  return (
    <>
      <section className="overflow-hidden rounded-lg bg-white shadow">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Family Registrations</h2>
            <p className="text-sm text-gray-500">{families.length} families with activity in this session</p>
          </div>
          <label className="w-full sm:w-72">
            <span className="sr-only">Search family registrations</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search family or guardian" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </label>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr><th className="px-6 py-3">Family</th><th className="px-4 py-3">Registration</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Selections</th><th className="px-6 py-3 text-right">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredFamilies.map((family) => (
                <tr key={family.familyId} role="button" tabIndex={0} onClick={() => setSelectedFamily(family)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedFamily(family) }} className="cursor-pointer transition hover:bg-blue-50 focus:bg-blue-50 focus:outline-none">
                  <td className="px-6 py-4"><div className="font-semibold text-gray-900">{family.familyName}</div><div className="text-xs text-gray-500">{family.email}</div></td>
                  <td className="px-4 py-4"><span className="flex flex-wrap gap-1"><Badge value={family.registrationState} config={registrationBadges} />{family.hasCart && <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">Cart changes</span>}{family.needsResolution && <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Needs resolution</span>}</span></td>
                  <td className="px-4 py-4"><Badge value={family.paymentState} config={paymentBadges} /></td>
                  <td className="px-4 py-4 text-gray-600">{family.classes.length} class{family.classes.length === 1 ? '' : 'es'} · {family.volunteerAssignments.length} volunteer</td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">{family.fee ? money(family.fee.remainingBalance) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-200 md:hidden">
          {filteredFamilies.map((family) => (
            <button key={family.familyId} type="button" onClick={() => setSelectedFamily(family)} className="block w-full px-4 py-4 text-left hover:bg-blue-50">
              <span className="flex items-start justify-between gap-3"><span><span className="block font-semibold text-gray-900">{family.familyName}</span><span className="block text-xs text-gray-500">{family.email}</span></span><span className="font-medium text-gray-900">{family.fee ? money(family.fee.remainingBalance) : '—'}</span></span>
              <span className="mt-3 flex flex-wrap gap-2"><Badge value={family.registrationState} config={registrationBadges} /><Badge value={family.paymentState} config={paymentBadges} />{family.hasCart && <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">Cart changes</span>}{family.needsResolution && <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Needs resolution</span>}</span>
              <span className="mt-2 block text-xs text-gray-500">{family.classes.length} classes · {family.volunteerAssignments.length} volunteer commitments</span>
            </button>
          ))}
        </div>
        {!filteredFamilies.length && <p className="px-6 py-10 text-center text-sm text-gray-500">No family registrations match this search.</p>}
      </section>

      <Modal isOpen={Boolean(selectedFamily)} onClose={() => setSelectedFamily(null)} title={selectedFamily?.familyName || 'Family registration'} size="xl">
        {selectedFamily && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2"><Badge value={selectedFamily.registrationState} config={registrationBadges} /><Badge value={selectedFamily.paymentState} config={paymentBadges} />{selectedFamily.hasCart && <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">Cart changes</span>}{selectedFamily.needsResolution && <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Needs resolution</span>}</div>

            <section className="grid gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <div><div className="font-semibold text-gray-900">Family contact</div><div className="mt-1 text-gray-600">{selectedFamily.email}</div><div className="text-gray-600">{selectedFamily.phone}</div></div>
              <div><div className="font-semibold text-gray-900">Guardians</div><div className="mt-1 text-gray-600">{selectedFamily.guardians.map((guardian) => `${guardian.firstName} ${guardian.lastName}${guardian.email ? ` (${guardian.email})` : ''}`).join(', ') || 'None listed'}</div></div>
              {(selectedFamily.emergencyContact || selectedFamily.emergencyPhone) && <div className="sm:col-span-2"><div className="font-semibold text-gray-900">Emergency contact</div><div className="mt-1 text-gray-600">{selectedFamily.emergencyContact}{selectedFamily.emergencyPhone ? ` · ${selectedFamily.emergencyPhone}` : ''}</div></div>}
            </section>

            {selectedFamily.status?.adminOverride && (
              <section className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                <h3 className="font-semibold">Admin override</h3>
                <p className="mt-1">{selectedFamily.status.adminOverrideReason || 'No reason recorded.'}</p>
                {selectedFamily.status.overriddenAt && <p className="mt-2 text-xs text-purple-700">Reviewed {new Date(selectedFamily.status.overriddenAt).toLocaleString()}</p>}
              </section>
            )}

            <section>
              <h3 className="font-semibold text-gray-900">Classes</h3>
              <div className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
                {selectedFamily.classes.map((registration) => (
                  <div key={registration.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                    <div><div className="font-medium text-gray-900">{registration.className}</div><div className="text-gray-600">{registration.child.firstName} {registration.child.lastName} · Grade {registration.child.grade}</div><div className="text-xs text-gray-500">{periodNames[registration.schedule.period] || registration.schedule.period} · {registration.classroom}{registration.teacherName ? ` · ${registration.teacherName}` : ''}</div></div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{itemStatus(registration.status, registration.holdExpiresAt)}</span>
                  </div>
                ))}
                {!selectedFamily.classes.length && <p className="p-4 text-sm text-gray-500">No class selections.</p>}
              </div>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">Volunteer Commitments</h3>
              <div className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
                {selectedFamily.volunteerAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                    <div><div className="font-medium text-gray-900">{assignment.volunteerJobTitle || assignment.className || assignment.volunteerType.replaceAll('_', ' ')}</div><div className="text-gray-600">{assignment.guardian.firstName} {assignment.guardian.lastName}</div><div className="text-xs text-gray-500">{periodNames[assignment.period] || assignment.period}{assignment.classroom ? ` · ${assignment.classroom}` : ''}</div></div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{itemStatus(assignment.status, assignment.holdExpiresAt)}</span>
                  </div>
                ))}
                {!selectedFamily.volunteerAssignments.length && <p className="p-4 text-sm text-gray-500">No volunteer commitments.</p>}
              </div>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">Payment</h3>
              {selectedFamily.fee ? <dl className="mt-2 grid gap-3 rounded-lg border border-gray-200 p-4 text-sm sm:grid-cols-3"><div><dt className="text-gray-500">Registration fee</dt><dd className="font-semibold text-gray-900">{money(selectedFamily.fee.registrationFee)}</dd></div><div><dt className="text-gray-500">Class fees</dt><dd className="font-semibold text-gray-900">{money(selectedFamily.fee.classFees)}</dd></div><div><dt className="text-gray-500">Total</dt><dd className="font-semibold text-gray-900">{money(selectedFamily.fee.totalFee)}</dd></div><div><dt className="text-gray-500">Paid</dt><dd className="font-semibold text-green-700">{money(selectedFamily.fee.paidAmount)}</dd></div><div><dt className="text-gray-500">Balance</dt><dd className="font-semibold text-gray-900">{money(selectedFamily.fee.remainingBalance)}</dd></div><div><dt className="text-gray-500">Due date</dt><dd className="text-gray-900">{selectedFamily.fee.dueDate}</dd></div>{selectedFamily.fee.overpaymentAmount > 0 && <div className="sm:col-span-3"><dt className="text-gray-500">Overpayment</dt><dd className="text-gray-900">{money(selectedFamily.fee.overpaymentAmount)} · {selectedFamily.fee.overpaymentStatus}</dd></div>}</dl> : <p className="mt-2 rounded-lg border border-gray-200 p-4 text-sm text-gray-500">No fee has been generated.</p>}
            </section>
          </div>
        )}
      </Modal>
    </>
  )
}
