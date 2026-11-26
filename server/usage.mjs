import { randomUUID } from "node:crypto";

export const DAY = 86400000;
export const COUNTERS = [
  "rooms",
  "joins",
  "games",
  "completed",
  "rounds",
  "answers",
  "photos",
  "drawings",
  "audio",
  "votes",
  "actions",
  "durationMs",
];
const counts = () => Object.fromEntries(COUNTERS.map((key) => [key, 0]));
export const gameState = (room) => ({
  phase: room.phase,
  results: room.results.length,
});
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
const midnightAfter = (now) => Math.floor(now / DAY) * DAY + DAY;

// Only anonymous counts enter this structure. Never copy player data or media.
export function recordUsage(
  room,
  event,
  before = gameState(room),
  now = Date.now(),
) {
  if (room.demo || room.usageExcluded) return;
  const fresh = !room.usage;
  room.usage ??= {
    id: randomUUID(),
    revision: 0,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    lastActivityAt: now,
    counters: { ...counts(), rooms: 1, joins: room.players.length },
    gameStartedAt: null,
    gameDurationMs: 0,
    days: {},
  };
  const u = room.usage;
  const previousCounters = fresh ? counts() : { ...u.counters };
  const changed =
    before.phase !== room.phase || before.results !== room.results.length;
  if (!fresh && event === "poll" && !changed) return;
  if (!fresh && event === "join") u.counters.joins++;
  if (event !== "poll" && event !== "create") u.counters.actions++;
  if (before.phase === "lobby" && !["lobby", "finished"].includes(room.phase)) {
    u.counters.games++;
    u.gameStartedAt = now;
    u.gameDurationMs = 0;
  }
  u.counters.rounds += Math.max(0, room.results.length - before.results);
  if (event === "answers") u.counters.answers++;
  if (event === "photo")
    u.counters[
      room.queue[room.questionIndex]?.type === "doodle" ? "drawings" : "photos"
    ]++;
  if (event === "audio") u.counters.audio++;
  if (["vote", "face-vote"].includes(event)) u.counters.votes++;
  if (u.gameStartedAt !== null && before.phase !== "finished")
    u.gameDurationMs = Math.max(0, now - u.gameStartedAt);
  if (before.phase !== "finished" && room.phase === "finished") {
    u.counters.completed++;
    u.counters.durationMs += u.gameDurationMs;
  }
  if (event === "replay") {
    u.gameStartedAt = null;
    u.gameDurationMs = 0;
  }
  u.revision++;
  u.lastActivityAt = now;
  u.players = room.players.length;
  u.phase = room.phase;
  u.mode = room.settings.mode === "classic" ? "classic" : "mixed";
  u.round = room.queue.length
    ? Math.min(room.questionIndex + 1, room.queue.length)
    : 0;
  u.totalRounds = room.queue.length || room.settings.totalRounds || 0;
  const day = (u.days[dayOf(now)] ??= counts());
  for (const key of COUNTERS)
    day[key] += u.counters[key] - previousCounters[key];
}

