import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_LENGTHS,
  GAME_TYPES,
  estimateMinutes,
  progressState,
} from "../public/game-options.js";
import {
  newRoom,
  enableSimpleFlow,
  joinRoom,
  apply,
  tick,
} from "../server/engine.mjs";
const now = 1800000000000;
test("the four game buckets use 0.7 minutes per question per player", () => {
  assert.deepEqual(GAME_LENGTHS, [5, 10, 20, 30]);
  assert.deepEqual(
    GAME_LENGTHS.map((n) => estimateMinutes(n)),
    [14, 28, 56, 84],
  );
  assert.deepEqual(
    GAME_LENGTHS.map((n) => estimateMinutes(n, 2)),
    [7, 14, 28, 42],
  );
  assert.equal(estimateMinutes(30, 8), 168);
});
test("all bucket sizes start an exact-length game and anything over 30 is rejected", () => {
  for (const totalRounds of GAME_LENGTHS) {
    const { room, token } = newRoom("Mia", false, now, null);
    enableSimpleFlow(room);
    joinRoom(room, "Sam", now, null);
    apply(room, token, "settings", { totalRounds }, now);
    apply(room, token, "start", {}, now);
    assert.equal(room.queue.length, totalRounds);
  }
  const { room, token } = newRoom("Mia", false, now, null);
  enableSimpleFlow(room);
  for (const totalRounds of [1, 6, 15, 31, 100])
    assert.throws(() => apply(room, token, "settings", { totalRounds }, now));
});
test("progress advances at results, stays correct on the next question, and reaches the finish", () => {
  const q = { number: 1, total: 10 };
  for (const phase of [
    "writing",
    "posing",
    "copying",
    "drawing",
    "voting",
    "judging",
  ])
    assert.deepEqual(progressState(q, phase), {
      completed: 0,
      remaining: 10,
      total: 10,
    });
  assert.deepEqual(progressState(q, "reveal"), {
    completed: 1,
    remaining: 9,
    total: 10,
  });
  assert.deepEqual(progressState({ number: 2, total: 10 }, "drawing"), {
    completed: 1,
    remaining: 9,
    total: 10,
  });
  assert.deepEqual(progressState({ number: 30, total: 30 }, "reveal"), {
    completed: 30,
    remaining: 0,
    total: 30,
  });
});
test("old lobbies adopt the new buckets without changing active games", () => {
  const { room } = newRoom("Mia", false, now, null);
  enableSimpleFlow(room);
  room.settings.totalRounds = 6;
  tick(room, now);
  assert.equal(room.settings.totalRounds, 10);
  room.phase = "voting";
  room.settings.totalRounds = 6;
  tick(room, now);
  assert.equal(room.settings.totalRounds, 6);
});

test("the game menu offers exactly Truth & Lies and Party Mix", () => {
  assert.deepEqual(
    GAME_TYPES.map((type) => [type.id, type.label]),
    [
      ["classic", "Truth & Lies"],
      ["mixed", "Party Mix"],
    ],
  );
});
