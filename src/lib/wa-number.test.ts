import { describe, expect, it } from "vitest";
import {
  formatWhatsappLocal,
  isLikelyIndonesianMobile,
  isValidWhatsappNumber,
  normalizeWhatsappNumber,
} from "./wa-number";

describe("isLikelyIndonesianMobile (ketat — pasca normalisasi)", () => {
  it("terima 628… (10–15 digit)", () => {
    expect(isLikelyIndonesianMobile("6281234567890")).toBe(true);
    expect(isLikelyIndonesianMobile("6281112223")).toBe(true); // 628 + 7 digit (batas bawah)
    expect(isLikelyIndonesianMobile("628123456789012")).toBe(true); // 628 + 12 (batas atas)
  });

  it("tolak angka acak yang lolos regex longgar", () => {
    expect(isLikelyIndonesianMobile(normalizeWhatsappNumber("12345678"))).toBe(false);
    expect(isLikelyIndonesianMobile(normalizeWhatsappNumber("021-555-7777"))).toBe(false);
    expect(isLikelyIndonesianMobile(normalizeWhatsappNumber("6591234567"))).toBe(false);
  });

  it("tolak terlalu pendek / terlalu panjang", () => {
    expect(isLikelyIndonesianMobile("628123456")).toBe(false); // 628 + 6
    expect(isLikelyIndonesianMobile("6281234567890123456")).toBe(false);
  });
});

describe("normalizeWhatsappNumber", () => {
  it("08xx → 628xx", () => {
    expect(normalizeWhatsappNumber("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeWhatsappNumber("081234567890")).toBe("6281234567890");
  });

  it("8xx tanpa prefix → 628xx", () => {
    expect(normalizeWhatsappNumber("81234567890")).toBe("6281234567890");
  });

  it("+62 / 62 dibiarkan", () => {
    expect(normalizeWhatsappNumber("+62 812-3456-7890")).toBe("6281234567890");
    expect(normalizeWhatsappNumber("6281234567890")).toBe("6281234567890");
  });

  it("nomor luar negeri non-62 diasumsikan lokal (keputusan MVP)", () => {
    expect(normalizeWhatsappNumber("6591234567")).toBe("626591234567");
  });

  it("validasi hasil", () => {
    expect(isValidWhatsappNumber(normalizeWhatsappNumber("081234567890"))).toBe(true);
    expect(isValidWhatsappNumber("123")).toBe(false);
    expect(isValidWhatsappNumber("123456789012345678")).toBe(false);
  });
});

describe("formatWhatsappLocal", () => {
  it("62 → gaya lokal 0xxx", () => {
    expect(formatWhatsappLocal("6281234567890")).toBe("0812-3456-7890");
  });

  it("neutrally pass-through bila bukan 62", () => {
    expect(formatWhatsappLocal("6591234567")).toBe("6591234567");
  });
});
