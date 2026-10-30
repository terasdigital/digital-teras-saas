import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getPublicClient } from "@/lib/supabase/public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL;
  const supabase = getPublicClient();

  const [{ data: stores }, { data: products }] = await Promise.all([
    supabase.from("public_storefront").select("slug"),
    supabase.from("public_products").select("store_slug, slug"),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/legal/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/legal/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const storeEntries: MetadataRoute.Sitemap = (stores ?? []).map((s) => ({
    url: `${base}/${s.slug as string}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
    url: `${base}/${p.store_slug as string}/produk/${p.slug as string}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...storeEntries, ...productEntries];
}
