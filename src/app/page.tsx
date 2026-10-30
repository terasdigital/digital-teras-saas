import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { readSessionUser } from "@/lib/auth";

function GuestCta() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button asChild size="lg">
        <Link href="/register">Buat Toko Gratis</Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/login">Masuk</Link>
      </Button>
    </div>
  );
}

async function CtaArea() {
  const user = await readSessionUser();
  if (user) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/dashboard">Buka Dashboard</Link>
        </Button>
      </div>
    );
  }
  return <GuestCta />;
}

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          Micro-store di satu link bio
        </span>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Satu teras untuk semua jualanmu
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Digital Teras mengubah link di bio Instagram & TikTok-mu jadi etalase
          produk — pembeli memilih barang lalu melanjutkan checkout langsung ke
          WhatsApp kamu.
        </p>
      </div>

      {/* Cache Components: bagian yang membaca sesi mengalir via Suspense. */}
      <Suspense fallback={<GuestCta />}>
        <CtaArea />
      </Suspense>

      <footer className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-neutral-400">
        <Link href="/pricing" className="hover:text-neutral-600">Harga</Link>
        <Link href="/legal/terms" className="hover:text-neutral-600">Syarat &amp; Ketentuan</Link>
        <Link href="/legal/privacy" className="hover:text-neutral-600">Privasi</Link>
        <span>&copy; Digital Teras</span>
      </footer>
    </main>
  );
}
