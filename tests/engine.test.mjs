import test from "node:test";
import assert from "node:assert/strict";
import {
  newRoom,
  joinRoom,
  apply,
  tick,
  snapshot,
  GameError,
} from "../server/engine.mjs";
import {
  PROMPTS,
  promptPoolForPlayer,
  promptsForPlayer,
} from "../server/prompts.mjs";
const at = 1800000000000;
const firstPrompt = (room, token) => snapshot(room, token, at).prompts[0].id;
function group() {
  const { room, token } = newRoom("Mia", false, at);
  const b = joinRoom(room, "Tumi", at),
    c = joinRoom(room, "Jo", at);
  return { room, tokens: [token, b, c] };
}
function prepared() {
  const g = group();
  apply(g.room, g.tokens[0], "start", {}, at);
  g.tokens.forEach((t, i) =>
    apply(
      g.room,
      t,
      "answers",
      {
        answers: [
          {
            promptId: firstPrompt(g.room, t),
            truth: "True job " + i,
            lie: "Fake job " + i,
          },
        ],
        submitted: true,
      },
      at,
    ),
  );
  apply(g.room, g.tokens[0], "begin", {}, at);
  return g;
}
function voting(g, index = 0) {
  while (g.room.questionIndex < index || g.room.phase !== "voting") {
    tick(g.room, g.room.deadline);
  }
  return g;
}
test("rooms have six-character codes and unguessable guest tokens", () => {
  const { room, token } = newRoom("Mia", false, at);
  assert.match(room.code, /^[A-Z2-9]{6}$/);
  assert.equal(token.length, 64);
  assert.equal(room.players.length, 1);
});
test("names are case-insensitively unique; rooms reject joins once started", () => {
  const g = group();
  assert.throws(() => joinRoom(g.room, "mia", at), /already taken/);
  apply(g.room, g.tokens[0], "start", {}, at);
  assert.throws(() => joinRoom(g.room, "Alex", at), /already started/);
});
test("host permissions and minimum player count are enforced server-side", () => {
  const { room, token } = newRoom("Mia", false, at);
  assert.throws(() => apply(room, token, "start", {}, at), /at least 2/);
  const g = group();
  assert.throws(
    () => apply(g.room, g.tokens[1], "start", {}, at),
    /Only the host/,
  );
});
test("snapshots do not leak tokens, someone else’s answers, or answer kinds", () => {
  const g = prepared();
  const view = snapshot(g.room, g.tokens[1], at),
    json = JSON.stringify(view);
  assert.ok(!json.includes(g.tokens[0]));
  assert.ok(!json.includes('"kind"'));
  assert.ok(!json.includes('"truthId"'));
  assert.equal(view.ownAnswers[0].truth, "True job 1");
  assert.equal(view.players[0].answers, undefined);
  assert.equal(view.history, null);
});
test("truth and lie must differ even with punctuation and casing changes", () => {
  const g = group();
  apply(g.room, g.tokens[0], "start", {}, at);
  assert.throws(
    () =>
      apply(
        g.room,
        g.tokens[0],
        "answers",
        {
          answers: [
            {
              promptId: firstPrompt(g.room, g.tokens[0]),
              truth: "A Café!",
              lie: "a café",
            },
          ],
        },
        at,
      ),
    /must be different/,
  );
});
test("each player gets the same number of questions when submissions are incomplete", () => {
  const g = prepared();
  assert.equal(g.room.queue.length, 3);
  for (const p of g.room.players)
    assert.equal(g.room.queue.filter((q) => q.playerId === p.id).length, 1);
});
test("cannot start questions while a player has no complete answer", () => {
  const g = group();
  apply(g.room, g.tokens[0], "start", {}, at);
  assert.throws(
    () => apply(g.room, g.tokens[0], "begin", {}, at),
    /Everyone needs/,
  );
  tick(g.room, g.room.deadline);
  assert.equal(g.room.phase, "writing");
  assert.equal(g.room.deadline, null);
  assert.equal(g.room.needsAnswers, true);
});
test("pause freezes deadlines, blocks votes, and resume preserves remaining time", () => {
  const g = voting(prepared()),
    deadline = g.room.deadline;
  apply(g.room, g.tokens[0], "pause", {}, deadline - 10000);
  tick(g.room, deadline + 100000);
  assert.equal(g.room.phase, "voting");
  assert.equal(g.room.pausedRemaining, 10000);
  assert.throws(
    () => apply(g.room, g.tokens[1], "vote", {}, deadline),
    /paused/,
  );
  apply(g.room, g.tokens[0], "pause", {}, deadline + 100000);
  assert.equal(g.room.deadline, deadline + 110000);
});
test("featured players cannot vote; unknown and stale question options are rejected", () => {
  const g = voting(prepared()),
    q = g.room.queue[0];
  assert.throws(
    () =>
      apply(
        g.room,
        g.tokens[0],
        "vote",
        { questionId: q.id, optionId: q.options[0].id },
        g.room.deadline - 1000,
      ),
    /own question/,
  );
  assert.throws(
    () =>
      apply(
        g.room,
        g.tokens[1],
        "vote",
        { questionId: "old", optionId: q.options[0].id },
        g.room.deadline - 1000,
      ),
    /previous question/,
  );
  assert.throws(
    () =>
      apply(
        g.room,
        g.tokens[1],
        "vote",
        { questionId: q.id, optionId: "bad" },
        g.room.deadline - 1000,
      ),
    /Choose an option/,
  );
});
test("votes stay private and can be changed until the deadline", () => {
  const g = voting(prepared()),
    q = g.room.queue[0],
    when = g.room.deadline - 10000;
  apply(
    g.room,
    g.tokens[1],
    "vote",
    { questionId: q.id, optionId: q.options[0].id },
    when,
  );
  const view = snapshot(g.room, g.tokens[2], when);
  assert.equal(view.myVote, null);
  assert.equal(view.votedCount, 1);
  assert.equal(view.result, null);
  assert.equal(view.votes, undefined);
  apply(
    g.room,
    g.tokens[1],
    "vote",
    { questionId: q.id, optionId: q.options[1].id },
    when + 100,
  );
  assert.equal(g.room.votes[g.room.players[1].id], q.options[1].id);
});
test("truth earns two points; only the authored lie earns bluff points, exactly once", () => {
  const g = voting(prepared()),
    q = g.room.queue[0],
    when = g.room.deadline - 10000,
    truth = q.options.find((o) => o.kind === "truth"),
    lie = q.options.find((o) => o.kind === "lie");
  apply(
    g.room,
    g.tokens[1],
    "vote",
    { questionId: q.id, optionId: truth.id },
    when,
  );
  apply(
    g.room,
    g.tokens[2],
    "vote",
    { questionId: q.id, optionId: lie.id },
    when,
  );
  assert.equal(g.room.deadline, when + 3000);
  tick(g.room, when + 3000);
  assert.equal(g.room.phase, "reveal");
  assert.deepEqual(
    g.room.players.map((p) => p.score),
    [1, 2, 0],
  );
  tick(g.room, when + 3001);
  assert.deepEqual(
    g.room.players.map((p) => p.score),
    [1, 2, 0],
  );
  const view = snapshot(g.room, g.tokens[1], when + 3001);
  assert.equal(view.result.truthId, truth.id);
  assert.equal(view.result.picks.length, 2);
});
test("late votes are rejected and missing votes score zero", () => {
  const g = voting(prepared()),
    q = g.room.queue[0],
    end = g.room.deadline;
  assert.throws(
    () =>
      apply(
        g.room,
        g.tokens[1],
        "vote",
        { questionId: q.id, optionId: q.options[0].id },
        end,
      ),
    /not open/,
  );
  assert.ok(g.room.players.every((p) => p.score === 0));
});
test("timed phases catch up after every client disconnects", () => {
  const g = prepared();
  tick(g.room, at + 3600000);
  assert.equal(g.room.phase, "finished");
  assert.equal(g.room.results.length, 3);
});
test("expired and invalid sessions cannot read a room", () => {
  const g = group();
  assert.throws(
    () => snapshot(g.room, "wrong", at),
    (e) => e.status === 401,
  );
  assert.throws(
    () => snapshot(g.room, g.tokens[0], at + 25 * 3600000),
    (e) => e.status === 404,
  );
});
test("demo is explicitly labelled and its extra players are bots", () => {
  const { room, token } = newRoom("Mia", true, at);
  const view = snapshot(room, token, at);
  assert.equal(view.demo, true);
  assert.equal(view.players.filter((p) => p.bot).length, 3);
});
test("replay resets scores, votes, answers and readiness", () => {
  const g = prepared();
  tick(g.room, at + 3600000);
  apply(g.room, g.tokens[0], "replay", {}, at + 3600001);
  assert.equal(g.room.phase, "lobby");
  assert.equal(g.room.results.length, 0);
  assert.ok(
    g.room.players.every(
      (p) => p.score === 0 && p.answers.length === 0 && !p.submitted,
    ),
  );
});
test("host can hand over control, but guests cannot", () => {
  const g = group();
  assert.throws(
    () =>
      apply(
        g.room,
        g.tokens[1],
        "transfer",
        { playerId: g.room.players[1].id },
        at,
      ),
    /Only the host/,
  );
  apply(
    g.room,
    g.tokens[0],
    "transfer",
    { playerId: g.room.players[1].id },
    at,
  );
  assert.equal(g.room.hostId, g.room.players[1].id);
});
test("four answer options are unique and shuffled without exposing their kinds", () => {
  const g = prepared(),
    q = g.room.queue[0];
  assert.equal(new Set(q.options.map((o) => o.text)).size, 4);
  assert.equal(q.options.filter((o) => o.kind === "truth").length, 1);
  assert.equal(q.options.filter((o) => o.kind === "lie").length, 1);
  assert.equal(q.options.filter((o) => o.kind === "wildcard").length, 1);
});
test("authors can review and swap decoys without changing their true answer", () => {
  const g = prepared();
  const p = g.room.players[0],
    before = [...p.answers[0].decoys];
  g.room.phase = "writing";
  g.room.deadline = at + 60000;
  apply(g.room, g.tokens[0], "reroll", { promptId: p.answers[0].promptId }, at);
  assert.equal(p.answers[0].truth, "True job 0");
  assert.ok(p.answers[0].decoys.every((x) => !before.includes(x)));
  const own = snapshot(g.room, g.tokens[0], at),
    other = snapshot(g.room, g.tokens[1], at);
  assert.deepEqual(own.ownAnswers[0].decoys, p.answers[0].decoys);
  assert.equal(other.ownAnswers[0].truth, "True job 1");
  apply(g.room, g.tokens[0], "begin", {}, at);
  assert.ok(
    g.room.queue[0].options.some((o) => o.text === p.answers[0].decoys[0]),
  );
  assert.throws(
    () =>
      apply(
        g.room,
        g.tokens[0],
        "reroll",
        { promptId: p.answers[0].promptId },
        at,
      ),
    /locked/,
  );
});
test("host recovery is unavailable until the host has been away for 90 seconds", () => {
  const g = group();
  assert.throws(
    () => apply(g.room, g.tokens[1], "claim-host", {}, at + 80000),
    /still connected/,
  );
  apply(g.room, g.tokens[1], "claim-host", {}, at + 91000);
  assert.equal(g.room.hostId, g.room.players[1].id);
  assert.equal(snapshot(g.room, g.tokens[1], at + 91000).hostAway, false);
});

