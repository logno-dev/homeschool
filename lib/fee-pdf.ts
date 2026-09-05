type FeePdfInput = { title: string; familyName: string; sessionName: string; totalAmount: number; amountPaid: number; balanceDue: number; dueDate?: string }

function pdfText(value: string) { return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)') }
function wrap(value: string, length = 78) {
  const lines: string[] = []; let line = ''
  for (const word of value.split(/\s+/)) {
    if (!word) continue
    if ((line + (line ? ' ' : '') + word).length > length && line) { lines.push(line); line = word } else line += (line ? ' ' : '') + word
  }
  if (line) lines.push(line)
  return lines
}

export function createFeePdf(input: FeePdfInput): string {
  const lines = [input.title, '', `Family: ${input.familyName}`, `Session: ${input.sessionName}`, '', `Total: $${input.totalAmount.toFixed(2)}`, `Amount paid: $${input.amountPaid.toFixed(2)}`, `Balance due: $${input.balanceDue.toFixed(2)}`, ...(input.dueDate ? [`Due date: ${input.dueDate}`] : [])].flatMap((line) => line ? wrap(line) : [''])
  const commands = ['BT', '/F1 18 Tf', '72 740 Td', `(${pdfText(lines[0])}) Tj`, '/F1 11 Tf']
  for (const line of lines.slice(1)) commands.push('0 -20 Td', `(${pdfText(line)}) Tj`)
  commands.push('ET')
  const stream = commands.join('\n')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`]
  let pdf = '%PDF-1.4\n'; const offsets = [0]
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, 'ascii'); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xrefOffset = Buffer.byteLength(pdf, 'ascii')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf, 'ascii').toString('base64')
}
