import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOwnStore } from "@/lib/db/queries/dashboard";
import { getOrder } from "@/lib/db/queries/order";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { formatNumber, formatRupiah } from "@/lib/format";
import { normalizeWhatsappNumber } from "@/lib/wa-number";
import { assetUrl } from "@/lib/storage";
import { OrdersLive } from "@/components/dashboard/orders-live";
import { OrderStatusSelect } from "../order-status-select";

export const metadata: Metadata = { title: "Detail Pesanan" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const store = await getOwnStore(user.id);
  if (!store) redirect("/onboarding");

  const order = await getOrder(store.id, id);
  if (!order) notFound();

  const items = order.order_items ?? [];
  const chatHref = order.buyer_phone
    ? `https://wa.me/${normalizeWhatsappNumber(order.buyer_phone)}?text=${encodeURIComponent(
        `Halo ${order.buyer_name}, ini ${store.name} soal pesanan ${order.ref} 🙏`,
      )}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/pesanan"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Semua pesanan
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight">{order.ref}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleString("id-ID", {
              dateStyle: "full",
              timeStyle: "short",
            })}{" "}
            · status lama: {ORDER_STATUS_LABEL[order.status]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OrdersLive storeId={store.id} />
          <OrderStatusSelect orderId={order.id} current={order.status} />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <ul className="divide-y">
          {items.map((it) => {
            const img = assetUrl(it.image_path);
            return (
              <li key={it.id} className="flex items-center gap-3 p-4">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  {img ? (
                    <Image src={img} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm">🛍️</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.variant_name !== "Default" ? `${it.variant_name} · ` : ""}
                    {formatNumber(it.qty)} × {formatRupiah(it.unit_price_idr)}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {formatRupiah(BigInt(it.unit_price_idr) * BigInt(it.qty))}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t p-4">
          <span className="text-sm text-muted-foreground">Total pesanan</span>
          <span className="text-lg font-bold">{formatRupiah(order.total_idr)}</span>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 text-sm">
        <p className="mb-2 font-medium">Pembeli</p>
        <p>{order.buyer_name}</p>
        {order.buyer_phone && (
          <p className="text-muted-foreground">{order.buyer_phone}</p>
        )}
        {order.buyer_note && (
          <p className="mt-2 rounded-lg bg-muted p-2 text-muted-foreground">
            “{order.buyer_note}”
          </p>
        )}
        {chatHref && (
          <a
            href={chatHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white"
          >
            <MessageCircle className="size-3.5" />
            Hubungi via WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export default function DetailPesananPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <Content params={params} />
      </Suspense>
    </div>
  );
}
