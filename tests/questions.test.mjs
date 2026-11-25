import test from "node:test";
import assert from "node:assert/strict";
import { newRoom, joinRoom, snapshot, apply } from "../server/engine.mjs";
import {
  PROMPTS,
  promptsForPlayer,
  promptPoolForPlayer,
  normalisePromptHistory,
} from "../server/prompts.mjs";
const at = 1800000000000;
const ids = (room, token) => snapshot(room, token, at).prompts.map((p) => p.id);

test("the authored bank has 100 unique questions with complete, unique answer banks", () => {
  assert.equal(PROMPTS.length, 100);
  assert.equal(new Set(PROMPTS.map((p) => p.id)).size, 100);
  for (const p of PROMPTS) {
    assert(p.title.endsWith("?"));
    assert(p.decoys.length >= 4 && p.wildcards.length >= 4, p.id);
    const options = [...p.decoys, ...p.wildcards];
    assert.equal(
      new Set(options.map((v) => v.toLowerCase())).size,
      options.length,
      p.id,
    );
    assert(
      options.every((v) => v.length >= 2 && v.length <= 120),
      p.id,
    );
  }
});
test("each age gets three eligible questions and broad variation across deterministic seeds", () => {
  for (const age of ["child", "teen", "adult", "adult26"]) {
    const seen = new Set();
    for (let n = 0; n < 16; n++) {
      const { room, token } = newRoom("Host", false, at, age);
      room.promptSeed = `selection-test-${n}`;
      room.players[0].id = "fixed-player";
      room.hostId = "fixed-player";
      const selected = ids(room, token);
      assert.equal(selected.length, 3);
      assert.equal(new Set(selected).size, 3);
      const pool = promptPoolForPlayer(room.players[0], room);
      assert(pool.length >= 40);
      assert(selected.every((id) => pool.some((p) => p.id === id)));
      selected.forEach((id) => seen.add(id));
      if (age === "child" || age === "teen")
        assert(
          !selected.some(
            (id) =>
              PROMPTS.find((p) => p.id === id).silly ||
              ["first-job", "ridiculous-purchase"].includes(id),
          ),
        );
    }
    assert(seen.size > 15, `${age} needs variety`);
  }
});
test("questions stay stable on polling, reconnect, saving and starting a game", () => {
  const { room, token } = newRoom("Host", false, at, "adult");
  const guest = joinRoom(room, "Guest", at, "teen");
  const before = ids(room, token);
  assert.deepEqual(ids(structuredClone(room), token), before);
  assert.deepEqual(ids(room, token), before);
  apply(room, token, "start", {}, at);
  apply(
    room,
    token,
    "answers",
    {
      answers: [
        {
          promptId: before[0],
          truth: "My honest answer",
          lie: "My pretend answer",
        },
      ],
    },
    at,
  );
  assert.deepEqual(ids(room, token), before);
  const guestView = snapshot(room, guest, at);
  assert(!JSON.stringify(guestView).includes("promptHistory"));
  assert(!JSON.stringify(guestView).includes("promptSeed"));
});
test("replay chooses fresh questions and rebuilds matching simulated answers", () => {
  const { room, token } = newRoom("Host", true, at, "adult26");
  const before = new Map(
    room.players.map((p) => [p.id, promptsForPlayer(p, room).map((q) => q.id)]),
  );
  room.phase = "finished";
  const oldSeed = room.promptSeed;
  apply(room, token, "replay", {}, at);
  assert.notEqual(room.promptSeed, oldSeed);
  for (const p of room.players) {
    const next = promptsForPlayer(p, room).map((q) => q.id);
    assert(next.every((id) => !before.get(p.id).includes(id)));
    if (p.bot) {
      assert.equal(p.answers.length, 3);
      assert(p.submitted);
      assert(p.answers.every((a) => next.includes(a.promptId)));
    } else assert.deepEqual(p.answers, []);
  }
});
test("device history avoids repeating any question until the appropriate pool is exhausted", () => {
  let history = [];
  const shown = [];
  for (let n = 0; n < 16; n++) {
    const { room, token } = newRoom("Host", true, at, "adult26", history);
    const selected = ids(room, token);
    assert(selected.every((id) => !shown.includes(id)));
    shown.push(...selected);
    history = normalisePromptHistory([...history, ...selected]);
  }
  assert.equal(new Set(shown).size, 48);
  const next = newRoom("Host", true, at, "adult26", history);
  assert.deepEqual(ids(next.room, next.token), shown.slice(0, 3));
});
test("recent history is validated and cannot force adult questions into a child's set", () => {
  assert.deepEqual(normalisePromptHistory({ bad: true }), []);
  assert.deepEqual(
    normalisePromptHistory(["first-job", null, "not-a-question", "first-job"]),
    ["first-job"],
  );
  const { room, token } = newRoom("Child", false, at, "child", [
    "first-job",
    "ridiculous-purchase",
  ]);
  assert(!ids(room, token).includes("first-job"));
  assert(!ids(room, token).includes("ridiculous-purchase"));
  const guest = joinRoom(room, "Guest", at, "child", ids(room, token));
  assert(ids(room, guest).every((id) => !ids(room, token).includes(id)));
});
test("a valid but unassigned question cannot be submitted by changing a request", () => {
  const { room, token } = newRoom("Host", false, at, "adult");
  joinRoom(room, "Guest", at, "adult");
  apply(room, token, "start", {}, at);
  const selected = ids(room, token);
  const hidden = promptPoolForPlayer(room.players[0], room).find(
    (p) => !selected.includes(p.id),
  );
  assert.throws(
    () =>
      apply(
        room,
        token,
        "answers",
        {
          answers: [
            {
              promptId: hidden.id,
              truth: "Actual answer",
              lie: "Invented answer",
            },
          ],
        },
        at,
      ),
    /supported prompts/,
  );
});
test("all 100 banks support answer generation and a decoy swap, even for outrageous truths", () => {
  for (const prompt of PROMPTS) {
    const age =
      prompt.silly ||
      ["ridiculous-purchase", "pointless-rivalry", "terrible-excuse"].includes(
        prompt.id,
      )
        ? "adult26"
        : (prompt.audiences?.[0] ??
          (["favourite-food", "free-time", "dream-pet"].includes(prompt.id)
            ? "child"
            : ["school-subject", "dream-skill"].includes(prompt.id)
              ? "teen"
              : "adult"));
    const { room, token } = newRoom("Host", false, at, age);
    joinRoom(room, "Guest", at, age);
    room.players[0].promptHistory = promptPoolForPlayer(room.players[0], room)
      .filter((p) => p.id !== prompt.id)
      .map((p) => p.id);
    assert(ids(room, token).includes(prompt.id), prompt.id);
    apply(room, token, "start", {}, at);
    apply(
      room,
      token,
      "answers",
      {
        answers: [
          {
            promptId: prompt.id,
            truth: prompt.wildcards[0],
            lie: prompt.wildcards[1],
          },
        ],
      },
      at,
    );
    apply(room, token, "reroll", { promptId: prompt.id }, at);
    assert.equal(
      new Set([
        prompt.wildcards[0],
        prompt.wildcards[1],
        ...room.players[0].answers[0].decoys,
      ]).size,
      4,
      prompt.id,
    );
  }
});
test("already-saved rooms retain their original questions until replay", () => {
  const { room, token } = newRoom("Host", false, at, "adult");
  delete room.promptSeed;
  joinRoom(room, "Guest", at, "adult");
  assert.deepEqual(ids(room, token), ["first-job", "unexpected", "fear"]);
  apply(room, token, "start", {}, at);
  assert.deepEqual(ids(room, token), ["first-job", "unexpected", "fear"]);
  room.phase = "finished";
  apply(room, token, "replay", {}, at);
  assert(
    ids(room, token).every(
      (id) => !["first-job", "unexpected", "fear"].includes(id),
    ),
  );
});

test("new demo bots avoid the questions already seen on the device", () => {
  const recent = promptPoolForPlayer(
    { ageGroup: "adult26" },
    { players: [{ ageGroup: "adult26" }] },
  )
    .slice(0, 12)
    .map((p) => p.id);
  const { room, token } = newRoom("Host", true, at, null, recent);
  apply(room, token, "profile", { ageGroup: "adult26" }, at);
  for (const player of room.players)
    assert(promptsForPlayer(player, room).every((p) => !recent.includes(p.id)));
});
