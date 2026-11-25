import test from "node:test";
import { promptPoolForPlayer } from "../server/prompts.mjs";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore } from "../server/store.mjs";
import { api } from "../server/api.mjs";
import { randomUUID } from "node:crypto";
async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), "bluff-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = await new FileStore(join(dir, "rooms.json")).load();
  const call = (path, method = "GET", data, token = "") =>
    api(
      {
        path,
        method,
        body: data ? JSON.stringify(data) : "",
        token,
        ip: "test",
      },
      store,
    );
  return { store, call, dir };
}
test("HTTP API supports create, join, reconnect and restart persistence", async (t) => {
  const { call, dir } = await setup(t);
  const created = await call("/api/rooms", "POST", {
    ageGroup: "adult",
    name: "Mia",
  });
  assert.equal(created.status, 201);
  const { token, room } = created.data;
  const base = "/api/rooms/" + room.code;
  assert.equal(
    (await call(base + "/join", "POST", { ageGroup: "adult", name: "Tumi" }))
      .status,
    200,
  );
  const reconnect = await call(base, "GET", null, token);
  assert.equal(reconnect.data.room.players.length, 2);
  assert.equal((await call(base)).status, 401);
  const reloaded = await new FileStore(join(dir, "rooms.json")).load();
  assert.equal(
    (await api({ path: base, method: "GET", token }, reloaded)).data.room
      .players.length,
    2,
  );
});
test("concurrent local joins preserve all players and enforce max room size", async (t) => {
  const { call } = await setup(t);
  const r = await call("/api/rooms", "POST", {
      ageGroup: "adult",
      name: "Mia",
    }),
    base = "/api/rooms/" + r.data.room.code;
  const joins = await Promise.all(
    Array.from({ length: 9 }, (_, i) =>
      call(base + "/join", "POST", { ageGroup: "adult", name: "Player " + i }),
    ),
  );
  assert.equal(joins.filter((x) => x.status === 200).length, 7);
  const view = await call(base, "GET", null, r.data.token);
  assert.equal(view.data.room.players.length, 8);
});
test("repeated action request IDs are idempotent", async (t) => {
  const { call } = await setup(t);
  const r = await call("/api/rooms", "POST", {
      ageGroup: "adult",
      name: "Mia",
      demo: true,
    }),
    base = "/api/rooms/" + r.data.room.code,
    token = r.data.token;
  const action = { action: "lock", data: {}, requestId: randomUUID() };
  const first = await call(base + "/action", "POST", action, token),
    repeat = await call(base + "/action", "POST", action, token);
  assert.equal(first.data.room.locked, true);
  assert.equal(repeat.data.room.locked, true);
});
test("malformed submissions and unauthorized host actions return safe errors", async (t) => {
  const { call, store } = await setup(t);
  assert.equal(
    (await api({ path: "/api/rooms", method: "POST", body: "{" }, store))
      .status,
    400,
  );
  assert.equal((await call("/api/rooms", "POST", {})).status, 400);
  const r = await call("/api/rooms", "POST", {
      ageGroup: "adult",
      name: "Mia",
    }),
    base = "/api/rooms/" + r.data.room.code,
    j = await call(base + "/join", "POST", { ageGroup: "adult", name: "Tumi" });
  const action = await call(
    base + "/action",
    "POST",
    { action: "lock", requestId: randomUUID() },
    j.data.token,
  );
  assert.equal(action.status, 403);
  assert.equal(
    (await call(base + "/action", "POST", { action: "lock" }, r.data.token))
      .status,
    400,
  );
});
test("room creation has a server-side rate limit", async (t) => {
  const { call } = await setup(t);
  for (let i = 0; i < 12; i++)
    assert.equal(
      (await call("/api/rooms", "POST", { ageGroup: "adult", name: "Mia" }))
        .status,
      201,
    );
  assert.equal(
    (await call("/api/rooms", "POST", { ageGroup: "adult", name: "Mia" }))
      .status,
    429,
  );
});
test("host polls refresh the heartbeat without exposing credentials", async (t) => {
  const { call, store } = await setup(t);
  const r = await call("/api/rooms", "POST", {
      ageGroup: "adult",
      name: "Mia",
    }),
    base = "/api/rooms/" + r.data.room.code;
  await store.mutate(r.data.room.code, (room) => {
    room.hostSeenAt = Date.now() - 120000;
  });
  const view = await call(base, "GET", null, r.data.token);
  assert.equal(view.data.room.hostAway, false);
  assert.ok(!JSON.stringify(view.data).includes(r.data.token));
});
test("AWS conditional writes retry concurrent joins without losing a player", async () => {
  const { DynamoStore } = await import("../server/store.mjs");
  const { newRoom, joinRoom } = await import("../server/engine.mjs");
  class GetItemCommand {
    constructor(input) {
      this.input = input;
    }
  }
  class PutItemCommand {
    constructor(input) {
      this.input = input;
    }
  }
  const records = new Map();
  let collisions = 0;
  const client = {
    async send(command) {
      const a = command.input;
      if (command instanceof GetItemCommand)
        return { Item: structuredClone(records.get(a.Key.pk.S)) };
      const old = records.get(a.Item.pk.S);
      if (
        a.ConditionExpression === "attribute_not_exists(pk)"
          ? Boolean(old)
          : old?.revision.N !== a.ExpressionAttributeValues[":revision"].N
      ) {
        collisions++;
        const e = new Error();
        e.name = "ConditionalCheckFailedException";
        throw e;
      }
      records.set(a.Item.pk.S, structuredClone(a.Item));
      return {};
    },
  };
  const store = new DynamoStore(
      client,
      { GetItemCommand, PutItemCommand },
      "rooms",
    ),
    { room } = newRoom("Mia");
  await store.create(room);
  await Promise.all(
    ["Tumi", "Jo", "Alex", "Zee"].map((name) =>
      store.mutate(room.code, (r) => joinRoom(r, name)),
    ),
  );
  const names = await store.mutate(room.code, (r) =>
    r.players.map((p) => p.name),
  );
  assert.equal(names.length, 5);
  assert.equal(new Set(names).size, 5);
  assert.ok(collisions > 0);
});

