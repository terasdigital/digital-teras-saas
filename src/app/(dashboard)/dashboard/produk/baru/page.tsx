import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getOwnStore } from "@/lib/db/queries/dashboard";
import { getProductUsage } from "@/lib/db/queries/product";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Produk Baru" };

async function Content() {
  const user = await requireUser();
  const store = await getOwnStore(user.id);
  if (!store) redirect("/onboarding");
  const usage = await getProductUsage(store.id);
  if (!usage.can) redirect("/dashboard/produk");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tambah Produk</h1>
        <p className="text-sm text-muted-foreground">
          Foto, harga, dan stok per varian.
        </p>
      </div>
      {/* key "new": App Router memakai ulang instance client component di
          rute saudara (baru ↔ [id]) beserta state-nya — tanpa key, form
          "baru" mewarisi isi produk yang barusan diedit. */}
      <ProductForm key="new" variantLimit={usage.maxVariants} />
    </div>
  );
}

export default function BaruProdukPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <Content />
      </Suspense>
    </div>
  );
}