// Both the local file store and Durable Object use the same transactional ledger.
// Cumulative checkpoints make retries and out-of-order delivery harmless.
export class UsageLedger {
  constructor(storage) {
    this.storage = storage;
  }
  async ingest(summary, now = Date.now()) {
    if (!summary || summary.expiresAt <= now) return;
    await this.storage.transaction(async (tx) => {
      const key = "room:" + summary.id;
      const previous = await tx.get(key);
      if (previous && previous.revision >= summary.revision) return;
      const totals = (await tx.get("totals")) ?? { rooms: 0, since: now };
      if (!previous) {
        totals.rooms++;
        await tx.put("totals", totals);
      }
      for (const [date, values] of Object.entries(summary.days)) {
        const dayKey = "day:" + date;
        const day = (await tx.get(dayKey)) ?? counts();
        for (const counter of COUNTERS)
          day[counter] += Math.max(
            0,
            values[counter] - (previous?.days[date]?.[counter] ?? 0),
          );
        await tx.put(dayKey, day);
      }
      // Explicit allowlist: the API cannot accidentally persist extra room fields.
      await tx.put(key, {
        id: summary.id,
        revision: summary.revision,
        createdAt: summary.createdAt,
        expiresAt: summary.expiresAt,
        lastActivityAt: summary.lastActivityAt,
        players: summary.players,
        phase: summary.phase,
        mode: summary.mode,
        round: summary.round,
        totalRounds: summary.totalRounds,
        gameStartedAt: summary.gameStartedAt,
        gameDurationMs: summary.gameDurationMs,
        counters: Object.fromEntries(
          COUNTERS.map((c) => [c, summary.counters[c]]),
        ),
        days: Object.fromEntries(
          Object.entries(summary.days).map(([date, values]) => [
            date,
            Object.fromEntries(COUNTERS.map((c) => [c, values[c]])),
          ]),
        ),
      });
      const alarm = await tx.getAlarm();
      const deadline = Math.min(summary.expiresAt, midnightAfter(now));
      if (!alarm || alarm > deadline) await tx.setAlarm(deadline);
    });
  }
  async cleanup(now = Date.now()) {
    await this.storage.transaction(async (tx) => {
      const entries = await tx.list();
      let nextAlarm = Infinity;
      const cutoff = new Date(now - 89 * DAY).toISOString().slice(0, 10);
      for (const [key, value] of entries) {
        if (
          (key.startsWith("room:") && value.expiresAt <= now) ||
          (key.startsWith("day:") && key.slice(4) < cutoff)
        )
          await tx.delete(key);
        else if (key.startsWith("room:"))
          nextAlarm = Math.min(nextAlarm, value.expiresAt);
        else if (key.startsWith("day:"))
          nextAlarm = Math.min(nextAlarm, midnightAfter(now));
      }
      if (Number.isFinite(nextAlarm)) await tx.setAlarm(nextAlarm);
    });
  }
  async report(now = Date.now()) {
    await this.cleanup(now);
    return this.storage.transaction(async (tx) => {
      const entries = await tx.list();
      return {
        generatedAt: now,
        totals: entries.get("totals") ?? { rooms: 0, since: null },
        days: [...entries]
          .filter(([key]) => key.startsWith("day:"))
          .map(([key, value]) => ({ date: key.slice(4), ...value }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        rooms: [...entries]
          .filter(([key]) => key.startsWith("room:"))
          .map(([, value]) => value)
          .sort((a, b) => b.lastActivityAt - a.lastActivityAt),
      };
    });
  }
}

// The sink is outside gameplay transactions. A failed report never loses a vote;
// the next request retries the persisted cumulative checkpoint.
export class ObservedRoomStore {
  constructor(store, publish) {
    this.store = store;
    this.publish = publish;
    this.delivered = new Map();
  }
  budget(...args) {
    return this.store.budget(...args);
  }
  async send(usage) {
    if (
      !usage ||
      (this.delivered.get(usage.id)?.revision ?? 0) >= usage.revision
    )
      return;
    for (const [id, value] of this.delivered)
      if (value.expiresAt <= Date.now()) this.delivered.delete(id);
    try {
      await this.publish(usage);
      this.delivered.set(usage.id, {
        revision: usage.revision,
        expiresAt: usage.expiresAt,
      });
    } catch {
      console.error(
        "Usage summary delivery failed; will retry on room activity.",
      );
    }
  }
  async create(room) {
    const created = await this.store.create(room);
    if (created) await this.send(room.usage);
    return created;
  }
  async mutate(code, fn) {
    let usage;
    const result = await this.store.mutate(code, async (room) => {
      const result = await fn(room);
      usage = room.usage ? structuredClone(room.usage) : null;
      return result;
    });
    await this.send(usage);
    return result;
  }
}
