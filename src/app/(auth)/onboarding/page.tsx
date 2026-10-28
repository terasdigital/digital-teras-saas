import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getOwnStore } from "@/lib/db/queries/dashboard";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Buat Toko" };

async function OnboardingContent() {
  const user = await requireUser();
  const store = await getOwnStore(user.id);
  if (store) redirect("/dashboard");
  return <OnboardingForm />;
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="h-96 w-full animate-pulse rounded-xl bg-muted" />
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
