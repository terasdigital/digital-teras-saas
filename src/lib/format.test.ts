import { describe, expect, it } from "vitest";
import { formatNumber, formatRupiah, parseRupiahInput } from "./format";

describe("formatRupiah", () => {
  it("memformat angka utuh IDR dengan titik ribuan", () => {
    expect(formatRupiah(1250000)).toBe("Rp1.250.000");
    expect(formatRupiah(0)).toBe("Rp0");
    expect(formatRupiah(99000)).toBe("Rp99.000");
  });

  it("menerima bigint (kolom uang DB)", () => {
    expect(formatRupiah(2500000n)).toBe("Rp2.500.000");
  });
});

describe("formatNumber", () => {
  it("memformat jumlah tanpa Rp", () => {
    expect(formatNumber(12500)).toBe("12.500");
  });
});

describe("parseRupiahInput", () => {
  it("membersihkan pemisah & simbol", () => {
    expect(parseRupiahInput("Rp25.000")).toBe(25000);
    expect(parseRupiahInput("25 000")).toBe(25000);
    expect(parseRupiahInput("1.250.000")).toBe(1250000);
  });

  it("null untuk input kosong/non-numerik", () => {
    expect(parseRupiahInput("")).toBeNull();
    expect(parseRupiahInput("abc")).toBeNull();
  });
});
