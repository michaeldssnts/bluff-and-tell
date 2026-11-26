import test from "node:test";
import assert from "node:assert/strict";
import { rankedScores, RevealChime } from "../public/reveal-effects.js";

test("rankings order totals, preserve ties and calculate climbs from round gains", () => {
  const players = [
    { id: "a", score: 5 },
    { id: "b", score: 9 },
    { id: "c", score: 9 },
    { id: "d", score: 2 },
  ];
  const rows = rankedScores(players, { a: 0, b: 6, c: 0, d: 2 });
  assert.deepEqual(
    rows.map((p) => [p.id, p.rank, p.climbed, p.gain]),
    [
      ["b", 1, 2, 6],
      ["c", 1, 0, 0],
      ["a", 3, -1, 0],
      ["d", 4, 0, 2],
    ],
  );
  assert.equal(players[0].id, "a");
});
test("zero-point ties share first place and final rankings need no round gains", () => {
  assert.deepEqual(
    rankedScores([
      { id: "a", score: 0 },
      { id: "b", score: 0 },
    ]).map((p) => [p.rank, p.gain, p.climbed]),
    [
      [1, 0, 0],
      [1, 0, 0],
    ],
  );
});
test("chime stays silent when muted or audio has not been unlocked", () => {
  const chime = new RevealChime();
  assert.doesNotThrow(() => chime.play());
  chime.context = {
    state: "running",
    createOscillator() {
      throw Error("Must stay muted");
    },
  };
  chime.enabled = false;
  assert.doesNotThrow(() => chime.play(true));
});

test("chime schedules a short rising phrase and mute immediately silences its output", () => {
  const scheduled = [],
    output = [];
  const chime = new RevealChime();
  chime.context = {
    state: "running",
    currentTime: 10,
    destination: {},
    createGain() {
      return {
        gain: {
          setValueAtTime: (...args) => output.push(args),
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
    },
    createOscillator() {
      const note = {
        frequency: {},
        connect() {},
        disconnect() {},
        start(t) {
          scheduled.push([t, note.frequency.value]);
        },
        stop() {},
      };
      return note;
    },
  };
  chime.play();
  assert.deepEqual(
    scheduled.map((n) => n[0]),
    [10, 10.12, 10.24],
  );
  assert(
    scheduled[0][1] < scheduled[1][1] && scheduled[1][1] < scheduled[2][1],
  );
  chime.setEnabled(false);
  assert.deepEqual(output.at(-1), [0, 10]);
  chime.play();
  assert.equal(scheduled.length, 3);
});
