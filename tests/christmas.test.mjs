import test from "node:test";
import assert from "node:assert/strict";
import {
  CHRISTMAS_PROMPTS,
  CHRISTMAS_PHOTOS,
  CHRISTMAS_DOODLES,
  CHRISTMAS_AUDIO,
} from "../server/christmas-prompts.mjs";
import {
  PROMPTS,
  ALL_PROMPTS,
  promptPoolForPlayer,
  normalisePromptHistory,
} from "../server/prompts.mjs";
import {
  newRoom,
  enableSimpleFlow,
  joinRoom,
  apply,
  snapshot,
  tick,
} from "../server/engine.mjs";
import { QUESTION_PACKS } from "../public/game-options.js";
const now = Date.now();
function setup(mode = "classic", length = 30, demo = false) {
  const { room, token } = newRoom("Mia", demo, now, null);
  enableSimpleFlow(room);
  const guest = demo ? null : joinRoom(room, "Sam", now, null);
  apply(
    room,
    token,
    "settings",
    { mode, totalRounds: length, questionPack: "christmas" },
    now,
  );
  return { room, token, guest };
}
test("Christmas pack contains exactly 100 original questions with usable, relevant answer banks", () => {
  assert.equal(CHRISTMAS_PROMPTS.length, 100);
  assert.equal(PROMPTS.length, 100);
  assert.equal(ALL_PROMPTS.length, 200);
  assert.equal(new Set(ALL_PROMPTS.map((q) => q.id)).size, 200);
  assert.equal(
    new Set(CHRISTMAS_PROMPTS.map((q) => q.title.toLowerCase())).size,
    100,
  );
  for (const p of CHRISTMAS_PROMPTS) {
    assert(p.title.endsWith("?"));
    assert(p.family);
    assert.equal(p.decoys.length, 4);
    assert.equal(p.wildcards.length, 4);
    assert.equal(
      new Set([...p.decoys, ...p.wildcards].map((a) => a.toLowerCase())).size,
      8,
      p.id,
    );
    assert(
      [...p.decoys, ...p.wildcards].every(
        (a) => a.length >= 2 && a.length <= 120,
      ),
      p.id,
    );
  }
  assert.deepEqual(
    QUESTION_PACKS.map((p) => p.id),
    ["original", "christmas"],
  );
});
test("Christmas text games stay entirely in the pack, rotate history, and hide other players answers", () => {
  const { room, token, guest } = setup();
  const pool = promptPoolForPlayer(room.players[0], room);
  assert.equal(pool.length, 100);
  const recent = pool.slice(0, 30).map((p) => p.id);
  room.players.forEach((p) => (p.promptHistory = recent));
  apply(room, token, "start", {}, now);
  assert.equal(room.queue.length, 30);
  assert(
    room.queue.every(
      (q) => q.type === "truth" && q.promptId.startsWith("christmas-"),
    ),
  );
  assert(room.queue.every((q) => !recent.includes(q.promptId)));
  assert.equal(new Set(room.queue.map((q) => q.promptId)).size, 30);
  const q = room.queue[0],
    author = room.players.find((p) => p.id === q.playerId),
    voter = room.players.find((p) => p.id !== q.playerId);
  assert.equal(snapshot(room, author.token, now).prompts[0].id, q.promptId);
  assert.equal(snapshot(room, voter.token, now).prompts.length, 0);
  apply(
    room,
    author.token,
    "answers",
    {
      answers: [
        {
          promptId: q.promptId,
          truth: "A mug of hot chocolate",
          lie: "A goose in a tiny sleigh",
        },
      ],
      submitted: true,
    },
    now,
  );
  assert.equal(room.phase, "voting");
  assert.equal(room.queue[0].options.length, 4);
  assert.throws(() =>
    apply(room, token, "settings", { questionPack: "original" }, now),
  );
  apply(
    room,
    voter.token,
    "vote",
    { questionId: q.id, optionId: room.queue[0].options[0].id },
    now,
  );
  tick(room, now + 10000);
  assert.equal(room.phase, "reveal");
  apply(room, token, "ready-next", {}, now + 10000);
  apply(room, guest, "ready-next", {}, now + 10000);
  assert.equal(room.questionIndex, 1);
});
test("Party Mix keeps 70/10/10/10 and every creative round uses festive prompts without repeats", () => {
  const { room, token } = setup("mixed");
  apply(room, token, "start", {}, now);
  const by = (type) => room.queue.filter((q) => q.type === type);
  assert.deepEqual(
    ["truth", "face", "doodle", "audio"].map((type) => by(type).length),
    [21, 3, 3, 3],
  );
  assert(by("truth").every((q) => q.promptId.startsWith("christmas-")));
  assert(
    by("face").every((q) =>
      CHRISTMAS_PHOTOS.some(
        (t) =>
          t.replace(
            "{name}",
            room.players.find((p) => p.id === q.playerId).name,
          ) === q.title,
      ),
    ),
  );
  assert(
    by("doodle").every((q) =>
      CHRISTMAS_DOODLES.some(
        (t) =>
          t.replace(
            "{name}",
            room.players.find((p) => p.id === q.playerId).name,
          ) === q.title,
      ),
    ),
  );
  assert(
    by("audio").every(
      (q) =>
        CHRISTMAS_AUDIO.includes(q.title) && q.title.includes("Ho, ho, ho!"),
    ),
  );
  for (const type of ["face", "doodle", "audio"])
    assert.equal(new Set(by(type).map((q) => q.title)).size, 3);
});
test("pack selection is host-only, validated, persists on replay and works with solo demo bots", () => {
  const { room, token, guest } = setup("classic", 5);
  assert.throws(
    () => apply(room, guest, "settings", { questionPack: "original" }, now),
    { status: 403 },
  );
  assert.throws(() =>
    apply(room, token, "settings", { questionPack: "not-a-pack" }, now),
  );
  assert.deepEqual(
    normalisePromptHistory(["christmas-001", "unexpected", "fake"]),
    ["christmas-001", "unexpected"],
  );
  apply(room, token, "start", {}, now);
  room.phase = "finished";
  apply(room, token, "replay", {}, now);
  assert.equal(room.settings.questionPack, "christmas");
  apply(room, token, "settings", { questionPack: "original" }, now);
  assert.equal(promptPoolForPlayer(room.players[0], room).length, 99);
  const demo = setup("classic", 5, true);
  apply(demo.room, demo.token, "start", {}, now);
  assert(demo.room.queue.every((q) => q.promptId.startsWith("christmas-")));
  assert.equal(
    snapshot(demo.room, demo.token, now).settings.questionPack,
    "christmas",
  );
});
