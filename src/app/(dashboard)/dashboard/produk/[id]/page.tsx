import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getOwnStore } from "@/lib/db/queries/dashboard";
import { getProduct, getProductUsage } from "@/lib/db/queries/product";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Edit Produk" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const store = await getOwnStore(user.id);
  if (!store) redirect("/onboarding");

  const [product, usage] = await Promise.all([
    getProduct(store.id, id),
    getProductUsage(store.id),
  ]);
  if (!product) notFound();

  const variants = [...product.product_variants].sort(
    (a, b) => a.position - b.position,
  );
  const hasVariants =
    variants.length > 1 || (variants.length === 1 && variants[0]!.name !== "Default");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Produk</h1>
        <p className="truncate text-sm text-muted-foreground">{product.name}</p>
      </div>
      {/* key per produk: edit A → edit B juga tidak boleh mewarisi state */}
      <ProductForm
        key={product.id}
        productId={product.id}
        variantLimit={usage.maxVariants}
        initial={{
          name: product.name,
          description: product.description ?? "",
          imagePath: product.image_path,
          hasVariants,
          variants: variants.map((v) => ({
            id: v.id,
            name: v.name,
            priceInput: String(v.price_idr),
            stockInput: v.stock === null ? "" : String(v.stock),
          })),
        }}
      />
    </div>
  );
}

export default function EditProdukPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <Content params={params} />
      </Suspense>
    </div>
  );
}
