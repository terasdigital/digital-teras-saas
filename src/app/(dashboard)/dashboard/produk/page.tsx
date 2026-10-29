import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ImageOff, Package } from "lucide-react";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { getOwnStore } from "@/lib/db/queries/dashboard";
import {
  getProductUsage,
  listProducts,
  type ProductRow,
} from "@/lib/db/queries/product";
import { formatNumber, formatRupiah } from "@/lib/format";
import { assetUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProductRowActions } from "./product-row-actions";

export const metadata: Metadata = { title: "Produk" };

function stockSummary(p: ProductRow): string {
  const tracked = p.product_variants.filter((v) => v.stock !== null);
  if (tracked.length === 0) return "Stok tidak dilacak";
  const total = tracked.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  return `${formatNumber(total)} stok tersedia`;
}

function ProductCard({ product }: { product: ProductRow }) {
  const img = assetUrl(product.image_path);
  const multi = product.product_variants.length > 1;
  return (
    <Card className="gap-0 p-0">
      <div className="relative h-32 w-full overflow-hidden rounded-t-xl border-b bg-muted">
        {img ? (
          <Image
            src={img}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-6" />
          </div>
        )}
        {!product.is_active && (
          <Badge className="absolute left-2 top-2" variant="secondary">
            Nonaktif
          </Badge>
        )}
      </div>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-semibold" title={product.name}>
            {product.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {multi ? `Dari ${formatRupiah(product.price_idr)}` : formatRupiah(product.price_idr)}
            {" · "}
            {product.product_variants.length === 1
              ? "1 varian"
              : `${product.product_variants.length} varian`}
          </p>
          <p className="text-xs text-muted-foreground">{stockSummary(product)}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/produk/${product.id}`}>Edit</Link>
          </Button>
          <ProductRowActions
            productId={product.id}
            productName={product.name}
            isActive={product.is_active}
          />
        </div>
      </CardContent>
    </Card>
  );
}

async function ProdukContent() {
  const user = await requireUser();
  const store = await getOwnStore(user.id);
  if (!store) redirect("/onboarding");

  const [products, usage] = await Promise.all([
    listProducts(store.id),
    getProductUsage(store.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produk</h1>
          <p className="text-sm text-muted-foreground">
            {usage.limit === null
              ? `${formatNumber(usage.used)} produk · paket ${usage.plan}`
              : `${formatNumber(usage.used)}/${formatNumber(usage.limit)} produk terpakai · paket ${usage.plan}`}
            {usage.maxVariants !== null && (
              <> · maks {usage.maxVariants} varian/produk</>
            )}
          </p>
        </div>
        {usage.can ? (
          <Button asChild>
            <Link href="/dashboard/produk/baru">Tambah Produk</Link>
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <Button asChild>
              <Link href="/dashboard/langganan">Upgrade untuk Tambah</Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              Batas paket {usage.plan} tercapai.
            </span>
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Package className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Belum ada produk</p>
              <p className="text-sm text-muted-foreground">
                Tambahkan barang pertama — foto, harga, varian, dan stok.
              </p>
            </div>
            {usage.can && (
              <Button asChild>
                <Link href="/dashboard/produk/baru">Buat Produk Pertama</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProdukPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <ProdukContent />
      </Suspense>
    </div>
  );
}
