import { createHmac, timingSafeEqual } from "node:crypto";

/* ---------- Upload file types ---------- */

/** Allowed report formats, identified by their first bytes (not the file name). */
const SIGNATURES: { mime: string; ext: string; magic: number[] }[] = [
  { mime: "application/pdf", ext: "pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
];

/** Detects PDF/PNG/JPEG from the file content. Returns undefined for anything else. */
export const sniffFileType = (buf: Buffer) => SIGNATURES.find((s) => buf.length >= s.magic.length && s.magic.every((b, i) => buf[i] === b));

/* ---------- Payment gateway signatures ---------- */

/** Constant-time comparison of two hex strings (false for malformed input). */
export function safeEqualHex(a: string, b: string) {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Razorpay checkout: signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret). */
export function isValidRazorpayPayment(secret: string, orderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Razorpay webhook: signature = HMAC-SHA256(raw request body, webhook_secret). */
export function isValidWebhookSignature(secret: string, rawBody: Buffer, signature: string) {
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
