import 'server-only'

import { createClient } from '@/lib/supabase/server'

export interface VariantRow {
  id: string
  name: string
  price_idr: number
  stock: number | null
  is_active: boolean
  position: number
}

export interface ProductRow {
  id: string
  store_id: string
  name: string
  slug: string
  description: string | null
  image_path: string | null
  price_idr: number
  is_active: boolean
  created_at: string
  product_variants: VariantRow[]
}

export interface UsageInfo {
  can: boolean
  used: number
  limit: number | null
  plan: string
  maxVariants: number | null
}

export async function listProducts(storeId: string): Promise<ProductRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('*, product_variants(*)')
    .eq('store_id', storeId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
  return (data as ProductRow[]) ?? []
}

export async function getProduct(
  storeId: string,
  productId: string,
): Promise<ProductRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('*, product_variants(*)')
    .eq('store_id', storeId)
    .eq('id', productId)
    .maybeSingle()
  return (data as ProductRow) ?? null
}

/** Pemakaian vs batas paket — dipakai guard aksi DAN meter di halaman produk. */
export async function getProductUsage(storeId: string): Promise<UsageInfo> {
  const supabase = await createClient()
  const [{ data: guard }, { data: planData }] = await Promise.all([
    supabase.rpc('can_create', { p_store: storeId, p_kind: 'product' }),
    supabase.rpc('effective_plan', { p_store: storeId }),
  ])
  const g = guard as { can: boolean; used: number; limit: number | null; plan: string } | null
  const planCode = (planData as string | null) ?? 'free'

  // batas varian per produk dari baris plans (policy select-all mengizinkan)
  const { data: plan } = await supabase
    .from('plans')
    .select('limits')
    .eq('code', planCode)
    .single()
  const limits = plan?.limits as { max_variants?: number } | undefined
  const maxVariants = limits?.max_variants ?? null

  return {
    can: g?.can ?? true,
    used: g?.used ?? 0,
    limit: g?.limit == null ? null : Number(g.limit),
    plan: g?.plan ?? 'free',
    maxVariants,
  }
}
