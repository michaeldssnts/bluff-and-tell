import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { adminApi, adminSession, validAdmin } from "../server/admin.mjs";
import {
  UsageLedger,
  ObservedRoomStore,
  recordUsage,
  gameState,
  DAY,
} from "../server/usage.mjs";
import { newRoom, enableSimpleFlow } from "../server/engine.mjs";
import { FileStore } from "../server/store.mjs";
import { api } from "../server/api.mjs";
import { localUsage } from "../server/local-usage.mjs";

class Storage {
  data = new Map();
  alarm = null;
  pending = Promise.resolve();
  transaction(fn) {
    const work = this.pending.then(async () => {
      const data = structuredClone(this.data);
      let alarm = this.alarm;
      const value = await fn({
        get: async (key) => structuredClone(data.get(key)),
        put: async (key, value) => data.set(key, structuredClone(value)),
        delete: async (key) => data.delete(key),
        list: async () => structuredClone(data),
        getAlarm: async () => alarm,
        setAlarm: async (value) => {
          alarm = value;
        },
      });
      this.data = data;
      this.alarm = alarm;
      return value;
    });
    this.pending = work.catch(() => {});
    return work;
  }
}
const secret = "synthetic-admin-test-password-12345678";
const username = "admin@example.test";
const sessionSecret = "synthetic-random-session-signing-key-123456789";
const now = Date.UTC(2026, 10, 26, 12);
const req = (
  path,
  method = "GET",
  body,
  cookie,
  origin = "https://example.test",
) =>
  new Request("https://example.test/api/admin/" + path, {
    method,
    headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

test("admin denies unauthenticated, tampered, expired and cross-origin access", async () => {
  const deps = {
    secret,
    username,
    sessionSecret,
    ledger: { report: async () => ({ safe: true }) },
    budget: async () => true,
  };
  assert.equal((await adminApi(req("usage"), deps, now)).status, 401);
  assert.equal(
    (await adminApi(req("usage"), { ...deps, secret: undefined }, now)).status,
    503,
  );
  assert.equal(
    (
      await adminApi(
        req(
          "session",
          "POST",
          { username, password: secret },
          null,
          "https://attacker.test",
        ),
        deps,
        now,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await adminApi(
        req("session", "POST", { username, password: "wrong" }),
        deps,
        now,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await adminApi(
        req("session", "POST", { username, password: secret }),
        { ...deps, budget: async () => false },
        now,
      )
    ).status,
    429,
  );
  const res = await adminApi(
    req("session", "POST", { username, password: secret }),
    deps,
    now,
  );
  const header = res.headers.get("Set-Cookie");
  for (const attribute of [
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/api/admin",
  ])
    assert.ok(header.includes(attribute));
  const cookie = header.split(";")[0];
  assert.equal(
    (await adminApi(req("usage", "GET", undefined, cookie), deps, now)).status,
    200,
  );
  assert.equal(validAdmin(cookie, sessionSecret, now + 8 * 3600000), false);
  assert.equal(validAdmin(cookie + "x", sessionSecret, now), false);
  assert.equal(validAdmin(cookie, "different secret", now), false);
  assert.equal(
    validAdmin(
      "bt_admin=" + adminSession(sessionSecret, now + 1000),
      sessionSecret,
      now,
    ),
    false,
  );
  const logout = await adminApi(
    req("session", "DELETE", undefined, cookie),
    deps,
    now,
  );
  assert.ok(logout.headers.get("Set-Cookie").includes("Max-Age=0"));
  assert.equal(res.headers.get("Cache-Control"), "no-store");
});

test("usage tracks lifecycle, retries and rematches without exposing names, codes or media", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bluff-admin-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const storage = new Storage(),
    ledger = new UsageLedger(storage);
  const raw = await new FileStore(join(dir, "rooms.json")).load();
  let published = 0;
  const store = new ObservedRoomStore(raw, async (summary) => {
    published++;
    await ledger.ingest(summary);
  });
  const call = (path, method = "GET", data, token = "") =>
    api(
      {
        path,
        method,
        body: data ? JSON.stringify(data) : "",
        token,
        ip: "synthetic",
      },
      store,
    );
  const made = await call("/api/rooms", "POST", {
    name: "PRIVATE_NAME",
    flowVersion: 2,
  });
  const { room, token } = made.data,
    base = "/api/rooms/" + room.code;
  const guest = await call(base + "/join", "POST", { name: "PRIVATE_GUEST" });
  assert.equal(guest.status, 200);
  await call(base, "GET", undefined, token);
  await call(base, "GET", undefined, token);
  assert.equal(
    published,
    2,
    "polls are not delivered or counted as player actions",
  );
  const settings = {
    action: "settings",
    requestId: randomUUID(),
    data: { mode: "classic", totalRounds: 5 },
  };
  await call(base + "/action", "POST", settings, token);
  await call(base + "/action", "POST", settings, token);
  await call(
    base + "/action",
    "POST",
    { action: "start", requestId: randomUUID() },
    token,
  );
  const report = await ledger.report();
  assert.equal(report.totals.rooms, 1);
  assert.equal(report.days[0].joins, 2);
  assert.equal(report.days[0].games, 1);
  assert.equal(report.days[0].actions, 3);
  assert.equal(report.rooms[0].players, 2);
  assert.equal(report.rooms[0].round, 1);
  const text = JSON.stringify(report);
  for (const privateValue of [
    "PRIVATE_NAME",
    "PRIVATE_GUEST",
    token,
    guest.data.token,
    room.code,
  ])
    assert.ok(!text.includes(privateValue));
  assert.ok(!JSON.stringify(made.data).includes("counters"));
  assert.ok(!JSON.stringify(made.data).includes("usage"));
  const stored = raw.rooms.get(room.code);
  stored.shots = { secret: "PRIVATE_PHOTO" };
  stored.clips = { secret: "PRIVATE_AUDIO" };
  stored.players[0].answers = [{ truth: "PRIVATE_TRUTH" }];
  let before = gameState(stored);
  stored.results.push({});
  stored.phase = "finished";
  recordUsage(stored, "ready-next", before, Date.now() + 60000);
  await ledger.ingest({ ...stored.usage, shots: stored.shots });
  const finished = await ledger.report();
  assert.equal(finished.days[0].completed, 1);
  assert.equal(finished.days[0].rounds, 1);
  assert.ok(finished.days[0].durationMs >= 60000);
  for (const value of [
    "PRIVATE_PHOTO",
    "PRIVATE_AUDIO",
    "PRIVATE_TRUTH",
    "shots",
  ])
    assert.ok(!JSON.stringify(finished).includes(value));
  const frozen = stored.usage.gameDurationMs;
  recordUsage(stored, "poll", gameState(stored), Date.now() + 3600000);
  assert.equal(stored.usage.gameDurationMs, frozen);
  before = gameState(stored);
  stored.phase = "lobby";
  stored.results = [];
  recordUsage(stored, "replay", before, Date.now() + 3600000);
  before = gameState(stored);
  stored.phase = "writing";
  recordUsage(stored, "start", before, Date.now() + 3601000);
  assert.equal(stored.usage.counters.games, 2);
  assert.equal(stored.usage.counters.completed, 1);
});

test("anonymous creation count survives room expiry and daily history expiry, with idempotent delivery", async () => {
  const storage = new Storage(),
    ledger = new UsageLedger(storage);
  const { room } = newRoom("Private", false, now);
  enableSimpleFlow(room);
  recordUsage(room, "create", undefined, now);
  await Promise.all([
    ledger.ingest(room.usage, now),
    ledger.ingest(room.usage, now),
  ]);
  const original = structuredClone(room.usage);
  recordUsage(room, "join", undefined, now + 1000);
  await ledger.ingest(room.usage, now + 1000);
  await ledger.ingest(original, now + 1000);
  let report = await ledger.report(now + 1000);
  assert.equal(report.totals.rooms, 1);
  assert.equal(report.days[0].joins, 2);
  report = await ledger.report(now + DAY);
  assert.equal(report.rooms.length, 0);
  assert.equal(report.days.length, 1);
  assert.equal(report.totals.rooms, 1);
  await ledger.ingest(original, now + DAY);
  assert.equal(
    (await ledger.report(now + DAY)).totals.rooms,
    1,
    "expired room cannot be resurrected or counted twice",
  );
  report = await ledger.report(now + 90 * DAY);
  assert.equal(report.days.length, 0);
  assert.equal(report.totals.rooms, 1);
  assert.deepEqual([...storage.data.keys()], ["totals"]);
});

test("media and vote totals are separated, demos excluded and failed sinks retried", async (t) => {
  const { room } = newRoom("Private", false, now);
  recordUsage(room, "create", undefined, now);
  for (const [action, type] of [
    ["answers", "truth"],
    ["photo", "face"],
    ["photo", "doodle"],
    ["audio", "audio"],
    ["face-vote", "audio"],
    ["vote", "truth"],
  ]) {
    room.queue = [{ type }];
    recordUsage(room, action, undefined, now + 1);
  }
  assert.deepEqual(
    Object.fromEntries(
      ["answers", "photos", "drawings", "audio", "votes"].map((key) => [
        key,
        room.usage.counters[key],
      ]),
    ),
    { answers: 1, photos: 1, drawings: 1, audio: 1, votes: 2 },
  );
  const demo = newRoom("Demo", true, now).room;
  recordUsage(demo, "create", undefined, now);
  assert.equal(demo.usage, undefined);
  const dir = await mkdtemp(join(tmpdir(), "bluff-usage-retry-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const raw = await new FileStore(join(dir, "rooms.json")).load();
  let failed = true;
  const ledger = await localUsage(join(dir, "usage.json"));
  const store = new ObservedRoomStore(raw, async (usage) => {
    if (failed) throw Error("synthetic outage");
    await ledger.ingest(usage);
  });
  const created = await api(
    {
      path: "/api/rooms",
      method: "POST",
      body: JSON.stringify({ name: "Private", flowVersion: 2 }),
    },
    store,
  );
  assert.equal(created.status, 201);
  failed = false;
  await api(
    {
      path: "/api/rooms/" + created.data.room.code,
      method: "GET",
      token: created.data.token,
    },
    store,
  );
  assert.equal((await ledger.report()).totals.rooms, 1);
  const reloaded = await localUsage(join(dir, "usage.json"));
  assert.equal((await reloaded.report()).totals.rooms, 1);
});

test("delivery after midnight preserves the original day of each activity", async () => {
  const ledger = new UsageLedger(new Storage());
  const start = Date.UTC(2026, 10, 25, 23, 55);
  const { room } = newRoom("Private", false, start);
  recordUsage(room, "create", undefined, start);
  recordUsage(room, "join", undefined, start + 10 * 60000);
  await ledger.ingest(room.usage, start + 10 * 60000);
  const report = await ledger.report(start + 10 * 60000);
  assert.deepEqual(
    report.days.map((d) => [d.date, d.rooms, d.joins]),
    [
      ["2026-11-25", 1, 1],
      ["2026-11-26", 0, 1],
    ],
  );
});

test("staging test exclusion is internal, persists for the room, and cannot be set through JSON", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bluff-test-exclusion-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const raw = await new FileStore(join(dir, "rooms.json")).load();
  const ledger = await localUsage(join(dir, "usage.json"));
  const store = new ObservedRoomStore(raw, (u) => ledger.ingest(u));
  const run = (trackUsage) =>
    api(
      {
        path: "/api/rooms",
        method: "POST",
        body: JSON.stringify({ name: "Private", trackUsage: false }),
        trackUsage,
      },
      store,
    );
  const testRoom = await run(false);
  await api(
    {
      path: "/api/rooms/" + testRoom.data.room.code,
      method: "GET",
      token: testRoom.data.token,
    },
    store,
  );
  assert.equal((await ledger.report()).totals.rooms, 0);
  await run(true);
  assert.equal((await ledger.report()).totals.rooms, 1);
});

test("a complete API game counts only locked-in answers, deduplicated votes and one completion", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bluff-usage-game-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const raw = await new FileStore(join(dir, "rooms.json")).load();
  const ledger = new UsageLedger(new Storage());
  const store = new ObservedRoomStore(raw, (u) => ledger.ingest(u));
  const call = (path, method = "GET", data, token = "") =>
    api(
      {
        path,
        method,
        body: data ? JSON.stringify(data) : "",
        token,
        ip: "synthetic",
      },
      store,
    );
  const host = (
    await call("/api/rooms", "POST", { name: "Synthetic host", flowVersion: 2 })
  ).data;
  const base = "/api/rooms/" + host.room.code;
  const guest = (
    await call(base + "/join", "POST", { name: "Synthetic guest" })
  ).data;
  const action = async (token, action, data = {}, requestId = randomUUID()) => {
    const reply = await call(
      base + "/action",
      "POST",
      { action, data, requestId },
      token,
    );
    assert.equal(reply.status, 200, reply.data.error);
    return reply;
  };
  await action(host.token, "settings", { mode: "classic", totalRounds: 5 });
  await action(host.token, "start");
  for (let index = 0; index < 5; index++) {
    let room = raw.rooms.get(host.room.code);
    const q = room.queue[index];
    const author = room.players.find((p) => p.id === q.playerId);
    const voter = room.players.find((p) => p.id !== q.playerId);
    const answers = {
      answers: [
        {
          promptId: q.promptId,
          truth: "Synthetic truth",
          lie: "Synthetic lie",
        },
      ],
      submitted: false,
    };
    await action(author.token, "answers", answers);
    await action(author.token, "answers", { ...answers, submitted: true });
    room = raw.rooms.get(host.room.code);
    const vote = {
      questionId: q.id,
      optionId: room.queue[index].options[0].id,
    };
    const requestId = randomUUID();
    await action(voter.token, "vote", vote, requestId);
    await action(voter.token, "vote", vote, requestId);
    raw.rooms.get(host.room.code).deadline = Date.now() - 1;
    await call(base, "GET", undefined, host.token);
    await action(host.token, "ready-next");
    await action(guest.token, "ready-next");
  }
  const report = await ledger.report();
  const c = report.days[0];
  assert.equal(report.rooms[0].phase, "finished");
  assert.deepEqual(
    [c.rooms, c.joins, c.games, c.completed, c.rounds, c.answers, c.votes],
    [1, 2, 1, 1, 5, 5, 5],
  );
  const finalDuration = report.rooms[0].gameDurationMs;
  await call(base, "GET", undefined, host.token);
  assert.equal((await ledger.report()).rooms[0].gameDurationMs, finalDuration);
});
