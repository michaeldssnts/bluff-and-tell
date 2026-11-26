import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore } from "../server/store.mjs";
import { newRoom } from "../server/engine.mjs";
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "bt-retention-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return join(dir, "rooms.json");
}
test("rooms expire 24 hours after creation and idle cleanup removes all expired room content", async (t) => {
  const file = await fixture(t),
    now = Date.now();
  const expired = newRoom("Old").room,
    active = newRoom("New").room;
  assert.equal(expired.expiresAt - expired.createdAt, 24 * 60 * 60 * 1000);
  expired.expiresAt = now + 1;
  expired.shots = { a: "private-photo" };
  expired.clips = { a: "private-audio" };
  expired.results = [{ answer: "private-answer" }];
  const store = await new FileStore(file).load();
  await store.create(expired);
  await store.create(active);
  assert.equal(await store.cleanup(now + 2), 1);
  assert(!store.rooms.has(expired.code));
  assert(store.rooms.has(active.code));
  const persisted = await readFile(file, "utf8");
  assert(!persisted.includes("private-"));
  assert.equal(JSON.parse(persisted).length, 1);
});
test("startup purges expired data from disk even if nobody opens the old room", async (t) => {
  const file = await fixture(t),
    room = newRoom("Old").room;
  room.expiresAt = Date.now() - 1;
  room.clips = { a: "old-audio" };
  await writeFile(file, JSON.stringify([room]));
  const store = await new FileStore(file).load();
  assert.equal(store.rooms.size, 0);
  assert.equal(await readFile(file, "utf8"), "[]");
});
