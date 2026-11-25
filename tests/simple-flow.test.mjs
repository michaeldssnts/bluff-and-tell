import test from "node:test";
import assert from "node:assert/strict";
import {
  newRoom,
  joinRoom,
  enableSimpleFlow,
  apply,
  snapshot,
  tick,
} from "../server/engine.mjs";
import { promptPoolForPlayer } from "../server/prompts.mjs";
const now = 1800000000000;
function setup(mode = "mixed", count = 6) {
  const { room, token } = newRoom("Mia", false, now, null);
  enableSimpleFlow(room);
  const guest = joinRoom(room, "Tumi", now, null);
  apply(room, token, "settings", { mode, totalRounds: count }, now);
  apply(room, token, "start", {}, now);
  return { room, tokens: [token, guest] };
}
test("new flow needs no age profile and mixes all activities in balanced trios", () => {
  for (let i = 0; i < 12; i++) {
    const { room } = setup("mixed", 12);
    assert.equal(room.queue.length, 12);
    for (let j = 0; j < 12; j += 3)
      assert.deepEqual(
        new Set(room.queue.slice(j, j + 3).map((q) => q.type)),
        new Set(["truth", "face", "doodle"]),
      );
    assert(
      room.queue.every((q, i) => i === 0 || q.type !== room.queue[i - 1].type),
    );
    assert(room.queue.every((q, i) => q.playerId === room.players[i % 2].id));
    assert(!room.queue.some((q) => q.promptId === "first-job"));
    assert(room.players.every((p) => p.ageGroup === null));
  }
});
test("one truth question is authored, voted, revealed and acknowledged before the next", () => {
  const { room, tokens } = setup("classic", 6);
  for (let index = 0; index < 6; index++) {
    assert.equal(room.phase, "writing");
    assert.equal(room.questionIndex, index);
    const author = index % 2,
      voter = 1 - author,
      q = room.queue[index];
    const view = snapshot(room, tokens[author], now);
    assert.equal(view.prompts.length, 1);
    assert.equal(view.question.number, index + 1);
    assert.equal(snapshot(room, tokens[voter], now).prompts.length, 0);
    assert.throws(() =>
      apply(
        room,
        tokens[voter],
        "answers",
        { answers: [], submitted: true },
        now,
      ),
    );
    const answer = {
      promptId: q.promptId,
      truth: "My real answer",
      lie: "A goose stole my homework",
    };
    apply(
      room,
      tokens[author],
      "answers",
      { answers: [answer], submitted: false },
      now,
    );
    assert.equal(room.phase, "writing");
    apply(
      room,
      tokens[author],
      "answers",
      { answers: [answer], submitted: true },
      now,
    );
    assert.equal(room.phase, "voting");
    assert.equal(room.queue[index].id, q.id);
    const ballot = snapshot(room, tokens[voter], now);
    assert.equal(ballot.question.options.length, 4);
    assert(ballot.question.options.every((o) => !("kind" in o)));
    apply(
      room,
      tokens[voter],
      "vote",
      { questionId: q.id, optionId: q.options[0].id },
      now,
    );
    tick(room, now + 10000);
    assert.equal(room.phase, "reveal");
    assert.equal(room.questionIndex, index);
    apply(room, tokens[0], "ready-next", {}, now + 10000);
    assert.equal(room.phase, "reveal");
    apply(room, tokens[1], "ready-next", {}, now + 10000);
  }
  assert.equal(room.phase, "finished");
  assert.equal(room.results.length, 6);
});
test("new prompt pool is broad, shared without age, and excludes work prompts", () => {
  const { room } = setup();
  const pool = promptPoolForPlayer(room.players[0], room);
  assert.equal(pool.length, 99);
  assert(pool.every((p) => p.id !== "first-job"));
  assert.deepEqual(pool, promptPoolForPlayer(room.players[1], room));
});
test("round count is validated and each single activity mode honours it", () => {
  for (const [mode, type] of [
    ["faces", "face"],
    ["doodles", "doodle"],
    ["classic", "truth"],
  ]) {
    const { room } = setup(mode, 9);
    assert.equal(room.queue.length, 9);
    assert(room.queue.every((q) => q.type === type));
  }
  const { room, token } = newRoom("Mia", false, now, null);
  enableSimpleFlow(room);
  for (const totalRounds of [0, 2, 25, 6.5])
    assert.throws(() => apply(room, token, "settings", { totalRounds }, now));
});
test("demo completes sequential questions and replay keeps the simpler lobby", () => {
  const { room, token } = newRoom("Mia", true, now, null);
  enableSimpleFlow(room);
  apply(room, token, "start", {}, now);
  assert.equal(room.phase, "writing");
  const q = room.queue[0];
  apply(
    room,
    token,
    "answers",
    {
      answers: [{ promptId: q.promptId, truth: "Real", lie: "Fake" }],
      submitted: true,
    },
    now,
  );
  tick(room, now + 10000);
  tick(room, now + 20000);
  assert.equal(room.phase, "reveal");
  apply(room, token, "ready-next", {}, now + 20000);
  assert.equal(room.phase, "voting");
  assert.equal(room.questionIndex, 1);
});

test("a two-player party mix completes photos, drawings and truths without skipping results", () => {
  const { room, tokens } = setup("mixed", 6);
  let clock = now;
  const image = "data:image/jpeg;base64,/9j/2Q==";
  for (let round = 0; round < 6; round++) {
    const q = room.queue[round],
      author = room.players.findIndex((p) => p.id === q.playerId);
    if (q.type === "truth") {
      apply(
        room,
        tokens[author],
        "answers",
        {
          answers: [
            {
              promptId: q.promptId,
              truth: "Something real",
              lie: "A suspicious goose",
            },
          ],
          submitted: true,
        },
        clock,
      );
      const voter = 1 - author;
      apply(
        room,
        tokens[voter],
        "vote",
        { questionId: q.id, optionId: q.options[0].id },
        clock,
      );
    } else {
      if (q.type === "face") {
        apply(
          room,
          tokens[author],
          "photo",
          { questionId: q.id, image },
          clock,
        );
        assert.equal(room.phase, "copying");
        apply(
          room,
          tokens[1 - author],
          "photo",
          { questionId: q.id, image },
          clock,
        );
      } else
        for (const token of tokens)
          apply(room, token, "photo", { questionId: q.id, image }, clock);
      assert.equal(room.phase, "judging");
      for (let i = 0; i < 2; i++) {
        const other = 1 - i;
        if (q.type === "doodle" || other !== author)
          apply(
            room,
            tokens[i],
            "face-vote",
            { questionId: q.id, playerId: room.players[other].id },
            clock,
          );
      }
    }
    clock += 10000;
    tick(room, clock);
    assert.equal(room.phase, "reveal");
    assert.equal(room.questionIndex, round);
    assert.equal(room.results.length, round + 1);
    for (const token of tokens) apply(room, token, "ready-next", {}, clock);
  }
  assert.equal(room.phase, "finished");
  apply(room, tokens[0], "replay", {}, clock);
  assert.equal(room.phase, "lobby");
  assert.equal(room.flowVersion, 2);
  assert(room.players.every((p) => p.answers.length === 0));
});
