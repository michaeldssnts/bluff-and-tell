import { createHash } from "node:crypto";
import { SECURITY_HEADERS } from "./api.mjs";
const emailKey = (email) =>
  "subscriber:" + createHash("sha256").update(email).digest("hex");
export function normaliseEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))
    return null;
  return email;
}
export class PackUpdates {
  constructor(storage) {
    this.storage = storage;
  }
  async subscribe(email, now = Date.now()) {
    await this.storage.transaction(async (tx) => {
      const key = emailKey(email);
      if (!(await tx.get(key)))
        await tx.put(key, {
          email,
          createdAt: now,
          consentVersion: "pack-updates-v1",
          status: "pending-verification",
        });
    });
  }
  async unsubscribe(email) {
    await this.storage.transaction((tx) => tx.delete(emailKey(email)));
  }
  async list() {
    return this.storage.transaction(async (tx) => {
      const rows = [...(await tx.list({ prefix: "subscriber:" }))]
        .filter(([key]) => key.startsWith("subscriber:"))
        .map(([, row]) => ({
          email: row.email,
          createdAt: row.createdAt,
          status: row.status,
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      return {
        total: rows.length,
        subscribers: rows.slice(0, 100),
        emailDeliveryConnected: false,
      };
    });
  }
}
export async function packUpdatesApi(request, { list, budget }) {
  const reply = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: SECURITY_HEADERS });
  const url = new URL(request.url);
  if (request.method !== "POST")
    return reply({ error: "Method not allowed." }, 405);
  if (request.headers.get("Origin") !== url.origin)
    return reply({ error: "Please use the form on the website." }, 403);
  if (!(await budget()))
    return reply(
      { error: "A few too many attempts. Please try again in 15 minutes." },
      429,
    );
  let data;
  try {
    const text = await request.text();
    if (text.length > 1024)
      return reply({ error: "Submission too large." }, 413);
    data = JSON.parse(text);
  } catch {
    return reply({ error: "Please check your email address." }, 400);
  }
  const email = normaliseEmail(data?.email);
  if (!email) return reply({ error: "Pop in a valid email address." }, 400);
  if (url.pathname === "/api/pack-updates/unsubscribe") {
    await list.unsubscribe(email);
    return reply({ ok: true });
  }
  if (url.pathname !== "/api/pack-updates")
    return reply({ error: "Not found." }, 404);
  if (data.consent !== true)
    return reply(
      { error: "Tick the box if you want pack launch emails." },
      400,
    );
  // Honeypot submissions get the same response without adding an address.
  if (!data.website) await list.subscribe(email);
  return reply({ ok: true });
}
