"use client";

import { useEffect } from "react";
import { track, type TrackType } from "@/lib/track";

/**
 * Island nol-UI yang mencatat satu event saat halaman etalase/produk ter-mount.
 * Sekali per mount; target opsional (product id untuk product_view).
 */
export function TrackPageView({
  storeSlug,
  event,
  targetId,
}: {
  storeSlug: string;
  event: TrackType;
  targetId?: string | null;
}) {
  useEffect(() => {
    track(storeSlug, event, targetId ?? null);
    // sengaja hanya sekali saat mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
