import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { env } from '@/lib/env'

const PROTECTED_PREFIXES = ['/dashboard', '/onboarding']
const AUTH_PAGES = ['/login', '/register']

function withCookies(
  response: NextResponse,
  setAll: { name: string; value: string; options: CookieOptions }[],
) {
  for (const { name, value, options } of setAll) {
    response.cookies.set(name, value, options)
  }
  return response
}

/** Segarkan sesi Supabase tiap request + guard rute privat/halaman auth. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        response = withCookies(response, cookiesToSet)
      },
    },
  })

  // getUser() memverifikasi token ke Supabase Auth — penting di edge.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }

  if (AUTH_PAGES.includes(pathname) && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
