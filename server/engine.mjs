import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  PROMPTS,
  promptPoolForPlayer,
  AGE_GROUPS,
  promptsForPlayer,
  promptPackForRoom,
  normalisePromptHistory,
} from "./prompts.mjs";

export const PHASES = ["voting", "reveal", "story"];
// Scoring: spot the truth +2; the featured player gets +1 per friend fooled by their lie,
// and +1 if at least one person voted and nobody spotted their truth.
export const POINTS = { truth: 2, fooled: 1, stumped: 1, faceVote: 2 };
// Game types: truth-and-lie questions, face-off photo rounds, or a mix of both.
export const MODES = ["classic", "faces", "doodles", "mixed"];
// Doodle prompts: always about one player in the room, always kind enough for any age.
export const DOODLE_PROMPTS = [
  "Draw {name} as a superhero",
  "Draw {name} at 7 o’clock in the morning",
  "Draw {name} as a vegetable",
  "Draw {name}’s face when the Wi-Fi goes down",
  "Draw {name} as a cat",
  "Draw {name} winning a prize for something silly",
  "Draw {name} dancing like nobody’s watching",
  "Draw {name}’s secret talent",
  "Draw {name} as a movie villain",
  "Draw {name} meeting a dinosaur",
  "Draw {name}’s dream pet",
  "Draw {name} on their dream holiday",
  "Draw {name} as a famous painting",
  "Draw {name} trying to cook dinner",
  "Draw {name} as a pirate",
  "Draw {name} after eating too much cake",
];
// Photos are small JPEG data URLs, resized on the phone before upload.
export const MAX_PHOTO_LENGTH = 60000;
export const DEFAULT_SETTINGS = {
  mode: "classic",
  questionsPerPlayer: 1,
  writing: 180,
  reading: 10,
  discussion: 45,
  voting: 45,
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
  recentPromptIds = [],
) {
  const host = player(name, false, ageGroup);
  host.promptHistory = normalisePromptHistory(recentPromptIds);
  const room = {
    code: Array.from(
      { length: 6 },
      () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)],
    ).join(""),
    version: 0,
    promptSeed: id(),
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
      writing: 180,
      reading: 5,
      discussion: 8,
      voting: 30,
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
      p.promptHistory ??= [...(host?.promptHistory ?? [])];
    });
  room.players
    .filter((p) => p.bot)
    .forEach((p) => {
      p.answers = promptsForPlayer(p, room).map((prompt) => {
        const [truth, lie] = shuffle([...prompt.decoys, ...prompt.wildcards]);
        return { promptId: prompt.id, truth, lie };
      });
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
export function joinRoom(
  room,
  name,
  now = Date.now(),
  ageGroup = "adult",
  recentPromptIds = [],
) {
  fail(room.expiresAt > now, "This room has expired.", 404);
  fail(
    room.phase === "lobby" && !room.locked,
    "This game has already started or the lobby is locked.",
  );
  fail(room.players.length < 8, "This room is full (8 players).");
  const p = player(name, false, ageGroup);
  p.promptHistory = normalisePromptHistory(recentPromptIds);
  fail(
    !room.players.some((x) => key(x.name) === key(p.name)),
    "That nickname is already taken. Try another.",
  );
  room.players.push(p);
  return p.token;
}
function enter(room, phase, now) {
  room.phase = phase;
  // No timers in a new game: writing ends when everyone is ready, voting when everyone
  // has voted, and the reveal when everyone taps Next. Older rooms mid-way through
  // a reading, discussion or story phase still finish on their timer.
  room.deadline = ["reading", "discussion", "story"].includes(phase)
    ? now + room.settings[phase] * 1000
    : null;
  room.pausedRemaining = null;
  room.nextReady = {};
}
// At the reveal, each player taps Next; the room moves on once everyone has.
function moveOnIfEveryoneReady(room, now) {
  if (room.phase !== "reveal" || room.pausedRemaining !== null) return;
  if (room.players.every((p) => room.nextReady?.[p.id]))
    nextQuestion(room, now);
}
// Everyone except the player the question is about.
function votersFor(room) {
  const q = room.queue[room.questionIndex];
  return room.players.filter((p) => p.id !== q.playerId);
}
// Once every voter has picked, reveal after a short grace so the last voter can still switch.
function closeIfEveryoneVoted(room, now) {
  if (room.pausedRemaining !== null) return;
  const voters =
    room.phase === "voting"
      ? votersFor(room)
      : room.phase === "judging"
        ? judgesFor(room)
        : null;
  if (voters?.every((p) => room.votes[p.id]))
    room.deadline = Math.min(room.deadline ?? Infinity, now + 3000);
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
const modeOf = (room) => room.settings.mode ?? "classic";
const hasChild = (room) => room.players.some((p) => p.ageGroup === "child");
// A face-off round: one player pulls a face, everyone else copies it, the room votes on the best copy.
function faceQuestion(p) {
  return {
    id: id(),
    type: "face",
    playerId: p.id,
    title: `Copy ${p.name}’s face`,
  };
}
// A doodle round: everyone draws the same prompt about one player; the room votes for the funniest.
function doodleQuestion(p, used = new Set()) {
  const fresh = DOODLE_PROMPTS.filter((t) => !used.has(t)),
    template = shuffle(fresh.length ? fresh : DOODLE_PROMPTS)[0];
  used.add(template);
  return {
    id: id(),
    type: "doodle",
    playerId: p.id,
    title: template.replace("{name}", p.name),
  };
}
const isPhotoRound = (q) => ["face", "doodle"].includes(q?.type);
export function enableSimpleFlow(room) {
  room.flowVersion = 2;
  room.settings.mode = room.demo ? "classic" : "mixed";
  room.settings.totalRounds = 6;
  room.players.forEach((p) => {
    p.ageGroup = null;
  });
}
function startSimpleGame(room, now) {
  const used = new Set(),
    mode = modeOf(room);
  const count = room.settings.totalRounds ?? 6;
  // Shuffle each trio so all three activities appear before a type repeats.
  const types = [];
  while (types.length < count) {
    const trio = shuffle(["truth", "face", "doodle"]);
    if (trio[0] === types.at(-1)) trio.push(trio.shift());
    types.push(...trio);
  }
  const pool = shuffle(promptPoolForPlayer(room.players[0], room));
  const recent = new Set(room.players.flatMap((p) => p.promptHistory ?? []));
  pool.sort((a, b) => Number(recent.has(a.id)) - Number(recent.has(b.id)));
  let truthIndex = 0;
  room.queue = Array.from({ length: count }, (_, i) => {
    const player = room.players[i % room.players.length];
    const type =
      mode === "mixed"
        ? types[i]
        : mode === "faces"
          ? "face"
          : mode === "doodles"
            ? "doodle"
            : "truth";
    if (type === "face") return faceQuestion(player);
    if (type === "doodle") return doodleQuestion(player, used);
    const prompt = pool[truthIndex++ % pool.length];
    return {
      id: id(),
      type: "truth",
      playerId: player.id,
      promptId: prompt.id,
      title: prompt.title,
      options: [],
    };
  });
  room.questionIndex = 0;
  openQuestion(room, now);
}
function startQuestions(room, now) {
  const mode = modeOf(room);
  room.queue = [];
  const used = new Set();
  if (mode === "faces" || mode === "doodles") {
    for (let round = 0; round < room.settings.questionsPerPlayer; round++)
      for (const p of room.players)
        room.queue.push(
          mode === "faces" ? faceQuestion(p) : doodleQuestion(p, used),
        );
  } else {
    const count = Math.min(
      room.settings.questionsPerPlayer,
      ...room.players.map((p) => p.answers.length),
    );
    fail(
      count >= 1,
      "Everyone needs at least one complete truth and lie before the game can start.",
    );
    const answerOrder = new Map(
      room.players.map((p) => [p.id, shuffle(p.answers)]),
    );
    for (let round = 0; round < count; round++)
      room.players.forEach((p, i) => {
        room.queue.push(buildQuestion(p, answerOrder.get(p.id)[round]));
        // Mixed: follow each truth question with the next player's face-off or doodle (alternating),
        // so nobody is featured twice in a row. Rooms with an under-13 player get doodles only.
        if (mode === "mixed" && round === 0) {
          const next = room.players[(i + 1) % room.players.length];
          room.queue.push(
            i % 2 === 0 && !hasChild(room)
              ? faceQuestion(next)
              : doodleQuestion(next, used),
          );
        }
      });
  }
  room.questionIndex = 0;
  openQuestion(room, now);
}
// Truth questions open straight into voting; face-offs start with the poser taking their photo.
function openQuestion(room, now) {
  room.votes = {};
  room.shots = {};
  const q = room.queue[room.questionIndex];
  if (room.flowVersion === 2 && q?.type === "truth") {
    room.players.forEach((p) => {
      p.answers = [];
      p.submitted = false;
    });
    const author = room.players.find((p) => p.id === q.playerId);
    if (author.bot) {
      const prompt = PROMPTS.find((p) => p.id === q.promptId);
      const [truth, lie] = shuffle([...prompt.decoys, ...prompt.wildcards]);
      const questionId = q.id;
      Object.assign(
        q,
        buildQuestion(author, {
          promptId: prompt.id,
          truth,
          lie,
          decoys: makeDecoys({ promptId: prompt.id, truth, lie }),
        }),
        { id: questionId, type: "truth" },
      );
      enter(room, "voting", now);
    } else enter(room, "writing", now);
    return;
  }
  enter(
    room,
    q?.type === "face" ? "posing" : q?.type === "doodle" ? "drawing" : "voting",
    now,
  );
}
function copiersFor(room) {
  const q = room.queue[room.questionIndex];
  return room.players.filter((p) => p.id !== q.playerId);
}
// The entries people vote on: copies in a face-off (not the original), every drawing in a doodle round.
function entriesFor(room) {
  const q = room.queue[room.questionIndex];
  return Object.keys(room.shots).filter(
    (id) => q.type === "doodle" || id !== q.playerId,
  );
}
// Anyone with at least one entry that isn't their own can judge.
function judgesFor(room) {
  const entries = entriesFor(room);
  return room.players.filter((p) => entries.some((id) => id !== p.id));
}
function openJudging(room, now) {
  room.votes = {};
  if (judgesFor(room).length) enter(room, "judging", now);
  else scoreFace(room, now);
}
function scoreFace(room, now) {
  const q = room.queue[room.questionIndex];
  if (room.results.some((r) => r.questionId === q.id)) return;
  const tally = {};
  const votes = Object.entries(room.votes).map(([playerId, photoOf]) => {
    tally[photoOf] = (tally[photoOf] ?? 0) + 1;
    return { playerId, photoOf };
  });
  for (const [playerId, count] of Object.entries(tally)) {
    const p = room.players.find((x) => x.id === playerId);
    if (p) p.score += count * POINTS.faceVote;
  }
  room.results.push({
    questionId: q.id,
    type: q.type,
    votes,
    tally,
    copies: entriesFor(room),
  });
  enter(room, "reveal", now);
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
      p.score += POINTS.truth;
      p.correct++;
    }
    if (optionId === lie.id) {
      subject.score += POINTS.fooled;
      subject.fooled++;
    }
    return { playerId, optionId, points: correct ? POINTS.truth : 0 };
  });
  // Nobody spotted the truth: reward the featured player even if nobody fell for the lie itself.
  const stumpBonus =
    picks.length && !picks.some((p) => p.optionId === truth.id)
      ? POINTS.stumped
      : 0;
  subject.score += stumpBonus;
  room.results.push({
    questionId: q.id,
    truthId: truth.id,
    lieId: lie.id,
    picks,
    bluffPoints:
      picks.filter((p) => p.optionId === lie.id).length * POINTS.fooled,
    stumpBonus,
  });
  enter(room, "reveal", now);
}
function nextQuestion(room, now) {
  room.questionIndex++;
  room.nextReady = {};
  room.votes = {};
  // Photos are only kept for the round they belong to.
  room.shots = {};
  if (room.questionIndex >= room.queue.length) enter(room, "finished", now);
  else openQuestion(room, now);
}
export function tick(room, now = Date.now()) {
  if (room.pausedRemaining !== null) return;
  if (room.demo && room.phase === "voting") {
    const q = room.queue[room.questionIndex];
    votersFor(room)
      .filter((p) => p.bot)
      .forEach((p, i) => {
        if (!room.votes[p.id])
          room.votes[p.id] =
            q.options[(i + room.questionIndex) % q.options.length].id;
      });
    closeIfEveryoneVoted(room, now);
  }
  if (room.demo && room.phase === "reveal") {
    room.nextReady ??= {};
    room.players
      .filter((p) => p.bot)
      .forEach((p) => (room.nextReady[p.id] = true));
  }
  if (!room.deadline) return;
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
    else if (room.phase === "judging") scoreFace(room, at);
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
        if (name === "mode") {
          fail(MODES.includes(value), "Choose a game type.");
          fail(
            value === "classic" || !room.demo,
            "The demo players can’t take photos or draw. Try these rounds with friends.",
          );
          room.settings.mode = value;
          continue;
        }
        if (name === "totalRounds" && room.flowVersion === 2) {
          const count = Number(value);
          fail(
            Number.isInteger(count) && count >= 3 && count <= 24,
            "Choose 3 to 24 rounds.",
          );
          room.settings.totalRounds = count;
          continue;
        }
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
      if (room.flowVersion === 2) {
        room.locked = true;
        startSimpleGame(room, now);
        break;
      }
      fail(
        room.players.every((p) => p.ageGroup !== null),
        "Everyone needs to choose their age group in the room before starting.",
      );
      if (modeOf(room) !== "classic")
        fail(
          !room.demo,
          "The demo players can’t take photos or draw. Try these rounds with friends.",
        );
      // Face-off photos are off for under-13s; Doodle off and Mixed (doodles only) are fine.
      if (modeOf(room) === "faces")
        fail(
          !hasChild(room),
          "Face off is switched off when a player is under 13. Try Doodle off instead.",
        );
      room.promptPack = promptPackForRoom(room);
      if (room.demo) configureDemo(room);
      room.locked = true;
      if (["faces", "doodles"].includes(room.settings.mode))
        startQuestions(room, now);
      else enter(room, "writing", now);
      break;
    case "answers": {
      fail(room.phase === "writing", "The writing phase is over.");
      active();
      if (room.flowVersion === 2)
        fail(
          room.queue[room.questionIndex]?.playerId === me.id,
          "Only the featured player answers this question.",
        );
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
      if (room.flowVersion === 2) {
        fail(me.answers.length === 1, "Answer the current question only.");
        if (me.submitted) {
          const q = room.queue[room.questionIndex],
            questionId = q.id;
          Object.assign(q, buildQuestion(me, me.answers[0]), {
            id: questionId,
            type: "truth",
          });
          enter(room, "voting", now);
        }
        break;
      }
      // Start as soon as everyone has locked in their answers.
      if (room.players.every((p) => p.submitted)) {
        startQuestions(room, now);
        room.needsAnswers = false;
      }
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
      fail(
        room.flowVersion !== 2,
        "The featured player must submit their answer.",
      );
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
      closeIfEveryoneVoted(room, now);
      break;
    }
    case "next":
      host();
      active();
      fail(
        [
          "reading",
          "discussion",
          "voting",
          "posing",
          "copying",
          "drawing",
          "judging",
          "reveal",
          "story",
        ].includes(room.phase),
        "Wait for this phase to finish.",
      );
      if (room.phase === "voting") score(room, now);
      else if (room.phase === "posing") nextQuestion(room, now);
      else if (room.phase === "copying" || room.phase === "drawing")
        openJudging(room, now);
      else if (room.phase === "judging") scoreFace(room, now);
      else if (room.phase === "reading") enter(room, "discussion", now);
      else if (room.phase === "discussion") enter(room, "voting", now);
      else nextQuestion(room, now);
      break;
    case "photo": {
      fail(
        ["posing", "copying", "drawing"].includes(room.phase),
        "This round isn’t taking pictures right now.",
      );
      active();
      const q = room.queue[room.questionIndex];
      fail(
        data.questionId === q.id,
        "That photo belongs to a previous round. Refresh and try again.",
      );
      const image = String(data.image ?? "");
      fail(
        /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) &&
          image.length <= MAX_PHOTO_LENGTH,
        "That picture didn’t come through. Try again.",
      );
      if (room.phase === "drawing") {
        // Everyone draws, including the player the prompt is about. Redraws replace the old one.
        room.shots[me.id] = image;
        if (room.players.every((p) => room.shots[p.id])) openJudging(room, now);
      } else if (room.phase === "posing") {
        fail(me.id === q.playerId, "Wait for the face to copy.");
        room.shots[me.id] = image;
        enter(room, "copying", now);
      } else {
        fail(
          me.id !== q.playerId,
          "You’ve already pulled the face. Now watch them copy it.",
        );
        room.shots[me.id] = image;
        if (copiersFor(room).every((p) => room.shots[p.id]))
          openJudging(room, now);
      }
      break;
    }
    case "face-vote": {
      fail(room.phase === "judging", "Judging is not open.");
      active();
      const q = room.queue[room.questionIndex];
      fail(
        data.questionId === q.id,
        "That vote belongs to a previous round. Refresh and try again.",
      );
      fail(data.playerId !== me.id, "You can’t vote for your own photo.");
      fail(
        entriesFor(room).includes(data.playerId),
        "Choose one of the entries.",
      );
      room.votes[me.id] = data.playerId;
      closeIfEveryoneVoted(room, now);
      break;
    }
    case "ready-next":
      fail(room.phase === "reveal", "Wait for the results first.");
      active();
      room.nextReady ??= {};
      room.nextReady[me.id] = true;
      moveOnIfEveryoneReady(room, now);
      break;
    case "extend":
      host();
      fail(
        ["reading", "discussion", "story"].includes(room.phase),
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
      // Anyone can call a rematch; it takes the whole room back to the lobby.
      fail(room.phase === "finished", "Finish this game first.");
      for (const p of room.players) {
        p.promptHistory = normalisePromptHistory([
          ...(p.promptHistory ?? []),
          ...promptsForPlayer(p, room).map((prompt) => prompt.id),
          ...room.queue.map((q) => q.promptId),
        ]);
        p.score = 0;
        p.correct = 0;
        p.fooled = 0;
        p.answers = [];
        p.submitted = false;
      }
      room.queue = [];
      room.results = [];
      room.votes = {};
      room.shots = {};
      room.questionIndex = 0;
      room.locked = false;
      delete room.promptPack;
      room.promptSeed = id();
      if (room.demo) configureDemo(room);
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
    flowVersion: room.flowVersion ?? 1,
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
      profileReady: room.flowVersion === 2 || p.ageGroup !== null,
    })),
    question:
      q &&
      (room.phase !== "writing" || room.flowVersion === 2) &&
      room.phase !== "lobby"
        ? {
            id: q.id,
            playerId: q.playerId,
            promptId: q.promptId,
            title: q.title,
            type: q.type ?? "truth",
            options: (q.options ?? []).map(({ id, text }) => ({ id, text })),
            number: room.questionIndex + 1,
            total: room.queue.length,
          }
        : null,
    myVote: room.votes?.[me.id] ?? null,
    votedCount: Object.keys(room.votes).length,
    votedIds: ["voting", "judging"].includes(room.phase)
      ? Object.keys(room.votes)
      : [],
    // Who has a photo in this round (the photos themselves come from photosFor).
    shotIds: Object.keys(room.shots ?? {}),
    nextReadyIds:
      room.phase === "reveal" ? Object.keys(room.nextReady ?? {}) : [],
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

// Photos a player may see right now: the face to copy and their own copy while copying,
// everyone's once judging opens. Nothing before the poser has taken theirs.
export function photosFor(room, token, now = Date.now()) {
  const me = authorize(room, token, now),
    q = room.queue[room.questionIndex],
    shots = room.shots ?? {};
  if (!isPhotoRound(q)) return { questionId: null, photos: {} };
  const visible =
    room.phase === "copying"
      ? [q.playerId, me.id]
      : room.phase === "drawing"
        ? [me.id]
        : ["judging", "reveal"].includes(room.phase)
          ? Object.keys(shots)
          : [];
  return {
    questionId: q.id,
    photos: Object.fromEntries(
      visible.filter((id) => shots[id]).map((id) => [id, shots[id]]),
    ),
  };
}
