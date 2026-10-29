import { describe, expect, it } from "vitest";
import { ACCENT_SWATCHES, fgFor, isCuratedAccent, RADIUS_PX } from "./theme";
import { DEFAULT_THEME, readTheme, themeSchema } from "./validation/theme";

describe("fgFor", () => {
  it("putih untuk warna gelap, tinta untuk warna terang", () => {
    expect(fgFor("#171717")).toBe("#ffffff");
    expect(fgFor("#0f766e")).toBe("#ffffff");
    expect(fgFor("#fde68a")).toBe("#1c1917"); // kuning pucat → teks gelap
    expect(fgFor("#ffffff")).toBe("#1c1917");
  });

  it("semua swatch kurasi punya kontras jelas (tidak default ambigu)", () => {
    for (const hex of ACCENT_SWATCHES) {
      expect(["#ffffff", "#1c1917"]).toContain(fgFor(hex));
    }
  });

  it("hex tidak valid → default putih (selalu ada nilai)", () => {
    expect(fgFor("bukan-hex")).toBe("#ffffff");
  });
});

describe("isCuratedAccent", () => {
  it("mengenali swatch (case-insensitive)", () => {
    expect(isCuratedAccent("#1D4ED8")).toBe(true);
    expect(isCuratedAccent("#1d4ed8")).toBe(true);
  });
  it("menolak warna di luar palet", () => {
    expect(isCuratedAccent("#123456")).toBe(false);
  });
});

describe("readTheme (blob rusak tidak menjatuhkan etalase)", () => {
  it("settings nona-objek → default", () => {
    expect(readTheme(null)).toEqual(DEFAULT_THEME);
    expect(readTheme("sampah")).toEqual(DEFAULT_THEME);
    expect(readTheme({})).toEqual(DEFAULT_THEME);
  });

  it("theme separuh rusak (accent invalid) → fallback default penuh", () => {
    expect(readTheme({ theme: { accent: "merah", layout: "grid" } })).toEqual(
      DEFAULT_THEME,
    );
  });

  it("theme valid → dipertahankan", () => {
    const t = { ...DEFAULT_THEME, accent: "#1d4ed8", layout: "katalog" as const };
    expect(readTheme({ theme: t })).toEqual(t);
  });
});

describe("themeSchema (penulis, strict)", () => {
  it("menolak accent bukan hex", () => {
    expect(
      themeSchema.safeParse({ ...DEFAULT_THEME, accent: "#f00" }).success,
    ).toBe(false);
  });

  it("menolak layout asing", () => {
    expect(
      themeSchema.safeParse({ ...DEFAULT_THEME, layout: "mewah" }).success,
    ).toBe(false);
  });
});

describe("RADIUS_PX", () => {
  it("punya nilai untuk semua opsi", () => {
    expect(Object.keys(RADIUS_PX).sort()).toEqual(["md", "sm", "xl"]);
  });
});
