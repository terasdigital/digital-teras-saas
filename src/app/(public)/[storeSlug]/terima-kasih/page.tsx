import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppLauncher } from "@/components/storefront/whatsapp-launcher";

export const metadata: Metadata = { title: "Pesanan tercatat" };

const REF_PATTERN = /^DT-[A-Z0-9]{6,10}$/;

export default function TerimaKasihPage(props: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  // Runtime data (params+searchParams) & possible notFound() → di belakang
  // Suspense (Cache Components): static shell = skeleton, isi mengalir saat request.
  return (
    <div className="min-h-svh bg-neutral-50">
      <Suspense
        fallback={
          <div className="mx-auto flex w-full max-w-md animate-pulse flex-col items-center gap-5 px-6 py-16">
            <div className="size-14 rounded-full bg-neutral-200" />
            <div className="h-6 w-40 rounded bg-neutral-200" />
            <div className="h-16 w-full rounded bg-neutral-200" />
          </div>
        }
      >
        <Content {...props} />
      </Suspense>
    </div>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const [{ storeSlug }, { ref: orderRef }] = await Promise.all([params, searchParams]);
  if (!orderRef || !REF_PATTERN.test(orderRef)) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-6 py-16 text-center">
      <CheckCircle2 className="size-14 text-emerald-600" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pesanan tercatat ✔</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Kode pesanan <code className="rounded bg-neutral-200 px-1.5 py-0.5 font-semibold">{orderRef}</code>{" "}
          sudah masuk ke penjual. Sekarang buka WhatsApp dan pencet{" "}
          <strong>kirim</strong> supaya chat-nya sampai.
        </p>
      </div>

      <div className="mt-1 w-full">
        <WhatsAppLauncher orderRef={orderRef} />
      </div>

      <Button asChild variant="outline" className="mt-2">
        <Link href={`/${storeSlug}`}>Kembali ke toko</Link>
      </Button>
    </div>
  );
}
