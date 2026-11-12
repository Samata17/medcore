import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/validators/contact";

/** Very small in-memory rate limit: 5 messages per IP per 10 minutes. */
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

function fail(statusCode: number, message: string, details?: unknown) {
  return NextResponse.json({ success: false, error: { statusCode, message, details } }, { status: statusCode });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return fail(429, "Too many messages. Please try again in a few minutes.");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "Invalid request body.");
  }

  const parsed = contactSchema.safeParse(json);
  if (!parsed.success) {
    return fail(422, "Please correct the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  // Bots fill the hidden honeypot field; accept silently but do nothing.
  if (parsed.data.website) {
    return NextResponse.json({ success: true, data: { delivery: "ignored" } });
  }

  const { website: _honeypot, ...message } = parsed.data;
  const webhook = process.env.CONTACT_WEBHOOK_URL;

  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...message, receivedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
      return NextResponse.json({ success: true, data: { delivery: "webhook" } });
    } catch (err) {
      console.error("[contact] webhook delivery failed:", err);
      return fail(502, "We couldn't deliver your message right now. Please try again later.");
    }
  }

  // Development fallback: no delivery channel configured, so log on the server.
  console.info("[contact] New message (no CONTACT_WEBHOOK_URL set):", message);
  return NextResponse.json({ success: true, data: { delivery: "logged" } });
}
