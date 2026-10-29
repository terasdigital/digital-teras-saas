"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ACCENT_SWATCHES, isCuratedAccent } from "@/lib/theme";
import {
  FONTS,
  LAYOUTS,
  RADII,
  themeSchema,
  type Theme,
} from "@/lib/validation/theme";
import type { ThemeFlags } from "@/lib/db/queries/theme";
import { saveThemeAction } from "@/lib/actions/theme";
import { StorefrontPreview } from "./storefront-preview";

const LAYOUT_INFO: Record<Theme["layout"], { label: string; desc: string }> = {
  linktree: { label: "Tumpuk", desc: "tautan besar, produk daftar" },
  grid: { label: "Grid", desc: "katalog kartu 2 kolom" },
  katalog: { label: "Katalog", desc: "tautan chip, grid padat" },
};

function OptionChips<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm transition-colors",
            value === opt
              ? "border-primary bg-primary text-primary-foreground font-medium"
              : "hover:bg-muted",
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export function ThemeEditor({
  initial,
  flags,
  storeName,
}: {
  initial: Theme;
  flags: ThemeFlags;
  storeName: string;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(initial);
  const [saving, startSave] = useTransition();

  function set<K extends keyof Theme>(key: K, value: Theme[K]) {
    setTheme((t) => ({ ...t, [key]: value }));
  }

  const customAccentActive = !isCuratedAccent(theme.accent);

  function handleSave() {
    const parsed = themeSchema.safeParse(theme);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Tema tidak valid");
      return;
    }
    startSave(async () => {
      const res = await saveThemeAction(parsed.data);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Tampilan disimpan — etalase langsung ikut berubah.");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardContent className="flex flex-col gap-6 pt-6">
          <div className="flex flex-col gap-2">
            <Label>Warna aksen</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  onClick={() => set("accent", hex)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-110",
                    theme.accent.toLowerCase() === hex
                      ? "border-foreground"
                      : "border-transparent",
                  )}
                  style={{ backgroundColor: hex }}
                >
                  {theme.accent.toLowerCase() === hex && (
                    <Check className="size-4 text-white mix-blend-difference" />
                  )}
                </button>
              ))}
            </div>
            <div
              className={cn(
                "mt-1 flex items-center gap-3",
                !flags.customAccent && "opacity-60",
              )}
            >
              <input
                type="color"
                aria-label="Warna kustom"
                disabled={!flags.customAccent}
                value={theme.accent}
                onChange={(e) => set("accent", e.target.value)}
                className="size-8 cursor-pointer rounded border bg-transparent p-0.5 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-muted-foreground">
                Warna kustom bebas
                {!flags.customAccent && (
                  <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    <Crown className="size-3" /> Pro
                  </span>
                )}
              </span>
              {customAccentActive && (
                <span className="font-mono text-xs text-muted-foreground">{theme.accent}</span>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label>Tata letak</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {LAYOUTS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => set("layout", l)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    theme.layout === l
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted",
                  )}
                >
                  <p className="text-sm font-semibold">{LAYOUT_INFO[l].label}</p>
                  <p className="text-xs text-muted-foreground">{LAYOUT_INFO[l].desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Sudut membulat</Label>
              <OptionChips
                value={theme.radius}
                options={RADII}
                labels={{ sm: "Tajam", md: "Sedang", xl: "Bulat" }}
                onChange={(v) => set("radius", v)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Gaya tombol</Label>
              <OptionChips
                value={theme.button}
                options={["solid", "outline"] as const}
                labels={{ solid: "Isi", outline: "Kerangka" }}
                onChange={(v) => set("button", v)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Huruf</Label>
            <OptionChips
              value={theme.font}
              options={FONTS}
              labels={{ sans: "Modern", rounded: "Membulat", serif: "Klasik" }}
              onChange={(v) => set("font", v)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">
                Sembunyikan badge &ldquo;Digital Teras&rdquo;
              </p>
              <p className="text-xs text-muted-foreground">
                {flags.hideBadge
                  ? "Etalase tampil full atas namamu."
                  : "Tersedia di paket Pro — badge membantu kami tumbuh gratis."}
              </p>
            </div>
            <Switch
              checked={!theme.show_powered}
              disabled={!flags.hideBadge}
              onCheckedChange={(v) => set("show_powered", !v)}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} size="lg" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Simpan Tampilan
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-8">
        <CardHeader className="px-0 pt-0 pb-2">
          <CardTitle className="text-sm font-semibold">Pratinjau langsung</CardTitle>
        </CardHeader>
        <StorefrontPreview theme={theme} storeName={storeName} />
      </div>
    </div>
  );
}
