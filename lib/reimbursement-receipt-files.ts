const RECEIPT_TYPES = {
  'application/pdf': { extension: 'pdf', matches: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === '%PDF' },
  'image/png': { extension: 'png', matches: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  'image/jpeg': { extension: 'jpg', matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/webp': { extension: 'webp', matches: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' },
} as const

export const MAX_REIMBURSEMENT_RECEIPT_SIZE = 10 * 1024 * 1024

export function validateReimbursementReceipt(file: File, bytes: Uint8Array) {
  if (!file.size || file.size > MAX_REIMBURSEMENT_RECEIPT_SIZE) throw new Error('Receipts must be between 1 byte and 10 MB')
  const definition = RECEIPT_TYPES[file.type as keyof typeof RECEIPT_TYPES]
  if (!definition || !definition.matches(bytes)) throw new Error('Upload a valid PDF, PNG, JPEG, or WebP receipt')
  return definition.extension
}
