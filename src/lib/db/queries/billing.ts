import 'server-only'

import { createClient } from '@/lib/supabase/server'

export interface PlanRow {
  code: string
  name: string
  price_idr: number
  limits: Record<string, number | boolean>
  sort: number
}

export interface StoreUsage {
  products: number
  links: number
  plan: string
  limits: Record<string, number>
}

export async function listPublicPlans(): Promise<PlanRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('plans')
    .select('code, name, price_idr, limits, sort')
    .eq('is_public', true)
    .order('sort', { ascending: true })
  return (data as PlanRow[]) ?? []
}

export async function getStoreUsage(storeId: string): Promise<StoreUsage> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('store_usage', { p_store: storeId })
  const d = (data as StoreUsage | null) ?? { products: 0, links: 0, plan: 'free', limits: {} }
  return {
    products: d.products ?? 0,
    links: d.links ?? 0,
    plan: d.plan ?? 'free',
    limits: (d.limits as Record<string, number>) ?? {},
  }
}

export interface SubState {
  plan: string
  status: string
  currentPeriodEnd: string | null
}

export async function getSubscriptionState(storeId: string): Promise<SubState> {
  const supabase = await createClient()
  const [planRes, subRes] = await Promise.all([
    supabase.rpc('effective_plan', { p_store: storeId }),
    supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('store_id', storeId)
      .maybeSingle(),
  ])
  const sub = subRes.data as { status: string; current_period_end: string | null } | null
  return {
    plan: (planRes.data as string | null) ?? 'free',
    status: sub?.status ?? 'active',
    currentPeriodEnd: sub?.current_period_end ?? null,
  }
}
