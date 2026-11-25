import { DurableObject } from "cloudflare:workers";
import { createHash } from "node:crypto";
import { api, SECURITY_HEADERS } from "./api.mjs";
import {
  CloudflareRoomStore,
  consumeBudget,
  clearExpiredBudgets,
} from "./cloudflare-store.mjs";

const response = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: SECURITY_HEADERS });

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new CloudflareRoomStore(ctx.storage);
  }
  async createRoom(room) {
    return this.store.create(room);
  }
  async handle(input) {
    return api(input, this.store);
  }
  async alarm() {
    // Recheck the deadline so a delayed alarm can never erase a newer room.
    const room = await this.ctx.storage.get("room");
    if (room && room.expiresAt > Date.now()) {
      await this.ctx.storage.setAlarm(room.expiresAt);
    } else {
      await this.ctx.storage.deleteAll();
    }
  }
}

export class RequestBudget extends DurableObject {
  async consume(key, limit, seconds) {
    return consumeBudget(this.ctx.storage, key, limit, seconds);
  }
  async alarm() {
    await clearExpiredBudgets(this.ctx.storage);
  }
}

async function readBody(request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 64000) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export default {
  async fetch(request, env) {
    const { pathname: path } = new URL(request.url);
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    const method = request.method;
    if (path === "/api/health" && method === "GET")
      return response({ ok: true, environment: env.APP_ENV });
    if (path === "/api/config" && method === "GET")
      return response({ inviteOrigin: new URL(request.url).origin });
    const create = path === "/api/rooms" && method === "POST";
    const match = path.match(
      /^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|action|photos))?$/,
    );
    if (!create && !match) return response({ error: "Not found." }, 404);
    const operation = match?.[2];
    if (
      !create &&
      method !== (operation && operation !== "photos" ? "POST" : "GET")
    )
      return response({ error: "Method not allowed." }, 405);
    try {
      const body = await readBody(request);
      if (body === null)
        return response({ error: "That submission is too large." }, 413);
      // Cloudflare overwrites CF-Connecting-IP at its public edge. No raw IP is persisted.
      const ip = request.headers.get("CF-Connecting-IP") ?? "local-development";
      const input = {
        path,
        method,
        body,
        ip,
        token: (request.headers.get("Authorization") ?? "").replace(
          /^Bearer /,
          "",
        ),
      };
      if (create || operation) {
        const fingerprint = createHash("sha256").update(ip).digest("hex");
        const limiter = env.REQUEST_BUDGETS.getByName(fingerprint);
        const key = create ? "create" : operation;
        const [limit, seconds] = create
          ? [12, 600]
          : operation === "join"
            ? [30, 60]
            : [240, 60];
        if (!(await limiter.consume(key, limit, seconds)))
          return response(
            { error: "Too many attempts. Please wait a moment and try again." },
            429,
          );
      }
      const result = create
        ? await api(input, {
            budget: async () => {},
            create: (room) =>
              env.GAME_ROOMS.getByName(room.code).createRoom(room),
          })
        : await env.GAME_ROOMS.getByName(match[1]).handle(input);
      return response(result.data, result.status);
    } catch (error) {
      console.error("Cloudflare game service error:", error.name);
      return response(
        { error: "The game service had a hiccup. Please try again." },
        503,
      );
    }
  },
};
