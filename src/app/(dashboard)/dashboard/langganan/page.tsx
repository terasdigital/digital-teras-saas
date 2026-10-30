import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Crown } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOwnStore } from "@/lib/db/queries/dashboard";
import {
  getStoreUsage,
  getSubscriptionState,
  listPublicPlans,
} from "@/lib/db/queries/billing";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpgradePanel } from "./upgrade-panel";

export const metadata: Metadata = { title: "Langganan" };

function Meter({ label, used, max }: { label: string; used: number; max: number | undefined }) {
  const pct = max ? Math.min(100, (used / max) * 100) : 0;
  const full = max ? used >= max : false;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={full ? "font-semibold text-amber-600" : "tabular-nums"}>
          {formatNumber(used)}
          {max ? ` / ${formatNumber(max)}` : ""}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={"h-full rounded-full " + (full ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${max ? pct : 100}%` }}
        />
      </div>
    </div>
  );
}

async function Content() {
  const user = await requireUser();
  const store = await getOwnStore(user.id);
  if (!store) redirect("/onboarding");

  const [usage, sub, plans] = await Promise.all([
    getStoreUsage(store.id),
    getSubscriptionState(store.id),
    listPublicPlans(),
  ]);

  const paidPlans = plans.filter((p) => p.code !== "free");
  const activePaid = sub.status === "active" || sub.status === "trialing";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          <Crown className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Langganan</h1>
          <p className="text-sm text-muted-foreground">
            Tingkatkan paket untuk lebih banyak produk, varian, &amp; tanpa badge.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Paket aktif: <Badge variant="outline" className="capitalize">{usage.plan}</Badge>
            </CardTitle>
            <CardDescription>
              {activePaid && sub.currentPeriodEnd
                ? `Berlaku sampai ${new Date(sub.currentPeriodEnd).toLocaleDateString("id-ID", { dateStyle: "long" })}.`
                : "Paket gratis selamanya — upgrade kapan saja."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Meter label="Produk" used={usage.products} max={usage.limits.max_products} />
            <Meter label="Tautan" used={usage.links} max={usage.limits.max_links} />
            <p className="text-xs text-muted-foreground">
              Batas mengikuti paket aktif — naik otomatis saat upgrade.
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>
                Maks varian/produk ({usage.plan}): {usage.limits.max_variants ?? "∞"}
              </span>
              <span>
                Riwayat analitik ({usage.plan}): {usage.limits.analytics_days ?? "∞"} hari
              </span>
            </div>
          </CardContent>
        </Card>

        <UpgradePanel
          paidPlans={paidPlans.map((p) => ({
            code: p.code,
            name: p.name,
            priceIdr: p.price_idr,
          }))}
          currentPlan={usage.plan}
        />
      </div>
    </div>
  );
}

export default function LanggananPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Content />
      </Suspense>
    </div>
  );
}
