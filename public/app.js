import { certificatePdf } from "/certificate.js";
import {
  PHOTO_FILTERS,
  PhotoDraft,
  preparePhoto,
  applyPhotoFilter,
} from "/photo-tools.js";
import { rankedScores, RevealChime } from "/reveal-effects.js";
import { JingleRecorder } from "/jingle-recorder.js";
import { createInviteQr, roomInviteUrl, sessionForInvite } from "/invite-qr.js";
import {
  GAME_LENGTHS,
  GAME_TYPES,
  estimateMinutes,
  progressState,
  partyMixCounts,
} from "/game-options.js";
import { drawShareCard, drawVictoryCard, cardBlob } from "/share-card.js";
const $ = (s, root = document) => root.querySelector(s);
const app = $("#app");
const icons = {
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  sparkles:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM21 2v4m-2-2h4"/>',
  shield: '<path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7zM9 12l2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  link: '<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  phone:
    '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
  shuffle:
    '<path d="m3 5 4 0 10 14h4m-4-4 4 4-4 3M3 19h4l10-14h4m-4-3 4 3-4 4"/>',
  trophy:
    '<path d="M8 3h8v7a4 4 0 0 1-8 0zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-5 1h10"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-4 4h.01"/>',
  logout: '<path d="M9 5H4v14h5m6-14 7 7-7 7m-7-7h14"/>',
  alert: '<path d="M12 3 2 20h20zM12 10v4m0 3h.01"/>',
  camera:
    '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  crown: '<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5z"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
  pencil: '<path d="m4 20 4-1 11-11-3-3L5 16zM14 6l3 3"/>',
  undo: '<path d="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};
const icon = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.sparkles}</svg>`;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const storage = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
  remove(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};
// Room drafts follow the same expiry as the server; preferences and question
// IDs contain no answers and can stay between games.
function clearRoomDeviceData(code) {
  const promptHistory = storage.get("bt-prompt-history");
  if (promptHistory?.round?.startsWith(code + ":"))
    storage.set("bt-prompt-history", { ids: promptHistory.ids ?? [] });
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("bt-draft-" + code)) localStorage.removeItem(key);
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("bt-doodle-" + code + "-"))
        sessionStorage.removeItem(key);
    if (JSON.parse(sessionStorage.getItem("bt-photo-draft"))?.code === code)
      sessionStorage.removeItem("bt-photo-draft");
  } catch {}
}
function pruneDeviceRooms(now = Date.now()) {
  const expiries = storage.get("bt-room-expiries") ?? {};
  for (const [code, expiry] of Object.entries(expiries))
    if (expiry <= now) {
      clearRoomDeviceData(code);
      if (storage.get("bt-session")?.code === code)
        storage.remove("bt-session");
      if (storage.get("bt-last-score-reveal")?.startsWith(code + ":"))
        storage.remove("bt-last-score-reveal");
      delete expiries[code];
    }
  storage.set("bt-room-expiries", expiries);
}
pruneDeviceRooms();
let session = storage.get("bt-session"),
  room = null,
  busy = false,
  signature = "",
  previousPhase = "",
  offset = 0,
  connected = navigator.onLine,
  polling = false,
  saveTimer = null,
  toastTimer = null,
  drafts = {},
  homeName = storage.get("bt-name") ?? "",
  draftDirty = false,
  saveMessage = "Saved on this device",
  requestNumber = 0;
const isLocalPreview = ["localhost", "127.0.0.1", "[::1]"].includes(
  location.hostname,
);
const inviteOriginPromise = isLocalPreview
  ? fetch("/api/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((config) => config.inviteOrigin || location.origin)
      .catch(() => location.origin)
  : Promise.resolve(location.origin);
const params = new URLSearchParams(location.search);
let inviteCode = (params.get("room") ?? "")
  .toUpperCase()
  .replace(/[^A-Z2-9]/g, "")
  .slice(0, 6);
session = sessionForInvite(session, inviteCode);
const toast = (message) => {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 4300);
};
const me = () => room?.players.find((p) => p.id === room.me);
const isHost = () => room?.me === room?.hostId;
const person = (id) => room?.players.find((p) => p.id === id);
const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => Array.from(w)[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const avatar = (p, size = "") =>
  `<span class="avatar c${Math.max(0, room?.players.findIndex((x) => x.id === p?.id) ?? 0) % 4}" ${size}>${esc(initials(p?.name ?? "?"))}</span>`;
const uuid = () =>
  crypto.randomUUID?.() ??
  `${Date.now()}-${++requestNumber}-${Math.random().toString(36).slice(2)}`;
function header() {
  return `<header class="site-header"><a class="wordmark" href="/" ${room ? "data-game-home" : ""}><span class="mark" aria-hidden="true"><b>BT</b></span>BLUFF <b>&</b> TELL</a><div class="header-right">${room ? `<span class="pill ${room.demo ? "pink" : "lime"}">${room.demo ? "SOLO DEMO" : `ROOM ${esc(room.code)}`}</span>` : '<span class="pill">A party in your pocket</span>'}${room?.demo ? '<button class="text-button" data-exit-demo>Exit demo</button>' : ""}<button class="text-button" data-help>${icon("help")}<span>How to play</span></button></div></header>`;
}
function footer() {
  return `<footer class="site-footer"><div class="footer-game-meta">${questionProgress()}<span>Know your friends. Believe nothing.</span></div><div class="footer-links">${room ? '<a class="text-button" href="/" data-exit-room>Exit room</a>' : ""}<span id="connection-status">${connected ? "Made for your people." : "Connection lost. Reconnecting…"}</span><button class="text-button" data-recommend>Recommend Bluff &amp; Tell</button><button class="text-button" data-privacy>Privacy</button><a class="text-button" href="/admin">Admin</a></div></footer>`;
}
function demoNote() {
  if (room.demo && room.flowVersion === 2 && room.phase !== "lobby")
    return '<div class="note demo">Solo demo · You + 3 simulated players · Truth & lies only</div>';
  return room.demo
    ? '<div class="note demo">' +
        icon("sparkles") +
        " <strong>Solo demo.</strong> You + 3 bluffing bots. Bring real humans for photos, doodles and jingles.</div>"
    : "";
}
function home() {
  return `${header()}<main id="main"><section class="hero"><div class="hero-copy"><span class="pill lime">${icon("sparkles", 15)} YOUR PEOPLE. FOUR WAYS TO PLAY.</span><h1>Your friends.<br>Your chaos.<br><em>Big laughs.</em></h1><p class="hero-hook">Bluff. Snap. Doodle. Sing.<br>Laugh yourself silly.</p><p>Tricky truths, ridiculous photos, dodgy doodles and five-second radio adverts. All on your phones.</p><div class="hero-facts"><span>${icon("users", 16)} 2–8 players</span><span>${icon("phone", 16)} Any phone</span><span>${icon("check", 16)} No download</span></div></div><div class="entry-wrap"><div class="floating-card" aria-hidden="true"><small>ZERO TALENT REQUIRED.</small><p>“That’s your <em>advert?!</em>”</p></div><span class="party-spark" aria-hidden="true">✳</span><section class="entry-card" aria-labelledby="entry-title"><span class="entry-kicker">GOOD COMPANY. BAD POKER FACES.</span><h2 id="entry-title">${inviteCode ? "You’re invited. Bring your best nonsense." : "Bring your ridiculous side."}</h2><p>${inviteCode ? `Room ${esc(inviteCode)} is already filled in. Choose a nickname to join.` : "A mix of silly challenges. Your kind of people."}</p><form id="entry-form"><label for="nickname">What should we call you?</label><input id="nickname" name="name" placeholder="e.g. Sam" value="${esc(homeName)}" maxlength="22" minlength="2" autocomplete="nickname" required><button class="button primary full" type="submit" id="create-button">${icon(inviteCode ? "users" : "plus")} ${inviteCode ? "Join this room" : "Create a game"}</button><div class="divider">${inviteCode ? "YOUR ROOM CODE" : "GOT AN INVITE?"}</div><div class="join-row"><label for="room-code" class="room-code-label">Room code</label><input id="room-code" name="code" placeholder="K7P2QX" aria-label="Six-character room code" value="${esc(inviteCode)}" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false">${inviteCode ? "" : '<button type="button" class="button secondary" id="join-button">Join game</button>'}</div></form><button class="text-button demo-button" id="demo-button">${icon("play", 15)} Try a solo demo</button><p class="entry-foot">${icon("lock", 13)} Private rooms. No accounts. Just your people.</p></section></div></section><section class="how-strip" aria-label="How it works"><div class="how-item"><span class="how-icon">${icon("users", 22)}</span><div><h3>Round up your suspects.</h3><p>Share a room code. Everyone joins on their own phone.</p></div></div><div class="how-item"><span class="how-icon">${icon("eye", 22)}</span><div><h3>Pick your kind of chaos.</h3><p>Truths, photos, doodles. And tiny jingles.</p></div></div><div class="how-item"><span class="how-icon">${icon("sparkles", 22)}</span><div><h3>Play. Vote. Crack up.</h3><p>Vote, see the results, then tap Next together.</p></div></div></section></main>${footer()}`;
}
function roster(showScore = false) {
  return `<div class="player-list">${room.players.map((p) => `<div class="player-row">${avatar(p)}<div class="player-name">${esc(p.name)}${p.id === room.me ? " <small>You" + (p.id === room.hostId ? " · Host" : "") + "</small>" : p.id === room.hostId ? "<small>Host</small>" : p.bot ? "<small>Demo player</small>" : ""}</div>${showScore ? `<span class="points">${p.score}<small>pts</small></span>` : room.phase === "writing" && room.flowVersion === 2 ? `<span class="player-meta">${p.id === room.question?.playerId ? "Answering now" : "Voting next"}</span>` : room.phase === "writing" ? `<span class="player-meta ${p.ready ? "ready" : ""}">${p.ready ? icon("check", 15) + " Ready" : Math.min(p.answerCount, needed()) + "/" + needed() + " saved"}</span>` : isHost() && p.id !== room.me && !p.bot ? `<button class="icon-button" data-remove="${p.id}" aria-label="Remove ${esc(p.name)}">Remove</button>` : `<span class="player-meta">${p.profileReady === false ? "Choosing profile" : "Joined"}</span>`}</div>`).join("")}</div>`;
}
function controls() {
  const content = controlsContent();
  if (room.flowVersion !== 2) return content;
  if (!isHost())
    return room.hostAway
      ? '<button class="button secondary full" data-action="claim-host">Become host</button>'
      : "";
  return content
    ? `<details class="game-extras"><summary>Host options</summary>${content}</details>`
    : "";
}
function controlsContent() {
  if (!isHost())
    return (
      (room.hostAway
        ? '<button class="button secondary full" data-action="claim-host">Take over as host (host disconnected)</button>'
        : "") +
      '<p class="muted center" style="font-size:.8rem;margin:18px 0">Your choices stay private until the reveal. Your host can skip ahead if someone steps away.</p>'
    );
  return `<div class="host-controls">${room.deadline || room.pausedRemaining !== null ? `<button class="button secondary small" data-action="pause">${icon(room.pausedRemaining !== null ? "play" : "pause", 15)} ${room.pausedRemaining !== null ? "Resume" : "Pause"}</button>` : ""}${["reading", "discussion", "story"].includes(room.phase) ? '<button class="button secondary small" data-action="extend">' + icon("plus", 15) + " Add a minute</button>" : ""}${["reading", "discussion", "voting", "story", "posing", "copying", "drawing", "recording", "judging"].includes(room.phase) ? `<button class="button soft small" data-action="next" ${room.pausedRemaining !== null ? "disabled" : ""}>${room.phase === "posing" ? "Skip this face-off" : room.phase === "recording" ? "Close jingles and start voting" : room.phase === "drawing" ? "Close drawings and start voting" : room.phase === "copying" ? "Close photos and start judging" : room.phase === "judging" ? "Close voting and reveal" : room.phase === "voting" ? (waitingOn().length ? "Close voting and reveal" : "Reveal now") : room.phase === "discussion" ? "Open voting" : room.phase === "reveal" ? "Hear the story" : room.phase === "story" ? "Next question" : "Start discussion"}</button>` : ""}${
    room.players.some((p) => p.id !== room.me && !p.bot)
      ? `<label for="host-transfer" class="host-transfer-label">Hand over hosting</label><select class="host-transfer" id="host-transfer" data-transfer><option value="">Choose a player…</option>${room.players
          .filter((p) => p.id !== room.me && !p.bot)
          .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
          .join("")}</select>`
      : ""
  }</div>`;
}
function roomProfile() {
  return `<section class="panel room-profile" aria-labelledby="room-profile-title"><div><span class="eyebrow">YOUR PRIVATE PLAYER PROFILE</span><h2 id="room-profile-title">${room.ageGroup ? "Your questions, picked for you." : "One quick detail before we play."}</h2><p>Choose your age group for suitable questions. Only you can see or change it.</p></div><div class="room-profile-field"><label for="room-age-group">Your age group</label><select id="room-age-group" required><option value="" disabled ${room.ageGroup === null ? "selected" : ""}>Choose your age group</option><option value="child" ${room.ageGroup === "child" ? "selected" : ""}>Under 13</option><option value="teen" ${room.ageGroup === "teen" ? "selected" : ""}>13–17</option><option value="adult" ${room.ageGroup === "adult" ? "selected" : ""}>18–25</option><option value="adult26" ${room.ageGroup === "adult26" ? "selected" : ""}>26 and over</option></select><p class="age-hint">${room.ageGroup ? "Saved privately. You can change this until the game starts." : "Everyone chooses before the host can start. All 26+? Expect extra-silly questions."}</p></div></section>`;
}
function scoringGuide(mode = "mixed") {
  const truth = [
    ["eye", "+2", "Spot the truth", "Pick the real answer."],
    ["shuffle", "+1", "Sell your lie", "For each friend you fool."],
    ["sparkles", "+1", "Stump the room", "Bonus if nobody spots your truth."],
  ];
  const creative = [
    ["camera", "+2", "Photo vote", "For each vote your photo gets.", "faces"],
    [
      "pencil",
      "+2",
      "Doodle vote",
      "For each vote your doodle gets.",
      "doodles",
    ],
    ["mic", "+2", "Jingle vote", "For each vote your advert gets.", "audio"],
  ];
  const cards = [
    ...(["classic", "mixed"].includes(mode) ? truth : []),
    ...creative.filter((c) => mode === "mixed" || c[4] === mode),
  ];
  return `<div class="score-guide"><p class="score-goal">${icon("trophy", 20)} <strong>Most points wins.</strong></p><ul class="score-cards">${cards.map(([symbol, points, title, hint]) => `<li class="score-rule"><span class="score-rule-icon">${icon(symbol, 22)}</span><strong class="score-rule-points">${points}<small>pts</small></strong><div><strong>${title}</strong><p>${hint}</p></div></li>`).join("")}</ul><p class="score-footnote">No self-voting. Nice try.</p></div>`;
}
function lobby() {
  const settings = room.settings;
  const needsProfiles =
    room.flowVersion !== 2 &&
    room.players.some((p) => p.profileReady === false);
  return `${header()}<main id="main" class="pulse"><div class="game-head"><div><span class="eyebrow">GOOD COMPANY. RIDICULOUS ROUNDS.</span><h1>The room is yours.</h1><p>${isHost() ? "Grab your people. Pick your chaos. Let’s go." : "You’re in. Your host is rounding up the suspects."}</p></div><span class="pill lime">${icon("users", 16)} ${room.players.length}/8 players</span></div>${demoNote()}${room.flowVersion === 2 ? "" : roomProfile()}<div class="game-layout"><div><section class="room-invite"><span class="eyebrow">YOUR INVITE CODE</span><div class="room-code">${esc(room.code)}</div><p>One phone each. Send them the link.</p><div class="invite-actions"><button class="button" data-copy-link>${icon("link", 15)} Copy invite link</button><button class="button secondary" data-copy-code>${icon("copy", 15)} Copy code</button>${isHost() && !room.demo ? `<button class="button secondary" type="button" data-show-qr>${icon("phone", 15)} Show QR code</button>` : ""}</div></section><section class="panel"><div class="panel-title"><h2>Your people</h2>${isHost() ? `<button class="text-button" data-action="lock">${icon("lock", 15)} ${room.locked ? "Unlock lobby" : "Lock lobby"}</button>` : ""}</div>${roster()}${room.players.length < 8 ? `<div class="empty-slot"><span class="avatar">+</span>${room.players.length === 2 ? "Two is all you need. Start whenever you’re ready." : "There’s room for more questionable characters."}</div>` : ""}</section></div><section class="panel"><div class="panel-title"><h2>${icon("shuffle", 19)} Choose your game</h2><span class="pill purple">${isHost() ? "Host controls" : "Game settings"}</span></div><div class="settings-grid"><div class="field-row"><label for="game-mode">Game type<small>${room.demo ? "Text only. You and three bluffing bots." : (GAME_TYPES.find((type) => type.id === settings.mode) ?? GAME_TYPES[1]).description}</small></label><select id="game-mode" data-mode ${!isHost() || room.demo ? "disabled" : ""}>${GAME_TYPES.map(({ id, label }) => `<option value="${id}" ${(settings.mode ?? "classic") === id ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field-row"><label id="game-length-label"${room.flowVersion === 2 ? "" : ' for="game-length"'}>Pick your chaos<small>Questions for the whole room.</small></label>${
    room.flowVersion === 2
      ? `<div class="length-buckets" role="group" aria-labelledby="game-length-label">${GAME_LENGTHS.map((n, i) => `<button type="button" class="length-bucket ${settings.totalRounds === n ? "selected" : ""}" data-length="${n}" aria-pressed="${settings.totalRounds === n}" ${!isHost() ? "disabled" : ""}><strong>${n}</strong><span>${["Quick giggles", "Just right", "Big laughs", "Full chaos"][i]}</span><small>~${estimateMinutes(n, room.players.length < 2 ? 4 : room.players.length)} min</small></button>`).join("")}</div>`
      : `<select id="game-length" data-setting="questionsPerPlayer" ${!isHost() ? "disabled" : ""}><option value="1" ${settings.questionsPerPlayer === 1 ? "selected" : ""}>Quick game</option><option value="2" ${settings.questionsPerPlayer === 2 ? "selected" : ""}>Full game</option></select>`
  }</div></div><p class="settings-note" role="status">${gameSummary(settings)}</p><details class="scoring-help"><summary>How do I win?</summary>${scoringGuide(settings.mode ?? "classic")}</details>${isHost() ? `<button class="button primary full" data-action="start" ${room.players.length < 2 || needsProfiles ? "disabled" : ""}>${icon("play", 18)} ${room.players.length < 2 ? "One more human, please…" : needsProfiles ? "Waiting for player profiles…" : "Let’s play"}</button>` : '<div class="note center">Your host has the big Go button.</div>' + (room.hostAway ? '<button class="button secondary full" data-action="claim-host">Take over as host (host disconnected)</button>' : "")}<div class="note">${icon("shield", 17)} <strong>Keep it kind. Make it weird.</strong></div></section></div><div class="actions-row"><button class="text-button" data-leave>${icon("logout", 16)} ${room.demo ? "Exit demo" : "Leave room"}</button></div></main>${footer()}`;
}
function draftKey() {
  return (
    "bt-draft-" +
    session.code +
    (room?.flowVersion === 2 ? "-" + (room.question?.id ?? "lobby") : "")
  );
}
function getDraft() {
  if (!Object.keys(drafts).length) {
    drafts = storage.get(draftKey()) ?? {};
    for (const a of room.ownAnswers)
      drafts[a.promptId] ??= { truth: a.truth, lie: a.lie };
  }
  return drafts;
}
function timerMarkup() {
  return `<span class="timer" data-timer>${icon("clock", 19)} <span data-countdown>—</span></span>`;
}
// How many answer pairs each player needs: one per question they'll be asked.
const needed = () =>
  room.flowVersion === 2 ? 1 : room.settings.questionsPerPlayer;
const slotsKey = () => draftKey() + "-slots";
const filled = (id) =>
  Boolean(drafts[id]?.truth?.trim() || drafts[id]?.lie?.trim()) ||
  room.ownAnswers.some((a) => a.promptId === id);
// The prompts this player is answering. Starts with any they've already written, then fills from the offered prompts.
function slots() {
  const ids = room.prompts.map((p) => p.id);
  let list = (storage.get(slotsKey()) ?? []).filter((id) => ids.includes(id));
  for (const id of ids.filter(filled)) if (!list.includes(id)) list.push(id);
  for (const id of ids)
    if (list.length < needed() && !list.includes(id)) list.push(id);
  list = [...list.filter(filled), ...list.filter((id) => !filled(id))].slice(
    0,
    Math.max(needed(), list.filter(filled).length),
  );
  storage.set(slotsKey(), list);
  return list;
}
function swapPrompt(id) {
  const list = slots(),
    ids = room.prompts.map((p) => p.id),
    unused = ids.filter((x) => !list.includes(x));
  if (!unused.length || filled(id)) return;
  // Cycle through the offered prompts so "different question" never repeats the one you just skipped.
  const after = ids.slice(ids.indexOf(id) + 1).concat(ids);
  const next = after.find((x) => unused.includes(x));
  list[list.indexOf(id)] = next;
  storage.set(slotsKey(), list);
  delete fieldErrors["truth-" + id];
  delete fieldErrors["lie-" + id];
  render(true);
  $(`#truth-${next}`)?.focus();
}
const fieldErrors = {};
const fieldMessage = (kind) =>
  kind === "truth"
    ? "Add the real answer to finish this pair."
    : "Add a convincing lie to finish this pair.";
