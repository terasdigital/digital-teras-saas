'use server'

import { createClient } from '@/lib/supabase/server'
import { buildWaMessage, type WaLine } from '@/lib/wa'
import { checkoutSchema, type CheckoutResult } from '@/lib/validation/checkout'

interface RpcLine {
  product_name: string
  variant_name: string
  unit_price: number
  qty: number
}
interface RpcOrder {
  order_id: string
  ref: string
  total_idr: number
  lines: RpcLine[]
  buyer: { name: string; phone: string | null; note: string | null }
  store: { name: string; whatsapp: string; slug: string }
}

function friendly(message: string | undefined): string {
  const m = (message ?? '').trim()
  if (!m) return 'Pesanan gagal dibuat — coba lagi ya.'
  // exception RPC kita sudah berbahasa Indonesia; error driver mentah → generic
  if (m.length < 240 && !/duplicate key|violates|constraint|syntax error|column/i.test(m)) {
    return m
  }
  return 'Pesanan gagal dibuat — coba lagi ya.'
}

/**
 * Alur checkout: validasi → RPC place_order (harga & keabsahan item dihitung
 * ulang oleh DB — payload klien HANYA berisi variantId+qty) → rakit pesan WA
 * → simpan pesan untuk audit → kirim URL wa.me ke klien.
 * Pesanan sudah TERTIDAK di dashboard seller meski pembeli batal mengirim chat.
 */
export async function submitOrderAction(input: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Data pesanan tidak valid' }
  }
  const { storeSlug, buyer, lines, session } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('place_order', {
    p_store_slug: storeSlug,
    p_buyer: { name: buyer.name, phone: buyer.phone, note: buyer.note },
    p_items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
    p_session: session ?? null,
  })
  if (error || !data) return { error: friendly(error?.message) }

  const order = data as RpcOrder

  const waLines: WaLine[] = order.lines.map((l) => ({
    productName: l.product_name,
    variantName: l.variant_name,
    unitPriceIdr: l.unit_price,
    qty: l.qty,
  }))
  const { text, url } = buildWaMessage({
    storeName: order.store.name,
    storeWhatsapp: order.store.whatsapp,
    ref: order.ref,
    buyerName: order.buyer.name,
    buyerPhone: order.buyer.phone,
    buyerNote: order.buyer.note,
    lines: waLines,
    totalIdr: order.total_idr,
  })

  // Audit message — kegagalan di sini tidak membatalkan pesanan.
  // Di-await (bukan fire-and-forget): Promise yang mengawang bisa ikut
  // terpotong saat response action dikirim.
  await supabase
    .rpc('set_order_message', { p_order: order.order_id, p_message: text })
    .then(() => undefined, () => undefined)

  return { ok: true, waUrl: url, ref: order.ref }
}
