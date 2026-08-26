export const APP_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'America/Phoenix', label: 'Arizona Time' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  { value: 'UTC', label: 'UTC' },
] as const

export const DEFAULT_APP_TIMEZONE = 'America/New_York'
export const isAppTimezone = (value: unknown): value is typeof APP_TIMEZONES[number]['value'] => APP_TIMEZONES.some((timezone) => timezone.value === value)