function answerField(p, kind, d) {
  const id = `${kind}-${p.id}`,
    err = fieldErrors[id];
  return `<div class="answer-field"><label class="${kind}-label" for="${id}">${icon(kind === "truth" ? "check" : "eye", 15)} ${kind === "truth" ? "The truth" : "The convincing lie"}</label><textarea id="${id}" data-prompt="${p.id}" data-kind="${kind}" maxlength="120" required aria-describedby="${id}-msg" ${err ? 'aria-invalid="true"' : ""} ${room.submitted ? "disabled" : ""}>${esc(d[p.id]?.[kind] ?? "")}</textarea><div class="field-foot"><span class="field-error" id="${id}-msg" role="alert" ${err ? "" : "hidden"}>${err ? esc(err) : ""}</span><span class="char-count"><span data-count-for="${id}">${(d[p.id]?.[kind] ?? "").length}</span>/120</span></div></div>`;
}
function simpleWriting() {
  const q = room.question,
    featured = person(q.playerId);
  if (q.playerId !== room.me)
    return `${header()}<main id="main" class="simple-round"><section class="round-wait center"><span class="pill purple">${esc(featured.name)}’s turn</span><h1>Bluff in progress.</h1><p>Your vote’s up next.</p></section></main>${footer()}`;
  const p = room.prompts[0],
    draft = getDraft();
  const extra = room.ownAnswers.find((a) => a.promptId === p.id)?.decoys;
  return `${header()}<main id="main" class="simple-round"><span class="pill lime">Your turn</span><h1 class="round-question">${esc(p.title)}</h1><form id="answers-form" novalidate><section class="panel answer-panel"><div class="answer-fields">${answerField(p, "truth", draft)}${answerField(p, "lie", draft)}</div>${extra ? `<details class="game-extras"><summary>Check the extra lies</summary><div class="decoy-options">${extra.map((text) => `<span>${esc(text)}</span>`).join("")}</div><button class="text-button" type="button" data-reroll="${p.id}">Swap extra lies</button></details>` : ""}</section><div class="save-strip"><span class="save-status" id="save-status">${esc(saveMessage)}</span><button class="button primary full round-primary" type="submit">Let them guess ${icon("play", 20)}</button></div></form>${controls()}</main>${footer()}`;
}
function writing() {
  if (room.flowVersion === 2) return simpleWriting();
  if (room.flowVersion === 2 && room.question?.playerId !== room.me) {
    const featured = person(room.question.playerId);
    return `${header()}<main id="main"><section class="panel round-wait"><span class="eyebrow">TRUTH & LIES · ANSWERING</span><h1>${esc(featured.name)} is cooking up a bluff.</h1><h2>${esc(room.question.title)}</h2><p>Poker face on. Voting’s up next.</p><div class="note" role="status">Waiting for ${esc(featured.name)}…</div></section></main>${footer()}`;
  }
  const d = getDraft(),
    list = slots(),
    prompts = list.map((id) => room.prompts.find((p) => p.id === id)),
    spare = room.prompts.length > list.length,
    n = needed();
  return `${header()}<main id="main" class="pulse"><div class="game-head"><div><span class="eyebrow">${room.flowVersion === 2 ? "YOUR TURN TO BLUFF" : "YOUR ANSWER SHEET · KEEP IT TO YOURSELF"}</span><h1>A little truth.<br>A very good lie.</h1><p>One truth. One lie. Keep it short. Make them doubt everything.</p></div>${room.flowVersion === 2 ? "" : `<span class="timer vote-count">${icon("check", 19)} ${room.players.filter((p) => p.ready).length}/${room.players.length} ready</span>`}</div>${demoNote()}${room.needsAnswers ? '<div class="note warning">Time’s up, but someone still needs a complete answer pair. The host can add a minute so everyone gets a turn.</div>' : ""}${room.pausedRemaining !== null ? '<div class="note warning">The host has paused the game. Your saved answers are safe.</div>' : ""}<div class="game-layout"><div><form id="answers-form" novalidate>${prompts
    .map(
      (p, i) =>
        `<section class="panel writing-card"><div class="prompt-heading"><span class="prompt-number">${room.flowVersion === 2 ? room.question.number : i + 1}</span><div><h3>${esc(p.title)}</h3><p>${esc(p.hint)}</p></div></div><div class="answer-fields">${answerField(p, "truth", d)}${answerField(p, "lie", d)}</div>${
          !room.submitted && spare && !filled(p.id)
            ? `<button class="text-button swap-prompt" type="button" data-swap="${p.id}">${icon("shuffle", 15)} Try a different question</button>`
            : ""
        }${
          room.ownAnswers.find((a) => a.promptId === p.id)?.decoys
            ? `<div class="decoy-review"><strong>Your extra decoys</strong><p>Both should be untrue about you. Swap them if either could also be correct.</p><div class="decoy-options">${room.ownAnswers
                .find((a) => a.promptId === p.id)
                .decoys.map((text) => `<span>${esc(text)}</span>`)
                .join(
                  "",
                )}</div><button class="text-button" type="button" data-reroll="${p.id}">${icon("shuffle", 15)} Swap decoys</button></div>`
            : ""
        }</section>`,
    )
    .join(
      "",
    )}<div class="save-strip"><span class="save-status" id="save-status">${room.submitted ? icon("check", 15) + " Answers ready. Nicely done." : esc(saveMessage)}</span>${room.submitted ? '<button class="button secondary small" type="button" id="edit-answers">Edit answers</button>' : '<button class="button primary" type="submit">' + icon("check", 17) + " Unleash my bluff</button>"}</div></form></div><aside class="panel"><div class="panel-title"><h2>${room.flowVersion === 2 ? "This round" : "How’s everyone doing?"}</h2></div>${roster()}<div class="note"><strong>A good lie lives close to the truth.</strong> Give it enough detail to sound real. The game adds two more decoys, including an outrageous wildcard.</div>${isHost() && room.flowVersion !== 2 ? `<button class="button primary full" data-action="begin" ${room.players.some((p) => p.answerCount === 0) || room.pausedRemaining !== null ? "disabled" : ""}>${"Start now with saved answers"}</button><p class="muted" style="font-size:.75rem;margin-top:12px">The game starts by itself once everyone is ready. Starting early locks everyone’s saved answers.</p>${controls()}` : '<p class="muted" style="font-size:.85rem">Send it. Let them squirm.</p>' + controls()}</aside></div></main>${footer()}`;
}
const phaseLabels = {
  reading: "Have a good look",
  discussion: "Make your case",
  voting: "Trust your instincts. Or don’t.",
  reveal: "The truth comes out",
  story: "Okay. We need the story.",
};
const letter = (i) => String.fromCharCode(65 + i);
const voterCount = () =>
  room.players.filter((p) => p.id !== room.question?.playerId).length;
