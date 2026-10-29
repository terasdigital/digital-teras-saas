import { ImageResponse } from "next/og";
import { getStorefront } from "@/lib/db/queries/storefront";

export const alt = "Digital Teras — micro-store di satu link";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function StoreOgImage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const data = await getStorefront(storeSlug);

  const name = data?.store.name ?? "Digital Teras";
  const tagline =
    data?.store.tagline ?? "Katalog & pesanan WhatsApp dalam satu link.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: 72,
          background: "linear-gradient(135deg, #0c0a09 0%, #292524 55%, #57534e 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 28,
            opacity: 0.85,
            marginBottom: 24,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#fbbf24",
              color: "#1c1917",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            ⚡
          </span>
          Digital Teras
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
          {name.slice(0, 40)}
        </div>
        <div style={{ display: "flex", fontSize: 30, opacity: 0.75, marginTop: 18 }}>
          {tagline.slice(0, 90)}
        </div>
      </div>
    ),
    { ...size },
  );
}
