import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getOwnStore } from "@/lib/db/queries/dashboard";
import { getThemeFlags } from "@/lib/db/queries/theme";
import { readTheme } from "@/lib/validation/theme";
import { ThemeEditor } from "./theme-editor";

export const metadata: Metadata = { title: "Tampilan" };

async function Content() {
  const user = await requireUser();
  const store = await getOwnStore(user.id);
  if (!store) redirect("/onboarding");

  const [flags] = await Promise.all([getThemeFlags(store.id)]);
  return (
    <ThemeEditor
      initial={readTheme(store.settings)}
      flags={flags}
      storeName={store.name}
    />
  );
}

export default function TampilanPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tampilan</h1>
        <p className="text-sm text-muted-foreground">
          Sesuaikan etalase publik — perubahan langsung terlihat di etalase
          pengunjung.
        </p>
      </div>
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <Content />
      </Suspense>
    </div>
  );
}
