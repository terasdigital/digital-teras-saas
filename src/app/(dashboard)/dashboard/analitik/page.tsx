import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getOwnStore } from "@/lib/db/queries/dashboard";
import {
  getAnalyticsData,
  getAnalyticsWindowDays,
  type TopItem,
} from "@/lib/db/queries/analytics";
import { formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/dashboard/trend-chart";

export const metadata: Metadata = { title: "Analitik" };

const RANGE_STEPS = [7, 30, 90] as const;

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function FunnelBar({
  label,
  count,
  pctOfTop,
  widthPct,
}: {
  label: string;
  count: number;
  pctOfTop: number;
  widthPct: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="relative h-6 flex-1 overflow-hidden rounded bg-muted">
        <div
          className="h-full rounded bg-primary/80"
          style={{ width: `${Math.max(widthPct, count > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-xs tabular-nums">
        {formatNumber(count)}{" "}
        <span className="text-muted-foreground">({pctOfTop.toFixed(0)}%)</span>
      </span>
    </div>
  );
}

function TopList({ title, items }: { title: string; items: TopItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Belum ada data.
          </p>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-xs" title={it.name}>
                {it.name}
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-primary/70"
                  style={{ width: `${(it.count / max) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                {formatNumber(it.count)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

async function Content({ daysParam }: { daysParam?: string }) {
  const user = await requireUser();
  const store = await getOwnStore(user.id);
  if (!store) redirect("/onboarding");

  const maxDays = await getAnalyticsWindowDays(store.id);
  const requested = Number.parseInt(daysParam ?? "", 10);
  const days =
    RANGE_STEPS.includes(requested as (typeof RANGE_STEPS)[number]) && requested <= maxDays
      ? requested
      : Math.min(7, maxDays);

  const data = await getAnalyticsData(store.id, days);
  const { totals } = data;
  const conversion = totals.visit > 0 ? (totals.order / totals.visit) * 100 : 0;
  const funnel = [
    { label: "Kunjungan", count: totals.visit },
    { label: "Lihat produk", count: totals.product_view },
    { label: "Keranjang", count: totals.cart_add },
    { label: "Checkout", count: totals.checkout },
    { label: "Pesanan", count: totals.order },
  ];
  const funnelMax = Math.max(1, totals.visit);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analitik</h1>
          <p className="text-sm text-muted-foreground">
            {days} hari terakhir
            {maxDays < 90 && ` · paketmu menyimpan riwayat ${maxDays} hari`}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {RANGE_STEPS.map((d) => {
            const allowed = d <= maxDays;
            const active = d === days;
            return allowed ? (
              <Link
                key={d}
                href={`/dashboard/analitik?days=${d}`}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {d}h
              </Link>
            ) : (
              <span
                key={d}
                title={`Paket kamu menampilkan maks ${maxDays} hari — upgrade di Milestone 7`}
                className="cursor-not-allowed rounded-md px-3 py-1 text-xs text-muted-foreground/50"
              >
                {d}h
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Kunjungan" value={formatNumber(totals.visit)} />
        <Kpi label="Lihat produk" value={formatNumber(totals.product_view)} />
        <Kpi label="Keranjang" value={formatNumber(totals.cart_add)} />
        <Kpi label="Checkout" value={formatNumber(totals.checkout)} />
        <Kpi
          label="Pesanan"
          value={formatNumber(totals.order)}
          sub={`${conversion.toFixed(1)}% konversi`}
        />
        <Kpi label="Omzet tercatat" value={formatRupiah(data.revenueIdr)} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Kunjungan harian</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart series={data.series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Corong konversi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {funnel.map((f) => (
            <FunnelBar
              key={f.label}
              label={f.label}
              count={f.count}
              pctOfTop={(f.count / funnelMax) * 100}
              widthPct={(f.count / funnelMax) * 100}
            />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <TopList title="Produk paling dilihat" items={data.topProducts} />
        <TopList title="Tautan paling diklik" items={data.topLinks} />
      </div>
    </div>
  );
}

export default function AnalitikPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <ContentWrapper searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ContentWrapper({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days } = await searchParams;
  return <Content daysParam={days} />;
}
