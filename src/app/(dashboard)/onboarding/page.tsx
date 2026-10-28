import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function OnboardingContent() {
  await requireUser();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Buat tokomu</CardTitle>
        <CardDescription>
          Wizard onboarding (nama toko, slug, nomor WhatsApp, avatar) dibangun
          di Milestone 1 — tabel & RPC stores menyusul.
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl items-center px-4 py-24">
      <Suspense
        fallback={
          <div className="h-44 w-full animate-pulse rounded-xl bg-muted" />
        }
      >
        <OnboardingContent />
      </Suspense>
    </main>
  );
}
