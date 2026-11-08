export function getPrivateBlobToken() {
  const token = process.env.PRIVATE_READ_WRITE_TOKEN?.trim()
  if (!token) throw new Error('PRIVATE_READ_WRITE_TOKEN is not configured')
  return token
}