// Players who still need to vote on the current question.
const waitingOn = () =>
  room.players.filter(
    (p) =>
      p.id !== room.question?.playerId && !(room.votedIds ?? []).includes(p.id),
  );
// After the reveal: everyone taps Next; the room moves on once they all have.
function nextPanel() {
  const ready = room.nextReadyIds ?? [],
    iAmReady = ready.includes(room.me),
    last = room.question.number === room.question.total,
    label = last ? "Crown the winner" : "Next question",
    reading = room.players.filter((p) => !ready.includes(p.id));
  return `<div class="next-panel">${
    iAmReady
      ? `<p class="next-status">${icon("check", 17)} Ready. Waiting for the crew.</p>`
      : `<button class="button primary full" data-action="ready-next" ${room.pausedRemaining !== null ? "disabled" : ""}>${label} ${icon("play", 16)}</button>`
  }${
    reading.length
      ? `<div class="waiting-panel"><span class="eyebrow">STILL READING</span><div class="waiting-list">${reading.map((p) => `<span class="waiting-chip">${avatar(p)}${esc(p.name)}${p.id === room.me ? " (you)" : ""}</span>`).join("")}</div>${isHost() && iAmReady ? `<button class="text-button skip-ahead" data-action="next">${icon("play", 15)} Skip ahead to the ${last ? "final scores" : "next question"}</button>` : ""}</div>`
      : ""
  }</div>`;
}
function waitingPanel() {
  const waiting = waitingOn();
  if (!waiting.length)
    return `<div class="waiting-panel done">${icon("check", 18)}<strong>Everyone has voted. Revealing…</strong></div>`;
  return `<div class="waiting-panel"><span class="eyebrow">STILL DECIDING</span><div class="waiting-list">${waiting.map((p) => `<span class="waiting-chip">${avatar(p)}${esc(p.name)}${p.id === room.me ? " (you)" : ""}</span>`).join("")}</div>${isHost() ? '<p class="muted">Missing a player? Open <strong>Host options</strong>.</p>' : ""}</div>`;
}
// Points a player earned on the question being revealed: +2 for the truth, +1 per friend fooled.
function roundPoints(playerId) {
  const result = room.result;
  if (!result) return 0;
  if (["face", "doodle", "audio"].includes(result.type))
    return (result.tally?.[playerId] ?? 0) * 2;
  const pick = result.picks.find((p) => p.playerId === playerId);
  return (
    (pick?.points ?? 0) +
    (playerId === room.question.playerId
      ? result.bluffPoints + (result.stumpBonus ?? 0)
      : 0)
  );
}
const revealChime = new RevealChime();
revealChime.enabled = storage.get("bt-reveal-sound") !== false;
let lastScoreReveal = storage.get("bt-last-score-reveal");
function scoreCelebration(final = false) {
  const gains = Object.fromEntries(
    room.players.map((p) => [p.id, final ? 0 : roundPoints(p.id)]),
  );
  const ranked = rankedScores(room.players, gains);
  const leaders = ranked.filter((p) => p.rank === 1);
  const topGain = Math.max(0, ...ranked.map((p) => p.gain));
  const personal = gains[room.me] ?? 0;
  return `<section class="score-celebration" aria-label="${final ? "Final leaderboard" : "Round scores and leaderboard"}"><div class="score-reveal-top"><span class="eyebrow">${final ? "FINAL STANDINGS" : "ROUND " + room.question.number + " · THE SCORES ARE IN"}</span><button class="text-button" data-reveal-sound aria-pressed="${revealChime.enabled}" aria-label="Score chime">${revealChime.enabled ? "🔊 Sound on" : "🔇 Sound off"}</button></div><div class="score-reveal-hero"><span class="score-reaction" aria-hidden="true">${final ? "🏆" : personal > 0 ? "🎉" : "👀"}</span><h2>${final ? "Bragging rights secured." : topGain ? "Points. Drama. Glory." : "Plot twist. Zero points!"}</h2><p class="leader-callout">${esc(leaders.map((p) => p.name).join(" & "))}${leaders.length > 1 ? (final ? " share the win!" : " share the lead!") : final ? " wins!" : " is in the lead!"}</p></div><div class="leaderboard-labels"><strong>${final ? "The final pecking order" : "The pecking order"}</strong><span>Total points</span></div><ol class="reveal-leaderboard">${ranked.map((p, i) => `<li class="reveal-player ${p.rank === 1 ? "is-leader" : ""} ${p.id === room.me ? "is-you" : ""}" style="--reveal-order:${i}"><span class="reveal-rank" aria-label="Rank ${p.rank}">${p.rank <= 3 ? `<span aria-hidden="true">${["🥇", "🥈", "🥉"][p.rank - 1]}</span>` : ""}<b>#${p.rank}</b></span>${avatar(p)}<div class="reveal-player-name"><strong>${esc(p.name)}${p.id === room.me ? " <small>(you)</small>" : ""}</strong>${!final && p.climbed > 0 ? `<small class="rank-climb">↑ Up ${p.climbed} ${p.climbed === 1 ? "place" : "places"}</small>` : p.rank === 1 ? "<small>Top of the chaos</small>" : ""}</div><div class="reveal-player-points"><strong data-score-total="${p.score}" data-score-from="${p.score - p.gain}">${p.score}</strong>${!final ? `<span class="reveal-gain ${p.gain ? "has-gain" : ""}">+${p.gain} this round</span>` : `<span>${p.score === 1 ? "point" : "points"}</span>`}</div></li>`).join("")}</ol>${!final ? `<p class="personal-gain"><strong>+${personal}</strong><span>your points this round</span></p>` : ""}</section>`;
}
function liveScoreboard() {
  const rows = rankedScores(room.players);
  return `<section class="live-scoreboard" style="--score-columns:${Math.min(4, rows.length)}" aria-label="Live leaderboard"><div class="live-score-heading"><strong>🏆 The scores</strong><span>Most points wins</span></div><ol>${rows.map((p) => `<li class="${p.rank === 1 ? "live-leader" : ""} ${p.id === room.me ? "live-you" : ""}"><span class="live-rank">#${p.rank}</span><strong class="live-player-name">${esc(p.name)}${p.id === room.me ? " <small>(you)</small>" : ""}</strong><b>${p.score}<small>pts</small></b></li>`).join("")}</ol></section>`;
}
function mountScoreReveal() {
  const final = room?.phase === "finished";
  if (
    !room ||
    (!final && !(["reveal", "story"].includes(room.phase) && room.result))
  )
    return;
  const key =
    room.code +
    ":" +
    (final
      ? "final:" + room.history.map((r) => r.question.id).join(",")
      : room.question.id);
  if (!final)
    $("main", app).insertAdjacentHTML("afterbegin", scoreCelebration());
  const fresh = key !== lastScoreReveal;
  if (!fresh) return;
  lastScoreReveal = key;
  storage.set("bt-last-score-reveal", key);
  revealChime.play(final);
  const panel = $(".score-celebration", app);
  if (!panel || matchMedia("(prefers-reduced-motion: reduce)").matches)
    return true;
  panel.classList.add("is-celebrating");
  celebrate();
  const totals = [...panel.querySelectorAll("[data-score-total]")];
  const started = performance.now();
  function countUp(now) {
    if (!panel.isConnected) return;
    const progress = Math.min(1, (now - started) / 850);
    const eased = 1 - (1 - progress) ** 3;
    for (const el of totals) {
      const from = Number(el.dataset.scoreFrom),
        to = Number(el.dataset.scoreTotal);
      el.textContent = Math.round(from + (to - from) * eased);
    }
    if (progress < 1) requestAnimationFrame(countUp);
  }
  requestAnimationFrame(countUp);
  return true;
}
function rankOf(p) {
  return room.players.filter((x) => x.score > p.score).length + 1;
}
function profileCard() {
  const p = me();
  if (!p) return "";
  const delta = room.result ? roundPoints(p.id) : null;
  return `<section class="my-profile" aria-label="Your profile">${avatar(p)}<div class="my-profile-name"><span class="eyebrow">YOUR PROFILE</span><strong>${esc(p.name)}</strong><small>Rank ${rankOf(p)} of ${room.players.length}${["faces", "doodles"].includes(room.settings.mode ?? "classic") ? "" : ` · ${p.correct} ${p.correct === 1 ? "truth" : "truths"} spotted · ${p.fooled} fooled`}</small></div><div class="my-profile-score">${delta !== null ? `<span class="delta ${delta ? "up" : ""}">+${delta} this round</span>` : ""}<span class="points">${p.score}<small>pts</small></span></div></section>`;
}
function noVoteWarning() {
  return `<div class="no-vote-warning" role="status">${icon("alert", 24)}<div><strong>You can’t vote on your own question</strong><p>${room.phase === "voting" ? "They’re guessing. Keep that poker face." : "Keep that poker face."}</p></div></div>`;
}
// What the featured player hears about their own question.
function ownResult(result) {
  const fooled = result.picks.filter((p) => p.optionId === result.lieId).length,
    total = result.bluffPoints + (result.stumpBonus ?? 0),
    pts = `+${total} ${total === 1 ? "point" : "points"} for you.`;
  if (result.stumpBonus && fooled)
    return `Your lie fooled <strong>${fooled} ${fooled === 1 ? "person" : "people"}</strong> and nobody spotted your truth. ${pts}`;
  if (result.stumpBonus)
    return `<strong>Nobody spotted your truth.</strong> ${pts}`;
  if (fooled)
    return `Your lie fooled <strong>${fooled} ${fooled === 1 ? "person" : "people"}</strong>. ${pts}`;
  return result.picks.length
    ? "They saw right through it."
    : "Nobody voted on this one.";
}
function roundResults() {
  const q = room.question,
    result = room.result,
    subject = person(q.playerId),
    optionLabel = (id) => {
      const i = q.options.findIndex((o) => o.id === id);
      return i < 0 ? "" : `${letter(i)}. ${esc(q.options[i].text)}`;
    },
    fooled = result.picks
      .filter((p) => p.optionId === result.lieId)
      .map((p) => esc(person(p.playerId)?.name ?? "Player")),
    row = (p, tag, tagClass, detail, pts) =>
      `<div class="round-row">${avatar(p)}<div class="round-who"><strong>${esc(p.name)}${p.id === room.me ? " <small>You</small>" : ""}</strong><span class="round-tag ${tagClass}">${tag}</span>${detail ? `<span class="round-pick">${detail}</span>` : ""}</div><span class="round-points ${pts ? "up" : ""}">+${pts}</span></div>`;
  const voters = room.players
    .filter((p) => p.id !== q.playerId)
    .map((p) => {
      const pick = result.picks.find((x) => x.playerId === p.id);
      if (!pick) return row(p, "Didn’t vote", "none", "", 0);
      const kind =
        pick.optionId === result.truthId
          ? ["Spotted the truth", "truth"]
          : pick.optionId === result.lieId
            ? [`Fell for ${esc(subject.name)}’s lie`, "lie"]
            : ["Picked a decoy", "decoy"];
      return row(p, kind[0], kind[1], optionLabel(pick.optionId), pick.points);
    })
    .join("");
  const bluffer = row(
    subject,
    "The bluffer",
    "bluffer",
    [
      fooled.length
        ? `Their lie fooled ${fooled.join(" & ")}`
        : "Nobody fell for their lie",
      result.stumpBonus ? "nobody spotted their truth (+1 bonus)" : "",
    ]
      .filter(Boolean)
      .join(" · "),
    result.bluffPoints + (result.stumpBonus ?? 0),
  );
  return `<section class="round-results" aria-labelledby="round-results-title"><div class="round-results-head"><h2 id="round-results-title">Points this round</h2><span class="muted">Truth +2 · Each friend fooled +1 · Nobody spots the truth +1</span></div>${bluffer}${voters}</section>`;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function gameSummary(settings) {
  if (room.flowVersion === 2) {
    const count = room.settings.totalRounds ?? 10;
    const people = room.players.length < 2 ? 4 : room.players.length;
    const mix = partyMixCounts(count, true, room.mixGameNumber ?? 0);
    const breakdown =
      (settings.mode ?? "classic") === "mixed"
        ? `${mix.truth} text · ${mix.face} photo · ${mix.doodle} doodle · ${mix.audio} jingle. `
        : "";
    const shortWarning =
      settings.mode === "mixed" && room.players.length > mix.truth
        ? " Pick 20+ so everyone gets a text turn."
        : "";
    return `${breakdown}~${estimateMinutes(count, people)} min for ${people} players${room.players.length < 2 ? " (estimated)" : ""}.${shortWarning}`;
  }
  const n = room.players.length * settings.questionsPerPlayer,
    mode = settings.mode ?? "classic";
  return mode === "faces"
    ? `${plural(n, "face-off round", "face-off rounds")}.`
    : mode === "doodles"
      ? `${plural(n, "doodle round", "doodle rounds")}.`
      : mode === "mixed"
        ? `${plural(n, "truth question", "truth questions")} and ${plural(room.players.length, "face-off or doodle round", "face-off or doodle rounds")}.`
        : `${plural(n, "question", "questions")}.`;
}
// ---- Face off: one player pulls a face, everyone copies it, the room votes on the best copy. ----
let photoCache = { questionId: null, photos: {} },
  photoKey = "",
  photoBusy = false;
const photoOf = (id) =>
  room.question && photoCache.questionId === room.question.id
    ? photoCache.photos[id]
    : null;
async function loadPhotos() {
  const q = room?.question;
  if (!["face", "doodle"].includes(q?.type)) return;
  const key = [q.id, room.phase, ...(room.shotIds ?? [])].join("|");
  if (key === photoKey) return;
  photoKey = key;
  try {
    const captured = session;
    const data = await request(`/api/rooms/${captured.code}/photos`);
    if (
      session !== captured ||
      data.questionId !== room?.question?.id ||
      key !== photoKey
    )
      return;
    photoCache = {
      questionId: data.questionId,
      photos: data.photos,
    };
    render(true);
  } catch {
    photoKey = "";
  }
}
const photoDraft = new PhotoDraft({
  getItem: (key) => sessionStorage.getItem(key),
  setItem: (key, value) => sessionStorage.setItem(key, value),
  removeItem: (key) => sessionStorage.removeItem(key),
});
let photoSending = false;
let photoCapture = null,
  photoGeneration = 0,
  photoError = "";
const photoContext = () =>
  room?.question
    ? { code: room.code, playerId: room.me, questionId: room.question.id }
    : null;
const samePhotoContext = (context) =>
  context &&
  ["code", "playerId", "questionId"].every(
    (key) => context[key] === photoContext()?.[key],
  );
function clearPhotoDraft() {
  photoGeneration++;
  photoCapture = null;
  photoDraft.clear();
  photoError = "";
}
function openPhotoPicker() {
  if (photoBusy || busy || room?.pausedRemaining !== null) return;
  photoCapture = photoContext();
  const input = $("#photo-input");
  input.value = "";
  input.click();
}
async function uploadPhoto(file) {
  const captured = photoCapture;
  if (!file || photoBusy) return;
  if (!samePhotoContext(captured)) {
    toast("The room moved on. That photo wasn’t sent.");
    return;
  }
  const generation = ++photoGeneration;
  photoBusy = true;
  photoError = "";
  render(true);
  try {
    const image = await preparePhoto(file);
    if (generation !== photoGeneration || !samePhotoContext(captured)) return;
    photoDraft.set(captured, image);
  } catch (error) {
    if (generation === photoGeneration) photoError = error.message;
  } finally {
    photoBusy = false;
    $("#photo-input").value = "";
    render(true);
  }
}
async function filterPhoto(filter) {
  if (photoBusy || !photoDraft.matches(photoContext())) return;
  const generation = ++photoGeneration,
    draft = photoDraft.value;
  photoBusy = true;
  photoError = "";
  render(true);
  try {
    const image = await applyPhotoFilter(draft.source, filter);
    if (
      generation === photoGeneration &&
      photoDraft.value === draft &&
      samePhotoContext(draft)
    )
      photoDraft.filtered(filter, image);
  } catch (error) {
    if (generation === photoGeneration) photoError = error.message;
  } finally {
    photoBusy = false;
    render(true);
  }
}
async function sendPhoto() {
  const draft = photoDraft.value;
  if (photoBusy || !photoDraft.matches(photoContext())) return;
  if (busy) {
    photoError =
      "Still sending something else. Your photo’s safe—try again in a moment.";
    render(true);
    return;
  }
  const actionSession = session;
  photoBusy = true;
  photoSending = true;
  photoError = "";
  draft.requestId ??= uuid();
  photoDraft.save();
  render(true);
  try {
    const response = await send(
      "photo",
      { questionId: draft.questionId, image: draft.image },
      draft.requestId,
    );
    if (session !== actionSession || !samePhotoContext(draft)) return;
    if (!response?.room?.shotIds?.includes(draft.playerId))
      throw new Error("We couldn’t confirm your photo. Tap Send again.");
    if (photoDraft.value === draft) photoDraft.clear();
    if (photoCache.questionId !== draft.questionId)
      photoCache = { questionId: draft.questionId, photos: {} };
    photoCache.photos[draft.playerId] = draft.image;
    photoKey = "";
    loadPhotos();
    toast("Photo sent. Nailed it!");
  } catch (error) {
    if (samePhotoContext(draft))
      photoError = `${error.message} Your photo’s saved here. Tap Send to retry.`;
  } finally {
    photoBusy = false;
    photoSending = false;
    render(true);
  }
}
function photoButton(label) {
  const draft = photoDraft.matches(photoContext()) ? photoDraft.value : null;
  return `${photoError ? `<p class="field-error" role="alert">${esc(photoError)}</p>` : ""}${draft ? `<section class="photo-editor" aria-label="Photo preview and filters"><img class="photo-draft-preview" src="${draft.image}" alt="Your photo preview with the ${esc(draft.filter)} filter"><div class="photo-filters" role="group" aria-label="Photo filters">${PHOTO_FILTERS.map(([id, label]) => `<button type="button" class="photo-filter ${draft.filter === id ? "selected" : ""}" data-photo-filter="${id}" aria-pressed="${draft.filter === id}" ${photoBusy ? "disabled" : ""}>${label}</button>`).join("")}</div><p class="muted center">Pick a filter. Unleash that face.</p><button class="button primary full photo-button" type="button" data-send-photo ${photoBusy || busy || room.pausedRemaining !== null ? "disabled" : ""}>${icon("check", 20)} ${photoBusy ? (photoSending ? "Sending photo…" : "Getting your photo ready…") : photoError ? "Retry sending photo" : "Send my photo"}</button><button class="text-button" type="button" data-take-photo ${photoBusy ? "disabled" : ""}>Take another photo</button></section>` : `<button class="button primary full photo-button" type="button" data-take-photo ${photoBusy || busy || room.pausedRemaining !== null ? "disabled" : ""}>${icon("camera", 20)} ${photoBusy ? "Getting your photo ready…" : label}</button>`}`;
}
function facePhoto(id, caption, extra = "") {
  const src = photoOf(id);
  return `<figure class="face-photo ${extra}">${src ? `<img src="${src}" alt="${esc(caption)}">` : `<span class="face-placeholder">${icon("camera", 28)}</span>`}<figcaption>${caption}</figcaption></figure>`;
}
const copierIds = () =>
  room.players.filter((p) => p.id !== room.question.playerId).map((p) => p.id);
const copyIds = () =>
  (room.shotIds ?? []).filter((id) => id !== room.question.playerId);
// Anyone with at least one copy that isn't their own can judge.
const judgeIds = () =>
  room.players.map((p) => p.id).filter((id) => copyIds().some((c) => c !== id));
function waitingChips(ids, title) {
  const people = ids.map(person).filter(Boolean);
  if (!people.length) return "";
  return `<div class="waiting-panel"><span class="eyebrow">${title}</span><div class="waiting-list">${people.map((p) => `<span class="waiting-chip">${avatar(p)}${esc(p.name)}${p.id === room.me ? " (you)" : ""}</span>`).join("")}</div></div>`;
}
function faceResults() {
  const result = room.result,
    copies = [...result.copies].sort(
      (a, b) => (result.tally[b] ?? 0) - (result.tally[a] ?? 0),
    ),
    top = Math.max(0, ...copies.map((id) => result.tally[id] ?? 0));
  const grid = `<div class="face-grid">${copies
    .map((id) => {
      const votes = result.tally[id] ?? 0,
        p = person(id);
      return facePhoto(
        id,
        `${esc(p?.name ?? "Player")}${id === room.me ? " (you)" : ""} · ${votes} ${votes === 1 ? "vote" : "votes"} · <b>+${votes * 2}</b>`,
        votes && votes === top ? "winner" : "",
      );
    })
    .join("")}</div>`;
  const winners = copies.filter((id) => top && (result.tally[id] ?? 0) === top);
  const headline = !copies.length
    ? "Nobody sent a copy this time."
    : winners.length
      ? `${icon("crown", 20)} Best copy: <strong>${esc(winners.map((id) => person(id)?.name).join(" & "))}</strong>`
      : "No votes this round.";
  return `<p class="face-headline">${headline}</p>${grid}<p class="muted face-rule">Each vote for your copy: +2</p>`;
}
// ---- Doodle off: everyone draws the same prompt; the room votes for the funniest. ----
const PAD_SIZE = 400,
  PAD_COLOURS = [
    ["#211439", "Black"],
    ["#e5484d", "Red"],
    ["#2f80ed", "Blue"],
    ["#27ae60", "Green"],
    ["#f2b705", "Yellow"],
  ];
// Strokes live here, not in the canvas, so a screen refresh never wipes a drawing in progress.
let penDown = false;
let pad = {
  questionId: null,
  strokes: [],
  colour: PAD_COLOURS[0][0],
  size: 6,
  editing: true,
  error: "",
};
// Keep an unfinished drawing on this device, so a refresh or dropped connection doesn't lose it.
const padKey = (questionId) =>
  `bt-doodle-${session?.code}-${room?.me}-${questionId}`;
function savePad() {
  try {
    sessionStorage.setItem(padKey(pad.questionId), JSON.stringify(pad.strokes));
  } catch {}
}
function resetPad(questionId) {
  let strokes = [];
  try {
    strokes = JSON.parse(sessionStorage.getItem(padKey(questionId))) ?? [];
  } catch {}
  pad = {
    questionId,
    strokes,
    colour: PAD_COLOURS[0][0],
    size: 6,
    editing: true,
    error: "",
  };
}
function drawStrokes(ctx) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAD_SIZE, PAD_SIZE);
  ctx.lineCap = ctx.lineJoin = "round";
  for (const stroke of pad.strokes) {
    ctx.strokeStyle = ctx.fillStyle = stroke.colour;
    ctx.lineWidth = stroke.size;
    const [first, ...rest] = stroke.points;
    if (!rest.length) {
      ctx.beginPath();
      ctx.arc(first[0], first[1], stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(...first);
    for (const point of rest) ctx.lineTo(...point);
    ctx.stroke();
  }
}
// Called after every render: wire up the canvas (if it's on screen) and redraw the strokes.
function mountPad() {
  const canvas = $("#doodle-pad");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  drawStrokes(ctx);
  let current = null;
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * PAD_SIZE,
      ((e.clientY - r.top) / r.height) * PAD_SIZE,
    ];
  };
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    penDown = true;
    current = { colour: pad.colour, size: pad.size, points: [at(e)] };
    pad.strokes.push(current);
    if (pad.error) {
      pad.error = "";
      const msg = $("#pad-error");
      if (msg) msg.hidden = true;
    }
    drawStrokes(ctx);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!current) return;
    current.points.push(at(e));
    drawStrokes(ctx);
  });
  const end = () => {
    if (current) savePad();
    current = null;
    penDown = false;
    // Catch up on anything that changed while the pen was down.
    if (room) render();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}
