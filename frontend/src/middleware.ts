// middleware.ts — runs on the edge, protects dashboard routes
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/google/callback',
  '/auth/hubspot/callback',
  '/',
  '/terms',
  '/privacy',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check for auth token in cookie (set at login)
  const token = request.cookies.get('cf_token')?.value

  if (!token) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Basic JWT expiry check (no secret needed at edge — backend validates)
  try {
    const [, payloadB64] = token.split('.')
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    )
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete('cf_token')
      return response
    }
  } catch {
    // Malformed token — redirect to login
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
