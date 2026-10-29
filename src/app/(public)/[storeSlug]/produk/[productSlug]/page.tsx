import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getProductPage } from "@/lib/db/queries/storefront";
import { formatNumber, formatRupiah } from "@/lib/format";
import { assetUrl } from "@/lib/storage";

async function load(params: Promise<{ storeSlug: string; productSlug: string }>) {
  const { storeSlug, productSlug } = await params;
  return getProductPage(storeSlug, productSlug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string; productSlug: string }>;
}): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Produk tidak ditemukan" };
  const { product, store } = data;
  const description =
    product.description?.slice(0, 140) ??
    `${formatRupiah(product.price_idr)} • ${store.name}`;
  return {
    title: `${product.name} — ${store.name}`,
    description,
    alternates: { canonical: `/${store.slug}/produk/${product.slug}` },
  };
}

async function Content({
  params,
}: {
  params: Promise<{ storeSlug: string; productSlug: string }>;
}) {
  const data = await load(params);
  if (!data) notFound();
  const { store, product } = data;
  const img = assetUrl(product.image_path);
  const multi = product.variants.length > 1;

  // Pesan chat pra-isi — checkout penuh dengan keranjang hadir di M4.
  const chatText = multi
    ? `Halo ${store.name}! Saya tertarik dengan produk "${product.name}"`
    : `Halo ${store.name}! Saya mau pesan "${product.name}" (${formatRupiah(product.price_idr)})`;
  const chatUrl = `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(chatText)}`;

  return (
    <>
      <Link
        href={`/${store.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" />
        Kembali ke {store.name}
      </Link>

      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border bg-white">
        {img ? (
          <Image
            src={img}
            alt={product.name}
            fill
            sizes="(max-width:640px) 100vw, 448px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl text-neutral-200">
            🛍️
          </div>
        )}
      </div>

      <div>
        <h1 className="text-lg font-bold tracking-tight">{product.name}</h1>
        <p className="mt-1 text-lg font-semibold">
          {multi ? `Mulai ${formatRupiah(product.price_idr)}` : formatRupiah(product.price_idr)}
        </p>
        {product.description && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
            {product.description}
          </p>
        )}
      </div>

      {multi && (
        <div className="rounded-xl border bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Pilihan
          </p>
          <ul className="flex flex-col divide-y">
            {product.variants.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                <span>{v.name}</span>
                <span className="text-right">
                  <span className="font-medium">{formatRupiah(v.price_idr)}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    {v.stock === null
                      ? ""
                      : v.stock === 0
                        ? "habis"
                        : `sisa ${formatNumber(v.stock)}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <a
        href={chatUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        <MessageCircle className="size-4" />
        Tanya / Pesan via WhatsApp
      </a>
      <p className="text-center text-xs text-neutral-400">
        Keranjang &amp; formulir pesanan resmi hadir di pembaruan berikutnya ✨
      </p>
    </>
  );
}

export default function ProdukPublikPage({
  params,
}: {
  params: Promise<{ storeSlug: string; productSlug: string }>;
}) {
  return (
    <div className="min-h-svh bg-neutral-50">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        <Suspense
          fallback={
            <div className="animate-pulse space-y-4">
              <div className="h-5 w-24 rounded bg-neutral-200" />
              <div className="aspect-square w-full rounded-2xl bg-neutral-200" />
              <div className="h-6 w-2/3 rounded bg-neutral-200" />
            </div>
          }
        >
          <Content params={params} />
        </Suspense>
      </div>
    </div>
  );
}
