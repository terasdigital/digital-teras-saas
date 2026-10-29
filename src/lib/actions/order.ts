'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { getOwnStore } from '@/lib/db/queries/dashboard'
import { createClient } from '@/lib/supabase/server'
import { isOrderStatus } from '@/lib/order-status'

export type OrderActionResult = { error?: string; ok?: boolean } | null

export async function updateOrderStatusAction(
  orderId: string,
  next: unknown,
): Promise<OrderActionResult> {
  if (!isOrderStatus(next)) {
    return { error: 'Status tidak dikenal.' }
  }
  const user = await requireUser()
  const store = await getOwnStore(user.id)
  if (!store) return { error: 'Toko tidak ditemukan.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({ status: next })
    .eq('id', orderId)
    .eq('store_id', store.id)
  if (error) return { error: 'Gagal mengubah status.' }

  revalidatePath('/dashboard/pesanan')
  revalidatePath(`/dashboard/pesanan/${orderId}`)
  return { ok: true }
}
