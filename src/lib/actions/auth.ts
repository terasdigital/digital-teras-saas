'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import {
  loginSchema,
  registerSchema,
  zodMessage,
  type AuthResult,
} from '@/lib/validation/auth'

/** Hanya allow path internal — cegah open redirect via parameter ?next=. */
function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
    return value
  }
  return '/dashboard'
}

function errorMessage(code?: string): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Email atau password salah.'
    case 'email_not_confirmed':
      return 'Email kamu belum dikonfirmasi. Cek inbox ya.'
    case 'over_email_sent_rate_limit':
      return 'Terlalu sering mengirim email. Coba sebentar lagi.'
    default:
      return 'Terjadi kesalahan. Coba lagi ya.'
  }
}

export async function registerAction(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: zodMessage(parsed.error) }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${env.APP_URL}/auth/callback`,
    },
  })

  if (error) return { error: errorMessage(error.code) }

  // Konfirmasi email ON: session null → minta user cek inbox.
  if (!data.session) {
    return {
      notice: 'Akun dibuat! Cek inbox kamu untuk klik tautan konfirmasi, lalu login.',
    }
  }

  redirect('/onboarding')
}

export async function loginAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: zodMessage(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: errorMessage(error.code) }

  redirect(safeNext(formData.get('next')))
}

export async function googleLoginAction(): Promise<void> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${env.APP_URL}/auth/callback` },
  })
  if (error) redirect('/login?error=google')
  redirect(data.url)
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
