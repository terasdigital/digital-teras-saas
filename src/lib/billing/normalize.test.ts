import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  expectedSignature,
  externalIdOf,
  mapTxStatus,
  newBillingOrderId,
  normalizeMidtransBody,
  verifySignature,
} from "./normalize";

const KEY = "test-server-key";

function sign(orderId: string, statusCode: string, gross: string) {
  return createHash("sha512").update(`${orderId}${statusCode}${gross}${KEY}`).digest("hex");
}

describe("normalizeMidtransBody", () => {
  it("memuat field notifikasi inti + array quirk", () => {
    const tx = normalizeMidtransBody({
      transaction_id: ["T123"],
      status_code: ["200"],
      gross_amount: ["29000"],
      order_id: ["dt-abc123"],
      transaction_status: ["settlement"],
      payment_type: ["qris"],
      signature: ["sig"],
    });
    expect(tx).not.toBeNull();
    expect(tx!.orderId).toBe("dt-abc123");
    expect(tx!.transactionId).toBe("T123");
    expect(tx!.statusCode).toBe("200");
    expect(tx!.grossAmount).toBe("29000");
  });

  it("mendukung transaction_details.order_id & body tak valid → null", () => {
    expect(
      normalizeMidtransBody({
        transaction_details: { order_id: "dt-x" },
        transaction_status: "pending",
      })?.orderId,
    ).toBe("dt-x");
    expect(normalizeMidtransBody(null)).toBeNull();
    expect(normalizeMidtransBody({ transaction_status: "settlement" })).toBeNull();
  });
});

describe("mapTxStatus", () => {
  it("settlement/complete → paid", () => {
    expect(mapTxStatus("settlement", null)).toBe("paid");
    expect(mapTxStatus("COMPLETE", null)).toBe("paid");
  });

  it("capture hanya paid setelah fraud lolos", () => {
    expect(mapTxStatus("capture", "settlement")).toBe("paid");
    expect(mapTxStatus("capture", null)).toBe("pending");
    expect(mapTxStatus("capture", "deny")).toBe("pending");
  });

  it("refund/chargeback → refunded; expire/cancel/void → failed_expired", () => {
    expect(mapTxStatus("refund", null)).toBe("refunded");
    expect(mapTxStatus("chargeback", null)).toBe("refunded");
    expect(mapTxStatus("expire", null)).toBe("failed_expired");
    expect(mapTxStatus("cancel", null)).toBe("failed_expired");
    expect(mapTxStatus("deny", null)).toBe("failed_expired");
  });

  it("sisanya pending", () => {
    expect(mapTxStatus("pending", null)).toBe("pending");
    expect(mapTxStatus("authorize", null)).toBe("pending");
  });
});

describe("verifikasi signature SHA512", () => {
  const tx = {
    orderId: "dt-abc",
    transactionId: "T1",
    statusCode: "200",
    grossAmount: "29000",
    transactionStatus: "settlement",
    paymentType: "qris",
    fraudStatus: null,
    signature: sign("dt-abc", "200", "29000"),
  };

  it("signature benar lolos", () => {
    expect(verifySignature(tx, KEY)).toBe(true);
  });

  it("gross/paylain → ditolak", () => {
    expect(
      verifySignature({ ...tx, grossAmount: "1" }, KEY),
    ).toBe(false);
    expect(verifySignature(tx, "wrong-key")).toBe(false);
    expect(verifySignature({ ...tx, signature: null }, KEY)).toBe(false);
    expect(verifySignature({ ...tx, signature: "x".repeat(128) }, KEY)).toBe(false);
  });

  it("expectedSignature == SHA512(order+code+gross+key)", () => {
    expect(expectedSignature("dt-abc", "200", "29000", KEY)).toBe(
      sign("dt-abc", "200", "29000"),
    );
  });
});

describe("externalIdOf & newBillingOrderId", () => {
  it("transaction_id + status (dua transisi status TIDAK saling bentrok)", () => {
    const base = {
      orderId: "dt-1",
      transactionId: "T9",
      statusCode: "201",
      grossAmount: "1000",
      paymentType: null,
      fraudStatus: null,
      signature: null,
    };
    const pending = externalIdOf({ ...base, transactionStatus: "pending" });
    const settled = externalIdOf({ ...base, transactionStatus: "capture" });
    expect(pending).toBe("T9.pending");
    expect(settled).toBe("T9.capture");
    expect(pending).not.toBe(settled);
    // replay event SAMA → key sama (idempoten)
    expect(externalIdOf({ ...base, transactionStatus: "capture" })).toBe(settled);
  });

  it("fallback komposisi stabil tanpa transaction_id", () => {
    const base = {
      orderId: "dt-1",
      transactionId: null,
      statusCode: "404",
      grossAmount: "1000",
      transactionStatus: "expire",
      paymentType: null,
      fraudStatus: null,
      signature: null,
    };
    expect(externalIdOf(base)).toBe("dt-1.404.1000.expire");
  });

  it("order id cocok dengan pola yang diterima checkoutStatusAction", () => {
    for (let i = 0; i < 20; i++) {
      const id = newBillingOrderId();
      expect(id).toMatch(/^dt-[a-z0-9]{20}$/);
      expect(id.length).toBeLessThanOrEqual(50);
    }
  });
});
