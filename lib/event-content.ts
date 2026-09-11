import 'server-only'
import sanitizeHtml from 'sanitize-html'
import { descriptionEditorHtml, isCalendarDate } from './calendar'

export function sanitizeEventDescription(value: string): string {
  return sanitizeHtml(descriptionEditorHtml(value), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ol', 'ul', 'li', 'blockquote', 'a', 'span'],
    allowedAttributes: { a: ['href', 'target', 'rel'], '*': ['class'], li: ['class', 'data-list'] },
    allowedClasses: { '*': [/^ql-align-(center|right|justify)$/, /^ql-indent-[1-8]$/, 'ql-ui'] },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }) },
  }).replace(/(?:&nbsp;|&#160;|&#xa0;|\u00a0)/gi, ' ')
}

export function validateEventBannerUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new Error('Invalid event banner URL')
  const url = new URL(value)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.public.blob.vercel-storage.com') || !url.pathname.startsWith('/events/') || url.username || url.password) {
    throw new Error('Choose an image uploaded to event banner storage')
  }
  return url.href
}

export function validateEventDates(startDate: unknown, endDate: unknown, startTime: unknown, endTime: unknown, isAllDay: unknown) {
  if (typeof startDate !== 'string' || !isCalendarDate(startDate)) throw new Error('Enter a valid start date')
  if (endDate && (typeof endDate !== 'string' || !isCalendarDate(endDate) || endDate < startDate)) throw new Error('End date must be on or after the start date')
  if (!isAllDay) {
    for (const time of [startTime, endTime]) if (time && (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('Enter a valid event time')
    if (startTime && endTime && (!endDate || endDate === startDate) && String(endTime) < String(startTime)) throw new Error('End time must be on or after the start time')
  }
}
