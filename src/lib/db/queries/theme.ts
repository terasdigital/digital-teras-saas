import 'server-only'

import { createClient } from '@/lib/supabase/server'

export interface ThemeFlags {
  customAccent: boolean
  hideBadge: boolean
  plan: string
}

export async function getPlanLimits(
  storeId: string,
): Promise<{ limits: Record<string, unknown>; plan: string }> {
  const supabase = await createClient()
  const { data: planCode } = await supabase.rpc('effective_plan', { p_store: storeId })
  const code = (planCode as string | null) ?? 'free'
  const { data: plan } = await supabase
    .from('plans')
    .select('limits')
    .eq('code', code)
    .maybeSingle()
  return {
    limits: (plan?.limits as Record<string, unknown> | undefined) ?? {},
    plan: code,
  }
}

export async function getThemeFlags(storeId: string): Promise<ThemeFlags> {
  const { limits, plan } = await getPlanLimits(storeId)
  return {
    customAccent: limits.custom_accent === true,
    hideBadge: limits.hide_badge === true,
    plan,
  }
}
