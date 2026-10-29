"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart";
import { formatRupiah } from "@/lib/format";
import { track } from "@/lib/track";
import { OPEN_CART_EVENT } from "./cart-islands";
import type { PublicVariant } from "@/lib/db/queries/storefront";

type Props = {
  storeSlug: string;
  product: {
    id: string;
    name: string;
    imagePath: string | null;
  };
  variants: PublicVariant[];
};

export function VariantPurchaser({ storeSlug, product, variants }: Props) {
  const add = useCartStore((s) => s.add);
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  if (!selected) return null;

  const soldOut = selected.stock === 0;
  const multi = variants.length > 1;

  function addToCart() {
    add(
      storeSlug,
      {
        productId: product.id,
        variantId: selected.id,
        productName: product.name,
        variantName: selected.name,
        imagePath: product.imagePath,
        unitPriceIdr: selected.price_idr,
        stock: selected.stock,
      },
      1,
    );
    track(storeSlug, "cart_add", product.id);
    toast.success("Masuk keranjang 🛒", {
      action: {
        label: "Buka",
        onClick: () =>
          window.dispatchEvent(new CustomEvent(OPEN_CART_EVENT)),
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {multi && (
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const out = v.stock === 0;
            const active = v.id === selected.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={
                  "rounded-xl border px-3 py-2 text-left text-sm transition-colors " +
                  (active
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : out
                      ? "border-dashed text-neutral-400"
                      : "bg-white hover:border-neutral-400")
                }
              >
                <span className="font-medium">{v.name}</span>
                <span className={active ? "text-white/70" : "text-neutral-500"}>
                  {" "}
                  · {formatRupiah(v.price_idr)}
                  {out ? " · habis" : v.stock !== null ? ` · sisa ${v.stock}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {soldOut ? (
        <div className="rounded-xl border border-dashed bg-neutral-100 px-4 py-3.5 text-center text-sm font-medium text-neutral-500">
          Varian ini sedang habis — pilih varian lain ya
        </div>
      ) : (
        <Button type="button" size="lg" className="w-full" onClick={addToCart}>
          <ShoppingBag className="size-4" />
          Tambah ke Keranjang — {formatRupiah(selected.price_idr)}
        </Button>
      )}
    </div>
  );
}
