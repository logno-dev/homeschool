export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['AS', 'American Samoa'], ['GU', 'Guam'],
  ['MP', 'Northern Mariana Islands'], ['PR', 'Puerto Rico'], ['VI', 'US Virgin Islands'],
  ['AA', 'Armed Forces Americas'], ['AE', 'Armed Forces Europe'], ['AP', 'Armed Forces Pacific'],
] as const

export interface USAddress {
  street: string
  unit: string
  city: string
  state: string
  zip: string
}

export function parseAddress(address: string): USAddress {
  const empty = { street: address, unit: '', city: '', state: '', zip: '' }
  // Read our multiline format and common legacy comma-separated addresses.
  const parts = address.split(/\n|,/).map(part => part.trim()).filter(Boolean)
  const last = parts.pop() || ''
  const match = last.match(/^(.*?)\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/)
  if (!match || !US_STATES.some(([code]) => code === match[2].toUpperCase())) return empty
  const city = match[1].trim() || parts.pop() || ''
  if (!parts.length || !city) return empty
  return { street: parts[0], unit: parts.slice(1).join(', '), city, state: match[2].toUpperCase(), zip: match[3] }
}

export function formatAddress(address: USAddress): string {
  return [address.street.trim(), address.unit.trim(), `${address.city.trim()}, ${address.state} ${address.zip.trim()}`]
    .filter(Boolean).join('\n')
}
