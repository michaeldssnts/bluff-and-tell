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
  return `<footer class="site-footer"><span>Know your friends. Believe nothing.</span><div class="footer-links"><span id="connection-status">${connected ? "Made for your people." : "Connection lost. Reconnecting…"}</span><button class="text-button" data-recommend>Recommend Bluff &amp; Tell</button><button class="text-button" data-privacy>Privacy</button></div></footer>`;
}
function demoNote() {
  return room.demo
    ? '<div class="note demo">' +
        icon("sparkles") +
        " <strong>Solo demo.</strong> Alex, Sam and Zee are simulated players. Timers are shorter so you can try a round. Real rooms use your longer party timings.</div>"
    : "";
}
function home() {
  return `${header()}<main id="main"><section class="hero"><div class="hero-copy"><span class="pill lime">${icon("sparkles", 15)} THE TRUTH IS A PARTY GAME.</span><h1>Your friends.<br>Their secrets.<br><em>Big laughs.</em></h1><p class="hero-hook">One truth. Three lies.<br>A whole lot of “NO WAY!”</p><p>From date night to game night, find out how well you <strong>really</strong> know your people.</p><div class="hero-facts"><span>${icon("users", 16)} 2–8 players</span><span>${icon("phone", 16)} Any phone</span><span>${icon("check", 16)} No download</span></div></div><div class="entry-wrap"><div class="floating-card" aria-hidden="true"><small>WAIT. THAT’S ACTUALLY TRUE?</small><p>“You did <em>WHAT?!</em>”</p></div><span class="party-spark" aria-hidden="true">✳</span><section class="entry-card" aria-labelledby="entry-title"><span class="entry-kicker">GOOD COMPANY. BAD POKER FACES.</span><h2 id="entry-title">${inviteCode ? "You’re invited. Bring your best bluff." : "Bring your suspicious side."}</h2><p>${inviteCode ? `Room ${esc(inviteCode)} is already filled in. Choose a nickname to join.` : "A few truths. Some terrible lies. Your kind of people."}</p><form id="entry-form"><label for="nickname">What should we call you?</label><input id="nickname" name="name" placeholder="e.g. Sam" value="${esc(homeName)}" maxlength="22" minlength="2" autocomplete="nickname" required><button class="button primary full" type="submit" id="create-button">${icon(inviteCode ? "users" : "plus")} ${inviteCode ? "Join this room" : "Create a game"}</button><div class="divider">${inviteCode ? "YOUR ROOM CODE" : "GOT AN INVITE?"}</div><div class="join-row"><label for="room-code" class="room-code-label">Room code</label><input id="room-code" name="code" placeholder="K7P2QX" aria-label="Six-character room code" value="${esc(inviteCode)}" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false">${inviteCode ? "" : '<button type="button" class="button secondary" id="join-button">Join game</button>'}</div></form><button class="text-button demo-button" id="demo-button">${icon("play", 15)} Try a solo demo</button><p class="entry-foot">${icon("lock", 13)} Private rooms. No accounts. Just your people.</p></section></div></section><section class="how-strip" aria-label="How it works"><div class="how-item"><span class="how-icon">${icon("users", 22)}</span><div><h3>Round up your suspects.</h3><p>Share a room code. Everyone joins on their own phone.</p></div></div><div class="how-item"><span class="how-icon">${icon("eye", 22)}</span><div><h3>Spill it. Then bluff it.</h3><p>Answer prompts about yourself. Make the lie convincing.</p></div></div><div class="how-item"><span class="how-icon">${icon("sparkles", 22)}</span><div><h3>Guess. Gasp. Repeat.</h3><p>Pick the truth, catch the bluff, and enjoy the reveal.</p></div></div></section></main>${footer()}`;
}
function roster(showScore = false) {
  return `<div class="player-list">${room.players.map((p) => `<div class="player-row">${avatar(p)}<div class="player-name">${esc(p.name)}${p.id === room.me ? " <small>You" + (p.id === room.hostId ? " · Host" : "") + "</small>" : p.id === room.hostId ? "<small>Host</small>" : p.bot ? "<small>Demo player</small>" : ""}</div>${showScore ? `<span class="points">${p.score}<small>pts</small></span>` : room.phase === "writing" ? `<span class="player-meta ${p.ready ? "ready" : ""}">${p.ready ? icon("check", 15) + " Ready" : Math.min(p.answerCount, needed()) + "/" + needed() + " saved"}</span>` : isHost() && p.id !== room.me && !p.bot ? `<button class="icon-button" data-remove="${p.id}" aria-label="Remove ${esc(p.name)}">Remove</button>` : `<span class="player-meta">${p.profileReady === false ? "Choosing profile" : "Joined"}</span>`}</div>`).join("")}</div>`;
}
function controls() {
  if (!isHost())
    return (
      (room.hostAway
        ? '<button class="button secondary full" data-action="claim-host">Take over as host (host disconnected)</button>'
        : "") +
      '<p class="muted center" style="font-size:.8rem;margin:18px 0">Your host controls the pace. Your guesses are private.</p>'
    );
  return `<div class="host-controls">${room.deadline || room.pausedRemaining !== null ? `<button class="button secondary small" data-action="pause">${icon(room.pausedRemaining !== null ? "play" : "pause", 15)} ${room.pausedRemaining !== null ? "Resume" : "Pause"}</button>` : ""}${["reading", "discussion", "story"].includes(room.phase) ? '<button class="button secondary small" data-action="extend">' + icon("plus", 15) + " Add a minute</button>" : ""}${["reading", "discussion", "voting", "story"].includes(room.phase) ? `<button class="button soft small" data-action="next" ${room.pausedRemaining !== null ? "disabled" : ""}>${room.phase === "voting" ? (waitingOn().length ? "Close voting and reveal" : "Reveal now") : room.phase === "discussion" ? "Open voting" : room.phase === "reveal" ? "Hear the story" : room.phase === "story" ? "Next question" : "Start discussion"}</button>` : ""}${
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
function lobby() {
  const settings = room.settings;
  const needsProfiles = room.players.some((p) => p.profileReady === false);
  return `${header()}<main id="main" class="pulse"><div class="game-head"><div><span class="eyebrow">GOOD COMPANY. QUESTIONABLE ANSWERS.</span><h1>The room is yours.</h1><p>${isHost() ? "Invite your friends, set the mood, and get ready to question everything." : "You’re in. Make yourself comfortable while your host gets everyone together."}</p></div><span class="pill lime">${icon("users", 16)} ${room.players.length}/8 players</span></div>${demoNote()}${roomProfile()}<div class="game-layout"><div><section class="room-invite"><span class="eyebrow">YOUR INVITE CODE</span><div class="room-code">${esc(room.code)}</div><p>Open this website on another phone and enter the code.</p><div class="invite-actions"><button class="button" data-copy-link>${icon("link", 15)} Copy invite link</button><button class="button secondary" data-copy-code>${icon("copy", 15)} Copy code</button></div></section><section class="panel"><div class="panel-title"><h2>Your people</h2>${isHost() ? `<button class="text-button" data-action="lock">${icon("lock", 15)} ${room.locked ? "Unlock lobby" : "Lock lobby"}</button>` : ""}</div>${roster()}${room.players.length < 8 ? `<div class="empty-slot"><span class="avatar">+</span>${room.players.length === 2 ? "Two is all you need. Start whenever you’re ready." : "There’s room for more questionable characters."}</div>` : ""}</section></div><section class="panel"><div class="panel-title"><h2>${icon("shuffle", 19)} Set the vibe</h2><span class="pill purple">${isHost() ? "Host controls" : "Game settings"}</span></div><div class="settings-grid"><div class="field-row"><label for="game-length">Game length<small>Everyone gets an equal turn.</small></label><select id="game-length" data-setting="questionsPerPlayer" ${!isHost() ? "disabled" : ""}><option value="1" ${settings.questionsPerPlayer === 1 ? "selected" : ""}>Quick game</option><option value="2" ${settings.questionsPerPlayer === 2 ? "selected" : ""}>Full game</option></select></div></div><p class="settings-note">${room.players.length * settings.questionsPerPlayer} questions. No timers: each step moves on once everyone is ready.<br><br>Correct guess: <strong>+2 points.</strong><br>Someone picks your lie: <strong>+1 point.</strong><br>Nobody spots your truth: <strong>+1 bonus.</strong></p>${isHost() ? `<button class="button primary full" data-action="start" ${room.players.length < 2 || needsProfiles ? "disabled" : ""}>${icon("play", 18)} ${room.players.length < 2 ? "Waiting for your second player…" : needsProfiles ? "Waiting for player profiles…" : "Start the game"}</button>` : '<div class="note center">Waiting for your host to start the game.</div>' + (room.hostAway ? '<button class="button secondary full" data-action="claim-host">Take over as host (host disconnected)</button>' : "")}<div class="note">${icon("shield", 17)} <strong>Keep it comfortable.</strong> Skip anything too personal. Great stories beat embarrassing secrets.</div></section></div><div class="actions-row"><button class="text-button" data-leave>${icon("logout", 16)} ${room.demo ? "Exit demo" : "Leave room"}</button></div></main>${footer()}`;
}
function draftKey() {
  return "bt-draft-" + session.code;
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
const needed = () => room.settings.questionsPerPlayer;
const slotsKey = () => draftKey() + "-slots";
const filled = (id) =>
  Boolean(drafts[id]?.truth?.trim() || drafts[id]?.lie?.trim()) ||
  room.ownAnswers.some((a) => a.promptId === id);
// The prompts this player is answering. Starts with any they've already written, then fills from the offered prompts.
function slots() {
  const ids = room.prompts.map((p) => p.id);
  let list = (storage.get(slotsKey()) ?? []).filter((id) => ids.includes(id));
  for (const id of ids.filter(filled)) if (!list.includes(id)) list.push(id);
  for (const id of ids) if (list.length < needed() && !list.includes(id)) list.push(id);
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
function writing() {
  const d = getDraft(),
    list = slots(),
    prompts = list.map((id) => room.prompts.find((p) => p.id === id)),
    spare = room.prompts.length > list.length,
    n = needed();
  return `${header()}<main id="main" class="pulse"><div class="game-head"><div><span class="eyebrow">YOUR ANSWER SHEET · KEEP IT TO YOURSELF</span><h1>A little truth.<br>A very good lie.</h1><p>${n === 1 ? "Just one prompt" : `${n} prompts`}: write one real answer and one convincing fake. ${room.promptPack === "extra-silly" ? "Your room has the extra-silly set." : "Picked for your age group."} Short answers work best.</p></div><span class="timer vote-count">${icon("check", 19)} ${room.players.filter((p) => p.ready).length}/${room.players.length} ready</span></div>${demoNote()}${room.needsAnswers ? '<div class="note warning">Time’s up, but someone still needs a complete answer pair. The host can add a minute so everyone gets a turn.</div>' : ""}${room.pausedRemaining !== null ? '<div class="note warning">The host has paused the game. Your saved answers are safe.</div>' : ""}<div class="game-layout"><div><form id="answers-form" novalidate>${prompts
    .map(
      (p, i) =>
        `<section class="panel writing-card"><div class="prompt-heading"><span class="prompt-number">${i + 1}</span><div><h3>${esc(p.title)}</h3><p>${esc(p.hint)}</p></div></div><div class="answer-fields">${answerField(p, "truth", d)}${answerField(p, "lie", d)}</div>${
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
    )}<div class="save-strip"><span class="save-status" id="save-status">${room.submitted ? icon("check", 15) + " Answers ready. Nicely done." : esc(saveMessage)}</span>${room.submitted ? '<button class="button secondary small" type="button" id="edit-answers">Edit answers</button>' : '<button class="button primary" type="submit">' + icon("check", 17) + " Lock in my answers</button>"}</div></form></div><aside class="panel"><div class="panel-title"><h2>How’s everyone doing?</h2></div>${roster()}<div class="note"><strong>A good lie lives close to the truth.</strong> Give it enough detail to sound real. The game adds two more decoys, including an outrageous wildcard.</div>${isHost() ? `<button class="button primary full" data-action="begin" ${room.players.some((p) => p.answerCount === 0) || room.pausedRemaining !== null ? "disabled" : ""}>${"Start now with saved answers"}</button><p class="muted" style="font-size:.75rem;margin-top:12px">The game starts by itself once everyone is ready. Starting early locks everyone’s saved answers.</p>${controls()}` : '<p class="muted" style="font-size:.85rem">The game starts as soon as everyone has locked in their answers.</p>' + controls()}</aside></div></main>${footer()}`;
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
    label = last ? "See final scores" : "Go to next question",
    reading = room.players.filter((p) => !ready.includes(p.id));
  return `<div class="next-panel">${
    iAmReady
      ? `<p class="next-status">${icon("check", 17)} You’re ready. Moving on when everyone is.</p>`
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
  return `<div class="waiting-panel"><span class="eyebrow">STILL DECIDING</span><div class="waiting-list">${waiting.map((p) => `<span class="waiting-chip">${avatar(p)}${esc(p.name)}${p.id === room.me ? " (you)" : ""}</span>`).join("")}</div>${isHost() ? '<p class="muted">Someone stepped away? Use <strong>Close voting and reveal</strong> below.</p>' : ""}</div>`;
}
// Points a player earned on the question being revealed: +2 for the truth, +1 per friend fooled.
function roundPoints(playerId) {
  const result = room.result;
  if (!result) return 0;
  const pick = result.picks.find((p) => p.playerId === playerId);
  return (
    (pick?.points ?? 0) +
    (playerId === room.question.playerId
      ? result.bluffPoints + (result.stumpBonus ?? 0)
      : 0)
  );
}
function rankOf(p) {
  return room.players.filter((x) => x.score > p.score).length + 1;
}
function profileCard() {
  const p = me();
  if (!p) return "";
  const delta = room.result ? roundPoints(p.id) : null;
  return `<section class="my-profile" aria-label="Your profile">${avatar(p)}<div class="my-profile-name"><span class="eyebrow">YOUR PROFILE</span><strong>${esc(p.name)}</strong><small>Rank ${rankOf(p)} of ${room.players.length} · ${p.correct} ${p.correct === 1 ? "truth" : "truths"} spotted · ${p.fooled} fooled</small></div><div class="my-profile-score">${delta !== null ? `<span class="delta ${delta ? "up" : ""}">+${delta} this round</span>` : ""}<span class="points">${p.score}<small>pts</small></span></div></section>`;
}
function noVoteWarning() {
  return `<div class="no-vote-warning" role="status">${icon("alert", 24)}<div><strong>You can’t vote on your own question</strong><p>${room.phase === "voting" ? "Everyone else is voting now. Keep a straight face while they guess." : "When voting opens, everyone else picks. Your job is to keep a straight face."}</p></div></div>`;
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
function questionScreen() {
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
            ? "Your friends are choosing between these four answers."
            : "Pick the truth. Results appear as soon as everyone has voted, and your choice stays private until then."
          : room.phase === "reveal"
            ? "The votes are in. Who knew them best, and who bought the bluff?"
            : `${esc(subject.name)}, tell us what actually happened.`;
  const yourPick = result?.picks.find((p) => p.playerId === room.me);
  return `${header()}<main id="main" class="question-stage pulse">${demoNote()}<div class="status-banner"><div><span class="eyebrow" style="margin:0 0 5px">QUESTION ${q.number} OF ${q.total}</span><strong>${phaseLabels[room.phase]}</strong></div>${room.phase === "voting" && !room.deadline && room.pausedRemaining === null ? `<span class="timer vote-count">${icon("users", 19)} ${room.votedCount}/${voterCount()}</span>` : room.phase === "reveal" && !room.deadline ? `<span class="timer vote-count">${icon("check", 19)} ${(room.nextReadyIds ?? []).length}/${room.players.length}</span>` : timerMarkup()}</div>${room.pausedRemaining !== null ? '<div class="note warning">Game paused. Take a breath. The host will resume when everyone is ready.</div>' : ""}${profileCard()}<section class="question-card ${room.phase === "voting" ? "is-voting" : ""}"><div class="question-topline"><div class="subject">${avatar(subject)}<div class="subject-details">${room.phase === "voting" ? `<span class="subject-context">${mine ? "This question is about you" : "You’re guessing about"}</span>` : ""}<strong>${esc(subject.name)}${mine ? " (you)" : ""}</strong><small>One truth. Three lies.</small></div></div><span class="pill ${revealed ? "lime" : "purple"}">${icon(revealed ? "check" : "eye", 14)} ${revealed ? "Revealed" : "Spot the truth"}</span></div><h1 class="question-title">${esc(q.title)}</h1><p class="phase-message">${message}</p>${mine && !revealed ? noVoteWarning() : ""}<div class="option-list ${mine && !revealed ? "locked" : ""}">${q.options
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
    )}</div>${room.phase === "voting" ? `<div class="vote-status"><span class="${room.myVote ? "confirmed" : ""}">${mine ? icon("lock", 15) + " Voting is locked for you" : room.myVote ? icon("check", 15) + " Vote saved. You can change it until the reveal." : "Your vote is still open."}</span><span>${room.votedCount}/${voterCount()} voted</span></div>${waitingPanel()}` : ""}${result ? `<div class="result-callout"><p>${mine ? `${ownResult(result)}` : yourPick?.points ? "<strong>+2 points!</strong> You spotted the truth." : yourPick ? "That one got you. No points this time." : "You missed this vote. There’s always the next one."}</p></div>${roundResults()}` : ""}${revealed ? `<div class="story-callout">${icon("sparkles", 25)}<h3>There’s definitely a story here.</h3><p>${esc(subject.name)}, the room is listening.</p></div>` : ""}${room.phase === "reveal" && !room.deadline ? nextPanel() : ""}${controls()}</section><div class="mini-scoreboard">${[
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
  return `${header()}<main id="main" class="finished pulse">${demoNote()}<div class="trophy" aria-hidden="true">${icon("trophy", 65)}</div><span class="eyebrow">THE TRUTH HAS SPOKEN.</span><h1>${winners.length > 1 ? "A suspicious tie." : esc(winners[0].name) + " takes it."}</h1><p>${winners.length > 1 ? esc(winners.map((p) => p.name).join(" & ")) + " share the win." : "Good instincts. Excellent company. A few questionable life choices."}</p><div class="victory-share"><button class="button primary" type="button" id="share-victory">${icon("sparkles", 18)} ${winners.some((p) => p.id === room.me) ? "Share your victory" : "Share your result"}</button></div><section class="panel"><div class="panel-title"><h2>The final word</h2><span class="pill lime">${room.history.length} questions</span></div>${players.map((p, i) => `<div class="player-row"><span class="rank">${players.findIndex((x) => x.score === p.score) + 1}</span>${avatar(p)}<div class="player-name">${esc(p.name)}${p.id === room.me ? " <small>You</small>" : ""}</div><span class="points">${p.score}<small>pts</small></span></div>`).join("")}</section><div class="end-actions"><button class="button primary" data-action="replay">${icon("shuffle", 18)} Play again</button><button class="button secondary" data-leave>${icon("logout", 18)} ${room.demo ? "Exit demo" : "Exit room"}</button><p class="muted">Play again takes everyone back to the lobby with fresh questions.</p></div><div class="awards"><div class="award"><small>${icon("eye", 16)} MASTER BLUFFER</small><strong>${bluffMax ? esc(bluffers.map((p) => p.name).join(" & ")) : "Nobody got away with it"}</strong><p>${bluffMax ? bluffMax + (bluffMax === 1 ? " guess fooled." : " guesses fooled.") + " Very convincing." : "The group saw through every lie."}</p></div><div class="award"><small>${icon("sparkles", 16)} HUMAN LIE DETECTOR</small><strong>${correctMax ? esc(detectives.map((p) => p.name).join(" & ")) : "Next time, trust your gut"}</strong><p>${correctMax ? correctMax + (correctMax === 1 ? " truth spotted." : " truths spotted.") + " Impressive instincts." : "Those were some convincing decoys."}</p></div></div><details class="panel history"><summary>Relive the revelations</summary>${room.history.map(({ question: q, result: r }) => `<div class="history-item"><p>${esc(person(q.playerId)?.name)} · ${esc(q.title)}</p><strong>${esc(q.options.find((o) => o.id === r?.truthId)?.text)}</strong><small>The lie: ${esc(q.options.find((o) => o.id === r?.lieId)?.text)} · Fooled ${r?.bluffPoints ?? 0}</small></div>`).join("")}</details></main>${footer()}`;
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
        nextReadyIds: room.nextReadyIds,
        closing: room.phase === "voting" && Boolean(room.deadline),
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
  updateTimer();
  if (room?.phase === "finished" && old && old !== "finished" && old !== "lobby")
    celebrate();
  if (room && old && old !== room.phase) {
    window.scrollTo({ top: 0, behavior: "instant" });
    const title = $("h1", app);
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }
}
function updateTimer() {
  if (!room) return;
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
    room = data.room;
    if (room.phase !== "lobby" && room.prompts.length) {
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
          ...(newQuestion ? [room.question.promptId] : []),
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
async function send(action, data = {}) {
  if (busy) return;
  const actionSession = session;
  busy = true;
  document
    .querySelectorAll(
      "button[data-action],button[data-option],#answers-form button",
    )
    .forEach((b) => (b.disabled = true));
  try {
    const response = await request(`/api/rooms/${session.code}/action`, {
      method: "POST",
      body: { action, data, requestId: uuid() },
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
function reset() {
  storage.remove("bt-session");
  if (session) storage.remove("bt-draft-" + session.code);
  session = null;
  room = null;
  drafts = {};
  draftDirty = false;
  signature = "";
  previousPhase = "";
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
      for (const id of missing) fieldErrors[id] = fieldMessage(id.split("-")[0]);
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
    "Know your friends. Believe nothing. Try Bluff & Tell — one truth, three lies, and a lot of laughs.";
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
  const pieces = Array.from({ length: Math.min(160, Math.round(w / 3)) }, () => ({
    x: w / 2 + (Math.random() - 0.5) * w * 0.3,
    y: h * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 6,
    size: 6 + Math.random() * 6,
    spin: Math.random() * Math.PI,
    turn: (Math.random() - 0.5) * 0.3,
    colour: colours[Math.floor(Math.random() * colours.length)],
  }));
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
      ? `I just won Bluff & Tell with ${mine.score} ${mine.score === 1 ? "point" : "points"}. One truth, three lies, zero mercy. Think you can beat me?`
      : `I came #${rank} in Bluff & Tell with ${mine.score} ${mine.score === 1 ? "point" : "points"}. One truth, three lies. Rematch?`;
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
  if (t.matches("[data-help]")) $("#help-dialog").showModal();
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
  else if (t.matches("[data-action]")) send(t.dataset.action).catch(() => {});
  else if (t.matches("[data-swap]")) swapPrompt(t.dataset.swap);
  else if (t.id === "share-victory") shareVictory().catch(() => {});
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
  else if (t.matches("[data-copy-link]")) {
    const origin = await inviteOriginPromise;
    const invite = new URL("/", origin);
    invite.searchParams.set("room", room.code);
    copy(
      invite.href,
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
  if (!document.hidden) poll();
});
setInterval(updateTimer, 250);
setInterval(() => {
  if (!document.hidden) poll();
}, 2000);
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
