import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Globe, Loader2 } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth";
import { getOwnStore, getSubscriptionInfo } from "@/lib/db/queries/dashboard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Dashboard" };

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-44 rounded-xl bg-muted" />
    </div>
  );
}

async function DashboardContent() {
  const user = await requireUser();
  const store = await getOwnStore(user.id);

  if (!store) {
    return (
      <>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {user.email}
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Belum ada toko</CardTitle>
            <CardDescription>
              Buat terasmu dulu — satu menit, gratis, dan link-nya siap
              dipajang di bio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/onboarding">Buat Toko Sekarang</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  const { effectivePlan } = await getSubscriptionInfo(store.id);
  const publicUrl = `${env.APP_URL}/${store.slug}`;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{store.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Globe className="size-3.5" />
              <code>{publicUrl.replace(/^https?:\/\//, "")}</code>
            </span>
            <Badge variant={store.published ? "secondary" : "outline"}>
              {store.published ? "Publik" : "Dirahasiakan"}
            </Badge>
            <Badge variant="outline" className="capitalize">
              Paket {effectivePlan}
            </Badge>
          </p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm">
            Keluar
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Langkah berikutnya</CardTitle>
          <CardDescription>
            Kelola profil &amp; nomor WhatsApp toko; katalog, pesanan, analitik,
            dan tema menyusul tiap milestone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/dashboard/toko">Atur Profil Toko</Link>
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Halaman publik &amp; katalog sedang dibangun (M2–M3)
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
