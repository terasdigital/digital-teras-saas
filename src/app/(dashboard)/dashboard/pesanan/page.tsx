import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOwnStore } from "@/lib/db/queries/dashboard";
import { listOrders } from "@/lib/db/queries/order";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusSelect } from "./order-status-select";

export const metadata: Metadata = { title: "Pesanan" };

const STATUS_TONE: Record<string, string> = {
  created: "bg-blue-100 text-blue-800 border-blue-200",
  confirmed: "bg-amber-100 text-amber-800 border-amber-200",
  processing: "bg-violet-100 text-violet-800 border-violet-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-neutral-100 text-neutral-500 border-neutral-200 line-through",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

async function Content() {
  const user = await requireUser();
  const store = await getOwnStore(user.id);
  if (!store) redirect("/onboarding");

  const orders = await listOrders(store.id);

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <ReceiptText className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Belum ada pesanan masuk</p>
            <p className="text-sm text-muted-foreground">
              Bagikan link{" "}
              <Link href={`/${store.slug}`} className="underline underline-offset-2">
                /{store.slug}
              </Link>{" "}
              — pesanan dari pembeli muncul di sini otomatis, bahkan sebelum
              chat-nya dikirim.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((o) => (
        <Card key={o.id} className="gap-0 py-3">
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/pesanan/${o.id}`}
                  className="font-mono text-sm font-semibold hover:underline"
                >
                  {o.ref}
                </Link>
                <span
                  className={
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                    (STATUS_TONE[o.status] ?? "")
                  }
                >
                  {ORDER_STATUS_LABEL[o.status]}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {o.buyer_name}
                {o.buyer_phone ? ` · ${o.buyer_phone}` : ""} · {timeAgo(o.created_at)}
              </p>
            </div>
            <p className="text-sm font-bold">{formatRupiah(o.total_idr)}</p>
            <OrderStatusSelect orderId={o.id} current={o.status} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PesananPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Pesanan</h1>
        <p className="text-sm text-muted-foreground">
          Semua checkout dari etalase tercatat di sini — kelola statusnya,
          kurangi stok manual bila perlu.
        </p>
      </div>
      <Suspense
        fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}
      >
        <Content />
      </Suspense>
    </div>
  );
}
