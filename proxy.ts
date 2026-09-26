import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/',
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/about',
  '/robots.txt',
  '/sitemap.xml',
  '/site.webmanifest'
]

const INDEXABLE_PATHS = ['/', '/about']

const PUBLIC_API_PREFIXES = [
  '/api/auth'
]

const SESSION_COOKIE_NAME = 'dvclc_session'
const EMULATION_COOKIE_NAME = 'dvclc_emulation_token'

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function isPublicApiPath(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function noIndex(response: NextResponse) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isEmulationPath = pathname.startsWith('/emulate/')
  const hasSession = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value
      || request.cookies.get(EMULATION_COOKIE_NAME)?.value
  )

  if (isEmulationPath && hasSession) {
    const rewritten = request.nextUrl.clone()
    rewritten.pathname = pathname.slice('/emulate'.length) || '/'
    return noIndex(NextResponse.rewrite(rewritten))
  }

  if (pathname === '/emulate' || isPublicPath(pathname) || isPublicApiPath(pathname)) {
    const response = NextResponse.next()
    return INDEXABLE_PATHS.includes(pathname) || pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/site.webmanifest'
      ? response
      : noIndex(response)
  }

  if (hasSession) {
    return noIndex(NextResponse.next())
  }

  if (pathname.startsWith('/api/')) {
    return noIndex(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const signinUrl = new URL('/signin', request.url)
  signinUrl.searchParams.set('next', pathname)
  return noIndex(NextResponse.redirect(signinUrl))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
