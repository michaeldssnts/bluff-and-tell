import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { SECURITY_HEADERS } from "./api.mjs";
const COOKIE = "bt_admin";
const SESSION_MS = 8 * 3600000;
const digest = (value) => createHash("sha256").update(value).digest();
const signature = (value, secret) =>
  createHmac("sha256", secret).update(value).digest("base64url");
const equal = (a, b) => timingSafeEqual(digest(a), digest(b));
export function adminSession(secret, now = Date.now()) {
  const value = `${now + SESSION_MS}.${randomBytes(18).toString("base64url")}`;
  return `${value}.${signature(value, secret)}`;
}
export function validAdmin(cookie, secret, now = Date.now()) {
  if (!secret) return false;
  const token =
    (cookie ?? "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(COOKIE + "="))
      ?.slice(COOKIE.length + 1) ?? "";
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false;
  const expiry = Number(parts[0]);
  return (
    expiry > now &&
    expiry <= now + SESSION_MS &&
    equal(parts[2], signature(parts.slice(0, 2).join("."), secret))
  );
}
export async function adminApi(
  request,
  { secret, username, sessionSecret, ledger, budget },
  now = Date.now(),
) {
  const url = new URL(request.url);
  const reply = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...SECURITY_HEADERS, ...headers },
    });
  const cookie = (value, age) =>
    `${COOKIE}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${age}${url.protocol === "https:" ? "; Secure" : ""}`;
  if (
    !secret ||
    secret.length < 8 ||
    !username ||
    !sessionSecret ||
    sessionSecret.length < 32
  )
    return reply({ error: "Admin access hasn’t been configured yet." }, 503);
  if (
    ![
      "/api/admin/session",
      "/api/admin/usage",
      "/api/admin/registrations",
    ].includes(url.pathname)
  )
    return reply({ error: "Not found." }, 404);
  if (request.method === "POST" || request.method === "DELETE") {
    if (request.headers.get("Origin") !== url.origin)
      return reply({ error: "Please use the admin page to sign in." }, 403);
  }
  if (url.pathname === "/api/admin/session" && request.method === "POST") {
    if (!(await budget()))
      return reply(
        { error: "Too many attempts. Try again in 15 minutes." },
        429,
      );
    const body = await request.text();
    if (body.length > 1024)
      return reply({ error: "Submission too large." }, 413);
    let password, email;
    try {
      ({ password, username: email } = JSON.parse(body));
    } catch {}
    const passwordMatches =
      typeof password === "string" && equal(password, secret);
    const usernameMatches =
      typeof email === "string" &&
      equal(email.trim().toLowerCase(), username.trim().toLowerCase());
    if (!passwordMatches || !usernameMatches)
      return reply({ error: "Those details didn’t match. Try again." }, 401);
    return reply({ ok: true }, 200, {
      "Set-Cookie": cookie(adminSession(sessionSecret, now), SESSION_MS / 1000),
    });
  }
  if (url.pathname === "/api/admin/session" && request.method === "DELETE")
    return reply({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
  if (!validAdmin(request.headers.get("Cookie"), sessionSecret, now))
    return reply({ error: "Sign in to see usage." }, 401);
  if (request.method !== "GET")
    return reply({ error: "Method not allowed." }, 405);
  if (url.pathname === "/api/admin/session") return reply({ ok: true });
  if (url.pathname === "/api/admin/registrations")
    return reply(await ledger.registrations());
  return reply(await ledger.report(now));
}
