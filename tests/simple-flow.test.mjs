import { encodeJingleWav } from "../public/audio-format.js";
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
function setup(mode = "mixed", count = 10) {
  const { room, token } = newRoom("Mia", false, now, null);
  enableSimpleFlow(room);
  const guest = joinRoom(room, "Tumi", now, null);
  apply(room, token, "settings", { mode, totalRounds: count }, now);
  apply(room, token, "start", {}, now);
  return { room, tokens: [token, guest] };
}
test("new flow needs no age profile and keeps Party Mix mostly text with fair text turns", () => {
  for (let i = 0; i < 12; i++) {
    const { room } = setup("mixed", 30);
    assert.equal(room.queue.length, 30);
    assert.equal(room.queue.filter((q) => q.type === "truth").length, 21);
    assert.equal(room.queue.filter((q) => q.type === "face").length, 3);
    assert.equal(room.queue.filter((q) => q.type === "doodle").length, 3);
    const totals = room.players.map(
      (p) =>
        room.queue.filter((q) => q.type === "truth" && q.playerId === p.id)
          .length,
    );
    assert(Math.abs(totals[0] - totals[1]) <= 1);
    assert(!room.queue.some((q) => q.promptId === "first-job"));
    assert(room.players.every((p) => p.ageGroup === null));
  }
});
test("one truth question is authored, voted, revealed and acknowledged before the next", () => {
  const { room, tokens } = setup("classic", 5);
  for (let index = 0; index < 5; index++) {
    assert.equal(room.phase, "writing");
    assert.equal(room.questionIndex, index);
    const q = room.queue[index],
      author = room.players.findIndex((p) => p.id === q.playerId),
      voter = 1 - author;
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
  assert.equal(room.results.length, 5);
});
test("new prompt pool is broad, shared without age, and excludes work prompts", () => {
  const { room } = setup();
  const pool = promptPoolForPlayer(room.players[0], room);
  assert.equal(pool.length, 99);
  assert(pool.every((p) => p.id !== "first-job"));
  assert.deepEqual(pool, promptPoolForPlayer(room.players[1], room));
});
test("round count is validated for the two public game modes", () => {
  for (const mode of ["classic", "mixed"]) {
    const { room } = setup(mode, 20);
    assert.equal(room.queue.length, 20);
    if (mode === "classic") assert(room.queue.every((q) => q.type === "truth"));
    else
      assert.deepEqual([...new Set(room.queue.map((q) => q.type))].sort(), [
        "audio",
        "doodle",
        "face",
        "truth",
      ]);
  }
  const { room, token } = newRoom("Mia", false, now, null);
  enableSimpleFlow(room);
  for (const totalRounds of [0, 2, 6, 25, 31, 6.5])
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
  const { room, tokens } = setup("mixed", 10);
  let clock = now;
  const image = "data:image/jpeg;base64,/9j/2Q==";
  for (let round = 0; round < 10; round++) {
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
      } else if (q.type === "audio") {
        const clip =
          "data:audio/wav;base64," +
          Buffer.from(
            encodeJingleWav([new Float32Array(12000)], 12000),
          ).toString("base64");
        for (const token of tokens)
          apply(room, token, "audio", { questionId: q.id, clip }, clock);
      } else
        for (const token of tokens)
          apply(room, token, "photo", { questionId: q.id, image }, clock);
      assert.equal(room.phase, "judging");
      for (let i = 0; i < 2; i++) {
        const other = 1 - i;
        if (["doodle", "audio"].includes(q.type) || other !== author)
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

test("new rooms only accept the two public modes and old standalone lobbies switch to Party Mix", () => {
  const { room, token } = newRoom("Mia", false, now, null);
  enableSimpleFlow(room);
  for (const mode of ["faces", "doodles", "video", "silly"])
    assert.throws(
      () => apply(room, token, "settings", { mode }, now),
      /Truth & Lies or Party Mix/,
    );
  for (const mode of ["faces", "doodles"]) {
    room.settings.mode = mode;
    tick(room, now);
    assert.equal(room.settings.mode, "mixed");
  }
  const game = setup("mixed", 10);
  game.room.settings.mode = "faces";
  const queue = JSON.stringify(game.room.queue);
  tick(game.room, now);
  assert.equal(game.room.settings.mode, "faces");
  assert.equal(JSON.stringify(game.room.queue), queue);
  game.room.phase = "finished";
  apply(game.room, game.tokens[0], "replay", {}, now);
  assert.equal(game.room.settings.mode, "mixed");
});
