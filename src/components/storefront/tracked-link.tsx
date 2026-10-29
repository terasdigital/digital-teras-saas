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
  children,
}: {
  storeSlug: string;
  linkId: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={() => track(storeSlug, "link_click", linkId)}
      className="flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.01] active:scale-[0.99]"
    >
      {children}
    </a>
  );
}
