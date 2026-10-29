import type { NormalizedTx, TxOutcome } from './normalize'

/** Hasil charge → bentuk tampilan yang berbeda per metode. */
export type ChargeResult =
  | { kind: 'qris'; qrString: string }
  | { kind: 'va'; bank: string; vaNumber: string }
  | { kind: 'redirect'; url: string }

export type PaymentMethod = 'qris' | 'bca_va' | 'card'

export interface ChargeInput {
  orderId: string
  grossIdr: number
  method: PaymentMethod
  notificationUrl: string
  metadata?: Record<string, string>
}

/**
 * Abstraksi tipis gateway — Midtrans implementasinya sekarang; provider
 * lain tinggal menambah route webhook saudaranya (ledger & dispatcher
 * sudah provider-agnostic).
 */
export interface BillingProvider {
  name: string
  createCharge(input: ChargeInput): Promise<ChargeResult>
  lookupStatus(orderId: string): Promise<{ outcome: TxOutcome; tx: NormalizedTx | null }>
  parseAndVerifyWebhook(rawBody: string): Promise<{ tx: NormalizedTx; outcome: TxOutcome } | null>
}
