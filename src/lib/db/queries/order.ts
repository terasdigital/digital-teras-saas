import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { OrderStatus } from '@/lib/order-status'

export type { OrderStatus } from '@/lib/order-status'

export interface OrderItemRow {
  id: string
  product_id: string | null
  variant_id: string | null
  product_name: string
  variant_name: string
  image_path: string | null
  unit_price_idr: number
  qty: number
}

export interface OrderRow {
  id: string
  ref: string
  status: OrderStatus
  buyer_name: string
  buyer_phone: string | null
  buyer_note: string | null
  items_total_idr: number
  total_idr: number
  created_at: string
  updated_at: string
  order_items?: OrderItemRow[]
}

export async function listOrders(storeId: string): Promise<OrderRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(100)
  return (data as OrderRow[]) ?? []
}

export async function getOrder(
  storeId: string,
  orderId: string,
): Promise<OrderRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('store_id', storeId)
    .eq('id', orderId)
    .maybeSingle()
  return (data as OrderRow) ?? null
}
