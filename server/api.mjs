import { MAX_REQUEST_LENGTH } from "../public/audio-format.js";
import { enableSimpleFlow } from "./engine.mjs";
import { createHash } from "node:crypto";
import {
  newRoom,
  validateAgeGroup,
  joinRoom,
  authorize,
  apply,
  tick,
  snapshot,
  photosFor,
  audioFor,
  GameError,
} from "./engine.mjs";
export const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
export async function api(
  { path, method, body = "", token = "", ip = "unknown" },
  store,
) {
  try {
    // Bounded uploads: resized photos and five-second normalised jingles.
    if (body.length > MAX_REQUEST_LENGTH)
      throw new GameError("That submission is too large.", 413);
    let data = {};
    if (body) {
      try {
        data = JSON.parse(body);
      } catch {
        throw new GameError("Invalid submission.");
      }
    }
    if (body.length > 64000 && data?.action !== "audio")
      throw new GameError("That submission is too large.", 413);
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new GameError("Invalid submission.");
    const fingerprint = createHash("sha256")
      .update(ip)
      .digest("hex")
      .slice(0, 24);
    if (path === "/api/health" && method === "GET")
      return { status: 200, data: { ok: true } };
    if (path === "/api/rooms" && method === "POST") {
      await store.budget("create:" + fingerprint, 12, 600);
      for (let attempt = 0; attempt < 5; attempt++) {
        const { room, token } = newRoom(
          data.name,
          Boolean(data.demo),
          Date.now(),
          data.ageGroup === undefined ? null : validateAgeGroup(data.ageGroup),
          data.recentPromptIds,
        );
        if (data.flowVersion === 2) enableSimpleFlow(room);
        if (await store.create(room))
          return { status: 201, data: { token, room: snapshot(room, token) } };
      }
      throw new GameError("Could not create a room. Please try again.", 503);
    }
    const match = path.match(
      /^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|action|photos|audio))?$/,
    );
    if (!match) throw new GameError("Not found.", 404);
    const [, code, operation] = match;
    if (operation === "join" && method === "POST") {
      await store.budget("join:" + fingerprint, 30, 60);
      return {
        status: 200,
        data: await store.mutate(code, (room) => {
          const token = joinRoom(
            room,
            data.name,
            Date.now(),
            room.flowVersion === 2
              ? null
              : data.ageGroup === undefined
                ? null
                : validateAgeGroup(data.ageGroup),
            data.recentPromptIds,
          );
          room.version++;
          return { token, room: snapshot(room, token) };
        }),
      };
    }
    if (operation === "audio" && method === "GET")
      return {
        status: 200,
        data: await store.mutate(code, (room) => audioFor(room, token)),
      };
    if (operation === "photos" && method === "GET")
      return {
        status: 200,
        data: await store.mutate(code, (room) => photosFor(room, token)),
      };
    if (!operation && method === "GET")
      return {
        status: 200,
        data: await store.mutate(code, (room) => {
          const me = authorize(room, token);
          if (
            me.id === room.hostId &&
            Date.now() - (room.hostSeenAt ?? 0) > 20000
          )
            room.hostSeenAt = Date.now();
          tick(room);
          return { room: snapshot(room, token) };
        }),
      };
    if (operation === "action" && method === "POST") {
      if (!/^[a-zA-Z0-9-]{8,80}$/.test(data.requestId ?? ""))
        throw new GameError("Missing request ID. Please refresh.");
      await store.budget("action:" + fingerprint, 240, 60);
      return {
        status: 200,
        data: await store.mutate(code, (room) => {
          authorize(room, token);
          room.requests ??= [];
          if (
            !room.requests.some(
              (r) => r.id === data.requestId && r.token === token,
            )
          ) {
            apply(room, token, data.action, data.data ?? {});
            room.requests.push({ id: data.requestId, token });
            room.requests = room.requests.slice(-80);
          }
          return data.action === "leave"
            ? { left: true }
            : { room: snapshot(room, token) };
        }),
      };
    }
    throw new GameError("Method not allowed.", 405);
  } catch (error) {
    if (!(error instanceof GameError))
      console.error("Game service error:", error.name);
    return {
      status: error.status ?? 500,
      data: {
        error:
          error instanceof GameError
            ? error.message
            : "The game service had a hiccup. Please try again.",
      },
    };
  }
}
