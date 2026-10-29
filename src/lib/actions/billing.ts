'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { getOwnStore } from '@/lib/db/queries/dashboard'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createMidtransProvider } from '@/lib/billing/midtrans'
import { newBillingOrderId } from '@/lib/billing/normalize'
import type { PaymentMethod } from '@/lib/billing/provider'

const provider = createMidtransProvider()

const METHODS: PaymentMethod[] = ['qris', 'bca_va', 'card']

export type CheckoutInit =
  | { kind: 'qris'; orderId: string; qrString: string; planName: string; grossIdr: number }
  | { kind: 'va'; orderId: string; bank: string; vaNumber: string; planName: string; grossIdr: number }
  | { kind: 'redirect'; orderId: string; url: string; planName: string; grossIdr: number }

export type UpgradeResult = { error?: string } | (CheckoutInit & { ok?: true })

export type CheckoutStatus =
  | { error: string }
  | { status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'; periodEnd?: string | null }

function friendly(message: string | undefined): string {
  const m = (message ?? '').trim()
  if (!m) return 'Terjadi kesalahan pada pembayaran. Coba lagi ya.'
  if (/not configured|dikonfigurasi/i.test(m)) return m
  if (m.length < 240 && !/duplicate key|violates|constraint/i.test(m)) return m
  return 'Terjadi kesalahan pada pembayaran. Coba lagi ya.'
}

/**
 * Mulai upgrade/perpanjangan: harga DIHITUNG ULANG dari tabel plans (klien
 * hanya mengirim kode paket + durasi + metode) → tagihan → charge Midtrans.
 */
export async function startUpgradeAction(
  planCode: unknown,
  months: unknown,
  method: unknown,
): Promise<UpgradeResult> {
  const user = await requireUser()
  const store = await getOwnStore(user.id)
  if (!store) return { error: 'Buat toko dulu ya.' }

  if (typeof planCode !== 'string' || !['micro', 'pro'].includes(planCode)) {
    return { error: 'Paket tidak valid.' }
  }
  const m = Number(months)
  if (![1, 3, 12].includes(m)) return { error: 'Durasi tidak valid.' }
  if (typeof method !== 'string' || !METHODS.includes(method as PaymentMethod)) {
    return { error: 'Metode pembayaran tidak valid.' }
  }

  const supabase = await createClient()
  const { data: planRow } = await supabase
    .from('plans')
    .select('name, price_idr')
    .eq('code', planCode)
    .maybeSingle()
  const price = Number(planRow?.price_idr ?? 0)
  if (!planRow || price <= 0) return { error: 'Paket tidak tersedia.' }

  const gross = price * m
  const orderId = newBillingOrderId()
  const admin = createAdminClient()

  const { data: payment, error: payErr } = await admin
    .from('billing_payments')
    .insert({
      store_id: store.id,
      plan_code: planCode,
      period_months: m,
      gross_amount_idr: gross,
      order_id: orderId,
      status: 'pending',
    })
    .select('id')
    .single()
  if (payErr || !payment) return { error: 'Gagal membuat tagihan. Coba lagi.' }

  let charge
  try {
    charge = await provider.createCharge({
      orderId,
      grossIdr: gross,
      method: method as PaymentMethod,
      notificationUrl: '',
      metadata: { store_id: store.id, payment_id: String(payment.id) },
    })
  } catch (err) {
    await admin
      .from('billing_payments')
      .update({ status: 'failed', provider_payload: { error: String(err).slice(0, 300) } })
      .eq('id', payment.id)
    return { error: friendly(err instanceof Error ? err.message : undefined) }
  }

  if (charge.kind === 'qris') {
    return { kind: 'qris', orderId, qrString: charge.qrString, planName: planRow.name, grossIdr: gross }
  }
  if (charge.kind === 'va') {
    return { kind: 'va', orderId, bank: charge.bank, vaNumber: charge.vaNumber, planName: planRow.name, grossIdr: gross }
  }
  return { kind: 'redirect', orderId, url: charge.url, planName: planRow.name, grossIdr: gross }
}

/**
 * Status pembayaran untuk polling UI. Bila provider bilang paid, langsung
 * rekonsiliasi (mark_billing_paid idempoten) — dashboard seller konsisten
 * meski webhook masih di belakang.
 */
export async function checkoutStatusAction(orderId: unknown): Promise<CheckoutStatus> {
  const user = await requireUser()
  const store = await getOwnStore(user.id)
  if (!store) return { error: 'Toko tidak ditemukan.' }
  if (typeof orderId !== 'string' || !/^dt-[a-z0-9]{6,20}$/.test(orderId)) {
    return { error: 'Tagihan tidak valid.' }
  }

  const admin = createAdminClient()
  const { data: payment } = await admin
    .from('billing_payments')
    .select('status, store_id')
    .eq('order_id', orderId)
    .eq('store_id', store.id)
    .maybeSingle()
  if (!payment) return { error: 'Tagihan tidak ditemukan.' }
  if (payment.status === 'paid') {
    const { data: sub } = await admin
      .from('subscriptions')
      .select('current_period_end')
      .eq('store_id', store.id)
      .maybeSingle()
    return { status: 'paid', periodEnd: sub?.current_period_end ?? null }
  }

  let lookup
  try {
    lookup = await provider.lookupStatus(orderId)
  } catch {
    return { status: 'pending' }
  }

  if (lookup.outcome === 'paid') {
    await admin.rpc('mark_billing_paid', {
      p_order_id: orderId,
      p_payment_method: lookup.tx?.paymentType ?? 'unknown',
      p_payload: { via: 'reconcile', status: lookup.tx?.transactionStatus ?? '' },
    })
    const { data: sub } = await admin
      .from('subscriptions')
      .select('current_period_end')
      .eq('store_id', store.id)
      .maybeSingle()
    revalidatePath('/dashboard/langganan')
    return { status: 'paid', periodEnd: sub?.current_period_end ?? null }
  }
  if (lookup.outcome === 'failed_expired') return { status: 'expired' }
  if (lookup.outcome === 'refunded') return { status: 'refunded' }
  return { status: 'pending' }
}