test("create and join store each player's age group and return tailored prompts", async (t) => {
  const { call } = await setup(t);
  const created = await call("/api/rooms", "POST", {
    name: "Robin",
    ageGroup: "child",
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.room.ageGroup, "child");
  assert.ok(!created.data.room.prompts.some((p) => p.id === "first-job"));
  const base = "/api/rooms/" + created.data.room.code;
  const joined = await call(base + "/join", "POST", {
    name: "Taylor",
    ageGroup: "teen",
  });
  assert.equal(joined.status, 200);
  assert.equal(joined.data.room.prompts.length, 3);
  const allowed = new Set(
    promptPoolForPlayer({ ageGroup: "teen" }).map((p) => p.id),
  );
  assert.ok(joined.data.room.prompts.every((p) => allowed.has(p.id)));
  const restored = await call(base, "GET", null, created.data.token);
  assert.equal(restored.data.room.ageGroup, "child");
  assert.ok(restored.data.room.players.every((p) => !("ageGroup" in p)));
});
test("players join before choosing age, then complete private profiles in the lobby", async (t) => {
  const { call } = await setup(t);
  const created = await call("/api/rooms", "POST", { name: "Host" }),
    base = "/api/rooms/" + created.data.room.code;
  assert.equal(created.status, 201);
  assert.equal(created.data.room.ageGroup, null);
  assert.deepEqual(created.data.room.prompts, []);
  const guest = await call(base + "/join", "POST", { name: "Guest" });
  assert.equal(guest.status, 200);
  assert.equal(guest.data.room.ageGroup, null);
  const action = (token, action, data = {}) =>
    call(
      base + "/action",
      "POST",
      { action, data, requestId: randomUUID() },
      token,
    );
  assert.equal((await action(created.data.token, "start")).status, 400);
  const hostProfile = await action(created.data.token, "profile", {
    ageGroup: "adult26",
  });
  assert.equal(hostProfile.status, 200);
  assert.equal((await action(created.data.token, "start")).status, 400);
  assert.equal(
    (
      await action(guest.data.token, "profile", {
        ageGroup: "child",
        playerId: created.data.room.me,
      })
    ).status,
    200,
  );
  const host = await call(base, "GET", null, created.data.token);
  assert.equal(host.data.room.ageGroup, "adult26");
  assert.ok(
    host.data.room.players.every((p) => p.profileReady && !("ageGroup" in p)),
  );
  assert.equal((await action(created.data.token, "start")).status, 200);
  assert.equal(
    (await action(guest.data.token, "profile", { ageGroup: "adult26" })).status,
    400,
  );
});
test("unsupported age groups are rejected when saving a lobby profile", async (t) => {
  const { call } = await setup(t);
  const r = await call("/api/rooms", "POST", { name: "Robin" }),
    base = "/api/rooms/" + r.data.room.code;
  for (const ageGroup of [undefined, null, "unknown", 12]) {
    const response = await call(
      base + "/action",
      "POST",
      { action: "profile", data: { ageGroup }, requestId: randomUUID() },
      r.data.token,
    );
    assert.equal(response.status, 400);
    assert.match(response.data.error, /age group/);
  }
});

test("the API lets a host start when exactly two human players have joined", async (t) => {
  const { call } = await setup(t);
  const created = await call("/api/rooms", "POST", {
      name: "Spouse A",
      ageGroup: "adult",
    }),
    base = "/api/rooms/" + created.data.room.code;
  const alone = await call(
    base + "/action",
    "POST",
    { action: "start", requestId: randomUUID() },
    created.data.token,
  );
  assert.equal(alone.status, 400);
  assert.match(alone.data.error, /at least 2/);
  const joined = await call(base + "/join", "POST", {
    name: "Spouse B",
    ageGroup: "adult",
  });
  assert.equal(joined.status, 200);
  const started = await call(
    base + "/action",
    "POST",
    { action: "start", requestId: randomUUID() },
    created.data.token,
  );
  assert.equal(started.status, 200);
  assert.equal(started.data.room.phase, "writing");
  assert.equal(started.data.room.players.length, 2);
  const other = await call(base, "GET", null, joined.data.token);
  assert.equal(other.data.room.phase, "writing");
});

test("API carries recent question history into new rooms and joining players", async (t) => {
  const { call } = await setup(t);
  const previous = await call("/api/rooms", "POST", {
    name: "Previous",
    ageGroup: "adult26",
    demo: true,
  });
  const recent = previous.data.room.prompts.map((p) => p.id);
  const next = await call("/api/rooms", "POST", {
    name: "Next",
    ageGroup: "adult26",
    demo: true,
    recentPromptIds: recent,
  });
  assert.equal(next.status, 201);
  assert(next.data.room.prompts.every((p) => !recent.includes(p.id)));
  const joined = await call(`/api/rooms/${next.data.room.code}/join`, "POST", {
    name: "Guest",
    ageGroup: "adult26",
    recentPromptIds: recent,
  });
  assert.equal(joined.status, 200);
  assert(joined.data.room.prompts.every((p) => !recent.includes(p.id)));
  assert(!JSON.stringify(joined.data).includes('"promptHistory"'));
});
test("face-off photos upload through the API and are only shown when allowed", async (t) => {
  const { call } = await setup(t);
  const host = (
    await call("/api/rooms", "POST", { ageGroup: "adult", name: "Mia" })
  ).data;
  const base = "/api/rooms/" + host.room.code;
  const guest = (
    await call(base + "/join", "POST", { ageGroup: "adult", name: "Tumi" })
  ).data;
  const act = (token, action, data = {}) =>
    call(
      base + "/action",
      "POST",
      { action, data, requestId: randomUUID() },
      token,
    );
  await act(host.token, "settings", { mode: "faces" });
  const started = await act(host.token, "start");
  assert.equal(started.data.room.phase, "posing");
  const q = started.data.room.question;
  assert.equal(q.type, "face");
  const poser = q.playerId === host.room.me ? host : guest,
    copier = poser === host ? guest : host;
  // A realistic resized photo is ~20-50 KB, more than the old 16 KB request limit.
  const image = "data:image/jpeg;base64," + "A".repeat(40000);
  const posed = await act(poser.token, "photo", { questionId: q.id, image });
  assert.equal(posed.status, 200);
  assert.equal(posed.data.room.phase, "copying");
  assert.deepEqual(posed.data.room.shotIds, [poser.room.me]);
  // Snapshots never carry the photos themselves.
  assert.equal(JSON.stringify(posed.data).includes("A".repeat(100)), false);
  const seen = await call(base + "/photos", "GET", undefined, copier.token);
  assert.equal(seen.status, 200);
  assert.deepEqual(Object.keys(seen.data.photos), [poser.room.me]);
  const tooBig = await act(copier.token, "photo", {
    questionId: q.id,
    image: "data:image/jpeg;base64," + "A".repeat(70000),
  });
  assert.equal(tooBig.status, 413);
  assert.equal(
    (await call(base + "/photos", "GET", undefined, "nope")).status,
    401,
  );
});

test("new web flow creates and joins without age, starts mixed rounds and survives reconnect", async (t) => {
  const { call } = await setup(t);
  const created = await call("/api/rooms", "POST", {
    name: "Mia",
    flowVersion: 2,
  });
  assert.equal(created.status, 201);
  const { room, token } = created.data;
  assert.equal(room.flowVersion, 2);
  assert.equal(room.settings.mode, "mixed");
  assert.equal(room.ageGroup, null);
  const base = "/api/rooms/" + room.code;
  const joined = await call(base + "/join", "POST", { name: "Tumi" });
  assert.equal(joined.status, 200);
  assert(joined.data.room.players.every((p) => p.profileReady));
  const started = await call(
    base + "/action",
    "POST",
    { action: "start", requestId: randomUUID() },
    token,
  );
  assert.equal(started.status, 200);
  assert.equal(started.data.room.question.total, 6);
  assert.notEqual(started.data.room.phase, "lobby");
  const reconnected = await call(base, "GET", null, joined.data.token);
  assert.equal(reconnected.status, 200);
  assert.equal(
    reconnected.data.room.question.id,
    started.data.room.question.id,
  );
});
