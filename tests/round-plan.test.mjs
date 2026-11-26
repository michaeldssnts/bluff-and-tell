import test from "node:test";
import assert from "node:assert/strict";
import { fairRoundPlan } from "../server/round-plan.mjs";
import { partyMixCounts, GAME_LENGTHS } from "../public/game-options.js";

test("requested 70/10/10/10 mix is exact for 10,20,30; audio can be excluded explicitly", () => {
  for (const count of [10, 20, 30]) {
    assert.deepEqual(partyMixCounts(count, true), {
      truth: count * 0.7,
      face: count * 0.1,
      doodle: count * 0.1,
      audio: count * 0.1,
    });
    assert.deepEqual(partyMixCounts(count, false), {
      truth: count * 0.8,
      face: count * 0.1,
      doodle: count * 0.1,
      audio: 0,
    });
  }
  for (let variant = 0; variant < 3; variant++) {
    const small = partyMixCounts(5, false, variant);
    assert.equal(small.truth, 4);
    assert.equal(small.face + small.doodle, 1);
  }
});
test("all player counts and game lengths balance overall turns AND each activity within one", () => {
  for (let n = 2; n <= 8; n++)
    for (const count of GAME_LENGTHS)
      for (let offset = 0; offset < n; offset++)
        for (const mode of ["mixed", "classic", "faces", "doodles"]) {
          const ids = Array.from({ length: n }, (_, i) => `player-${i}`);
          const plan = fairRoundPlan(ids, count, mode, {
            offset,
            variant: offset,
          });
          assert.equal(plan.rounds.length, count);
          for (const type of [null, "truth", "face", "doodle", "audio"]) {
            const turns = ids.map(
              (id) =>
                plan.rounds.filter(
                  (q) => q.playerId === id && (!type || q.type === type),
                ).length,
            );
            assert(
              Math.max(...turns) - Math.min(...turns) <= 1,
              `${mode}, ${n} players, ${count} rounds, ${type}`,
            );
          }
          for (const [type, total] of Object.entries(plan.counts))
            assert.equal(
              plan.rounds.filter((q) => q.type === type).length,
              total,
            );
        }
});
test("four players share seven text questions with at most one turn difference", () => {
  const ids = ["A", "B", "C", "D"];
  const { rounds } = fairRoundPlan(ids, 10, "mixed");
  assert.deepEqual(
    ids.map(
      (id) =>
        rounds.filter((q) => q.playerId === id && q.type === "truth").length,
    ),
    [2, 2, 2, 1],
  );
  assert.equal(rounds[0].type, "truth");
});
test("rematches rotate the people who receive the extra text turn", () => {
  const ids = ["A", "B", "C"];
  let offset = 0;
  const turns = { A: 0, B: 0, C: 0 };
  for (let i = 0; i < 3; i++) {
    const plan = fairRoundPlan(ids, 10, "mixed", { offset });
    offset = plan.nextOffset;
    plan.rounds
      .filter((q) => q.type === "truth")
      .forEach((q) => turns[q.playerId]++);
  }
  assert.deepEqual(Object.values(turns), [7, 7, 7]);
});
