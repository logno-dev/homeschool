import { authkitMiddleware } from '@workos-inc/authkit-nextjs'

export default authkitMiddleware({
  redirectUri: process.env.WORKOS_REDIRECT_URI,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      '/',
      '/signin',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/api/auth',
      '/api/register',
      '/api/forgot-password',
      '/api/reset-password'
    ]
  }
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
