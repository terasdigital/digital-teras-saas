import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStorefront } from "@/lib/db/queries/storefront";
import { env } from "@/lib/env";
import { getPublicClient } from "@/lib/supabase/public";
import { storeJsonLd } from "@/lib/jsonld";
import { StorefrontView } from "@/components/storefront/storefront-view";

/**
 * Slug toko yang ada saat build → shell (termasuk <head>/metadata) ter-
 * prerender; slug baru tetap dilayani dinamis (dynamicParams default).
 * Kesegaran data dijaga cacheTag store:{slug} + updateTag tiap mutasi.
 */
export async function generateStaticParams() {
  const { data } = await getPublicClient()
    .from("public_storefront")
    .select("slug")
    .limit(1000);
  return (data ?? []).map((r) => ({ storeSlug: String(r.slug) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  const data = await getStorefront(storeSlug);
  if (!data) return { title: "Toko tidak ditemukan" };

  const { store } = data;
  // template root layout sudah menambah "— Digital Teras"; jangan dobel.
  const title = store.name;
  const description =
    store.tagline ?? store.bio ?? `Katalog & pesanan via WhatsApp di satu link.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: `/${store.slug}`,
    },
    alternates: { canonical: `${env.APP_URL}/${store.slug}` },
  };
}

function StorefrontSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-md animate-pulse flex-col items-center gap-4 px-4 py-12">
      <div className="size-24 rounded-full bg-neutral-200" />
      <div className="h-5 w-40 rounded bg-neutral-200" />
      <div className="h-10 w-full rounded-xl bg-neutral-200" />
      <div className="h-10 w-full rounded-xl bg-neutral-200" />
      <div className="grid w-full grid-cols-2 gap-3">
        <div className="aspect-square rounded-xl bg-neutral-200" />
        <div className="aspect-square rounded-xl bg-neutral-200" />
      </div>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const data = await getStorefront(storeSlug);
  if (!data) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd(data)) }}
      />
      <StorefrontView data={data} />
    </>
  );
}

export default function StorefrontPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  return (
    <Suspense fallback={<StorefrontSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
