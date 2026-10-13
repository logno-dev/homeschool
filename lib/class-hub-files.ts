const FILE_TYPES = {
  'application/pdf': { extension: 'pdf', matches: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === '%PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: 'docx', matches: (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b },
  'image/png': { extension: 'png', matches: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  'image/jpeg': { extension: 'jpg', matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
} as const

export const MAX_CLASS_HUB_FILE_SIZE = 10 * 1024 * 1024

export function validateClassHubFile(file: File, bytes: Uint8Array) {
  if (!file.size || file.size > MAX_CLASS_HUB_FILE_SIZE) throw new Error('Files must be between 1 byte and 10 MB')
  const definition = FILE_TYPES[file.type as keyof typeof FILE_TYPES]
  if (!definition || !definition.matches(bytes)) throw new Error('Upload a valid PDF, DOCX, PNG, or JPEG file')
  return definition.extension
}
