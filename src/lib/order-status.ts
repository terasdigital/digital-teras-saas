/**
 * Status pesanan — modul murni (tanpa 'server-only') agar bisa dipakai
 * komponen server, klien, dan aksi sekaligus.
 */
export const ORDER_STATUSES = [
  'created',
  'confirmed',
  'processing',
  'completed',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  created: 'Baru masuk',
  confirmed: 'Dikonfirmasi',
  processing: 'Diproses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' &&
    (ORDER_STATUSES as readonly string[]).includes(value)
}
