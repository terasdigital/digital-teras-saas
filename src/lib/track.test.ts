import { describe, expect, it } from "vitest";
import { dedupeView } from "./track";

describe("dedupeView (guard double-mount StrictMode)", () => {
  it("kunjungan pertama lolos (null), duplikat dalam window ditahan", () => {
    const first = dedupeView("visit");
    expect(first).toBeNull(); // belum ada → lanjut kirim
    const dup = dedupeView("visit");
    expect(dup).not.toBeNull(); // key sama & sedang aktif → di-dedupe
  });

  it("product_view dengan target berbeda tidak saling menahan", () => {
    expect(dedupeView("product_view", "p-1")).toBeNull();
    expect(dedupeView("product_view", "p-2")).toBeNull();
  });

  it("event klik nyata TIDAK didedupe (return null selalu)", () => {
    expect(dedupeView("link_click", "l-1")).toBeNull();
    expect(dedupeView("cart_add", "p-1")).toBeNull();
    expect(dedupeView("checkout")).toBeNull();
  });
});
