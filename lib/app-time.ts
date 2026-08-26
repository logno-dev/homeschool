import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { globalSettings } from '@/lib/schema'
import { DEFAULT_APP_TIMEZONE, isAppTimezone } from '@/lib/timezones'

export async function getAppTimezone() {
  try {
    const [setting] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, 'app_timezone')).limit(1)
    return isAppTimezone(setting?.value) ? setting.value : DEFAULT_APP_TIMEZONE
  } catch {
    return DEFAULT_APP_TIMEZONE
  }
}

function timezoneOffset(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' }).formatToParts(date)
  const offset = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT'
  const match = offset.match(/^GMT([+-])(\d{2}):?(\d{2})?$/)
  if (!match) return 0
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0)) * 60_000
}

export function parseAppDate(value: string, timezone: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value)
  const [year, month, day] = value.split('-').map(Number)
  const localMillis = Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
  return new Date(localMillis - timezoneOffset(new Date(localMillis), timezone))
}

export async function parseConfiguredDate(value: string, endOfDay = false) {
  return parseAppDate(value, await getAppTimezone(), endOfDay)
}

export async function getConfiguredDateKey(date = new Date()) {
  const timezone = await getAppTimezone()
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
