import 'server-only'

import { apiBase, getMidtransConfig, snapBase, type MidtransConfig } from './env'
import {
  mapTxStatus,
  normalizeMidtransBody,
  verifySignature,
  type NormalizedTx,
} from './normalize'
import type { BillingProvider, ChargeInput, ChargeResult } from './provider'

function authHeader(cfg: MidtransConfig): string {
  return 'Basic ' + Buffer.from(cfg.SERVER_KEY + ':').toString('base64')
}

async function mtFetch(cfg: MidtransConfig, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader(cfg),
      ...(init?.headers ?? {}),
    },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const errs = (json?.validation_messages as string[] | undefined) ?? []
    throw new Error(
      errs[0]
        ? `Midtrans menolak transaksi: ${errs.join(', ')}`
        : `Midtrans error (HTTP ${res.status}).`,
    )
  }
  return json as Record<string, unknown>
}

export function createMidtransProvider(): BillingProvider {
  return {
    name: 'midtrans',

    async createCharge(input: ChargeInput): Promise<ChargeResult> {
      const cfg = getMidtransConfig()

      if (input.method === 'card') {
        // kartu via Snap redirect (hosted, 3-D Secure) — tanpa SDK JS
        const json = await mtFetch(cfg, snapBase(cfg), {
          method: 'POST',
          body: JSON.stringify({
            transaction_details: { order_id: input.orderId, gross_amount: input.grossIdr },
            enabled_payments: ['credit_card'],
            metadata: input.metadata ?? {},
          }),
        })
        const url = json.redirect_url
        if (typeof url !== 'string') throw new Error('Snap tidak mengembalikan redirect_url.')
        return { kind: 'redirect', url }
      }

      // Core API v2 memakai `payment_type` + blok per metode
      // (bukan `enabled_payments` — itu format Snap, pemicu
      // "payment_type is required").
      const td = { transaction_details: { order_id: input.orderId, gross_amount: input.grossIdr } }
      const body =
        input.method === 'qris'
          ? {
              payment_type: 'qris',
              ...td,
              metadata: input.metadata ?? {},
              qris: { optimal: false },
            }
          : {
              payment_type: 'bank_transfer',
              ...td,
              metadata: input.metadata ?? {},
              bank_transfer: { bank: 'bca' },
            }

      const json = await mtFetch(cfg, `${apiBase(cfg)}/v2/charge`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      // v2 kadang membungkus detail di `transaction_data` — dukung kedua bentuk
      const data = (json.transaction_data as Record<string, unknown> | undefined) ?? json

      if (input.method === 'qris') {
        const qr = json.qr_string ?? data.qr_string
        if (typeof qr !== 'string') throw new Error('QRIS tidak mengembalikan qr_string.')
        return { kind: 'qris', qrString: qr }
      }
      const vaArr =
        (json.va_numbers as { bank: string; va_number: string }[] | undefined) ??
        (data.va_numbers as { bank: string; va_number: string }[] | undefined)
      const va = vaArr?.[0]
      if (!va?.va_number) throw new Error('BCA VA tidak dikembalikan.')
      return { kind: 'va', bank: va.bank, vaNumber: va.va_number }
    },

    async lookupStatus(orderId: string) {
      const cfg = getMidtransConfig()
      const json = await mtFetch(cfg, `${apiBase(cfg)}/v2/${encodeURIComponent(orderId)}/status`)
      const tx = normalizeMidtransBody(json)
      const outcome = tx
        ? mapTxStatus(tx.transactionStatus, tx.fraudStatus)
        : ('pending' as const)
      return { outcome, tx }
    },

    async parseAndVerifyWebhook(rawBody: string) {
      const cfg = getMidtransConfig()
      let body: unknown
      try {
        body = JSON.parse(rawBody)
      } catch {
        return null
      }
      // notifikasi Midtrans kadang array (batch) — pakai elemen pertama
      const single = Array.isArray(body) ? body[0] : body
      const tx = normalizeMidtransBody(single)
      if (!tx) return null
      if (!verifySignature(tx, cfg.SERVER_KEY)) return null
      return { tx, outcome: mapTxStatus(tx.transactionStatus, tx.fraudStatus) }
    },
  }
}

export function normalizeOutcomeFromStatus(tx: NormalizedTx) {
  return mapTxStatus(tx.transactionStatus, tx.fraudStatus)
}
