import { createHash, timingSafeEqual } from 'node:crypto'

/** Outcome internal dari mesin status Midtrans. */
export type TxOutcome = 'paid' | 'refunded' | 'failed_expired' | 'pending'

export interface NormalizedTx {
  orderId: string
  transactionId: string | null
  statusCode: string
  grossAmount: string
  transactionStatus: string
  paymentType: string | null
  fraudStatus: string | null
  signature: string | null
}

/** Midtrans bisa mengirim string ATAU array (quirk notifikasi PHP-era). */
function first(v: unknown): string | undefined {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.length > 0 ? first(v[0]) : undefined
  return undefined
}

export function normalizeMidtransBody(body: unknown): NormalizedTx | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const td = (b.transaction_details as Record<string, unknown> | undefined) ?? undefined

  const orderId = first(td?.order_id) ?? first(b.order_id)
  if (!orderId) return null

  return {
    orderId,
    transactionId: first(b.transaction_id) ?? null,
    statusCode: first(b.status_code) ?? '',
    grossAmount: first(b.gross_amount) ?? '',
    transactionStatus: first(b.transaction_status) ?? '',
    paymentType: first(b.payment_type) ?? null,
    fraudStatus: first(b.fraud_status) ?? null,
    signature: first(b.signature) ?? null,
  }
}

/**
 * Mesin status Midtrans → outcome internal.
 * capture dianggap PAID hanya bila fraud check lolos (setelah authorize ada
 * review — settlement-nya menyusul sebagai event terpisah).
 */
export function mapTxStatus(transactionStatus: string, fraudStatus: string | null): TxOutcome {
  const ts = transactionStatus.toLowerCase()
  if (ts === 'settlement' || ts === 'complete') return 'paid'
  if (ts === 'capture') return fraudStatus === 'settlement' ? 'paid' : 'pending'
  if (['refund', 'chargeback'].includes(ts)) return 'refunded'
  if (['expire', 'cancel', 'void', 'deny', 'failed', 'incomplete'].includes(ts)) {
    return 'failed_expired'
  }
  return 'pending'
}

export function expectedSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
): string {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex')
}

export function verifySignature(tx: NormalizedTx, serverKey: string): boolean {
  if (!tx.signature) return false
  const expected = expectedSignature(tx.orderId, tx.statusCode, tx.grossAmount, serverKey)
  if (tx.signature.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(tx.signature, 'utf8'), Buffer.from(expected, 'utf8'))
}

/**
 * Kunci idempotensi ledger. transaction_status IKUT di key karena Midtrans
 * mengirim BEBERAPA transisi status dengan transaction_id yang sama
 * (pending → settlement); tanpa status, event settlement menyusul akan
 * dianggap duplikat dan pembayaran tak pernah aktif via webhook.
 */
export function externalIdOf(tx: NormalizedTx): string {
  return tx.transactionId
    ? `${tx.transactionId}.${tx.transactionStatus}`
    : `${tx.orderId}.${tx.statusCode}.${tx.grossAmount}.${tx.transactionStatus}`
}

/** order_id Midtrans: alnum + dash/underscore, ≤50 char. */
export function newBillingOrderId(): string {
  const rand =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  return `dt-${rand.slice(0, 20)}`
}
