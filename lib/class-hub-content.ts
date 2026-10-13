import 'server-only'

import sanitizeHtml from 'sanitize-html'

export function sanitizeClassHubHtml(value: unknown) {
  const html = typeof value === 'string' ? value : ''
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ol', 'ul', 'li', 'blockquote', 'a', 'span'],
    allowedAttributes: { a: ['href', 'target', 'rel'], '*': ['class'], li: ['class', 'data-list'] },
    allowedClasses: { '*': [/^ql-align-(center|right|justify)$/, /^ql-indent-[1-8]$/, 'ql-ui'] },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }) },
  }).replace(/(?:&nbsp;|&#160;|&#xa0;|\u00a0)/gi, ' ').trim()
}

export function cleanClassHubText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}