test("mixed-age players receive their own suitable prompts without exposing age groups", () => {
  const { room, token } = newRoom("Parent", false, at, "adult");
  const child = joinRoom(room, "Robin", at, "child"),
    teen = joinRoom(room, "Taylor", at, "teen");
  const view = (t) => snapshot(room, t, at);
  for (const [t, ageGroup] of [
    [child, "child"],
    [teen, "teen"],
    [token, "adult"],
  ]) {
    assert.equal(view(t).prompts.length, 3);
    const allowed = new Set(promptPoolForPlayer({ ageGroup }).map((p) => p.id));
    assert.ok(view(t).prompts.every((p) => allowed.has(p.id)));
  }
  assert.equal(view(child).ageGroup, "child");
  assert.ok(view(child).players.every((p) => !("ageGroup" in p)));
  assert.ok(view(child).prompts.every((p) => !("decoys" in p)));
});
test("children cannot submit adult prompts by changing a request", () => {
  const { room, token } = newRoom("Robin", false, at, "child");
  joinRoom(room, "Parent", at, "adult");
  joinRoom(room, "Taylor", at, "teen");
  apply(room, token, "start", {}, at);
  assert.throws(
    () =>
      apply(
        room,
        token,
        "answers",
        {
          ageGroup: "adult",
          answers: [
            { promptId: "first-job", truth: "Cafe", lie: "Babysitting" },
          ],
        },
        at,
      ),
    /supported prompts/,
  );
  apply(
    room,
    token,
    "answers",
    {
      answers: [
        { promptId: firstPrompt(room, token), truth: "Pizza", lie: "Pancakes" },
      ],
      submitted: true,
    },
    at,
  );
  assert.equal(room.players[0].answers[0].promptId, firstPrompt(room, token));
});
test("a complete mixed-age game builds and scores questions from all three sets", () => {
  const { room, token } = newRoom("Parent", false, at, "adult");
  const child = joinRoom(room, "Robin", at, "child"),
    teen = joinRoom(room, "Taylor", at, "teen");
  apply(room, token, "start", {}, at);
  const selections = [token, child, teen].map((t) => [t, firstPrompt(room, t)]);
  for (const [t, promptId] of selections)
    apply(
      room,
      t,
      "answers",
      {
        answers: [
          { promptId, truth: "My actual answer", lie: "My pretend answer" },
        ],
        submitted: true,
      },
      at,
    );
  apply(room, token, "begin", {}, at);
  assert.deepEqual(
    room.queue.map((q) => q.promptId),
    selections.map(([, id]) => id),
  );
  for (const q of room.queue)
    assert.equal(new Set(q.options.map((o) => o.text)).size, 4);
  tick(room, at + 3600000);
  assert.equal(room.phase, "finished");
  assert.equal(room.results.length, 3);
});
test("unsupported age groups are rejected and saved legacy rooms retain their prompts", () => {
  assert.throws(() => newRoom("Robin", false, at, "anything"), /age group/);
  const { room, token } = newRoom("Parent", false, at, "adult");
  delete room.players[0].ageGroup;
  assert.ok(
    snapshot(room, token, at).prompts.some((p) => p.id === "first-job"),
  );
});
test("child and teen demo hosts still have exactly three suitable prompts", () => {
  for (const ageGroup of ["child", "teen"]) {
    const { room, token } = newRoom("Robin", true, at, ageGroup);
    assert.equal(snapshot(room, token, at).prompts.length, 3);
    assert.ok(
      room.players.filter((p) => p.bot).every((p) => p.answers.length === 3),
    );
  }
});

