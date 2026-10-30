import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { getPublicClient } from "@/lib/supabase/public";
import { cacheLife, cacheTag } from "next/cache";

export const metadata: Metadata = {
  title: "Harga — Gratis selamanya untuk mulai",
  description:
    "Digital Teras gratis untuk micro-store pertamamu. Upgrade saat jualan tumbuh.",
};

type PlanRow = {
  code: string;
  name: string;
  price_idr: number;
  limits: Record<string, number | boolean>;
};

/** Data publik & jarang berubah → ter-prerender penuh (SEO) via use cache. */
async function listPlansCached(): Promise<PlanRow[]> {
  "use cache"
  cacheTag("plans")
  cacheLife("days")
  const { data } = await getPublicClient()
    .from("plans")
    .select("code, name, price_idr, limits")
    .eq("is_public", true)
    .order("sort");
  return (data as PlanRow[]) ?? [];
}

function featureLines(l: PlanRow["limits"]): string[] {
  const out: string[] = [];
  if (typeof l.max_products === "number")
    out.push(`Maks ${l.max_products} produk`);
  if (typeof l.max_links === "number") out.push(`Maks ${l.max_links} tautan`);
  if (typeof l.max_variants === "number")
    out.push(`Maks ${l.max_variants} varian/produk`);
  if (typeof l.analytics_days === "number")
    out.push(`Analitik ${l.analytics_days} hari`);
  if (l.custom_accent === true) out.push("Warna kustom bebas");
  if (l.hide_badge === true) out.push("Tanpa badge Digital Teras");
  return out;
}

export default async function PricingPage() {
  const plans = await listPlansCached();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Mulai gratis, upgrade saat tumbuh
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Paket Free selamanya — tanpa kartu kredit. Bayar hanya kalau
          jualanmu sudah melewati batasnya.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.code} className={p.code === "micro" ? "border-primary" : undefined}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <p className="text-2xl font-bold">
                {p.price_idr > 0 ? (
                  <>
                    {formatRupiah(p.price_idr)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /bulan
                    </span>
                  </>
                ) : (
                  "Gratis"
                )}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2 text-sm">
                {featureLines(p.limits).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {f}
                  </li>
                ))}
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  Etalase publik + checkout WhatsApp
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  Pesanan tercatat otomatis
                </li>
              </ul>
              <Button asChild variant={p.code === "micro" ? "default" : "outline"}>
                <Link href={p.code === "free" ? "/register" : "/register?next=/dashboard/langganan"}>
                  {p.price_idr > 0 ? "Pilih " + p.name : "Mulai Gratis"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Pembayaran diproses Midtrans (QRIS, Virtual Account, kartu). Harga sudah
        termasuk PPN bila berlaku.
      </p>
    </main>
  );
}