async function sendDrawing() {
  if (photoBusy) return;
  if (!pad.strokes.length) {
    pad.error = "Draw something first, even a stick figure counts.";
    render(true);
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PAD_SIZE;
  drawStrokes(canvas.getContext("2d"));
  let quality = 0.8,
    image = canvas.toDataURL("image/jpeg", quality);
  while (image.length > 56000 && quality > 0.3)
    image = canvas.toDataURL("image/jpeg", (quality -= 0.1));
  photoBusy = true;
  render(true);
  const questionId = room.question.id;
  try {
    photoCache =
      photoCache.questionId === questionId
        ? { questionId, photos: { ...photoCache.photos, [room.me]: image } }
        : { questionId, photos: { [room.me]: image } };
    await send("photo", { questionId, image });
    pad.editing = false;
  } catch {
    toast("Your drawing didn’t send. Check your connection and try again.");
  } finally {
    photoBusy = false;
    render(true);
  }
}
function padMarkup() {
  return `<div class="doodle-pad-wrap"><canvas id="doodle-pad" width="${PAD_SIZE}" height="${PAD_SIZE}" role="img" aria-label="Drawing pad. Draw with your finger or mouse."></canvas><div class="pad-tools" role="group" aria-label="Drawing tools">${PAD_COLOURS.map(
    ([c, name]) =>
      `<button type="button" class="swatch ${pad.colour === c ? "active" : ""}" data-pad-colour="${c}" style="--swatch:${c}" aria-label="${name}" aria-pressed="${pad.colour === c}"></button>`,
  ).join(
    "",
  )}<button type="button" class="pad-tool" data-pad-size aria-label="${pad.size > 6 ? "Use thin brush" : "Use thick brush"}">${pad.size > 6 ? "Thick" : "Thin"}</button><button type="button" class="pad-tool" data-pad="undo" aria-label="Undo last line">${icon("undo", 18)}</button><button type="button" class="pad-tool" data-pad="clear" aria-label="Clear drawing">${icon("trash", 18)}</button></div><p class="field-error pad-error" id="pad-error" role="alert" ${pad.error ? "" : "hidden"}>${esc(pad.error)}</p><button class="button primary full photo-button" type="button" data-pad="send" ${photoBusy ? "disabled" : ""}>${icon("check", 20)} ${photoBusy ? "Sending…" : "Send my drawing"}</button></div>`;
}
// Stable but scrambled order for anonymous voting, different each round.
function hashed(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}
function anonymousOrder(ids) {
  return [...ids].sort(
    (a, b) => hashed(room.question.id + a) - hashed(room.question.id + b),
  );
}
function doodleScreen() {
  const q = room.question,
    featured = person(q.playerId),
    shots = room.shotIds ?? [],
    myShot = shots.includes(room.me);
  if (pad.questionId !== q.id) resetPad(q.id);
  const labels = {
    drawing: "Get drawing",
    judging: "Vote for the funniest",
    reveal: "And the funniest drawing is…",
  };
  let count = "";
  if (room.phase === "drawing")
    count = `${icon("pencil", 19)} ${shots.length}/${room.players.length}`;
  if (room.phase === "judging")
    count = `${icon("users", 19)} ${(room.votedIds ?? []).length}/${judgeIds().length}`;
  if (room.phase === "reveal")
    count = `${icon("check", 19)} ${(room.nextReadyIds ?? []).length}/${room.players.length}`;
  const prompt = `<h1 class="question-title doodle-prompt">${esc(q.title)}</h1>`;
  let body = "";
  if (room.phase === "drawing")
    body = `${prompt}${
      myShot && !pad.editing
        ? `<div class="face-mine">${facePhoto(room.me, "Your drawing")}<div><p class="next-status">${icon("check", 17)} Drawing sent. You can change it until everyone’s done.</p><button class="button secondary full" type="button" data-pad="edit">${icon("pencil", 18)} Change my drawing</button></div></div>`
        : `<p class="phase-message center">Everyone draws this, ${q.playerId === room.me ? "you included" : `${esc(featured.name)} included`}. It doesn’t have to be good. It has to be funny.</p>${padMarkup()}`
    }${waitingChips(
      room.players.map((p) => p.id).filter((id) => !shots.includes(id)),
      "STILL DRAWING",
    )}`;
  if (room.phase === "judging") {
    const canJudge = judgeIds().includes(room.me),
      order = anonymousOrder(shots);
    body = `${prompt}<p class="phase-message center">${canJudge ? "Names are hidden until the results. Tap the funniest drawing. You can change your vote until everyone’s in." : "There’s nothing for you to vote on this round."}</p><div class="face-grid">${order
      .map((id, i) => {
        const own = id === room.me,
          chosen = room.myVote === id,
          label = own ? "Your drawing" : `Drawing ${i + 1}`;
        return `<div class="face-choice ${chosen ? "chosen" : ""}">${facePhoto(id, label, "doodle")}${
          own
            ? `<span class="face-own">${icon("lock", 15)} You can’t vote for your own</span>`
            : canJudge
              ? `<button class="button ${chosen ? "primary" : "secondary"} full" type="button" data-face-vote="${id}" aria-pressed="${chosen}">${chosen ? icon("check", 16) + " Your vote" : `Vote for drawing ${i + 1}`}</button>`
              : ""
        }</div>`;
      })
      .join("")}</div>${
      room.deadline
        ? `<div class="waiting-panel done">${icon("check", 18)}<strong>Everyone has voted. Revealing…</strong></div>`
        : waitingChips(
            judgeIds().filter((id) => !(room.votedIds ?? []).includes(id)),
            "STILL DECIDING",
          )
    }`;
  }
  if (room.phase === "reveal") {
    const result = room.result,
      entries = [...result.copies].sort(
        (a, b) => (result.tally[b] ?? 0) - (result.tally[a] ?? 0),
      ),
      top = Math.max(0, ...entries.map((id) => result.tally[id] ?? 0)),
      winners = entries.filter((id) => top && (result.tally[id] ?? 0) === top);
    body = `${prompt}<p class="face-headline">${
      !entries.length
        ? "Nobody sent a drawing this time."
        : winners.length
          ? `${icon("crown", 20)} Funniest drawing: <strong>${esc(winners.map((id) => person(id)?.name).join(" & "))}</strong>`
          : "No votes this round."
    }</p><div class="face-grid">${entries
      .map((id) => {
        const votes = result.tally[id] ?? 0;
        return facePhoto(
          id,
          `${esc(person(id)?.name ?? "Player")}${id === room.me ? " (you)" : ""} · ${votes} ${votes === 1 ? "vote" : "votes"} · <b>+${votes * 2}</b>`,
          `doodle ${votes && votes === top ? "winner" : ""}`,
        );
      })
      .join(
        "",
      )}</div><p class="muted face-rule">Each vote for your drawing: +2</p>${nextPanel()}`;
  }
  return `${header()}<main id="main" class="question-stage pulse">${demoNote()}<div class="status-banner"><div><span class="eyebrow" style="margin:0 0 5px">DOODLE OFF</span><strong>${esc(labels[room.phase] ?? "")}</strong></div>${count ? `<span class="timer vote-count">${count}</span>` : ""}</div>${room.pausedRemaining !== null ? '<div class="note warning">Game paused. Take a breath. The host will resume when everyone is ready.</div>' : ""}${room.flowVersion === 2 ? "" : profileCard()}<section class="question-card face-card"><div class="question-topline"><div class="subject">${avatar(featured)}<div class="subject-details"><strong>${esc(featured.name)}${q.playerId === room.me ? " (you)" : ""}</strong><small>Starring in this drawing.</small></div></div><span class="pill purple">${icon("pencil", 14)} Doodle off</span></div>${body}${controls()}</section><div class="mini-scoreboard">${[
    ...room.players,
  ]
    .sort((a, b) => b.score - a.score)
    .map((p) => {
      const delta = roundPoints(p.id);
      return `<span>${esc(p.name)}<b>${p.score}</b>${delta ? `<i class="delta up">+${delta}</i>` : ""}</span>`;
    })
    .join("")}</div></main>${footer()}`;
}
function faceScreen() {
  const q = room.question,
    poser = person(q.playerId),
    mine = q.playerId === room.me,
    shots = room.shotIds ?? [],
    myShot = shots.includes(room.me);
  const labels = {
    posing: mine
      ? "Your turn to pull a face"
      : `${poser.name} is pulling a face`,
    copying: "Copy that face",
    judging: "Pick the best copy",
    reveal: "And the best copy is…",
  };
  let count = "";
  if (room.phase === "copying")
    count = `${icon("camera", 19)} ${copyIds().length}/${copierIds().length}`;
  if (room.phase === "judging")
    count = `${icon("users", 19)} ${(room.votedIds ?? []).length}/${judgeIds().length}`;
  if (room.phase === "reveal")
    count = `${icon("check", 19)} ${(room.nextReadyIds ?? []).length}/${room.players.length}`;
  let body = "";
  if (room.phase === "posing")
    body = mine
      ? `<div class="face-cta"><p>Pull a ridiculous face.</p>${photoButton("Snap your face")}</div>`
      : `<div class="face-wait">${avatar(poser)}<p><strong>${esc(poser.name)}</strong> is pulling their silliest face. You’re copying next.</p></div>`;
  if (room.phase === "copying")
    body = `<div class="face-target">${facePhoto(q.playerId, `${esc(poser.name)}’s face`, "target")}</div>${
      mine
        ? `<p class="phase-message center">Your work here is done. Watch them try.</p>`
        : photoDraft.matches(photoContext()) || !myShot
          ? `<p class="phase-message center">Copy that face.</p>${photoButton("Snap your copy")}`
          : `<div class="face-mine">${facePhoto(room.me, "Your copy")}<div><p class="next-status">${icon("check", 17)} Copy sent!</p><button class="button secondary full" type="button" data-take-photo ${photoBusy ? "disabled" : ""}>${icon("camera", 18)} Retake my copy</button></div></div>`
    }${waitingChips(
      copierIds().filter((id) => !shots.includes(id)),
      "STILL SNAPPING",
    )}`;
  if (room.phase === "judging") {
    const canJudge = judgeIds().includes(room.me);
    body = `<div class="face-target">${facePhoto(q.playerId, `${esc(poser.name)}’s face`, "target")}</div><p class="phase-message center">${canJudge ? "Who nailed it? Tap to vote." : "There’s nothing for you to judge this round. Sit back and watch."}</p><div class="face-grid">${copyIds()
      .map((id) => {
        const p = person(id),
          own = id === room.me,
          chosen = room.myVote === id;
        return `<div class="face-choice ${chosen ? "chosen" : ""}">${facePhoto(id, `${esc(p?.name ?? "Player")}${own ? " (you)" : ""}`)}${
          own
            ? `<span class="face-own">${icon("lock", 15)} Your copy</span>`
            : canJudge
              ? `<button class="button ${chosen ? "primary" : "secondary"} full" type="button" data-face-vote="${id}" aria-pressed="${chosen}">${chosen ? icon("check", 16) + " Your vote" : "Vote for " + esc(p?.name ?? "this copy")}</button>`
              : ""
        }</div>`;
      })
      .join("")}</div>${
      room.deadline
        ? `<div class="waiting-panel done">${icon("check", 18)}<strong>Everyone has voted. Revealing…</strong></div>`
        : waitingChips(
            judgeIds().filter((id) => !(room.votedIds ?? []).includes(id)),
            "STILL DECIDING",
          )
    }`;
  }
  if (room.phase === "reveal")
    body = `<div class="face-target">${facePhoto(q.playerId, `${esc(poser.name)}’s face`, "target")}</div>${faceResults()}${nextPanel()}`;
  return `${header()}<main id="main" class="question-stage pulse">${demoNote()}<div class="status-banner"><div><span class="eyebrow" style="margin:0 0 5px">FACE OFF</span><strong>${esc(labels[room.phase] ?? "")}</strong></div>${count ? `<span class="timer vote-count">${count}</span>` : ""}</div>${room.pausedRemaining !== null ? '<div class="note warning">Game paused. Take a breath. The host will resume when everyone is ready.</div>' : ""}${room.flowVersion === 2 ? "" : profileCard()}<section class="question-card face-card"><div class="question-topline"><div class="subject">${avatar(poser)}<div class="subject-details"><strong>${esc(poser.name)}${mine ? " (you)" : ""}</strong><small>Pulls the face. Everyone copies it.</small></div></div><span class="pill purple">${icon("camera", 14)} Face off</span></div>${body}${controls()}</section><div class="mini-scoreboard">${[
    ...room.players,
  ]
    .sort((a, b) => b.score - a.score)
    .map((p) => {
      const delta = roundPoints(p.id);
      return `<span>${esc(p.name)}<b>${p.score}</b>${delta ? `<i class="delta up">+${delta}</i>` : ""}</span>`;
    })
    .join("")}</div></main>${footer()}`;
}
let audioCache = { questionId: null, clips: {} },
  audioKey = "";
const jingle = new JingleRecorder(
  () => render(true),
  (seconds) => {
    const label = $("#jingle-seconds");
    if (label) label.textContent = seconds;
  },
);
async function loadAudio() {
  const q = room?.question;
  if (q?.type !== "audio") return;
  const key = [q.id, room.phase, ...(room.clipIds ?? [])].join("|");
  if (key === audioKey) return;
  audioKey = key;
  const captured = session;
  try {
    const data = await request(`/api/rooms/${session.code}/audio`);
    if (session !== captured || data.questionId !== room?.question?.id) return;
    audioCache = { questionId: data.questionId, clips: data.clips };
    render(true);
  } catch {
    audioKey = "";
  }
}
const audioOf = (id) =>
  audioCache.questionId === room.question?.id ? audioCache.clips[id] : null;
function audioPlayer(src, label) {
  return src
    ? `<audio controls preload="none" src="${esc(src)}" aria-label="${esc(label)}"></audio>`
    : '<p class="muted">Loading jingle…</p>';
}
function audioScreen() {
  const q = room.question,
    ids = room.clipIds ?? [],
    skipped = room.audioSkippedIds ?? [],
    sent = ids.includes(room.me),
    ready = sent || skipped.includes(room.me);
  let body = "";
  if (room.phase === "recording") {
    const recording = jingle.status === "recording",
      working = ["asking", "processing"].includes(jingle.status);
    body = `<p class="jingle-hint">Give it a catchy line. Sing it or say it. Five seconds.</p>${jingle.error ? `<p class="field-error" role="alert">${esc(jingle.error)}</p>` : ""}${jingle.draft ? `<div class="jingle-preview">${audioPlayer(jingle.draft, "Your jingle preview")}</div><button class="button primary full round-primary" data-jingle="send" ${busy ? "disabled" : ""}>Send my jingle</button><button class="text-button" data-jingle="record">Record again</button>` : sent ? `<div class="jingle-preview">${audioPlayer(audioOf(room.me), "Your submitted jingle")}</div><p class="next-status">Jingle sent. Waiting for the crew.</p><button class="text-button" data-jingle="record">Record again</button>` : skipped.includes(room.me) ? '<p class="next-status">Sitting this one out. You can still vote.</p><button class="button secondary full" data-jingle="record">Record a jingle instead</button>' : `<button class="button primary full round-primary ${recording ? "is-recording" : ""}" data-jingle="${recording ? "stop" : "record"}" ${working ? "disabled" : ""}>${recording ? 'Stop · <span id="jingle-seconds">5</span>s' : jingle.status === "asking" ? "Allow your microphone…" : jingle.status === "processing" ? "Getting your jingle ready…" : "Record my jingle"}</button>`}${!ready && !recording && !working && !jingle.draft ? '<button class="text-button jingle-skip" data-jingle="skip">Skip my jingle</button>' : ""}<p class="muted center">${ids.length + skipped.length}/${room.players.length} ready</p>`;
  } else {
    const revealed = room.phase === "reveal",
      result = room.result;
    body = `<p class="jingle-hint">${revealed ? "Bragging rights unlocked." : "Play them. Pick your favourite."}</p><div class="jingle-entries">${anonymousOrder(
      ids,
    )
      .map((id, index) => {
        const own = id === room.me,
          chosen = room.myVote === id,
          label = revealed
            ? person(id).name
            : own
              ? "Your jingle"
              : `Jingle ${index + 1}`;
        const canVote = ids.some((entry) => entry !== room.me);
        return `<article class="jingle-entry ${chosen ? "chosen" : ""}"><strong>${esc(label)}</strong>${audioPlayer(audioOf(id), label)}${revealed ? `<span class="points">+${(result?.tally[id] ?? 0) * 2} <small>· ${result?.tally[id] ?? 0} ${(result?.tally[id] ?? 0) === 1 ? "vote" : "votes"}</small></span>` : own ? "<small>Your masterpiece. No self-voting.</small>" : canVote ? `<button class="button ${chosen ? "primary" : "secondary"} full" data-face-vote="${id}" aria-pressed="${chosen}">${chosen ? "Your vote ✓" : "Vote for this jingle"}</button>` : ""}</article>`;
      })
      .join(
        "",
      )}</div>${revealed ? nextPanel() : room.deadline ? '<p class="next-status">Votes in. Drum roll…</p>' : '<p class="muted center">' + room.votedCount + " votes in</p>"}`;
  }
  return `${header()}<main id="main" class="simple-round audio-round"><span class="pill pink">Tiny Jingle</span><h1 class="round-question">${esc(q.title)}</h1>${body}${controls()}</main>${footer()}`;
}
function questionScreen() {
  if (room.question?.type === "audio") return audioScreen();
  if (room.question?.type === "face") return faceScreen();
  if (room.question?.type === "doodle") return doodleScreen();
  const q = room.question,
    subject = person(q.playerId),
    mine = q.playerId === room.me,
    revealed = ["reveal", "story"].includes(room.phase),
    result = room.result;
  let message =
    room.phase === "reading"
      ? "Four options. One truth. The wildest answer might be real."
      : room.phase === "discussion"
        ? "Debate it out loud. The featured player is allowed to bluff."
        : room.phase === "voting"
          ? mine
            ? "Poker face. They’re guessing."
            : "Pick the truth. Trust issues encouraged."
          : room.phase === "reveal"
            ? "Bluffs busted. Points served."
            : `${esc(subject.name)}, tell us what actually happened.`;
  const yourPick = result?.picks.find((p) => p.playerId === room.me);
  return `${header()}<main id="main" class="question-stage pulse">${demoNote()}<div class="status-banner"><div><span class="eyebrow" style="margin:0 0 5px">TRUTH & LIES</span><strong>${phaseLabels[room.phase]}</strong></div>${room.phase === "voting" && !room.deadline && room.pausedRemaining === null ? `<span class="timer vote-count">${icon("users", 19)} ${room.votedCount}/${voterCount()}</span>` : room.phase === "reveal" && !room.deadline ? `<span class="timer vote-count">${icon("check", 19)} ${(room.nextReadyIds ?? []).length}/${room.players.length}</span>` : timerMarkup()}</div>${room.pausedRemaining !== null ? '<div class="note warning">Game paused. Take a breath. The host will resume when everyone is ready.</div>' : ""}${room.flowVersion === 2 ? "" : profileCard()}<section class="question-card ${room.phase === "voting" ? "is-voting" : ""}"><div class="question-topline"><div class="subject">${avatar(subject)}<div class="subject-details">${room.phase === "voting" ? `<span class="subject-context">${mine ? "This question is about you" : "You’re guessing about"}</span>` : ""}<strong>${esc(subject.name)}${mine ? " (you)" : ""}</strong><small>One truth. Three lies.</small></div></div><span class="pill ${revealed ? "lime" : "purple"}">${icon(revealed ? "check" : "eye", 14)} ${revealed ? "Revealed" : "Spot the truth"}</span></div><h1 class="question-title">${esc(q.title)}</h1><p class="phase-message">${message}</p>${mine && !revealed ? noVoteWarning() : ""}<div class="option-list ${mine && !revealed ? "locked" : ""}">${q.options
    .map((o, i) => {
      const truth = result?.truthId === o.id,
        lie = result?.lieId === o.id,
        picks = result?.picks.filter((p) => p.optionId === o.id) ?? [],
        selected = room.myVote === o.id,
        votable =
          room.phase === "voting" && !mine && room.pausedRemaining === null;
      return `<${votable ? "button" : "div"} class="option ${selected ? "selected" : ""} ${truth ? "correct" : ""} ${lie ? "lie" : ""}" ${votable ? `type="button" data-option="${o.id}" aria-pressed="${selected}"` : ""}><span class="letter">${letter(i)}</span><span class="option-body">${esc(o.text)}${revealed ? `<span class="option-detail">${truth ? "THE TRUTH" : lie ? esc(subject.name.toUpperCase()) + "’S LIE" : "DECOY"} · ${picks.length} ${picks.length === 1 ? "vote" : "votes"}</span>${picks.length ? `<span class="option-tags">${picks.map((p) => `<span class="mini-tag">${esc(person(p.playerId)?.name ?? "Player")}${p.points ? " +2" : ""}</span>`).join("")}</span>` : ""}` : ""}</span>${truth ? icon("check", 22) : selected ? icon("check", 19) : mine && !revealed ? `<span class="option-lock" aria-hidden="true">${icon("lock", 17)}</span>` : ""}</${votable ? "button" : "div"}>`;
    })
    .join(
      "",
    )}</div>${room.phase === "voting" ? `<div class="vote-status"><span class="${room.myVote ? "confirmed" : ""}">${mine ? icon("lock", 15) + " Voting is locked for you" : room.myVote ? icon("check", 15) + " Vote saved." : "Tap an answer."}</span><span>${room.votedCount}/${voterCount()} voted</span></div>${waitingPanel()}` : ""}${result ? `<div class="result-callout"><p>${mine ? `${ownResult(result)}` : yourPick?.points ? "<strong>+2 points!</strong> You spotted the truth." : yourPick ? "That one got you. No points this time." : "You missed this vote. There’s always the next one."}</p></div>${room.flowVersion === 2 ? `<details class="game-extras"><summary>Who got points?</summary>${roundResults()}</details>` : roundResults()}` : ""}${revealed && room.flowVersion !== 2 ? `<div class="story-callout">${icon("sparkles", 25)}<h3>There’s definitely a story here.</h3><p>${esc(subject.name)}, the room is listening.</p></div>` : ""}${room.phase === "reveal" && !room.deadline ? nextPanel() : ""}${controls()}</section><div class="mini-scoreboard">${[
    ...room.players,
  ]
    .sort((a, b) => b.score - a.score)
    .map((p) => {
      const delta = roundPoints(p.id);
      return `<span>${esc(p.name)}<b>${p.score}</b>${delta ? `<i class="delta up">+${delta}</i>` : ""}</span>`;
    })
    .join(
      "",
    )}</div>${room.demo ? '<div class="center"><button class="text-button" data-exit-demo>Exit solo demo</button></div>' : ""}</main>${footer()}`;
}
function downloadCertificate() {
  if (room?.phase !== "finished") return;
  const url = URL.createObjectURL(
    certificatePdf({ players: room.players, rounds: room.history.length }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "bluff-and-tell-certificate.pdf";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast("Certificate ready. Brag responsibly.");
}
function historyFace(q, r) {
  const tally = r?.tally ?? {},
    top = Math.max(0, ...Object.values(tally)),
    best = Object.keys(tally).filter((id) => top && tally[id] === top);
  return `<div class="history-item"><p>${esc(person(q.playerId)?.name)} · ${["doodle", "audio"].includes(q.type) ? esc(q.title) : "Face off"}</p><strong>${best.length ? (q.type === "audio" ? "Best jingle: " : q.type === "doodle" ? "Funniest drawing: " : "Best copy: ") + esc(best.map((id) => person(id)?.name).join(" & ")) : "No winner this time"}</strong><small>${r?.copies?.length ?? 0} entries · ${top} ${top === 1 ? "vote" : "votes"} for the best</small></div>`;
}
function finished() {
  const players = [...room.players].sort(
      (a, b) => b.score - a.score || b.correct - a.correct,
    ),
    top = players[0].score,
    winners = players.filter((p) => p.score === top),
    bluffMax = Math.max(...players.map((p) => p.fooled)),
    bluffers = players.filter((p) => p.fooled === bluffMax),
    correctMax = Math.max(...players.map((p) => p.correct)),
    detectives = players.filter((p) => p.correct === correctMax);
  return `${header()}<main id="main" class="finished pulse">${scoreCelebration(true)}${demoNote()}<div class="trophy" aria-hidden="true">${icon("trophy", 65)}</div><span class="eyebrow">THE POINTS ARE IN.</span><h1>${winners.length > 1 ? "A suspicious tie." : esc(winners[0].name) + " takes it."}</h1><p>${winners.length > 1 ? esc(winners.map((p) => p.name).join(" & ")) + " share the win." : "Good instincts. Excellent company. A few questionable life choices."}</p><div class="victory-share"><button class="button primary" type="button" id="share-victory">${icon("sparkles", 18)} ${winners.some((p) => p.id === room.me) ? "Share your victory" : "Share your result"}</button><button class="button secondary" type="button" id="download-certificate">${icon("trophy", 18)} Download certificate (PDF)</button><p class="muted certificate-hint">Keep the scores. Keep the bragging rights. Download before the room expires.</p></div><div class="end-actions"><button class="button primary" data-action="replay">${icon("shuffle", 18)} Play again</button><button class="button secondary" data-leave>${icon("logout", 18)} ${room.demo ? "Exit demo" : "Exit room"}</button><p class="muted">Play again takes everyone back to the lobby with fresh questions.</p></div><div class="awards"><div class="award"><small>${icon("eye", 16)} MASTER BLUFFER</small><strong>${bluffMax ? esc(bluffers.map((p) => p.name).join(" & ")) : "Nobody got away with it"}</strong><p>${bluffMax ? bluffMax + (bluffMax === 1 ? " guess fooled." : " guesses fooled.") + " Very convincing." : "The group saw through every lie."}</p></div><div class="award"><small>${icon("sparkles", 16)} HUMAN LIE DETECTOR</small><strong>${correctMax ? esc(detectives.map((p) => p.name).join(" & ")) : "Next time, trust your gut"}</strong><p>${correctMax ? correctMax + (correctMax === 1 ? " truth spotted." : " truths spotted.") + " Impressive instincts." : "Those were some convincing decoys."}</p></div></div><details class="panel history"><summary>Relive the revelations</summary>${room.history.map(({ question: q, result: r }) => (["face", "doodle", "audio"].includes(q.type) ? historyFace(q, r) : `<div class="history-item"><p>${esc(person(q.playerId)?.name)} · ${esc(q.title)}</p><strong>${esc(q.options.find((o) => o.id === r?.truthId)?.text)}</strong><small>The lie: ${esc(q.options.find((o) => o.id === r?.lieId)?.text)} · Fooled ${r?.bluffPoints ?? 0}</small></div>`)).join("")}</details></main>${footer()}`;
}
function questionProgress() {
  const q = room?.question;
  if (!q || ["lobby", "finished"].includes(room.phase)) return "";
  const { completed, total } = progressState(q, room.phase);
  return `<span class="footer-question-count" aria-label="Game progress">Question <strong>${q.number} / ${total}</strong> · ${completed} done</span>`;
}
function render(force = false) {
  const focused = document.activeElement?.matches("textarea")
    ? {
        id: document.activeElement.id,
        start: document.activeElement.selectionStart,
        end: document.activeElement.selectionEnd,
      }
    : null;
  const sig = room
    ? JSON.stringify({
        phase: room.phase,
        players: room.players,
        settings: room.settings,
        ageGroup: room.ageGroup,
        promptPack: room.promptPack,
        hostId: room.hostId,
        hostAway: room.hostAway,
        ownAnswers: room.ownAnswers,
        locked: room.locked,
        myVote: room.myVote,
        votedCount: room.votedCount,
        votedIds: room.votedIds,
        shotIds: room.shotIds,
        clipIds: room.clipIds,
        audioSkippedIds: room.audioSkippedIds,
        nextReadyIds: room.nextReadyIds,
        closing:
          ["voting", "judging"].includes(room.phase) && Boolean(room.deadline),
        result: room.result,
        index: room.question?.id,
        submitted: room.submitted,
        paused: room.pausedRemaining,
        needsAnswers: room.needsAnswers,
      })
    : "home";
  if (!force && sig === signature) return;
  if (
    !force &&
    room?.question?.type === "audio" &&
    room.phase === "judging" &&
    previousPhase === "judging" &&
    [...app.querySelectorAll("audio")].some(
      (player) => !player.paused && !player.ended,
    )
  )
    return;
  // Never redraw the screen under a finger that's mid-stroke; the next update catches up.
  if (!force && penDown) return;
  if (
    !force &&
    room?.phase === "writing" &&
    previousPhase === "writing" &&
    document.activeElement?.matches("textarea")
  )
    return;
  const old = previousPhase;
  signature = sig;
  previousPhase = room?.phase ?? "";
  app.className = "shell";
  app.innerHTML = room
    ? room.phase === "lobby"
      ? lobby()
      : room.phase === "writing"
        ? writing()
        : room.phase === "finished"
          ? finished()
          : questionScreen()
    : home();
  if (focused && old === room?.phase) {
    const field = document.getElementById(focused.id);
    if (field && !field.disabled) {
      field.focus({ preventScroll: true });
      field.setSelectionRange(focused.start, focused.end);
    }
  }
  const freshScoreReveal = mountScoreReveal();
  if (room && !["lobby", "finished"].includes(room.phase) && !room.result)
    $("main", app).insertAdjacentHTML("afterbegin", liveScoreboard());
  updateTimer();
  mountPad();
  if (room && ((old && old !== room.phase) || freshScoreReveal)) {
    window.scrollTo({ top: 0, behavior: "instant" });
    const title = $(".score-celebration h2", app) || $("h1", app);
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }
}
function updateTimer() {
  if (!room) return;
  if (room.expiresAt <= Date.now() + offset) {
    clearRoomDeviceData(room.code);
    pruneDeviceRooms(Date.now() + offset);
    reset();
    toast("This room’s 24 hours are up. Time for fresh chaos.");
    return;
  }
  const time =
      room.pausedRemaining ??
      Math.max(
        0,
        (room.deadline ?? Date.now() + offset) - (Date.now() + offset),
      ),
    sec = Math.ceil(time / 1000);
  document.querySelectorAll("[data-countdown]").forEach((el) => {
    el.textContent =
      room.pausedRemaining !== null
        ? "Paused"
        : !room.deadline
          ? "Waiting"
          : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    el.parentElement.classList.toggle(
      "urgent",
      sec <= 10 && room.deadline !== null && room.pausedRemaining === null,
    );
  });
}
async function request(path, { method = "GET", body, auth = true } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(auth && session ? { Authorization: "Bearer " + session.token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The game service is unavailable. Please try again.");
  }
  if (!response.ok) {
    const err = new Error(data.error ?? "Something went wrong.");
    err.status = response.status;
    throw err;
  }
  return data;
}
function accept(data) {
  if (data.room) {
    if (!session || data.room.code !== session.code) return;
    if (
      room &&
      (data.room.version < room.version ||
        (data.room.version === room.version &&
          data.room.serverNow < room.serverNow))
    )
      return;
    if (room?.phase === "finished" && data.room.phase === "lobby") {
      drafts = {};
      draftDirty = false;
      clearTimeout(saveTimer);
      saveTimer = null;
      storage.remove(draftKey());
    }
    if (
      data.room.flowVersion === 2 &&
      room?.question?.id !== data.room.question?.id
    ) {
      drafts = {};
      draftDirty = false;
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (room?.question?.id !== data.room.question?.id) {
      jingle.cancel();
      audioCache = { questionId: null, clips: {} };
      audioKey = "";
    } else if (
      data.room.phase !== "recording" &&
      ["asking", "recording", "processing"].includes(jingle.status)
    )
      jingle.cancel();
    const oldPhotoContext = photoContext();
    if (
      room?.flowVersion === 2 &&
      room.question?.id !== data.room.question?.id
    ) {
      storage.remove(draftKey());
      storage.remove(slotsKey());
      if (oldPhotoContext)
        try {
          sessionStorage.removeItem(
            `bt-doodle-${oldPhotoContext.code}-${oldPhotoContext.playerId}-${oldPhotoContext.questionId}`,
          );
        } catch {}
    }
    room = data.room;
    if (session.expiresAt !== room.expiresAt) {
      session.expiresAt = room.expiresAt;
      storage.set("bt-session", session);
      storage.set("bt-room-expiries", {
        ...(storage.get("bt-room-expiries") ?? {}),
        [room.code]: room.expiresAt,
      });
    }
    if (!samePhotoContext(oldPhotoContext)) {
      photoCache = { questionId: null, photos: {} };
      photoKey = "";
      photoGeneration++;
      photoCapture = null;
      photoError = "";
      if (
        room.question?.type === "face" &&
        ["posing", "copying"].includes(room.phase)
      )
        photoDraft.restore(photoContext());
      else photoDraft.clear();
    }
    if (
      room.question?.type !== "face" ||
      !["posing", "copying"].includes(room.phase) ||
      (room.phase === "copying" && room.question.playerId === room.me)
    ) {
      photoDraft.clear();
      photoCapture = null;
    }
    if (["face", "doodle"].includes(room.question?.type)) loadPhotos();
    if (room.question?.type === "audio") loadAudio();
    if (
      room.phase !== "lobby" &&
      (room.prompts.length || room.question?.promptId)
    ) {
      const previous = storage.get("bt-prompt-history") ?? {};
      const ids = room.prompts.map((p) => p.id);
      const round = room.code + ":" + ids.join(",");
      let history = Array.isArray(previous.ids)
        ? previous.ids.filter((id) => typeof id === "string")
        : [];
      const question = room.question?.id ?? null;
      const newRound = previous.round !== round;
      const newQuestion = question && previous.question !== question;
      if (newRound || newQuestion) {
        const seen = [
          ...(newRound ? ids : []),
          ...(newQuestion && room.question.promptId
            ? [room.question.promptId]
            : []),
        ];
        history = [
          ...history.filter((id) => !seen.includes(id)),
          ...new Set(seen),
        ].slice(-90);
        storage.set("bt-prompt-history", { round, question, ids: history });
      }
    }
    offset = room.serverNow - Date.now();
    connected = true;
    render();
  }
}
async function send(action, data = {}, requestId = uuid()) {
  if (busy) throw new Error("Still sending. Try again in a moment.");
  const actionSession = session;
  busy = true;
  document
    .querySelectorAll(
      "button[data-action],button[data-option],button[data-length],button[data-jingle],button[data-send-photo],#answers-form button",
    )
    .forEach((b) => (b.disabled = true));
  try {
    const response = await request(`/api/rooms/${session.code}/action`, {
      method: "POST",
      body: { action, data, requestId },
    });
    if (session !== actionSession) return response;
    if (response.left) {
      reset();
    } else {
      accept(response);
      render(true);
    }
    return response;
  } catch (e) {
    toast(e.message);
    render(true);
    throw e;
  } finally {
    busy = false;
  }
}
async function exitRoom() {
  if (!session) return;
  // Remove the player from a lobby or completed game. An active round keeps
  // its player records, as when closing the tab, while this device goes home.
  if (
    room &&
    !room.demo &&
    ["lobby", "finished"].includes(room.phase) &&
    !busy
  ) {
    try {
      await send("leave");
      return;
    } catch {
      /* Going home still works offline. */
    }
  }
  reset();
}
function reset() {
  photoCache = { questionId: null, photos: {} };
  photoKey = "";
  clearPhotoDraft();
  jingle.cancel();
  audioCache = { questionId: null, clips: {} };
  audioKey = "";
  clearTimeout(saveTimer);
  saveTimer = null;
  if (session) {
    clearRoomDeviceData(session.code);
    storage.remove(draftKey());
    storage.remove(slotsKey());
  }
  storage.remove("bt-session");
  if (session) storage.remove("bt-draft-" + session.code);
  session = null;
  room = null;
  drafts = {};
  draftDirty = false;
  signature = "";
  previousPhase = "";
  inviteCode = "";
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  history.replaceState({}, "", location.pathname);
  render(true);
}
async function createOrJoin(kind) {
  if (busy) return;
  const name = $("#nickname").value.trim();
  if (name.length < 2) {
    $("#nickname").focus();
    toast("Choose a nickname with at least 2 characters.");
    return;
  }
  homeName = name;
  storage.set("bt-name", name);
  let code = $("#room-code").value.trim().toUpperCase();
  if (kind === "join" && !/^[A-Z2-9]{6}$/.test(code)) {
    toast("Enter the six-character code from your host.");
    $("#room-code").focus();
    return;
  }
  busy = true;
  document
    .querySelectorAll("#entry-form button,#demo-button")
    .forEach((b) => (b.disabled = true));
  try {
    const data = await request(
      kind === "join" ? `/api/rooms/${code}/join` : "/api/rooms",
      {
        method: "POST",
        body: {
          name,
          demo: kind === "demo",
          flowVersion: 2,
          recentPromptIds: storage.get("bt-prompt-history")?.ids ?? [],
        },
        auth: false,
      },
    );
    session = { code: data.room.code, token: data.token };
    storage.set("bt-session", session);
    drafts = {};
    accept(data);
    history.replaceState({}, "", location.pathname);
    inviteCode = "";
  } catch (e) {
    toast(e.message);
    render(true);
  } finally {
    busy = false;
  }
}
function collectAnswers() {
  return slots().map((id) => ({
    promptId: id,
    truth: (drafts[id]?.truth ?? "").trim(),
    lie: (drafts[id]?.lie ?? "").trim(),
  }));
}
async function saveAnswers(submitted = false) {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!room || room.phase !== "writing") return;
  const all = collectAnswers(),
    answers = all.filter((a) => a.truth.length >= 2 && a.lie.length >= 2);
  if (submitted) {
    // Every pair on screen is used in the game, so all of them need both halves.
    const missing = [];
    all.forEach((a) => {
      if (a.truth.length < 2) missing.push(`truth-${a.promptId}`);
      if (a.lie.length < 2) missing.push(`lie-${a.promptId}`);
    });
    if (missing.length) {
      for (const id of missing)
        fieldErrors[id] = fieldMessage(id.split("-")[0]);
      render(true);
      const first = $("#" + missing[0]);
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      first?.focus({ preventScroll: true });
      return;
    }
  }
  if (!answers.length) return;
  if (busy) {
    saveTimer = setTimeout(() => saveAnswers(submitted), 500);
    return;
  }
  try {
    saveMessage = "Saving privately…";
    const status = $("#save-status");
    if (status) status.textContent = saveMessage;
    await send("answers", { answers, submitted });
    draftDirty = false;
    saveMessage = "Saved privately to your room";
    const after = $("#save-status");
    if (after && !submitted) after.textContent = saveMessage;
  } catch {
    saveMessage = "Saved on this device. Reconnecting…";
    const status = $("#save-status");
    if (status) status.textContent = saveMessage;
  }
}
async function poll() {
  if (!session || polling || busy) return;
  const pollingSession = session;
  polling = true;
  try {
    const data = await request(`/api/rooms/${session.code}`);
    if (session !== pollingSession) return;
    accept(data);
    if (draftDirty && room.phase === "writing" && !room.submitted)
      saveTimer ??= setTimeout(() => saveAnswers(false), 500);
  } catch (e) {
    if (session !== pollingSession) return;
    connected = false;
    if ([401, 404].includes(e.status)) {
      toast(e.message);
      reset();
    }
    const status = $("#connection-status");
    if (status) status.textContent = "Connection lost. Reconnecting…";
  } finally {
    polling = false;
  }
}
async function showInviteQr() {
  if (!isHost() || room.phase !== "lobby" || room.demo) return;
  const code = room.code;
  try {
    const origin = await inviteOriginPromise;
    if (room?.code !== code || room.phase !== "lobby") return;
    const qr = createInviteQr(origin, code);
    const canvas = $("#invite-qr-canvas");
    canvas.width = canvas.height = qr.width;
    const context = canvas.getContext("2d");
    const image = context.createImageData(qr.width, qr.width);
    image.data.set(qr.pixels);
    context.putImageData(image, 0, 0);
    $("#invite-qr-code").textContent = code;
    $("#invite-qr-local").hidden = !isLocalPreview;
    $("#invite-qr-dialog").showModal();
  } catch {
    toast("QR took a wrong turn. Copy the invite link instead.");
  }
}
async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.cssText = "position:fixed;left:-9999px";
    (document.querySelector("dialog[open]") ?? document.body).append(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    toast(
      ok
        ? message
        : "Copy didn’t work. Please select and copy the link manually.",
    );
  }
}
let recommendationUrl = "";
let recommendationFile = null;
let cardVersion = 0;
async function prepareRecommendationCard() {
  const version = ++cardVersion;
  recommendationFile = null;
  $("#share-recommendation").disabled = true;
  $("#download-social-card").disabled = true;
  const format = $("#social-format").value;
  try {
    drawShareCard($("#social-card"), format, recommendationUrl);
    const blob = await cardBlob($("#social-card"));
    if (version !== cardVersion) return;
    recommendationFile = new File([blob], `bluff-and-tell-${format}.png`, {
      type: "image/png",
    });
    $("#share-recommendation").disabled = false;
    $("#download-social-card").disabled = false;
  } catch {
    toast("Couldn’t create the image. You can still copy the game link below.");
  }
}
async function openRecommendation() {
  recommendationUrl = new URL("/", await inviteOriginPromise).href;
  $("#recommend-link").value = recommendationUrl;
  $("#recommend-preview-note").hidden =
    !isLocalPreview &&
    !/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);
  $("#recommend-dialog").showModal();
  await prepareRecommendationCard();
}
async function shareRecommendation() {
  const text =
    "Know your friends. Believe nothing. Try Bluff & Tell — tricky truths, silly photos, doodles and tiny radio adverts.";
  const data = { title: "Bluff & Tell", text, url: recommendationUrl };
  if (
    recommendationFile &&
    navigator.canShare?.({ files: [recommendationFile] })
  )
    data.files = [recommendationFile];
  if (!navigator.share) {
    await copy(
      `${text} ${recommendationUrl}`,
      "Recommendation copied. Download the card to add it to your post.",
    );
    return;
  }
  try {
    await navigator.share(data);
  } catch (error) {
    if (error.name !== "AbortError")
      toast(
        "Sharing isn’t available here. Download the card and copy the link below.",
      );
  }
}
// A one-off confetti burst for the final scores. Skipped when the player prefers reduced motion.
function celebrate() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const dpr = Math.min(window.devicePixelRatio || 1, 2),
    w = innerWidth,
    h = innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const c = canvas.getContext("2d");
  c.scale(dpr, dpr);
  const colours = ["#d8fa85", "#ffadd1", "#c5a2ff", "#ffb777", "#fff9ed"];
  const pieces = Array.from(
    { length: Math.min(160, Math.round(w / 3)) },
    () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 6,
      size: 6 + Math.random() * 6,
      spin: Math.random() * Math.PI,
      turn: (Math.random() - 0.5) * 0.3,
      colour: colours[Math.floor(Math.random() * colours.length)],
    }),
  );
  const start = performance.now(),
    life = 2800;
  const frame = (now) => {
    const t = now - start;
    c.clearRect(0, 0, w, h);
    c.globalAlpha = Math.max(0, 1 - Math.max(0, t - life * 0.6) / (life * 0.4));
    for (const p of pieces) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.turn;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.spin);
      c.fillStyle = p.colour;
      c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      c.restore();
    }
    if (t < life) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
