import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/',
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/about'
]

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
    return NextResponse.rewrite(rewritten)
  }

  if (pathname === '/emulate' || isPublicPath(pathname) || isPublicApiPath(pathname)) {
    return NextResponse.next()
  }

  if (hasSession) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const signinUrl = new URL('/signin', request.url)
  signinUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(signinUrl)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
