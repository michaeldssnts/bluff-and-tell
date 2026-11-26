import test from "node:test";
import assert from "node:assert/strict";
import {
  newRoom,
  joinRoom,
  enableSimpleFlow,
  apply,
  snapshot,
  audioFor,
  tick,
} from "../server/engine.mjs";
import {
  encodeJingleWav,
  jingleDuration,
  MAX_AUDIO_DATA_LENGTH,
} from "../public/audio-format.js";
const now = 1800000000000;
const wav = (seconds = 1) =>
  encodeJingleWav(
    [
      Float32Array.from(
        { length: 48000 * seconds },
        (_, i) => Math.sin(i / 20) * 0.4,
      ),
    ],
    48000,
  );
const clip = (seconds) =>
  "data:audio/wav;base64," + Buffer.from(wav(seconds)).toString("base64");
// The fixture uses a finished earlier round to advance without inventing recordings or answers.
function audioRoom(n = 3) {
  const { room, token } = newRoom("Host", false, now, null);
  enableSimpleFlow(room);
  const tokens = [token];
  for (let i = 1; i < n; i++)
    tokens.push(joinRoom(room, "Player " + i, now, null));
  apply(room, token, "start", {}, now);
  const target = room.queue.findIndex((q) => q.type === "audio");
  room.questionIndex = target - 1;
  room.phase = "reveal";
  apply(room, token, "next", {}, now);
  return { room, tokens, q: room.queue[room.questionIndex] };
}
test("recordings become bounded, mono WAV that can play across recording formats", () => {
  for (const rate of [8000, 44100, 48000]) {
    const bytes = encodeJingleWav(
      [new Float32Array(rate * 7), new Float32Array(rate * 7)],
      rate,
    );
    assert.equal(jingleDuration(bytes), 5);
    assert(bytes.length <= 120044);
    assert(
      "data:audio/wav;base64,".length +
        Buffer.from(bytes).toString("base64").length <=
        MAX_AUDIO_DATA_LENGTH,
    );
  }
  assert.throws(() => encodeJingleWav([new Float32Array(10)], 48000));
  const damaged = wav();
  damaged[20] = 2;
  assert.throws(() => jingleDuration(damaged));
});
test("audio stays private until everyone submits, then votes score and clips clear on next", () => {
  const { room, tokens, q } = audioRoom();
  assert.equal(room.phase, "recording");
  for (let i = 0; i < tokens.length; i++) {
    apply(room, tokens[i], "audio", { questionId: q.id, clip: clip(1) }, now);
    if (i < tokens.length - 1) {
      assert.equal(room.phase, "recording");
      const other = audioFor(room, tokens[i + 1], now);
      assert(!Object.keys(other.clips).includes(room.players[i].id));
      assert.equal(Object.keys(audioFor(room, tokens[i], now).clips).length, 1);
    }
  }
  assert.equal(room.phase, "judging");
  assert.equal(Object.keys(audioFor(room, tokens[0], now).clips).length, 3);
  const publicView = JSON.stringify(snapshot(room, tokens[0], now));
  assert(!publicView.includes("data:audio"));
  assert.throws(
    () =>
      apply(
        room,
        tokens[0],
        "face-vote",
        { questionId: q.id, playerId: room.players[0].id },
        now,
      ),
    /own/,
  );
  tokens.forEach((token, i) =>
    apply(
      room,
      token,
      "face-vote",
      { questionId: q.id, playerId: room.players[(i + 1) % 3].id },
      now,
    ),
  );
  tick(room, now + 4000);
  assert.equal(room.phase, "reveal");
  assert(room.players.every((p) => p.score === 2));
  tokens.forEach((token) => apply(room, token, "ready-next", {}, now + 4000));
  assert.deepEqual(room.clips, {});
  assert(!JSON.stringify(room).includes("data:audio"));
});
test("full-size five-second clips fit an eight-player room and are not returned in polling", () => {
  const { room, tokens, q } = audioRoom(8);
  const full = clip(5);
  tokens.forEach((token) =>
    apply(room, token, "audio", { questionId: q.id, clip: full }, now),
  );
  assert.equal(room.phase, "judging");
  assert.equal(Object.keys(room.clips).length, 8);
  assert(JSON.stringify(snapshot(room, tokens[0], now)).length < 20000);
  assert(JSON.stringify(room).length < 2000000);
});
test("bad, oversized, stale and unauthorised jingles are rejected", () => {
  const { room, tokens, q } = audioRoom();
  for (const bad of [
    "https://example.com/clip.wav",
    "data:audio/wav;base64,QUJD",
    "data:audio/wav;base64," + "A".repeat(MAX_AUDIO_DATA_LENGTH),
  ])
    assert.throws(() =>
      apply(room, tokens[0], "audio", { questionId: q.id, clip: bad }, now),
    );
  assert.throws(() =>
    apply(room, tokens[0], "audio", { questionId: "old", clip: clip(1) }, now),
  );
  assert.throws(() => audioFor(room, "not-a-player", now));
  apply(room, tokens[0], "audio", { questionId: q.id, clip: clip(1) }, now);
  const audio = Buffer.from(wav());
  audio.writeUInt32LE(1000, 24);
  assert.throws(() =>
    apply(
      room,
      tokens[1],
      "audio",
      {
        questionId: q.id,
        clip: "data:audio/wav;base64," + audio.toString("base64"),
      },
      now,
    ),
  );
});
test("denied microphones can skip without trapping the room; the host can close recording", () => {
  const { room, tokens, q } = audioRoom();
  tokens.forEach((token) =>
    apply(room, token, "skip-audio", { questionId: q.id }, now),
  );
  assert.equal(room.phase, "reveal");
  assert.deepEqual(room.results.at(-1).copies, []);
  const another = audioRoom();
  apply(
    another.room,
    another.tokens[0],
    "audio",
    { questionId: another.q.id, clip: clip(1) },
    now,
  );
  apply(another.room, another.tokens[0], "next", {}, now);
  assert.equal(another.room.phase, "judging");
});
