import { describe, expect, it } from "vitest";
import { buildWaMessage, WA_TEXT_LIMIT, type WaPayload } from "./wa";

const base: WaPayload = {
  storeName: "Kopi Senja",
  storeWhatsapp: "6281234567890",
  ref: "DT-A1B2C3D4",
  buyerName: "Budi",
  buyerPhone: "083812345678",
  buyerNote: "Titip ya kak",
  lines: [
    { productName: "Kopi Gayo 200g", variantName: "Default", unitPriceIdr: 55000, qty: 2 },
    { productName: "Tumbler", variantName: "Hitam · 500ml", unitPriceIdr: 89000, qty: 1 },
  ],
  totalIdr: 199000,
};

describe("buildWaMessage", () => {
  it("menyusun header, baris, total, identitas, ref, footer", () => {
    const { text } = buildWaMessage(base);
    expect(text.startsWith("Halo Kopi Senja! Saya mau pesan:")).toBe(true);
    expect(text).toContain("1. Kopi Gayo 200g — 2x @ Rp55.000 = Rp110.000");
    expect(text).toContain("2. Tumbler (Hitam · 500ml) — 1x @ Rp89.000 = Rp89.000");
    expect(text).toContain("*Total: Rp199.000*");
    expect(text).toContain("Nama: Budi");
    expect(text).toContain("No. HP: 083812345678");
    expect(text).toContain("Catatan: Titip ya kak");
    expect(text).toContain("Kode pesanan: DT-A1B2C3D4");
    expect(text).toContain("dikirim dari Kopi Senja di Digital Teras");
  });

  it("varian Default tidak ditampilkan", () => {
    const { text } = buildWaMessage(base);
    expect(text).not.toContain("(Default)");
  });

  it("phone/note opsional hilang bila kosong", () => {
    const { text } = buildWaMessage({ ...base, buyerPhone: null, buyerNote: null });
    expect(text).not.toContain("No. HP");
    expect(text).not.toContain("Catatan");
  });

  it("URL wa.me benar & newline ter-encode %0A", () => {
    const { url, text } = buildWaMessage(base);
    expect(url.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(url).toContain("%0A");
    expect(decodeURIComponent(url.split("?text=")[1]!)).toBe(text);
  });

  it("note dibuang lebih dulu saat melebihi batas", () => {
    const longNote = "X".repeat(3000);
    const { text } = buildWaMessage({ ...base, buyerNote: longNote });
    expect(text.length).toBeLessThanOrEqual(WA_TEXT_LIMIT);
    expect(text).not.toContain("Catatan: XXXX");
    expect(text).toContain("Kode pesanan"); // isi esensial tetap ada
  });

  it("baris ekor dipangkas dengan penanda saat sangat banyak item", () => {
    const many: WaPayload = {
      ...base,
      buyerNote: null,
      lines: Array.from({ length: 120 }, (_, i) => ({
        productName: `Produk Nomor ${i} Dengan Nama Cukup Panjang Supaya Cepat Penuh`,
        variantName: "Default",
        unitPriceIdr: 100000,
        qty: 1,
      })),
    };
    const { text } = buildWaMessage(many);
    expect(text.length).toBeLessThanOrEqual(WA_TEXT_LIMIT);
    expect(text).toContain("menyusul di chat");
  });
});
