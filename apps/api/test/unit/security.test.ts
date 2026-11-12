/** Unit tests for security helpers and configuration checks (no database needed). */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { parseEnv } from "../../src/config/env";
import { isValidRazorpayPayment, isValidWebhookSignature, safeEqualHex, sniffFileType } from "../../src/common/security";

describe("upload file-type detection", () => {
  it("recognises PDF, PNG and JPEG by content", () => {
    assert.equal(sniffFileType(Buffer.from("%PDF-1.7\n..."))?.ext, "pdf");
    assert.equal(sniffFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))?.ext, "png");
    assert.equal(sniffFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext, "jpg");
  });
  it("rejects other files whatever their name, and short/empty files", () => {
    assert.equal(sniffFileType(Buffer.from("MZ\x90\x00 executable")), undefined);
    assert.equal(sniffFileType(Buffer.from("<html><script>")), undefined);
    assert.equal(sniffFileType(Buffer.from("%PD")), undefined);
    assert.equal(sniffFileType(Buffer.alloc(0)), undefined);
  });
});

describe("payment signatures", () => {
  const secret = "test_secret_not_real";
  const sign = (data: string | Buffer) => createHmac("sha256", secret).update(data).digest("hex");

  it("accepts a correctly signed checkout result", () => {
    assert.ok(isValidRazorpayPayment(secret, "order_1", "pay_1", sign("order_1|pay_1")));
  });
  it("rejects tampered ids, wrong secrets and garbage", () => {
    const good = sign("order_1|pay_1");
    assert.equal(isValidRazorpayPayment(secret, "order_1", "pay_2", good), false);
    assert.equal(isValidRazorpayPayment("other_secret", "order_1", "pay_1", good), false);
    assert.equal(isValidRazorpayPayment(secret, "order_1", "pay_1", "0".repeat(64)), false);
    assert.equal(isValidRazorpayPayment(secret, "order_1", "pay_1", "not-hex"), false);
    assert.equal(isValidRazorpayPayment(secret, "order_1", "pay_1", ""), false);
  });
  it("verifies webhooks against the exact raw body", () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    assert.ok(isValidWebhookSignature(secret, body, sign(body)));
    assert.equal(isValidWebhookSignature(secret, Buffer.from('{"event":"payment.captured" }'), sign(body)), false);
    assert.equal(isValidWebhookSignature(secret, body, sign(body).toUpperCase()), false);
  });
  it("compares hex safely", () => {
    assert.ok(safeEqualHex("abcd", "ABCD"));
    assert.equal(safeEqualHex("abcd", "abcdef"), false);
    assert.equal(safeEqualHex("zz", "zz"), false);
  });
});

describe("environment validation", () => {
  const base = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JWT_ACCESS_SECRET: "a".repeat(48),
    OTP_SECRET: "b".repeat(48),
  };
  const prod = { ...base, NODE_ENV: "production", SMTP_HOST: "smtp.example.test", COOKIE_SECURE: "true", WEB_ORIGIN: "https://medcore.example.test" };

  it("applies safe defaults in development", () => {
    const e = parseEnv(base);
    assert.equal(e.API_PORT, 4100);
    assert.equal(e.JWT_ACCESS_TTL_SECONDS, 900);
    assert.equal(e.COOKIE_SECURE, false);
    assert.equal(e.TRUST_PROXY, 1);
  });
  it("accepts a proxy-hop count for the sign-in proxy and rejects nonsense", () => {
    assert.equal(parseEnv({ ...base, TRUST_PROXY: "2" }).TRUST_PROXY, 2);
    assert.throws(() => parseEnv({ ...base, TRUST_PROXY: "-1" }), /TRUST_PROXY/);
  });
  it("uses the hosting platform's PORT unless API_PORT is set", () => {
    assert.equal(parseEnv({ ...base, PORT: "10000" }).API_PORT, 10000);
    assert.equal(parseEnv({ ...base, PORT: "10000", API_PORT: "4100" }).API_PORT, 4100);
  });
  it("rejects short secrets and a missing database URL", () => {
    assert.throws(() => parseEnv({ ...base, JWT_ACCESS_SECRET: "short" }), /JWT_ACCESS_SECRET must be at least 32/);
    assert.throws(() => parseEnv({ ...base, DATABASE_URL: undefined }), /DATABASE_URL/);
  });
  it("requires both Razorpay keys or neither", () => {
    assert.throws(() => parseEnv({ ...base, RAZORPAY_KEY_ID: "rzp_test_x" }), /RAZORPAY_KEY_SECRET/);
    assert.doesNotThrow(() => parseEnv({ ...base, RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "s" }));
  });
  it("accepts a correct production configuration", () => {
    assert.equal(parseEnv(prod).COOKIE_SECURE, true);
  });
  it("refuses unsafe production settings", () => {
    assert.throws(() => parseEnv({ ...prod, JWT_ACCESS_SECRET: "CHANGE_ME_" + "x".repeat(40) }), /placeholder secret/);
    assert.throws(() => parseEnv({ ...prod, OTP_SECRET: prod.JWT_ACCESS_SECRET }), /must differ/);
    assert.throws(() => parseEnv({ ...prod, SMTP_HOST: undefined }), /SMTP is required/);
    assert.throws(() => parseEnv({ ...prod, COOKIE_SECURE: "false" }), /Secure cookies/);
    assert.throws(() => parseEnv({ ...prod, WEB_ORIGIN: "*" }), /exact origins/);
    assert.throws(() => parseEnv({ ...prod, RAZORPAY_KEY_ID: "rzp_live_x", RAZORPAY_KEY_SECRET: "s" }), /test mode only/);
  });
});
