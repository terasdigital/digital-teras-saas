import { Suspense } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { requireUser, getProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const profile = await getProfile(user.id);

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Halo {profile?.full_name ?? "kamu"}! ({user.email})
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
          <CardTitle>Sesi aktif ✔</CardTitle>
          <CardDescription>
            Login, registrasi, dan profil (tabel profiles) sudah berjalan.
            Pembuatan toko & katalog hadir di Milestone 1–2.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Profil tersimpan:
          <pre className="mt-2 rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(profile, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