async function shareVictory() {
  const players = [...room.players].sort(
      (a, b) => b.score - a.score || b.correct - a.correct,
    ),
    mine = me(),
    rank = room.players.filter((p) => p.score > mine.score).length + 1,
    won = rank === 1,
    tie = won && players.filter((p) => p.score === mine.score).length > 1,
    url = new URL("/", await inviteOriginPromise).href,
    text = won
      ? `I just won Bluff & Tell with ${mine.score} ${mine.score === 1 ? "point" : "points"}. Bluffs, photos, doodles and jingles. Think you can beat me?`
      : `I came #${rank} in Bluff & Tell with ${mine.score} ${mine.score === 1 ? "point" : "points"}. Bluffs, photos, doodles and jingles. Rematch?`;
  let file = null;
  try {
    const canvas = document.createElement("canvas");
    drawVictoryCard(canvas, {
      name: mine.name,
      won,
      tie,
      rank,
      total: room.players.length,
      points: mine.score,
      url,
    });
    file = new File([await cardBlob(canvas)], "bluff-and-tell-victory.png", {
      type: "image/png",
    });
  } catch {}
  const data = { title: "Bluff & Tell", text, url };
  if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  // No share sheet here: save the card and copy the message so it can be pasted into a post.
  if (file) {
    const href = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = href;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  }
  await copy(
    `${text} ${url}`,
    file
      ? "Victory card saved and message copied. Paste it into your post."
      : "Message copied. Paste it into your post.",
  );
}
// Destructive action: name the player, use a destructive verb, and default focus to Cancel.
function confirmRemove(trigger) {
  const target = person(trigger.dataset.remove);
  if (!target) return;
  const dialog = document.createElement("dialog");
  dialog.className = "confirm-dialog";
  dialog.setAttribute("aria-labelledby", "confirm-title");
  dialog.innerHTML = `<h2 id="confirm-title">Remove ${esc(target.name)} from the lobby?</h2><p>They’ll leave this room and need the code to rejoin.</p><div class="confirm-actions"><button class="button secondary" type="button" data-cancel>Cancel</button><button class="button danger" type="button" data-confirm>Remove ${esc(target.name)}</button></div>`;
  document.body.append(dialog);
  const close = () => {
    dialog.close();
    dialog.remove();
    if (trigger.isConnected) trigger.focus();
  };
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  dialog.querySelector("[data-cancel]").addEventListener("click", close);
  dialog.querySelector("[data-confirm]").addEventListener("click", () => {
    send("remove", { playerId: target.id }).catch(() => {});
    close();
  });
  dialog.showModal();
  dialog.querySelector("[data-cancel]").focus();
}
function downloadRecommendation() {
  if (!recommendationFile) return;
  const url = URL.createObjectURL(recommendationFile);
  const a = document.createElement("a");
  a.href = url;
  a.download = recommendationFile.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
document.addEventListener("submit", (e) => {
  if (e.target.id === "entry-form") {
    e.preventDefault();
    createOrJoin(inviteCode ? "join" : "create");
  }
  if (e.target.id === "answers-form") {
    e.preventDefault();
    saveAnswers(true);
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "room-code")
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "");
  if (e.target.matches("textarea[data-prompt]")) {
    const { prompt, kind } = e.target.dataset;
    clearFieldError(e.target);
    drafts[prompt] ??= {};
    drafts[prompt][kind] = e.target.value;
    // Once you've started answering, swapping the question would throw that away, so hide the option.
    const swap = $(`[data-swap="${prompt}"]`);
    if (swap) swap.hidden = filled(prompt);
    storage.set(draftKey(), drafts);
    draftDirty = true;
    const count = $(`[data-count-for="${e.target.id}"]`);
    if (count) count.textContent = e.target.value.length;
    const status = $("#save-status");
    if (status) status.textContent = "Saved on this device";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveAnswers(false), 1200);
  }
});
function clearFieldError(el) {
  if (!fieldErrors[el.id]) return;
  delete fieldErrors[el.id];
  el.removeAttribute("aria-invalid");
  const msg = $(`#${el.id}-msg`);
  if (msg) {
    msg.hidden = true;
    msg.textContent = "";
  }
}
// Validate on blur: only flag a box once its partner has something in it, so skipping ahead never shows red.
document.addEventListener(
  "blur",
  (e) => {
    if (!e.target.matches?.("textarea[data-prompt]") || room?.submitted) return;
    const { prompt, kind } = e.target.dataset,
      other = kind === "truth" ? "lie" : "truth",
      mine = e.target.value.trim(),
      theirs = (drafts[prompt]?.[other] ?? "").trim();
    if (mine.length >= 2 || !theirs) return;
    fieldErrors[e.target.id] = fieldMessage(kind);
    e.target.setAttribute("aria-invalid", "true");
    const msg = $(`#${e.target.id}-msg`);
    if (msg) {
      msg.hidden = false;
      msg.textContent = fieldErrors[e.target.id];
    }
  },
  true,
);
document.addEventListener("change", (e) => {
  if (e.target.id === "social-format") {
    prepareRecommendationCard();
    return;
  }
  if (e.target.id === "photo-input") {
    uploadPhoto(e.target.files?.[0]);
    return;
  }
  if (e.target.matches("[data-mode]")) {
    send("settings", { mode: e.target.value }).catch(() => {});
    return;
  }
  if (e.target.id === "room-age-group") {
    send("profile", { ageGroup: e.target.value }).catch(() => {});
    return;
  }
  if (e.target.matches("[data-transfer]") && e.target.value) {
    send("transfer", { playerId: e.target.value }).catch(() => {});
    return;
  }
  if (e.target.dataset.setting)
    send("settings", {
      [e.target.dataset.setting]: Number(e.target.value),
    }).catch(() => {});
});
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button,a");
  if (!t) return;
  if (t.matches("[data-exit-room]")) {
    e.preventDefault();
    exitRoom();
  } else if (t.matches("[data-help]")) $("#help-dialog").showModal();
  else if (t.matches("[data-recommend]")) openRecommendation();
  else if (t.id === "share-recommendation") shareRecommendation();
  else if (t.id === "download-social-card") downloadRecommendation();
  else if (t.id === "copy-recommendation")
    copy(
      recommendationUrl,
      "Game link copied. Paste it into your social post.",
    );
  else if (t.matches("[data-privacy]")) $("#privacy-dialog").showModal();
  else if (t.matches("[data-close-dialog]")) t.closest("dialog").close();
  else if (t.id === "join-button") createOrJoin("join");
  else if (t.id === "demo-button") createOrJoin("demo");
  else if (t.matches("[data-jingle]")) {
    if (busy) return;
    const action = t.dataset.jingle,
      questionId = room.question.id;
    if (action === "record") jingle.start(questionId);
    else if (action === "stop") jingle.stop();
    else if (action === "skip") {
      jingle.cancel();
      send("skip-audio", { questionId }).catch(() => {});
    } else if (action === "send" && jingle.draft) {
      const clip = jingle.draft;
      try {
        await send("audio", { questionId, clip });
        if (room?.question?.id === questionId && room.phase === "recording") {
          jingle.cancel();
          audioKey = "";
          loadAudio();
        }
      } catch {}
    }
  } else if (t.matches("[data-length]"))
    send("settings", { totalRounds: Number(t.dataset.length) }).catch(() => {});
  else if (t.matches("[data-action]")) send(t.dataset.action).catch(() => {});
  else if (t.matches("[data-swap]")) swapPrompt(t.dataset.swap);
  else if (t.matches("[data-take-photo]")) openPhotoPicker();
  else if (t.matches("[data-photo-filter]")) filterPhoto(t.dataset.photoFilter);
  else if (t.matches("[data-send-photo]")) sendPhoto();
  else if (t.matches("[data-pad-colour]")) {
    // Tool changes update in place: no full redraw, so no flicker while drawing.
    pad.colour = t.dataset.padColour;
    document.querySelectorAll("[data-pad-colour]").forEach((b) => {
      const on = b.dataset.padColour === pad.colour;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
  } else if (t.matches("[data-pad-size]")) {
    pad.size = pad.size > 6 ? 6 : 14;
    t.textContent = pad.size > 6 ? "Thick" : "Thin";
    t.setAttribute(
      "aria-label",
      pad.size > 6 ? "Use thin brush" : "Use thick brush",
    );
  } else if (t.matches("[data-pad]")) {
    const step = t.dataset.pad,
      canvas = $("#doodle-pad");
    if (step === "undo") pad.strokes.pop();
    if (step === "clear") pad.strokes = [];
    if (step === "undo" || step === "clear") {
      savePad();
      if (canvas) drawStrokes(canvas.getContext("2d"));
    }
    if (step === "edit") {
      pad.editing = true;
      render(true);
    }
    if (step === "send") sendDrawing();
  } else if (t.matches("[data-face-vote]"))
    send("face-vote", {
      playerId: t.dataset.faceVote,
      questionId: room.question.id,
    }).catch(() => {});
  else if (t.id === "download-certificate") {
    try {
      downloadCertificate();
    } catch {
      toast("Couldn’t create your certificate. Tap Download to try again.");
    }
  } else if (t.id === "share-victory") shareVictory().catch(() => {});
  else if (t.matches("[data-reroll]"))
    send("reroll", { promptId: t.dataset.reroll }).catch(() => {});
  else if (t.matches("[data-option]"))
    send("vote", {
      optionId: t.dataset.option,
      questionId: room.question.id,
    }).catch(() => {});
  else if (t.matches("[data-remove]")) {
    confirmRemove(t);
  } else if (t.matches("[data-copy-code]"))
    copy(room.code, "Room code copied. Send it to your people.");
  else if (t.matches("[data-show-qr]")) showInviteQr();
  else if (t.matches("[data-copy-link]")) {
    const origin = await inviteOriginPromise;
    const invite = roomInviteUrl(origin, room.code);
    copy(
      invite,
      isLocalPreview
        ? "Invite copied. This preview link works on your Wi-Fi while this computer stays on."
        : "Invite link copied. Paste it into WhatsApp, email, Teams, or anywhere else.",
    );
  } else if (t.id === "edit-answers")
    send("answers", { answers: room.ownAnswers, submitted: false }).catch(
      () => {},
    );
  else if (t.matches("[data-leave]")) send("leave").catch(() => {});
  else if (t.matches("[data-exit-demo]")) {
    reset();
  } else if (t.matches("[data-game-home]")) {
    e.preventDefault();
    toast(
      room.demo
        ? "Finish the demo or use “Exit solo demo” below."
        : "You’re in a game. Your room code is " + room.code + ".",
    );
  }
});
window.addEventListener("online", () => {
  connected = true;
  poll();
});
window.addEventListener("offline", () => {
  connected = false;
  toast("You’re offline. Your place is saved; reconnect to keep playing.");
  const status = $("#connection-status");
  if (status) status.textContent = "Offline. Reconnect to play.";
});
document.addEventListener("visibilitychange", () => {
  if (
    document.hidden &&
    ["asking", "recording", "processing"].includes(jingle.status)
  ) {
    jingle.cancel();
    render(true);
  }
  if (!document.hidden) poll();
});
setInterval(updateTimer, 250);
setInterval(() => {
  if (!document.hidden) poll();
}, 2000);
document.addEventListener("click", (event) => {
  const toggle = event.target.closest?.("[data-reveal-sound]");
  if (toggle) {
    revealChime.setEnabled(!revealChime.enabled);
    storage.set("bt-reveal-sound", revealChime.enabled);
    toggle.setAttribute("aria-pressed", String(revealChime.enabled));
    toggle.textContent = revealChime.enabled ? "🔊 Sound on" : "🔇 Sound off";
  }
  revealChime.unlock();
  if (toggle && revealChime.enabled) setTimeout(() => revealChime.play(), 50);
});
document.addEventListener("keydown", () => revealChime.unlock(), {
  once: true,
});
$("#help-scoring").innerHTML = scoringGuide();
if (session) {
  app.className = "shell";
  app.innerHTML =
    header() +
    '<main id="main" class="reconnect-screen"><div class="spinner"></div><h2>Back to your people.</h2><p class="muted">Reconnecting to your room…</p><button class="button secondary" id="forget-session">Start fresh</button></main>';
  $("#forget-session").onclick = () => reset();
  await poll();
} else render(true);
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});

window.addEventListener("pagehide", () => jingle.cancel());
document.addEventListener(
  "ended",
  (event) => {
    if (event.target.matches("audio")) render(true);
  },
  true,
);
document.addEventListener(
  "play",
  (event) => {
    if (event.target.matches("audio"))
      document.querySelectorAll("audio").forEach((player) => {
        if (player !== event.target) player.pause();
      });
  },
  true,
);
