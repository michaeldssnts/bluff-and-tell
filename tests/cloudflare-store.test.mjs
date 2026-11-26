import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  CloudflareRoomStore,
  consumeBudget,
  clearExpiredBudgets,
} from "../server/cloudflare-store.mjs";
import { api } from "../server/api.mjs";
import { newRoom } from "../server/engine.mjs";

// A transactional storage double: rollback and isolation match the storage contract.
class Storage {
  data = new Map();
  alarm = null;
  pending = Promise.resolve();
  transaction(fn) {
    const work = this.pending.then(async () => {
      const data = structuredClone(this.data);
      let alarm = this.alarm;
      const tx = {
        get: async (key) => structuredClone(data.get(key)),
        put: async (key, value) => data.set(key, structuredClone(value)),
        getAlarm: async () => alarm,
        setAlarm: async (time) => {
          alarm = time;
        },
        list: async () => structuredClone(data),
        delete: async (key) => data.delete(key),
      };
      const result = await fn(tx);
      this.data = data;
      this.alarm = alarm;
      return result;
    });
    this.pending = work.catch(() => {});
    return work;
  }
}

test("Cloudflare room storage preserves concurrent joins and survives new store instances", async () => {
  const storage = new Storage();
  const store = new CloudflareRoomStore(storage);
  const { room, token } = newRoom("Host", false, Date.now(), "adult26");
  assert.equal(await store.create(room), true);
  assert.equal(await store.create(room), false);
  assert.equal(storage.alarm, room.expiresAt);
  const base = `/api/rooms/${room.code}`;
  const joined = await Promise.all(
    Array.from({ length: 9 }, (_, i) =>
      api(
        {
          path: base + "/join",
          method: "POST",
          body: JSON.stringify({ name: `Friend ${i}`, ageGroup: "adult26" }),
        },
        store,
      ),
    ),
  );
  assert.equal(joined.filter((r) => r.status === 200).length, 7);
  const reloaded = new CloudflareRoomStore(storage);
  const view = await api({ path: base, method: "GET", token }, reloaded);
  assert.equal(view.status, 200);
  assert.equal(view.data.room.players.length, 8);
  assert.equal(
    (await api({ path: base, method: "GET" }, reloaded)).status,
    401,
  );
  assert.equal(JSON.stringify(view).includes('"token"'), false);
});

test("Cloudflare room storage rolls back failed mutations and isolates room codes", async () => {
  const storage = new Storage();
  const store = new CloudflareRoomStore(storage);
  const { room } = newRoom("Host");
  await store.create(room);
  await assert.rejects(
    store.mutate(room.code, (r) => {
      r.players = [];
      throw new Error("rollback");
    }),
  );
  assert.equal(storage.data.get("room").players.length, 1);
  await assert.rejects(
    store.mutate("ZZZZZZ", () => {}),
    { status: 404 },
  );
  storage.data.get("room").shots = { private: "expired-photo" };
  storage.data.get("room").clips = { private: "expired-audio" };
  storage.data.get("room").expiresAt = Date.now() - 1;
  await assert.rejects(
    store.mutate(room.code, () => {}),
    { status: 404 },
  );
  assert.equal(storage.data.has("room"), false);
});

test("concurrent duplicate Cloudflare actions apply once", async () => {
  const storage = new Storage();
  const store = new CloudflareRoomStore(storage);
  const { room, token } = newRoom("Host");
  await store.create(room);
  const input = {
    path: `/api/rooms/${room.code}/action`,
    method: "POST",
    token,
    body: JSON.stringify({ action: "lock", requestId: randomUUID() }),
  };
  const replies = await Promise.all([api(input, store), api(input, store)]);
  assert.deepEqual(
    replies.map((r) => r.status),
    [200, 200],
  );
  assert.equal(storage.data.get("room").locked, true);
  assert.equal(storage.data.get("room").requests.length, 1);
});

test("shared client budget enforces concurrent limits and resets only after its deadline", async () => {
  const storage = new Storage();
  const responses = await Promise.all(
    Array.from({ length: 15 }, () =>
      consumeBudget(storage, "create", 12, 600, 1000),
    ),
  );
  assert.equal(responses.filter(Boolean).length, 12);
  assert.equal(await consumeBudget(storage, "create", 12, 600, 600999), false);
  assert.equal(await consumeBudget(storage, "create", 12, 600, 601000), true);
  assert.equal(await consumeBudget(storage, "join", 30, 60, 601000), true);
  await clearExpiredBudgets(storage, 661000);
  assert.equal(storage.data.has("join"), false);
  assert.equal(storage.data.has("create"), true);
  assert.equal(storage.alarm, 1201000);
  await clearExpiredBudgets(storage, 1201000);
  assert.equal(storage.data.size, 0);
});
