import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getOwnStore } from "@/lib/db/queries/dashboard";
import { StoreForm } from "./store-form";

export const metadata: Metadata = { title: "Profil Toko" };

async function TokoContent() {
  const user = await requireUser();
  const store = await getOwnStore(user.id);
  if (!store) redirect("/onboarding");

  return (
    // key = updated_at: tiap simpan sukses, trigger DB menaikkan nilai ini →
    // StoreForm remount dengan state segar (switch sinkron dgn DB, hasil
    // useActionState lama tidak ter-replay saat kembali ke halaman).
    <StoreForm
      key={store.updated_at}
      store={{
        slug: store.slug,
        name: store.name,
        tagline: store.tagline,
        bio: store.bio,
        whatsapp: store.whatsapp,
        published: store.published,
        avatarPath: store.avatar_path,
        bannerPath: store.banner_path,
      }}
    />
  );
}

export default function TokoPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profil Toko</h1>
        <p className="text-sm text-muted-foreground">
          Ini yang dilihat calon pembeli di halaman tokomu nanti.
        </p>
      </div>
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <TokoContent />
      </Suspense>
    </div>
  );
}
