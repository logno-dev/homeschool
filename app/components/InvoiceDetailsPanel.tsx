'use client'

type InvoiceDetails = {
  invoiceOrganizationName: string
  invoiceOrganizationAddress: string
  invoiceOrganizationCity: string
  invoiceOrganizationState: string
  invoiceOrganizationPostalCode: string
  invoiceOrganizationPhone: string
  invoiceOrganizationEmail: string
  invoiceOrganizationWebsite: string
  invoicePaymentInstructions: string
  invoiceDonationStatement: string
}

export default function InvoiceDetailsPanel({ details, setDetails, onSave, isSaving }: { details: InvoiceDetails; setDetails: (updater: (current: InvoiceDetails) => InvoiceDetails) => void; onSave: () => void; isSaving: boolean }) {
  const update = (key: keyof InvoiceDetails, value: string) => setDetails((current) => ({ ...current, [key]: value }))
  const fields: Array<[keyof InvoiceDetails, string, string]> = [
    ['invoiceOrganizationName', 'Organization name', 'DVCLC'],
    ['invoiceOrganizationAddress', 'Street address', '123 Main Street'],
    ['invoiceOrganizationCity', 'City', 'Anytown'],
    ['invoiceOrganizationState', 'State / province', 'CA'],
    ['invoiceOrganizationPostalCode', 'Postal code', '90210'],
    ['invoiceOrganizationPhone', 'Phone', '(555) 555-5555'],
    ['invoiceOrganizationEmail', 'Contact email', 'office@example.com'],
    ['invoiceOrganizationWebsite', 'Website', 'https://example.com']
  ]
  return <div className="space-y-6"><div><h2 className="text-xl font-semibold text-gray-900">Invoice and Receipt Details</h2><p className="mt-1 text-sm text-gray-600">These details appear on generated invoices, billing statements, and donation receipts. Document dates and numbers are generated automatically.</p></div><section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold text-gray-900">Organization details</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{fields.map(([key, label, placeholder]) => <label key={key} className="text-sm font-medium text-gray-700">{label}<input type="text" value={details[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>)}</div></section><section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold text-gray-900">Document footer text</h3><label className="mt-4 block text-sm font-medium text-gray-700">Payment instructions<textarea value={details.invoicePaymentInstructions} onChange={(event) => update('invoicePaymentInstructions', event.target.value)} placeholder="Payment is due by the date shown above." rows={3} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label><label className="mt-4 block text-sm font-medium text-gray-700">Donation receipt statement<textarea value={details.invoiceDonationStatement} onChange={(event) => update('invoiceDonationStatement', event.target.value)} placeholder="No goods or services were provided in exchange for this contribution." rows={3} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label></section><button type="button" onClick={onSave} disabled={isSaving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{isSaving ? 'Saving...' : 'Save Invoice Details'}</button></div>
}
