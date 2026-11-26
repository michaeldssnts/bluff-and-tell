import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:8787");
assert(
  ["http:", "https:"].includes(origin.protocol) &&
    !origin.username &&
    !origin.password,
);
async function call(path, data, token = "", expected = 200) {
  const reply = await fetch(new URL(path, origin), {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "User-Agent": "BluffAndTell-StagingCheck/1.0",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  assert.equal(
    reply.status,
    expected,
    `Unexpected response for ${path}: ${reply.status}`,
  );
  assert.equal(reply.headers.get("cache-control"), "no-store");
  return reply.json();
}
const health = await call("/api/health");
assert.equal(health.ok, true);
const adminPage = await fetch(new URL("/admin", origin));
assert.equal(adminPage.status, 200);
assert((await adminPage.text()).includes('id="login-form"'));
const privateUsage = await fetch(new URL("/api/admin/usage", origin));
assert(
  [401, 503].includes(privateUsage.status),
  "Admin usage must never be public",
);
assert.equal(privateUsage.headers.get("cache-control"), "no-store");
const html = await fetch(origin);
assert.equal(html.status, 200);
assert((await html.text()).includes("Bluff & Tell"));
assert(
  html.headers.get("content-security-policy")?.includes("default-src 'self'"),
);
const host = await call("/api/rooms", { name: "Check Host" }, "", 201);
const base = `/api/rooms/${host.room.code}`;
const guest = await call(base + "/join", { name: "Check Guest" });
assert.equal(host.room.prompts.length, 0);
await call(base, undefined, "", 401);
const action = (
  player,
  name,
  data = {},
  expected = 200,
  requestId = randomUUID(),
) =>
  call(
    base + "/action",
    { action: name, data, requestId },
    player.token,
    expected,
  );
await Promise.all([
  action(host, "profile", { ageGroup: "adult26" }),
  action(guest, "profile", { ageGroup: "adult26" }),
]);
await action(guest, "start", {}, 403);
const writing = await action(host, "start");
assert.equal(writing.room.phase, "writing");
assert.equal(writing.room.promptPack, "extra-silly");
assert.equal(
  writing.room.players.some((p) => "ageGroup" in p || "token" in p),
  false,
);
for (const [index, player] of [host, guest].entries()) {
  const current = await call(base, undefined, player.token);
  player.truth = `Test truth ${index}: I bought a very ordinary teaspoon`;
  player.lie = `Test lie ${index}: I bought a golden teapot`;
  player.promptId = current.room.prompts[0].id;
}
await Promise.all(
  [host, guest].map((p) =>
    action(p, "answers", {
      answers: [{ promptId: p.promptId, truth: p.truth, lie: p.lie }],
      submitted: true,
    }),
  ),
);
const view = await call(base, undefined, host.token);
assert.equal(view.room.ownAnswers.length, 1);
assert.equal(JSON.stringify(view).includes(guest.truth), false);
// Both players locked in, so the game has already started itself.
let voting = view;
for (let round = 0; round < 2; round++) {
  assert.equal(voting.room.phase, "voting");
  const q = voting.room.question;
  assert.equal(q.options.length, 4);
  assert.equal(
    q.options.some((o) => "kind" in o),
    false,
  );
  const author = q.playerId === host.room.me ? host : guest;
  const voter = author === host ? guest : host;
  const option = q.options.find((o) => o.text === author.truth);
  assert(option);
  await action(author, "vote", { questionId: q.id, optionId: option.id }, 400);
  const requestId = randomUUID();
  const vote = { questionId: q.id, optionId: option.id };
  const replies = await Promise.all([
    action(voter, "vote", vote, 200, requestId),
    action(voter, "vote", vote, 200, requestId),
  ]);
  assert.equal(replies[0].room.votedCount, 1);
  assert.equal(replies[0].room.result, null);
  await wait(Math.max(0, replies[0].room.deadline - Date.now()) + 100);
  const revealed = await call(base, undefined, host.token);
  assert.equal(revealed.room.phase, "reveal");
  assert.equal(revealed.room.result.truthId, option.id);
  // Results have no timer: the host skips ahead to the next question.
  voting = await action(host, "next");
  if (round === 1) {
    assert.equal(voting.room.phase, "finished");
    assert.deepEqual(
      voting.room.players.map((p) => p.score),
      [2, 2],
    );
  }
}
await action(host, "leave");
await action(guest, "leave");
const crowded = await call("/api/rooms", { name: "Concurrent Host" }, "", 201);
const crowdBase = `/api/rooms/${crowded.room.code}`;
const replies = await Promise.all(
  Array.from({ length: 9 }, async (_, i) => {
    const reply = await fetch(new URL(crowdBase + "/join", origin), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "BluffAndTell-StagingCheck/1.0",
      },
      body: JSON.stringify({ name: `Concurrent ${i}` }),
    });
    const data = await reply.json();
    return { status: reply.status, ...data };
  }),
);
assert.equal(replies.filter((r) => r.status === 200).length, 7);
assert.equal(
  (await call(crowdBase, undefined, crowded.token)).room.players.length,
  8,
);
for (const joined of replies.filter((r) => r.status === 200))
  await call(
    crowdBase + "/action",
    { action: "leave", requestId: randomUUID() },
    joined.token,
  );
await call(
  crowdBase + "/action",
  { action: "leave", requestId: randomUUID() },
  crowded.token,
);
console.log(
  "Cloudflare runtime checks passed: private profiles, two-player full game, voting, scoring, duplicate actions and concurrent joins.",
);
