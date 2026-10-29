"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import {
  checkoutStatusAction,
  startUpgradeAction,
  type CheckoutInit,
} from "@/lib/actions/billing";

type PlanLite = { code: string; name: string; priceIdr: number };

const DURATIONS = [
  { months: 1, label: "1 bulan" },
  { months: 3, label: "3 bulan" },
  { months: 12, label: "1 tahun" },
];

const METHOD_LABELS: Record<string, string> = {
  qris: "QRIS",
  bca_va: "Virtual Account BCA",
  card: "Kartu Kredit/Debit",
};

export function UpgradePanel({
  paidPlans,
  currentPlan,
}: {
  paidPlans: PlanLite[];
  currentPlan: string;
}) {
  const router = useRouter();
  const [planCode, setPlanCode] = useState(paidPlans[1]?.code ?? paidPlans[0]?.code ?? "pro");
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState("qris");
  const [busy, start] = useTransition();
  const [init, setInit] = useState<CheckoutInit | null>(null);
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const plan = paidPlans.find((p) => p.code === planCode);
  const total = plan ? plan.priceIdr * months : 0;

  useEffect(() => {
    if (!init || paid) return;
    const started = Date.now();
    pollRef.current = setInterval(async () => {
      const res = await checkoutStatusAction(init.orderId);
      if ("error" in res) return;
      if (res.status === "paid") {
        setPaid(true);
        toast.success("Pembayaran diterima — paket aktif! 🎉");
        router.refresh();
      } else if (res.status === "expired" || res.status === "refunded") {
        toast.error(res.status === "expired" ? "Batas waktu pembayaran lewat." : "Pembayaran dibatalkan/dikembalikan.");
        setInit(null);
      }
      if (Date.now() - started > 10 * 60_000 && pollRef.current) {
        clearInterval(pollRef.current);
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [init, paid, router]);

  function handleStart() {
    start(async () => {
      const res = await startUpgradeAction(planCode, months, method);
      if ("error" in res && !("kind" in res)) {
        toast.error(res.error);
        return;
      }
      setPaid(false);
      setInit(res as CheckoutInit);
    });
  }

  if (paid) {
    return (
      <Card className="border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Check className="size-10 text-emerald-600" />
          <p className="font-semibold">Paket {plan?.name} aktif!</p>
          <p className="text-sm text-muted-foreground">
            Batas pemakaian &amp; fitur Pro sudah terbuka. Data halaman akan
            menyegar sendiri.
          </p>
          <Button variant="outline" onClick={() => setInit(null)}>
            Selesai
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (init) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Selesaikan pembayaran · {formatRupiah(init.grossIdr)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {init.kind === "qris" && (
            <>
              <div className="rounded-xl border bg-white p-3">
                <QRCodeSVG value={init.qrString} size={180} />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Scan QRIS dari aplikasi banking/e-wallet apa pun.
                <br />
                Status terdeteksi otomatis setelah bayar.
              </p>
            </>
          )}
          {init.kind === "va" && (
            <>
              <p className="text-xs text-muted-foreground">Nomor VA {init.bank}</p>
              <div className="flex items-center gap-2 rounded-lg border bg-muted px-4 py-3">
                <code className="font-mono text-lg font-semibold">{init.vaNumber}</code>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(init.kind === "va" ? init.vaNumber : "");
                    toast.success("Nomor VA disalin.");
                  }}
                >
                  <Copy />
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Transfer tepat ke nomor ini; status terdeteksi otomatis.
              </p>
            </>
          )}
          {init.kind === "redirect" && (
            <>
              <a
                href={init.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Lanjut ke Halaman Pembayaran
              </a>
              <p className="text-center text-xs text-muted-foreground">
                Selesaikan di tab Midtrans — halaman ini akan mendeteksi
                otomatis setelah tuntas.
              </p>
            </>
          )}
          <Separator className="w-full" />
          <div className="flex w-full items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Menunggu pembayaran…
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setInit(null)}>
              Batal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upgrade paket</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {paidPlans.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => setPlanCode(p.code)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                planCode === p.code ? "border-primary bg-primary/5" : "hover:bg-muted",
                currentPlan === p.code && "opacity-70",
              )}
            >
              <p className="text-sm font-semibold">
                {p.name}
                {currentPlan === p.code && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(aktif)</span>
                )}
              </p>
              <p className="text-lg font-bold">{formatRupiah(p.priceIdr)}
                <span className="text-xs font-normal text-muted-foreground"> /bln</span>
              </p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d.months}
              type="button"
              onClick={() => setMonths(d.months)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium",
                months === d.months ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(METHOD_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMethod(key)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs",
                method === key ? "border-primary bg-primary/10 font-semibold" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
          <span>Total {months} bulan</span>
          <span className="text-base font-bold">{formatRupiah(total)}</span>
        </div>

        <Button size="lg" onClick={handleStart} disabled={busy || !plan}>
          {busy && <Loader2 className="animate-spin" />}
          Bayar dengan {METHOD_LABELS[method]}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Pembayaran diproses Midtrans · prabayar, bisa diperpanjang kapan saja
        </p>
      </CardContent>
    </Card>
  );
}
