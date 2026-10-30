import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Metadata STATIS untuk segmen toko — masuk ke <head> static shell (PPR).
 * generateMetadata di page bersifat dinamis sehingga di-stream terlambat ke
 * body; crawler/Lighthouse yang tidak mengeksekusi JS hanya melihat head.
 * Nilai dinamis (nama toko) tetap menimpa saat stream tiba.
 */
export const metadata: Metadata = {
  description:
    "Katalog produk & pesanan langsung via WhatsApp — dibuat dengan Digital Teras.",
};

export default function StoreSegmentLayout({ children }: { children: ReactNode }) {
  return children;
}
