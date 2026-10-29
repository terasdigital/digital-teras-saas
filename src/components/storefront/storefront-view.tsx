import Image from "next/image";
import Link from "next/link";
import type { PublicProduct, StorefrontData } from "@/lib/db/queries/storefront";
import { formatRupiah } from "@/lib/format";
import { assetUrl } from "@/lib/storage";
import { BrandingBadge } from "./branding-badge";
import { CartButton } from "./cart-islands";
import { LinkIcon } from "./link-icon";

function soldOut(p: PublicProduct): boolean {
  return p.variants.length > 0 && p.variants.every((v) => v.stock === 0);
}

function ProductCard({ product, storeSlug }: { product: PublicProduct; storeSlug: string }) {
  const img = assetUrl(product.image_path);
  const multi = product.variants.length > 1;
  return (
    <Link
      href={`/${storeSlug}/produk/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square w-full bg-neutral-100">
        {img ? (
          <Image
            src={img}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 45vw, 220px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-300">
            <span className="text-3xl">🛍️</span>
          </div>
        )}
        {soldOut(product) && (
          <span className="absolute right-2 top-2 rounded-full bg-neutral-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">
            Habis
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
        <p className="mt-auto pt-1 text-sm font-semibold text-neutral-800">
          {multi ? `Mulai ${formatRupiah(product.price_idr)}` : formatRupiah(product.price_idr)}
        </p>
      </div>
    </Link>
  );
}

export function StorefrontView({ data }: { data: StorefrontData }) {
  const { store, links, products } = data;
  const avatar = assetUrl(store.avatar_path);
  const banner = assetUrl(store.banner_path);

  return (
    <div className="min-h-svh bg-neutral-50">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
        {/* Header toko */}
        <header className="flex flex-col items-center gap-3 text-center">
          {banner && (
            <div className="relative h-28 w-full overflow-hidden rounded-2xl border bg-white">
              <Image src={banner} alt="" fill sizes="(max-width:640px) 100vw, 448px" className="object-cover" />
            </div>
          )}
          <div className="relative -mt-2 size-24 overflow-hidden rounded-full border-4 border-white bg-neutral-200 shadow-md">
            {avatar ? (
              <Image src={avatar} alt={store.name} fill sizes="96px" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl font-bold text-neutral-500">
                {store.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{store.name}</h1>
            {store.tagline && (
              <p className="mt-0.5 text-sm text-neutral-600">{store.tagline}</p>
            )}
            {store.bio && (
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{store.bio}</p>
            )}
          </div>
        </header>

        {/* Tautan */}
        {links.length > 0 && (
          <nav className="flex flex-col gap-2.5">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <LinkIcon icon={link.icon} className="size-4" />
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {/* Katalog */}
        {products.length > 0 ? (
          <section>
            <h2 className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Katalog
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} storeSlug={store.slug} />
              ))}
            </div>
          </section>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-neutral-400">
            Belum ada produk di sini — mampir lagi ya 🌱
          </p>
        )}

        <BrandingBadge />
      </div>

      {/* island keranjang: tombol mengambang + sheet + dialog checkout */}
      <CartButton storeSlug={store.slug} />
    </div>
  );
}
