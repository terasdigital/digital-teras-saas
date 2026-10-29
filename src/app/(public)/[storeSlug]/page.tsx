import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStorefront } from "@/lib/db/queries/storefront";
import { StorefrontView } from "@/components/storefront/storefront-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  const data = await getStorefront(storeSlug);
  if (!data) return { title: "Toko tidak ditemukan" };

  const { store } = data;
  const title = `${store.name} — Digital Teras`;
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
    alternates: { canonical: `/${store.slug}` },
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
  return <StorefrontView data={data} />;
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
