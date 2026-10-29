"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/track";

/**
 * Anchor tautan sosial yang mencatat link_click saat ditekan.
 * sendBeacon tetap terkirim walau tab baru dibuka / navigasi berlanjut.
 */
export function TrackedLink({
  storeSlug,
  linkId,
  href,
  compact = false,
  children,
}: {
  storeSlug: string;
  linkId: string;
  href: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={() => track(storeSlug, "link_click", linkId)}
      className={
        compact
          ? "dt-cta inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-transform hover:scale-[1.02] active:scale-95"
          : "dt-cta flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-transform hover:scale-[1.01] active:scale-[0.99]"
      }
    >
      {children}
    </a>
  );
}