test("two real players can start without bots or a third player", () => {
  const { room, token } = newRoom("Spouse A", false, at);
  const partner = joinRoom(room, "Spouse B", at);
  apply(room, token, "start", {}, at);
  assert.equal(room.phase, "writing");
  assert.equal(room.players.length, 2);
  assert.ok(room.players.every((p) => !p.bot));
  assert.throws(
    () => apply(room, partner, "settings", { voting: 45 }, at),
    /Only the host/,
  );
});
test("a two-player game alternates roles, keeps votes private and scores correctly", () => {
  const { room, token } = newRoom("Spouse A", false, at),
    partner = joinRoom(room, "Spouse B", at);
  apply(room, token, "start", {}, at);
  for (const t of [token, partner])
    apply(
      room,
      t,
      "answers",
      {
        answers: [
          {
            promptId: firstPrompt(room, t),
            truth: "Working in a cafe",
            lie: "Walking dogs",
          },
        ],
        submitted: true,
      },
      at,
    );
  apply(room, token, "begin", {}, at);
  assert.equal(room.queue.length, 2);
  tick(room, room.deadline);
  tick(room, room.deadline);
  let q = room.queue[0],
    when = room.deadline - 10000;
  const lie = q.options.find((o) => o.kind === "lie"),
    truth = q.options.find((o) => o.kind === "truth");
  assert.throws(
    () =>
      apply(
        room,
        token,
        "vote",
        { questionId: q.id, optionId: truth.id },
        when,
      ),
    /own question/,
  );
  apply(room, partner, "vote", { questionId: q.id, optionId: lie.id }, when);
  assert.equal(room.deadline, when + 3000);
  assert.equal(snapshot(room, token, when).myVote, null);
  assert.equal(snapshot(room, token, when).result, null);
  tick(room, room.deadline);
  assert.deepEqual(
    room.players.map((p) => p.score),
    [1, 0],
  );
  apply(room, token, "next", {}, room.deadline - 1);
  apply(room, token, "next", {}, room.deadline - 1);
  assert.equal(room.queue[room.questionIndex].playerId, room.players[1].id);
  tick(room, room.deadline);
  tick(room, room.deadline);
  q = room.queue[1];
  when = room.deadline - 10000;
  apply(
    room,
    token,
    "vote",
    {
      questionId: q.id,
      optionId: q.options.find((o) => o.kind === "truth").id,
    },
    when,
  );
  tick(room, room.deadline);
  assert.deepEqual(
    room.players.map((p) => p.score),
    [3, 0],
  );
  apply(room, token, "next", {}, room.deadline - 1);
  apply(room, token, "next", {}, room.deadline - 1);
  assert.equal(room.phase, "finished");
  assert.equal(snapshot(room, partner, room.expiresAt - 1).history.length, 2);
});
test("the only voter can change their mind before the shortened deadline", () => {
  const { room, token } = newRoom("Spouse A", false, at),
    partner = joinRoom(room, "Spouse B", at);
  apply(room, token, "start", {}, at);
  for (const t of [token, partner])
    apply(
      room,
      t,
      "answers",
      {
        answers: [
          { promptId: firstPrompt(room, t), truth: "Cafe", lie: "Babysitting" },
        ],
      },
      at,
    );
  apply(room, token, "begin", {}, at);
  tick(room, room.deadline);
  tick(room, room.deadline);
  const q = room.queue[0],
    when = room.deadline - 10000;
  apply(
    room,
    partner,
    "vote",
    { questionId: q.id, optionId: q.options.find((o) => o.kind === "lie").id },
    when,
  );
  apply(
    room,
    partner,
    "vote",
    {
      questionId: q.id,
      optionId: q.options.find((o) => o.kind === "truth").id,
    },
    when + 1000,
  );
  assert.equal(room.deadline, when + 3000);
  tick(room, room.deadline);
  assert.deepEqual(
    room.players.map((p) => p.score),
    [0, 2],
  );
});
test("a two-player full game gives each person two questions, including mixed ages", () => {
  const { room, token } = newRoom("Parent", false, at, "adult"),
    child = joinRoom(room, "Robin", at, "child");
  apply(room, token, "settings", { questionsPerPlayer: 2 }, at);
  apply(room, token, "start", {}, at);
  for (const t of [token, child]) {
    const prompts = snapshot(room, t, at).prompts;
    apply(
      room,
      t,
      "answers",
      {
        answers: prompts.map((p) => ({
          promptId: p.id,
          truth: "My real answer",
          lie: "A made-up answer",
        })),
      },
      at,
    );
  }
  apply(room, token, "begin", {}, at);
  assert.equal(room.queue.length, 4);
  assert.deepEqual(
    room.queue.map((q) => q.playerId),
    [
      room.players[0].id,
      room.players[1].id,
      room.players[0].id,
      room.players[1].id,
    ],
  );
  tick(room, at + 3600000);
  assert.equal(room.phase, "finished");
  assert.ok(room.players.every((p) => p.score === 0));
});

