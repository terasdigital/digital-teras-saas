"use client";

import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { themeRootClass, themeStyleVars } from "@/lib/theme";
import type { Theme } from "@/lib/validation/theme";

/**
 * Pratinjau mini etalase ala Linktree — memakai kelas .dt-* yang SAMA dengan
 * storefront asli, sehingga apa yang dilihat seller = apa yang dilihat pembeli
 * (hanya data contoh). Bukan iframe: satu sumber styling.
 */
export function StorefrontPreview({
  theme,
  storeName,
}: {
  theme: Theme;
  storeName: string;
}) {
  const sampleProducts = [
    { name: "Kopi Gayo 200g", price: 55000 },
    { name: "Tumbler Logam", price: 89000 },
  ];

  return (
    <div
      className={cn(
        "dt-store flex min-h-[26rem] w-full flex-col items-stretch gap-3 rounded-xl border bg-neutral-50 p-4",
        themeRootClass(theme),
      )}
      style={themeStyleVars(theme)}
    >
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-neutral-200 text-lg font-bold text-neutral-500">
          {storeName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="text-base font-bold text-neutral-900">{storeName}</p>
          <p className="text-xs text-neutral-600">Tagline tokomu muncul di sini</p>
        </div>
      </div>

      {theme.layout === "katalog" ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          <span className="dt-cta px-2.5 py-1 text-xs font-medium">Instagram</span>
          <span className="dt-cta px-2.5 py-1 text-xs font-medium">WhatsApp</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="dt-cta flex items-center justify-center px-4 py-2.5 text-sm font-medium">
            Instagram
          </span>
          <span className="dt-cta flex items-center justify-center px-4 py-2.5 text-sm font-medium">
            WhatsApp
          </span>
        </div>
      )}

      {theme.layout === "linktree" ? (
        <div className="flex flex-col gap-2">
          {sampleProducts.map((p) => (
            <div key={p.name} className="dt-rounded flex items-center gap-2 border bg-white p-2">
              <div className="size-9 shrink-0 rounded bg-neutral-100" />
              <span className="flex-1 truncate text-sm text-neutral-800">{p.name}</span>
              <span className="dt-accent-text text-sm font-semibold">
                {formatRupiah(p.price)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className={theme.layout === "katalog" ? "grid grid-cols-3 gap-1.5" : "grid grid-cols-2 gap-2"}>
          {sampleProducts.map((p) => (
            <div key={p.name} className="dt-rounded overflow-hidden border bg-white">
              <div className="aspect-square w-full bg-neutral-100" />
              <div className="p-2">
                <p className="truncate text-xs text-neutral-800">{p.name}</p>
                <p className="dt-accent-text text-xs font-semibold">{formatRupiah(p.price)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {theme.show_powered && (
        <p className="mt-1 text-center text-[10px] text-neutral-400">
          Dibuat dengan Digital Teras
        </p>
      )}
    </div>
  );
}
