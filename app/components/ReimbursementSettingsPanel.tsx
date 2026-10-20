'use client'

interface ReimbursementMethod {
  id: string
  label: string
  detailsLabel: string
}

export default function ReimbursementSettingsPanel({ methods, setMethods, onSave, isSaving }: {
  methods: ReimbursementMethod[]
  setMethods: (methods: ReimbursementMethod[]) => void
  onSave: () => void
  isSaving: boolean
}) {
  const update = (index: number, changes: Partial<ReimbursementMethod>) => setMethods(methods.map((method, itemIndex) => itemIndex === index ? { ...method, ...changes } : method))

  return <div className="space-y-5">
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Teacher reimbursement methods</h2>
      <p className="mt-1 text-sm text-gray-600">Configure the payout choices teachers see and the payment information requested for each choice.</p>
    </div>
    <div className="space-y-3">
      {methods.map((method, index) => <div key={method.id} className="grid gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-medium text-gray-700">Method name<input required maxLength={100} value={method.label} onChange={(event) => update(index, { label: event.target.value })} placeholder="Zelle" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" /></label>
        <label className="text-sm font-medium text-gray-700">Follow-up field label<input required maxLength={100} value={method.detailsLabel} onChange={(event) => update(index, { detailsLabel: event.target.value })} placeholder="Zelle Username" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" /></label>
        <button type="button" disabled={methods.length === 1} onClick={() => setMethods(methods.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">Remove</button>
      </div>)}
    </div>
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => setMethods([...methods, { id: `method-${Date.now()}`, label: '', detailsLabel: '' }])} className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">Add method</button>
      <button type="button" disabled={isSaving} onClick={onSave} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{isSaving ? 'Saving...' : 'Save Settings'}</button>
    </div>
  </div>
}
