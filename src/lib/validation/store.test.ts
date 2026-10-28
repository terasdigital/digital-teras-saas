import { describe, expect, it } from "vitest";
import { onboardingSchema } from "./store";

const valid = {
  name: "Toko Kopi Senja",
  slug: "kopisenja",
  whatsapp: "0812-3456-7890",
};

describe("onboardingSchema", () => {
  it("menerima input valid dan menormalisasi nomor WA", () => {
    const result = onboardingSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.whatsapp).toBe("6281234567890");
      expect(result.data.name).toBe("Toko Kopi Senja");
    }
  });

  it("menolak slug yang dicadangkan", () => {
    const result = onboardingSchema.safeParse({ ...valid, slug: "dashboard" });
    expect(result.success).toBe(false);
  });

  it("menolak slug dengan karakter salah", () => {
    expect(
      onboardingSchema.safeParse({ ...valid, slug: "toko kopi" }).success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({ ...valid, slug: "-awalto" }).success,
    ).toBe(false);
  });

  it("menolak nomor bukan seluler Indonesia", () => {
    const r1 = onboardingSchema.safeParse({ ...valid, whatsapp: "12345678" });
    expect(r1.success).toBe(false);
    if (!r1.success)
      expect(r1.error.issues[0]?.message).toContain("seluler");

    const r2 = onboardingSchema.safeParse({ ...valid, whatsapp: "021-555-7777" });
    expect(r2.success).toBe(false);
  });

  it("menerima +62 8xx dan 08xx dengan pemisah apa pun", () => {
    expect(
      onboardingSchema.safeParse({ ...valid, whatsapp: "+62 812-3456-7890" })
        .success,
    ).toBe(true);
    expect(
      onboardingSchema.safeParse({ ...valid, whatsapp: "08123456789" }).success,
    ).toBe(true);
  });

  it("menolak nama terlalu pendek", () => {
    const r = onboardingSchema.safeParse({ ...valid, name: "ab" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toContain("3 karakter");
  });

  it("menormalisasi slug huruf besar", () => {
    const r = onboardingSchema.safeParse({ ...valid, slug: "KopiSenja" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.slug).toBe("kopisenja");
  });

  it("menerima assetPath berformat benar", () => {
    const uid = "9b2e4c1a-7f3d-4a5b-8c9d-0e1f2a3b4c5d";
    const r = onboardingSchema.safeParse({
      ...valid,
      avatarPath: `${uid}/stores/draft/avatar-lz1abc.webp`,
    });
    expect(r.success).toBe(true);
  });

  it("menolak assetPath aneh (path traversal)", () => {
    const r = onboardingSchema.safeParse({
      ...valid,
      avatarPath: "../../etc/passwd",
    });
    expect(r.success).toBe(false);
  });
});