test("the game waits for private age choices after players enter the room", () => {
  const { room, token } = newRoom("Host", false, at, null),
    guest = joinRoom(room, "Guest", at, null);
  assert.equal(snapshot(room, guest, at).ageGroup, null);
  assert.deepEqual(snapshot(room, guest, at).prompts, []);
  assert.throws(() => apply(room, token, "start", {}, at), /Everyone needs/);
  apply(room, token, "profile", { ageGroup: "adult26" }, at);
  apply(room, guest, "profile", { ageGroup: "teen" }, at);
  apply(room, token, "start", {}, at);
  assert.equal(room.phase, "writing");
  assert.throws(
    () => apply(room, guest, "profile", { ageGroup: "adult26" }, at),
    /locked/,
  );
});
test("all-26-plus rooms get the extra-silly pack and can finish a game", () => {
  const { room, token } = newRoom("Host", false, at, "adult26"),
    guest = joinRoom(room, "Guest", at, "adult26");
  apply(room, token, "start", {}, at);
  assert.equal(room.promptPack, "extra-silly");
  for (const t of [token, guest]) {
    const view = snapshot(room, t, at);
    assert.equal(view.prompts.length, 3);
    const allowed = new Set(
      promptPoolForPlayer({ ageGroup: "adult26" }, room).map((p) => p.id),
    );
    assert.ok(view.prompts.every((p) => allowed.has(p.id)));
    apply(
      room,
      t,
      "answers",
      {
        answers: view.prompts.map((p) => ({
          promptId: p.id,
          truth: "A tiny sofa for a pet",
          lie: "A garden gnome tuxedo",
        })),
        submitted: true,
      },
      at,
    );
  }
  apply(room, token, "begin", {}, at);
  assert.equal(room.queue.length, 2);
  tick(room, at + 3600000);
  assert.equal(room.phase, "finished");
});
test("one younger or unconfirmed player keeps a room on personal age-suitable prompts", () => {
  for (const ageGroup of ["child", "teen", "adult", null]) {
    const { room, token } = newRoom("Host", false, at, "adult26");
    joinRoom(room, "Guest", at, ageGroup);
    const view = snapshot(room, token, at);
    assert.equal(view.promptPack, "personal");
    assert.ok(!view.prompts.some((p) => p.id === "terrible-excuse"));
  }
});
test("switching a lobby profile updates pack selection and never changes another player", () => {
  const { room, token } = newRoom("Host", false, at, "adult26"),
    guest = joinRoom(room, "Guest", at, null);
  assert.equal(snapshot(room, token, at).promptPack, "personal");
  apply(
    room,
    guest,
    "profile",
    { ageGroup: "adult26", playerId: room.players[0].id },
    at,
  );
  assert.equal(snapshot(room, token, at).promptPack, "extra-silly");
  assert.equal(room.players[0].ageGroup, "adult26");
  apply(room, guest, "profile", { ageGroup: "teen" }, at);
  assert.equal(snapshot(room, token, at).promptPack, "personal");
});
test("26-plus solo demos include simulated older players and matching silly answers", () => {
  const { room, token } = newRoom("Host", true, at, null);
  apply(room, token, "profile", { ageGroup: "adult26" }, at);
  assert.equal(snapshot(room, token, at).promptPack, "extra-silly");
  assert.ok(
    room.players
      .filter((p) => p.bot)
      .every(
        (p) =>
          p.ageGroup === "adult26" &&
          p.answers.every(
            (a) =>
              promptsForPlayer(p, room).some((q) => q.id === a.promptId) &&
              PROMPTS.find((q) => q.id === a.promptId)
                .decoys.concat(
                  PROMPTS.find((q) => q.id === a.promptId).wildcards,
                )
                .includes(a.truth),
          ),
      ),
  );
  apply(room, token, "start", {}, at);
  assert.equal(room.promptPack, "extra-silly");
});
