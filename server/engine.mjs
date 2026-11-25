import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  PROMPTS,
  DEMO_ANSWERS,
  AGE_GROUPS,
  promptsForPlayer,
  promptPackForRoom,
  SILLY_DEMO_ANSWERS,
} from "./prompts.mjs";

export const PHASES = ["reading", "discussion", "voting", "reveal", "story"];
export const DEFAULT_SETTINGS = {
  questionsPerPlayer: 1,
  writing: 360,
  reading: 10,
  discussion: 45,
  voting: 30,
  reveal: 30,
  story: 60,
};
export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const fail = (condition, message, status) => {
  if (!condition) throw new GameError(message, status);
};
const id = () => randomUUID();
const clean = (value, max = 120) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
const key = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const shuffle = (values) => {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export function validateAgeGroup(ageGroup) {
  fail(
    AGE_GROUPS.includes(ageGroup),
    "Choose an age group so we can pick your questions.",
  );
  return ageGroup;
}
export function player(name, bot = false, ageGroup = "adult") {
  const nickname = clean(name, 22);
  fail(nickname.length >= 2, "Choose a nickname with at least 2 characters.");
  return {
    id: id(),
    token: randomBytes(32).toString("hex"),
    name: nickname,
    ageGroup: ageGroup === null ? null : validateAgeGroup(ageGroup),
    bot,
    score: 0,
    fooled: 0,
    correct: 0,
    answers: [],
    submitted: false,
  };
}
export function newRoom(
  name,
  demo = false,
  now = Date.now(),
  ageGroup = "adult",
) {
  const host = player(name, false, ageGroup);
  const room = {
    code: Array.from(
      { length: 6 },
      () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)],
    ).join(""),
    version: 0,
    createdAt: now,
    expiresAt: now + 24 * 3600000,
    hostId: host.id,
    hostSeenAt: now,
    phase: "lobby",
    deadline: null,
    pausedRemaining: null,
    settings: { ...DEFAULT_SETTINGS },
    players: [host],
    queue: [],
    questionIndex: 0,
    votes: {},
    results: [],
    demo,
    locked: false,
  };
  if (demo) {
    room.settings = {
      questionsPerPlayer: 1,
      writing: 360,
      reading: 5,
      discussion: 8,
      voting: 20,
      reveal: 12,
      story: 20,
    };
    ["Alex", "Sam", "Zee"].forEach((name) =>
      room.players.push(player(name, true)),
    );
    configureDemo(room);
  }
  return { room, token: host.token };
}
function configureDemo(room) {
  const host = room.players.find((p) => p.id === room.hostId);
  room.players
    .filter((p) => p.bot)
    .forEach((p) => {
      p.ageGroup = host?.ageGroup === "adult26" ? "adult26" : "adult";
    });
  const answers =
    promptPackForRoom(room) === "extra-silly"
      ? SILLY_DEMO_ANSWERS
      : DEMO_ANSWERS;
  room.players
    .filter((p) => p.bot)
    .forEach((p, n) => {
      p.answers = promptsForPlayer(p, room).map((prompt, i) => ({
        promptId: prompt.id,
        truth: answers[n][i * 2],
        lie: answers[n][i * 2 + 1],
      }));
      p.submitted = true;
    });
}
export function authorize(room, token, now = Date.now()) {
  fail(
    room && room.expiresAt > now,
    "This room has expired. Create a new game.",
    404,
  );
  const p = room.players.find((p) => p.token === token);
  fail(p, "Your session is no longer in this room. Please join again.", 401);
  return p;
}
export function joinRoom(room, name, now = Date.now(), ageGroup = "adult") {
  fail(room.expiresAt > now, "This room has expired.", 404);
  fail(
    room.phase === "lobby" && !room.locked,
    "This game has already started or the lobby is locked.",
  );
  fail(room.players.length < 8, "This room is full (8 players).");
  const p = player(name, false, ageGroup);
  fail(
    !room.players.some((x) => key(x.name) === key(p.name)),
    "That nickname is already taken. Try another.",
  );
  room.players.push(p);
  return p.token;
}
function enter(room, phase, now) {
  room.phase = phase;
  room.deadline =
    phase === "finished" || phase === "lobby"
      ? null
      : now + room.settings[phase] * 1000;
  room.pausedRemaining = null;
}
function makeDecoys(answer, previous = []) {
  const prompt = PROMPTS.find((p) => p.id === answer.promptId);
  const used = new Set([answer.truth, answer.lie, ...previous].map(key));
  const pick = (values) => {
    const value = shuffle(values).find((v) => !used.has(key(v)));
    fail(value, "Try another answer to make room for different decoys.");
    used.add(key(value));
    return value;
  };
  return [pick(prompt.decoys), pick(prompt.wildcards)];
}
function buildQuestion(p, answer) {
  const prompt = PROMPTS.find((x) => x.id === answer.promptId);
  const [plausible, outrageous] = answer.decoys ?? makeDecoys(answer);
  return {
    id: id(),
    playerId: p.id,
    promptId: prompt.id,
    title: prompt.title,
    options: shuffle([
      { text: answer.truth, kind: "truth" },
      { text: answer.lie, kind: "lie" },
      { text: plausible, kind: "decoy" },
      { text: outrageous, kind: "wildcard" },
    ]).map((x) => ({ ...x, id: id() })),
  };
}
function startQuestions(room, now) {
  const count = Math.min(
    room.settings.questionsPerPlayer,
    ...room.players.map((p) => p.answers.length),
  );
  fail(
    count >= 1,
    "Everyone needs at least one complete truth and lie before the game can start. Add more writing time.",
  );
  room.queue = [];
  for (let round = 0; round < count; round++)
    for (const p of room.players)
      room.queue.push(buildQuestion(p, p.answers[round]));
  room.questionIndex = 0;
  room.votes = {};
  enter(room, "reading", now);
}
function score(room, now) {
  const q = room.queue[room.questionIndex];
  if (room.results.some((r) => r.questionId === q.id)) return;
  const subject = room.players.find((p) => p.id === q.playerId);
  const truth = q.options.find((o) => o.kind === "truth"),
    lie = q.options.find((o) => o.kind === "lie");
  const picks = Object.entries(room.votes).map(([playerId, optionId]) => {
    const p = room.players.find((p) => p.id === playerId),
      correct = optionId === truth.id;
    if (correct) {
      p.score += 2;
      p.correct++;
    }
    if (optionId === lie.id) {
      subject.score++;
      subject.fooled++;
    }
    return { playerId, optionId, points: correct ? 2 : 0 };
  });
  room.results.push({
    questionId: q.id,
    truthId: truth.id,
    lieId: lie.id,
    picks,
    bluffPoints: picks.filter((p) => p.optionId === lie.id).length,
  });
  enter(room, "reveal", now);
}
function nextQuestion(room, now) {
  room.questionIndex++;
  room.votes = {};
  if (room.questionIndex >= room.queue.length) enter(room, "finished", now);
  else enter(room, "reading", now);
}
export function tick(room, now = Date.now()) {
  if (room.pausedRemaining !== null || !room.deadline) return;
  if (room.demo && room.phase === "voting") {
    const q = room.queue[room.questionIndex];
    room.players
      .filter((p) => p.bot && p.id !== q.playerId)
      .forEach((p, i) => {
        if (!room.votes[p.id])
          room.votes[p.id] =
            q.options[(i + room.questionIndex) % q.options.length].id;
      });
  }
  for (
    let safety = 0;
    safety < 200 && room.deadline && now >= room.deadline;
    safety++
  ) {
    const at = room.deadline;
    if (room.phase === "writing") {
      if (room.players.some((p) => p.answers.length === 0)) {
        room.deadline = null;
        room.needsAnswers = true;
        break;
      }
      startQuestions(room, at);
    } else if (room.phase === "reading") enter(room, "discussion", at);
    else if (room.phase === "discussion") enter(room, "voting", at);
    else if (room.phase === "voting") score(room, at);
    else if (room.phase === "reveal") enter(room, "story", at);
    else if (room.phase === "story") nextQuestion(room, at);
    else break;
  }
}
export function apply(room, token, action, data = {}, now = Date.now()) {
  const me = authorize(room, token, now);
  tick(room, now);
  if (me.id === room.hostId) room.hostSeenAt = now;
  const host = () =>
    fail(me.id === room.hostId, "Only the host can do that.", 403);
  const active = () =>
    fail(room.pausedRemaining === null, "The game is paused.");
  switch (action) {
    case "settings": {
      host();
      fail(
        room.phase === "lobby",
        "Settings are locked after the game starts.",
      );
      for (const [name, value] of Object.entries(data)) {
        fail(Object.hasOwn(DEFAULT_SETTINGS, name), "Unknown setting.");
        const n = Number(value);
        fail(Number.isInteger(n), "Choose a whole number.");
        const [min, max] =
          name === "questionsPerPlayer"
            ? [1, 2]
            : name === "writing"
              ? [120, 900]
              : [5, 180];
        fail(
          n >= min && n <= max,
          "That setting is outside the allowed range.",
        );
        room.settings[name] = n;
      }
      break;
    }
    case "profile":
      fail(
        room.phase === "lobby",
        "Your profile is locked once the game starts.",
      );
      me.ageGroup = validateAgeGroup(data.ageGroup);
      me.answers = [];
      me.submitted = false;
      if (room.demo) configureDemo(room);
      break;
    case "lock":
      host();
      fail(room.phase === "lobby", "The game has already started.");
      room.locked = !room.locked;
      break;
    case "start":
      host();
      fail(room.phase === "lobby", "The game has already started.");
      fail(
        room.players.length >= 2,
        "You need at least 2 players. Invite someone or try the solo demo.",
      );
      fail(
        room.players.every((p) => p.ageGroup !== null),
        "Everyone needs to choose their age group in the room before starting.",
      );
      room.promptPack = promptPackForRoom(room);
      room.locked = true;
      enter(room, "writing", now);
      break;
    case "answers": {
      fail(room.phase === "writing", "The writing phase is over.");
      active();
      fail(
        Array.isArray(data.answers) && data.answers.length <= 3,
        "Submit up to three answers.",
      );
      const seen = new Set();
      me.answers = data.answers.map((a) => {
        const promptId = clean(a.promptId);
        fail(
          promptsForPlayer(me, room).some((p) => p.id === promptId) &&
            !seen.has(promptId),
          "Choose different supported prompts.",
        );
        seen.add(promptId);
        const truth = clean(a.truth),
          lie = clean(a.lie);
        fail(
          truth.length >= 2 && lie.length >= 2,
          "Each answer needs a truth and a lie.",
        );
        fail(key(truth) !== key(lie), "Your truth and lie must be different.");
        const previous = me.answers.find(
          (x) => x.promptId === promptId && x.truth === truth && x.lie === lie,
        );
        return {
          promptId,
          truth,
          lie,
          decoys: previous?.decoys ?? makeDecoys({ promptId, truth, lie }),
        };
      });
      fail(me.answers.length > 0, "Add at least one complete pair.");
      me.submitted = Boolean(data.submitted);
      break;
    }
    case "reroll": {
      fail(room.phase === "writing", "Decoys are locked after writing.");
      active();
      const answer = me.answers.find((a) => a.promptId === data.promptId);
      fail(answer, "Save a complete truth and lie first.");
      answer.decoys = makeDecoys(answer, answer.decoys ?? []);
      break;
    }
    case "claim-host":
      fail(
        now - (room.hostSeenAt ?? room.createdAt) > 90000,
        "Your host is still connected.",
      );
      fail(!me.bot, "Choose a real player.");
      room.hostId = me.id;
      room.hostSeenAt = now;
      break;
    case "begin":
      host();
      fail(room.phase === "writing", "Not in the writing phase.");
      active();
      startQuestions(room, now);
      room.needsAnswers = false;
      break;
    case "vote": {
      fail(room.phase === "voting", "Voting is not open.");
      active();
      const q = room.queue[room.questionIndex];
      fail(
        data.questionId === q.id,
        "That vote belongs to a previous question. Refresh and try again.",
      );
      fail(me.id !== q.playerId, "You cannot vote on your own question.");
      fail(
        q.options.some((o) => o.id === data.optionId),
        "Choose an option from this question.",
      );
      room.votes[me.id] = data.optionId;
      if (Object.keys(room.votes).length === room.players.length - 1)
        room.deadline = Math.min(room.deadline, now + 3000);
      break;
    }
    case "next":
      host();
      active();
      fail(
        ["reading", "discussion", "reveal", "story"].includes(room.phase),
        "Wait for this phase to finish.",
      );
      if (room.phase === "reading") enter(room, "discussion", now);
      else if (room.phase === "discussion") enter(room, "voting", now);
      else if (room.phase === "reveal") enter(room, "story", now);
      else nextQuestion(room, now);
      break;
    case "extend":
      host();
      fail(
        room.phase !== "lobby" && room.phase !== "finished",
        "No timer to extend.",
      );
      if (room.pausedRemaining !== null) room.pausedRemaining += 60000;
      else room.deadline = Math.max(room.deadline ?? now, now) + 60000;
      room.needsAnswers = false;
      break;
    case "pause":
      host();
      fail(
        room.deadline || room.pausedRemaining !== null,
        "No timer to pause.",
      );
      if (room.pausedRemaining !== null) {
        room.deadline = now + room.pausedRemaining;
        room.pausedRemaining = null;
      } else {
        room.pausedRemaining = Math.max(0, room.deadline - now);
        room.deadline = null;
      }
      break;
    case "transfer":
      host();
      fail(
        room.players.some((p) => p.id === data.playerId && !p.bot),
        "Choose a player in the room.",
      );
      room.hostId = data.playerId;
      room.hostSeenAt = now;
      break;
    case "remove":
      host();
      fail(room.phase === "lobby", "Players can only be removed in the lobby.");
      fail(data.playerId !== me.id, "You cannot remove yourself.");
      room.players = room.players.filter((p) => p.id !== data.playerId);
      break;
    case "leave": {
      fail(
        ["lobby", "finished"].includes(room.phase),
        "Keep your place by closing the tab. You can reconnect during the game.",
      );
      room.players = room.players.filter((p) => p.id !== me.id);
      if (room.hostId === me.id)
        room.hostId =
          room.players.find((p) => !p.bot)?.id ?? room.players[0]?.id;
      break;
    }
    case "replay":
      host();
      fail(room.phase === "finished", "Finish this game first.");
      for (const p of room.players) {
        p.score = 0;
        p.correct = 0;
        p.fooled = 0;
        if (!p.bot) {
          p.answers = [];
          p.submitted = false;
        }
      }
      room.queue = [];
      room.results = [];
      room.votes = {};
      room.questionIndex = 0;
      room.locked = false;
      delete room.promptPack;
      room.needsAnswers = false;
      enter(room, "lobby", now);
      break;
    default:
      throw new GameError("Unknown game action.");
  }
  room.version++;
  return room;
}
export function snapshot(room, token, now = Date.now()) {
  const me = authorize(room, token, now),
    q = room.queue[room.questionIndex];
  const revealed = ["reveal", "story"].includes(room.phase),
    result = revealed ? room.results.find((r) => r.questionId === q?.id) : null;
  return {
    code: room.code,
    phase: room.phase,
    version: room.version,
    serverNow: now,
    expiresAt: room.expiresAt,
    deadline: room.deadline,
    pausedRemaining: room.pausedRemaining,
    hostId: room.hostId,
    hostAway: now - (room.hostSeenAt ?? room.createdAt) > 90000,
    me: me.id,
    demo: room.demo,
    locked: room.locked,
    settings: room.settings,
    needsAnswers: Boolean(room.needsAnswers),
    ageGroup: me.ageGroup === null ? null : (me.ageGroup ?? "adult"),
    promptPack: promptPackForRoom(room),
    prompts: promptsForPlayer(me, room).map(
      ({ id, title, hint, category }) => ({
        id,
        title,
        hint,
        category,
      }),
    ),
    ownAnswers: me.answers,
    submitted: me.submitted,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      fooled: p.fooled,
      correct: p.correct,
      ready: p.submitted,
      answerCount: p.answers.length,
      bot: p.bot,
      profileReady: p.ageGroup !== null,
    })),
    question:
      q && room.phase !== "writing" && room.phase !== "lobby"
        ? {
            id: q.id,
            playerId: q.playerId,
            promptId: q.promptId,
            title: q.title,
            options: q.options.map(({ id, text }) => ({ id, text })),
            number: room.questionIndex + 1,
            total: room.queue.length,
          }
        : null,
    myVote: room.votes[me.id] ?? null,
    votedCount: Object.keys(room.votes).length,
    result,
    history:
      room.phase === "finished"
        ? room.queue.map((q) => ({
            question: q,
            result: room.results.find((r) => r.questionId === q.id),
          }))
        : null,
  };
}
