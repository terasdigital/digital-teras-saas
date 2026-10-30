import Image from "next/image";
import Link from "next/link";
import type { PublicProduct, StorefrontData } from "@/lib/db/queries/storefront";
import { formatRupiah } from "@/lib/format";
import { assetUrl } from "@/lib/storage";
import { themeRootClass, themeStyleVars } from "@/lib/theme";
import { readTheme } from "@/lib/validation/theme";
import { BrandingBadge } from "./branding-badge";
import { CartMount } from "./cart-mount";
import { LinkIcon } from "./link-icon";
import { TrackPageView } from "./track-page-view";
import { TrackedLink } from "./tracked-link";

function soldOut(p: PublicProduct): boolean {
  return p.variants.length > 0 && p.variants.every((v) => v.stock === 0);
}

/** Kartu produk — 'card' (gambar kotak di atas) atau 'row' (baris list). */
function ProductCard({
  product,
  storeSlug,
  mode = "card",
  compact = false,
}: {
  product: PublicProduct;
  storeSlug: string;
  mode?: "card" | "row";
  compact?: boolean;
}) {
  const img = assetUrl(product.image_path);
  const multi = product.variants.length > 1;
  const price = multi
    ? `Mulai ${formatRupiah(product.price_idr)}`
    : formatRupiah(product.price_idr);

  if (mode === "row") {
    return (
      <Link
        href={`/${storeSlug}/produk/${product.slug}`}
        className="dt-rounded flex items-center gap-3 border bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="relative size-16 shrink-0 overflow-hidden bg-neutral-100" style={{ borderRadius: "calc(var(--dt-radius) / 1.5)" }}>
          {img ? (
            <Image src={img} alt={product.name} fill sizes="64px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">🛍️</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{product.name}</p>
          {soldOut(product) && (
            <span className="text-xs font-medium text-neutral-400">habis</span>
          )}
        </div>
        <p className="dt-accent-text text-sm font-semibold">{price}</p>
      </Link>
    );
  }

  return (
    <Link
      href={`/${storeSlug}/produk/${product.slug}`}
      className="dt-rounded group flex flex-col overflow-hidden border bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div
        className={
          "relative w-full overflow-hidden bg-neutral-100 " +
          (compact ? "aspect-[4/3]" : "aspect-square")
        }
      >
        {img ? (
          <Image
            src={img}
            alt={product.name}
            fill
            sizes={compact ? "(max-width:640px) 45vw, 200px" : "(max-width:640px) 45vw, 220px"}
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
        <p className="dt-accent-text mt-auto pt-1 text-sm font-semibold">{price}</p>
      </div>
    </Link>
  );
}

/** Header (banner, avatar, nama, tagline, bio) — sama untuk semua layout. */
function StoreHeader({ data }: { data: StorefrontData }) {
  const { store } = data;
  const avatar = assetUrl(store.avatar_path);
  const banner = assetUrl(store.banner_path);
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      {banner && (
        <div className="dt-rounded relative h-28 w-full overflow-hidden border bg-white">
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
        {store.tagline && <p className="mt-0.5 text-sm text-neutral-600">{store.tagline}</p>}
        {store.bio && (
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">{store.bio}</p>
        )}
      </div>
    </header>
  );
}

function ProductGrid({
  layout,
  products,
  storeSlug,
}: {
  layout: string;
  products: PublicProduct[];
  storeSlug: string;
}) {
  if (products.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-neutral-400">
        Belum ada produk di sini — mampir lagi ya 🌱
      </p>
    );
  }
  if (layout === "linktree") {
    return (
      <div className="flex flex-col gap-2.5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} storeSlug={storeSlug} mode="row" />
        ))}
      </div>
    );
  }
  return (
    <div
      className={
        layout === "katalog"
          ? "grid grid-cols-3 gap-2"
          : "grid grid-cols-2 gap-3"
      }
    >
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          storeSlug={storeSlug}
          compact={layout === "katalog"}
        />
      ))}
    </div>
  );
}

export function StorefrontView({ data }: { data: StorefrontData }) {
  const { store, links } = data;
  const theme = readTheme(store.settings);
  const linksCompact = theme.layout === "katalog";

  return (
    <div className={`min-h-svh bg-neutral-50 ${themeRootClass(theme)}`} style={themeStyleVars(theme)}>
      <TrackPageView storeSlug={store.slug} event="visit" />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
        <StoreHeader data={data} />

        {links.length > 0 && (
          <nav
            className={
              linksCompact
                ? "flex flex-wrap justify-center gap-2"
                : "flex flex-col gap-2.5"
            }
          >
            {links.map((link) => (
              <TrackedLink
                key={link.id}
                storeSlug={store.slug}
                linkId={link.id}
                href={link.url}
                compact={linksCompact}
              >
                <LinkIcon icon={link.icon} className="size-4" />
                {link.label}
              </TrackedLink>
            ))}
          </nav>
        )}

        <ProductGrid layout={theme.layout} products={data.products} storeSlug={store.slug} />

        {theme.show_powered && <BrandingBadge />}
      </div>

      {/* UI keranjang dimuat on-demand (CartMount) — hemat First-Load JS */}
      <CartMount storeSlug={store.slug} />
    </div>
  );
}
