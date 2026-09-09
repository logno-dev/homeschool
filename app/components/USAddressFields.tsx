'use client'

import { useId } from 'react'
import { US_STATES, type USAddress } from '@/lib/address'

export default function USAddressFields({ value, onChange }: {
  value: USAddress
  onChange: (value: USAddress) => void
}) {
  const id = useId()
  const inputClass = 'mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white'
  const fields = [
    { key: 'street', label: 'Street address', autoComplete: 'address-line1', placeholder: '123 Main St', required: true },
    { key: 'unit', label: 'Apartment, suite, or unit (optional)', autoComplete: 'address-line2', placeholder: 'Apt 4B', required: false },
    { key: 'city', label: 'City', autoComplete: 'address-level2', placeholder: 'City', required: true },
  ] as const

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-gray-700">US mailing address</legend>
      {fields.map(field => (
        <div key={field.key}>
          <label htmlFor={`${id}-${field.key}`} className="block text-sm font-medium text-gray-700">{field.label}</label>
          <input id={`${id}-${field.key}`} name={field.autoComplete} autoComplete={field.autoComplete}
            value={value[field.key]} onChange={event => onChange({ ...value, [field.key]: event.target.value })}
            required={field.required} pattern={field.required ? '.*\\S.*' : undefined}
            title={field.required ? `Enter a ${field.label.toLowerCase()}.` : undefined}
            placeholder={field.placeholder} className={inputClass} />
        </div>
      ))}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-state`} className="block text-sm font-medium text-gray-700">State / territory</label>
          <select id={`${id}-state`} name="state" autoComplete="address-level1" required value={value.state}
            onChange={event => onChange({ ...value, state: event.target.value })} className={inputClass}>
            <option value="">Select a state</option>
            {US_STATES.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-zip`} className="block text-sm font-medium text-gray-700">ZIP code</label>
          <input id={`${id}-zip`} name="zip" autoComplete="postal-code" required value={value.zip}
            onChange={event => onChange({ ...value, zip: event.target.value })}
            pattern="[0-9]{5}(-[0-9]{4})?" maxLength={10} placeholder="12345 or 12345-6789"
            title="Enter a 5-digit ZIP code or ZIP+4 (12345-6789)." aria-describedby={`${id}-zip-help`} className={inputClass} />
          <p id={`${id}-zip-help`} className="mt-1 text-xs text-gray-500">5 digits, or ZIP+4 (12345-6789).</p>
        </div>
      </div>
    </fieldset>
  )
}
