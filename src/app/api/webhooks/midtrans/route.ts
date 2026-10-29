import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMidtransProvider } from "@/lib/billing/midtrans";
import { externalIdOf, mapTxStatus } from "@/lib/billing/normalize";

const provider = createMidtransProvider();

function ack(reason?: string) {
  const res = NextResponse.json({ ok: true });
  if (reason) res.headers.set("x-dt-webhook", reason);
  return res;
}

/**
 * Webhook notifikasi Midtrans — SUMBER KEBENARAN status langganan.
 * 1) parse + verifikasi SHA512(order_id+status_code+gross+server_key)
 * 2) idempoten: klaim di ledger webhook_events (ON CONFLICT); event
 *    'failed' yang sudah tercatat boleh diproses ulang (retry Midtrans)
 * 3) belt check: transaksi yang memberi masa aktif diverifikasi ulang via
 *    GET /v2/{order_id}/status (jangan percaya body sendirian)
 * 4) dispatch → mark_billing_paid / mark_billing_failed (RPC atomik)
 * 5) error dispatch → ledger 'failed' + balas 500 supaya Midtrans retry
 *    (aman karena langkah 2 mengizinkan replay event failed)
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const verified = await provider.parseAndVerifyWebhook(raw).catch(() => null);
  if (!verified) return NextResponse.json({ error: "invalid signature/body" }, { status: 400 });

  const { tx } = verified;
  const outcome = mapTxStatus(tx.transactionStatus, tx.fraudStatus);
  const supabase = createAdminClient();

  // 2) klaim idempoten
  const { data: claim, error: claimError } = await supabase.rpc("webhook_claim", {
    p_provider: "midtrans",
    p_external_id: externalIdOf(tx),
    p_event_type: tx.transactionStatus,
    p_payload: JSON.parse(raw.length < 60_000 ? raw : "{}"),
  });
  if (claimError) return NextResponse.json({ error: "ledger unavailable" }, { status: 500 });

  const claimed = (claim as { claimed: boolean; event_id: number | null }[] | null)?.[0];
  let eventId = claimed?.event_id ?? null;

  if (!claimed?.claimed) {
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("status, id")
      .eq("provider", "midtrans")
      .eq("external_id", externalIdOf(tx))
      .maybeSingle();
    if (!existing || existing.status !== "failed") return ack("duplicate");
    eventId = existing.id as number; // event gagal → boleh diproses ulang
  }

  try {
    // 3) belt check khusus transisi yang memberi masa aktif
    if (outcome === "paid") {
      const check = await provider.lookupStatus(tx.orderId);
      if (check.outcome !== "paid") {
        await supabase.rpc("webhook_finish", {
          p_event_id: eventId,
          p_status: "skipped",
          p_error: `belt-check said ${check.outcome}`,
        });
        return ack("belt-check rejected");
      }
    }

    // 4) dispatch
    if (outcome === "paid") {
      const { data, error } = await supabase.rpc("mark_billing_paid", {
        p_order_id: tx.orderId,
        p_payment_method: tx.paymentType,
        p_payload: { transaction_id: tx.transactionId, status: tx.transactionStatus },
      });
      if (error) throw error;
      if ((data as { foreign?: boolean })?.foreign) {
        await supabase.rpc("webhook_finish", { p_event_id: eventId, p_status: "skipped", p_error: null });
        return ack("foreign order");
      }
    } else if (outcome === "refunded" || outcome === "failed_expired") {
      const newStatus = outcome === "refunded" ? "refunded" : "expired";
      const { data, error } = await supabase.rpc("mark_billing_failed", {
        p_order_id: tx.orderId,
        p_new_status: newStatus,
        p_payload: { transaction_id: tx.transactionId, status: tx.transactionStatus },
      });
      if (error) throw error;
      if ((data as { foreign?: boolean })?.foreign) {
        await supabase.rpc("webhook_finish", { p_event_id: eventId, p_status: "skipped", p_error: null });
        return ack("foreign order");
      }
    }
    // pending → ledger only

    await supabase.rpc("webhook_finish", { p_event_id: eventId, p_status: "processed", p_error: null });
    return ack("processed");
  } catch (error) {
    if (eventId) {
      await supabase
        .rpc("webhook_finish", {
          p_event_id: eventId,
          p_status: "failed",
          p_error: String(error).slice(0, 500),
        })
        .then(() => undefined, () => undefined);
    }
    if (process.env.NODE_ENV !== "production") console.error("[webhook/midtrans]", error);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
