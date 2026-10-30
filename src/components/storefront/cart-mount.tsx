"use client";

import { lazy, Suspense, useCallback, useSyncExternalStore } from "react";

/**
 * Loader on-demand untuk UI keranjang (Sheet+Dialog Radix cukup berat).
 * Etalase yang keranjangnya tidak pernah disentuh TIDAK men-download
 * bundle cart — First-Load JS publik tetap kecil.
 *
 * Aktivasi via useSyncExternalStore (bukan setState-in-effect): snapshot
 * = "ada isi cart utk slug ini?" di localStorage; event dt:cart-active
 * (ditembakkan saat tambah item) memicu React memeriksa ulang snapshot.
 */
const CartButton = lazy(() =>
  import("./cart-islands").then((m) => ({ default: m.CartButton })),
);

export const CART_ACTIVATE_EVENT = "dt:cart-active";

function hasCart(slug: string): boolean {
  try {
    const raw = localStorage.getItem("dt.cart.v1");
    if (!raw) return false;
    const lines = JSON.parse(raw)?.state?.byStore?.[slug];
    return Array.isArray(lines) && lines.length > 0;
  } catch {
    return false;
  }
}

export function CartMount({ storeSlug }: { storeSlug: string }) {
  const subscribe = useCallback(
    (cb: () => void) => {
      window.addEventListener(CART_ACTIVATE_EVENT, cb);
      return () => window.removeEventListener(CART_ACTIVATE_EVENT, cb);
    },
    [],
  );
  const snapshot = useCallback(() => hasCart(storeSlug), [storeSlug]);

  const active = useSyncExternalStore(subscribe, snapshot, () => false);

  if (!active) return null;
  return (
    <Suspense fallback={null}>
      <CartButton storeSlug={storeSlug} />
    </Suspense>
  );
}
