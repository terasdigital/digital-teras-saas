import type { PublicProduct, StorefrontData } from '@/lib/db/queries/storefront'
import { env } from '@/lib/env'

/** Schema.org LocalBusiness untuk etalase + daftar produk (SEO/preview). */
export function storeJsonLd(data: StorefrontData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: data.store.name,
    description: data.store.tagline ?? data.store.bio ?? undefined,
    url: `${env.APP_URL}/${data.store.slug}`,
    ...(data.store.avatar_path ? { image: data.store.avatar_path } : {}),
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'ID',
    },
    ...(data.products.length > 0
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'Katalog',
            itemListElement: data.products.slice(0, 40).map((p) => ({
              '@type': 'ItemListElement',
              item: productSchemaItem(data.store.slug, p),
            })),
          },
        }
      : {}),
  }
}

export function productJsonLd(storeSlug: string, storeName: string, p: PublicProduct) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description ?? undefined,
    category: 'Produk',
    brand: { '@type': 'Brand', name: storeName },
    offers: p.variants.length > 1
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'IDR',
          lowPrice: Math.min(...p.variants.map((v) => v.price_idr)),
          highPrice: Math.max(...p.variants.map((v) => v.price_idr)),
          offerCount: p.variants.length,
        }
      : {
          '@type': 'Offer',
          price: p.variants[0]?.price_idr ?? p.price_idr,
          priceCurrency: 'IDR',
          ...(p.variants[0]?.stock != null
            ? {
                availability:
                  p.variants[0].stock > 0
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock',
              }
            : {}),
        },
    url: `${env.APP_URL}/${storeSlug}/produk/${p.slug}`,
  }
}

function productSchemaItem(storeSlug: string, p: PublicProduct) {
  return {
    '@type': 'Product',
    name: p.name,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'IDR',
      lowPrice: p.variants.length ? Math.min(...p.variants.map((v) => v.price_idr)) : p.price_idr,
      highPrice: p.variants.length ? Math.max(...p.variants.map((v) => v.price_idr)) : p.price_idr,
    },
    url: `${env.APP_URL}/${storeSlug}/produk/${p.slug}`,
  }
}
