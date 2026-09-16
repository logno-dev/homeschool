import sanitizeHtml from 'sanitize-html'

export function normalizeEmailSpacing(value: string): string {
  return value.replace(/(?:&amp;nbsp;|&nbsp;|&#0*160;|&#x0*a0;|\u00a0)/gi, ' ')
}

const safeCssValue = /^(?!.*(?:expression|javascript|url\s*\(|@import)).{1,200}$/i

export function sanitizeEmailHtml(value: string): string {
  return normalizeEmailSpacing(sanitizeHtml(value, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col', 'caption', 'div', 'span'],
    allowedAttributes: {
      '*': ['class', 'style', 'title', 'role'],
      a: ['href', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      table: ['width', 'height', 'align', 'border', 'cellpadding', 'cellspacing', 'bgcolor', 'role'],
      tr: ['height', 'align', 'valign', 'bgcolor'],
      th: ['width', 'height', 'colspan', 'rowspan', 'align', 'valign', 'bgcolor'],
      td: ['width', 'height', 'colspan', 'rowspan', 'align', 'valign', 'bgcolor'],
      col: ['width', 'span']
    },
    allowedStyles: {
      '*': Object.fromEntries([
        'color', 'background', 'background-color', 'font-family', 'font-size', 'font-style', 'font-weight', 'letter-spacing', 'line-height',
        'text-align', 'text-decoration', 'text-transform', 'vertical-align', 'white-space', 'display', 'width', 'min-width', 'max-width', 'height',
        'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-style', 'border-width', 'border-collapse', 'border-spacing'
      ].map((property) => [property, [safeCssValue]]))
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel', 'cid'],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) }
  }))
}
