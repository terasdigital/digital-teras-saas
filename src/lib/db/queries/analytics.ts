import 'server-only'

import { createClient } from '@/lib/supabase/server'

export interface SeriesPoint {
  day: string
  visit: number
  product_view: number
  cart_add: number
  checkout: number
  order: number
}

export interface TopItem {
  id: string
  name: string
  count: number
}

export interface AnalyticsTotals {
  visit: number
  product_view: number
  cart_add: number
  checkout: number
  order: number
}

export interface AnalyticsData {
  days: number
  series: SeriesPoint[]
  totals: AnalyticsTotals
  revenueIdr: number
  topProducts: TopItem[]
  topLinks: TopItem[]
}

/** Batas hari analitik dari paket aktif (Free 7, Micro 30, Pro 90). */
export async function getAnalyticsWindowDays(storeId: string): Promise<number> {
  const supabase = await createClient()
  const { data: planCode } = await supabase.rpc('effective_plan', { p_store: storeId })
  const code = (planCode as string | null) ?? 'free'
  const { data: plan } = await supabase
    .from('plans')
    .select('limits')
    .eq('code', code)
    .maybeSingle()
  const limits = plan?.limits as { analytics_days?: number } | undefined
  return limits?.analytics_days ?? 7
}

/** Awal window (tengah malam WIB) sebagai ISO timestamptz untuk query orders. */
function wibWindowStartIso(days: number): string {
  const now = new Date()
  const wibNow = new Date(now.getTime() + 7 * 3600 * 1000)
  const todayUtcMs = Date.parse(`${wibNow.toISOString().slice(0, 10)}T00:00:00Z`)
  const fromMs = todayUtcMs - (days - 1) * 86_400_000
  const fromDate = new Date(fromMs).toISOString().slice(0, 10)
  return `${fromDate}T00:00:00+07:00`
}

export async function getAnalyticsData(
  storeId: string,
  days: number,
): Promise<AnalyticsData> {
  const supabase = await createClient()
  const [seriesRes, totalsRes, topProductsRes, topLinksRes, ordersRes] =
    await Promise.all([
      supabase.rpc('analytics_series', { p_store: storeId, p_days: days }),
      supabase.rpc('analytics_totals', { p_store: storeId, p_days: days }),
      supabase.rpc('analytics_top', {
        p_store: storeId,
        p_metric: 'product_view',
        p_days: days,
        p_limit: 5,
      }),
      supabase.rpc('analytics_top', {
        p_store: storeId,
        p_metric: 'link_click',
        p_days: days,
        p_limit: 5,
      }),
      supabase
        .from('orders')
        .select('total_idr')
        .eq('store_id', storeId)
        .neq('status', 'cancelled')
        .gte('created_at', wibWindowStartIso(days)),
    ])

  const orders = (ordersRes.data as { total_idr: number }[] | null) ?? []
  const revenueIdr = orders.reduce((sum, o) => sum + Number(o.total_idr ?? 0), 0)

  return {
    days,
    series: (seriesRes.data as SeriesPoint[] | null) ?? [],
    totals: {
      visit: 0,
      product_view: 0,
      cart_add: 0,
      checkout: 0,
      order: 0,
      ...((totalsRes.data as Partial<AnalyticsTotals> | null) ?? {}),
    },
    revenueIdr,
    topProducts: (topProductsRes.data as TopItem[] | null) ?? [],
    topLinks: (topLinksRes.data as TopItem[] | null) ?? [],
  }
}
