'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { revalidateStore } from '@/lib/cache'
import { getOwnStore } from '@/lib/db/queries/dashboard'
import { getPlanLimits } from '@/lib/db/queries/theme'
import { isCuratedAccent } from '@/lib/theme'
import { createClient } from '@/lib/supabase/server'
import { themeSchema } from '@/lib/validation/theme'

export type ThemeResult = { error?: string; ok?: boolean } | null

export async function saveThemeAction(input: unknown): Promise<ThemeResult> {
  const user = await requireUser()
  const store = await getOwnStore(user.id)
  if (!store) return { error: 'Buat toko dulu ya.' }

  const parsed = themeSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Tema tidak valid' }
  }
  const theme = parsed.data

  const { limits, plan } = await getPlanLimits(store.id)
  const customAccentAllowed = limits.custom_accent === true
  const hideBadgeAllowed = limits.hide_badge === true

  if (!isCuratedAccent(theme.accent) && !customAccentAllowed) {
    return { error: 'Pilih warna dari palet dulu ya — warna kustom adalah fitur Pro.' }
  }
  if (!theme.show_powered && !hideBadgeAllowed) {
    return { error: `Sembunyikan badge Digital Teras tersedia di paket Pro (kamu di paket ${plan}).` }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('stores')
    .update({
      settings: {
        ...(store.settings as Record<string, unknown>),
        theme,
      },
    })
    .eq('id', store.id)
  if (error) return { error: 'Gagal menyimpan tema.' }

  revalidateStore(store.slug)
  revalidatePath('/dashboard/tampilan')
  return { ok: true }
}
