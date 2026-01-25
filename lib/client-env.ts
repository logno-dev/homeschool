export const getReturnToUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!baseUrl) return '/'
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}
