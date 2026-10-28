import { describe, expect, it } from "vitest";
import {
  isReservedSlug,
  isValidSlug,
  normalizeSlug,
  suggestSlug,
} from "./slug";

describe("normalizeSlug", () => {
  it("mengubah nama bebas menjadi slug aman", () => {
    expect(normalizeSlug("Toko Kopi Aku!")).toBe("toko-kopi-aku");
    expect(normalizeSlug("  Rendang  Mbak  Yuli  ")).toBe("rendang-mbak-yuli");
    expect(normalizeSlug("Kue Lapis @ 2024")).toBe("kue-lapis-2024");
  });

  it("membuang strip tepi hasil slice", () => {
    const long = normalizeSlug("a".repeat(35) + "-b");
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long).not.toMatch(/-$/);
  });
});

describe("isValidSlug", () => {
  it("menerima slug valid", () => {
    expect(isValidSlug("toko-kopi")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("l3gi73r-s4y")).toBe(true);
  });

  it("menolak slug terlalu pendek / panjang / karakter salah", () => {
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("a".repeat(31))).toBe(false);
    expect(isValidSlug("-awali")).toBe(false);
    expect(isValidSlug("berakhiran-")).toBe(false);
    expect(isValidSlug("ada_spasi")).toBe(false);
    expect(isValidSlug("UPPER")).toBe(false);
  });
});

describe("isReservedSlug", () => {
  it("menolak nama rute aplikasi", () => {
    expect(isReservedSlug("dashboard")).toBe(true);
    expect(isReservedSlug("api")).toBe(true);
    expect(isReservedSlug("login")).toBe(true);
    expect(isReservedSlug("toko")).toBe(true);
  });

  it("resisten terhadap huruf besar", () => {
    expect(isReservedSlug("DASHBOARD")).toBe(true);
  });

  it("mengizinkan nama normal", () => {
    expect(isReservedSlug("keripik-sayang")).toBe(false);
  });

  it("isValidSlug menolak reserved", () => {
    expect(isValidSlug("dashboard")).toBe(false);
  });
});

describe("suggestSlug", () => {
  it("memberi saran dari nama toko", () => {
    expect(suggestSlug("Sambel Bu Tini")).toBe("sambel-bu-tini");
  });
});
