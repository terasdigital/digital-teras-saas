import { describe, expect, it } from "vitest";
import {
  buildVariants,
  productFormSchema,
  type ProductFormInput,
} from "./product";

const VUID = "9b2e4c1a-7f3d-4a5b-8c9d-0e1f2a3b4c5d";

function form(over: Partial<ProductFormInput>): ProductFormInput {
  return {
    name: "Keripik Balado",
    description: undefined,
    imagePath: null,
    hasVariants: false,
    variantsJson: "[]",
    ...over,
  };
}

describe("productFormSchema", () => {
  it("menerima mode single sederhana", () => {
    const r = productFormSchema.safeParse(
      form({
        variantsJson: JSON.stringify([
          { id: null, name: "", priceInput: "25.000", stockInput: "" },
        ]),
      }),
    );
    expect(r.success).toBe(true);
  });

  it("menolak nama produk 1 karakter", () => {
    expect(
      productFormSchema.safeParse(form({ name: "x" })).success,
    ).toBe(false);
  });
});

describe("buildVariants", () => {
  it("mode single → satu varian Default, stok kosong = null", () => {
    const out = buildVariants(
      form({
        variantsJson: JSON.stringify([
          { id: null, name: "", priceInput: "Rp25.000", stockInput: "" },
          { id: null, name: "sisa yang diabaikan", priceInput: "1", stockInput: "1" },
        ]),
      }),
    );
    expect(out).toEqual({
      variants: [{ id: null, name: "Default", price: 25000, stock: null }],
    });
  });

  it("mode single mempertahankan id varian lama", () => {
    const out = buildVariants(
      form({
        variantsJson: JSON.stringify([
          { id: VUID, name: "Default", priceInput: "10000", stockInput: "5" },
        ]),
      }),
    );
    expect(out).toEqual({
      variants: [{ id: VUID, name: "Default", price: 10000, stock: 5 }],
    });
  });

  it("mode multi: validasi per baris", () => {
    const out = buildVariants(
      form({
        hasVariants: true,
        variantsJson: JSON.stringify([
          { id: null, name: "Merah · L", priceInput: "50000", stockInput: "3" },
          { id: VUID, name: "Hitam · M", priceInput: "45000", stockInput: "" },
        ]),
      }),
    );
    expect(out).toEqual({
      variants: [
        { id: null, name: "Merah · L", price: 50000, stock: 3 },
        { id: VUID, name: "Hitam · M", price: 45000, stock: null },
      ],
    });
  });

  it("harga tidak valid → pesan menyebut label", () => {
    const out = buildVariants(
      form({
        hasVariants: true,
        variantsJson: JSON.stringify([
          { id: null, name: "L", priceInput: "dua puluh", stockInput: "" },
        ]),
      }),
    );
    expect("error" in out && out.error).toContain("Varian \"L\"");
  });

  it("nama varian kosong saat multi → error", () => {
    const out = buildVariants(
      form({
        hasVariants: true,
        variantsJson: JSON.stringify([
          { id: null, name: "   ", priceInput: "1000", stockInput: "" },
        ]),
      }),
    );
    expect("error" in out).toBe(true);
  });

  it("variantsJson rusak → error ramah", () => {
    const out = buildVariants(form({ variantsJson: "{bukan json" }));
    expect("error" in out && out.error).toContain("muat ulang");
  });

  it("stok negatif → ditolak, bukan diam-diam jadi positif", () => {
    const out = buildVariants(
      form({
        variantsJson: JSON.stringify([
          { id: null, name: "", priceInput: "1000", stockInput: "-5" },
        ]),
      }),
    );
    expect("error" in out).toBe(true);
  });

  it("typo huruf pada harga → ditolak", () => {
    const out = buildVariants(
      form({
        variantsJson: JSON.stringify([
          { id: null, name: "", priceInput: "25rb", stockInput: "" },
        ]),
      }),
    );
    expect("error" in out).toBe(true);
  });

  it("prefix Rp diterima", () => {
    const out = buildVariants(
      form({
        variantsJson: JSON.stringify([
          { id: null, name: "", priceInput: "Rp1.250.000", stockInput: "10" },
        ]),
      }),
    );
    expect(out).toEqual({
      variants: [{ id: null, name: "Default", price: 1250000, stock: 10 }],
    });
  });
});
