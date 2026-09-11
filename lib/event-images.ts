export const MAX_EVENT_IMAGE_SIZE = 4 * 1024 * 1024
export const EVENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function eventImageExtension(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return 'png'
  const header = String.fromCharCode(...bytes.slice(0, 12))
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'gif'
  if (header.startsWith('RIFF') && header.slice(8) === 'WEBP') return 'webp'
  return null
}
