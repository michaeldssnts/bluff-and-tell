import { GameError } from "./engine.mjs";

// Each room lives in its own SQLite-backed Durable Object. Transactions protect
// concurrent votes/joins; only changed rooms are written on polling requests.
export class CloudflareRoomStore {
  constructor(storage) {
    this.storage = storage;
  }
  async create(room) {
    return this.storage.transaction(async (tx) => {
      if (await tx.get("room")) return false;
      await tx.put("room", room);
      await tx.setAlarm(room.expiresAt);
      return true;
    });
  }
  async mutate(code, fn) {
    return this.storage.transaction(async (tx) => {
      const room = await tx.get("room");
      if (!room || room.code !== code || room.expiresAt <= Date.now())
        throw new GameError(
          "Room not found or expired. Check the code with your host.",
          404,
        );
      const before = JSON.stringify(room);
      const result = await fn(room);
      if (before !== JSON.stringify(room)) await tx.put("room", room);
      return result;
    });
  }
  // The Worker applies account-wide, per-client limits before room dispatch.
  async budget() {}
}

export async function consumeBudget(
  storage,
  key,
  limit,
  seconds,
  now = Date.now(),
) {
  return storage.transaction(async (tx) => {
    const bucket = await tx.get(key);
    const next =
      !bucket || bucket.end <= now
        ? { count: 1, end: now + seconds * 1000 }
        : { ...bucket, count: bucket.count + 1 };
    if (next.count > limit) return false;
    await tx.put(key, next);
    // Keep a limiter only as long as any of its rolling windows needs it.
    const alarm = await tx.getAlarm();
    if (!alarm || alarm < next.end) await tx.setAlarm(next.end);
    return true;
  });
}

export async function clearExpiredBudgets(storage, now = Date.now()) {
  return storage.transaction(async (tx) => {
    const buckets = await tx.list();
    let nextAlarm = 0;
    for (const [key, bucket] of buckets) {
      if (bucket.end <= now) await tx.delete(key);
      else nextAlarm = Math.max(nextAlarm, bucket.end);
    }
    if (nextAlarm) await tx.setAlarm(nextAlarm);
  });
}
