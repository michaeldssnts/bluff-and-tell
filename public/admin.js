const $ = (selector) => document.querySelector(selector);
let report = null,
  busy = false;
const n = (value) => new Intl.NumberFormat().format(value ?? 0);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const duration = (ms) => {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return `${Math.floor(ms / 1000)} sec`;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
};
const recent = (room) =>
  room.players > 0 &&
  room.phase !== "finished" &&
  report.generatedAt - room.lastActivityAt < 300000;
const status = (room) =>
  room.phase === "finished"
    ? "Finished"
    : !room.players
      ? "Empty"
      : recent(room)
        ? "Active"
        : "Quiet";
const phase = (name) =>
  ({
    lobby: "Lobby",
    writing: "Answering",
    posing: "Taking photos",
    copying: "Taking photos",
    drawing: "Drawing",
    recording: "Recording",
    judging: "Voting",
    voting: "Voting",
    reading: "Reading",
    discussion: "Chatting",
    reveal: "Results",
    story: "Results",
    finished: "Finished",
  })[name] ?? "Playing";
function showLogin() {
  $("#login").hidden = false;
  $("#dashboard").hidden = true;
  report = null;
  for (const id of [
    "stats",
    "trend",
    "activity",
    "duration",
    "rooms",
    "registrations",
  ])
    $("#" + id).replaceChildren();
}
async function request(path, options) {
  const res = await fetch("/api/admin/" + path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) showLogin();
    throw new Error(data.error || "Couldn’t load usage. Try again.");
  }
  return data;
}
function render() {
  if (!report) return;
  const period = Number($("#period").value);
  const date = new Date(report.generatedAt);
  date.setUTCHours(0, 0, 0, 0);
  const start = new Date(date.getTime() - (period - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  const days = report.days.filter((day) => day.date >= start);
  const sum = (key) => days.reduce((total, day) => total + (day[key] ?? 0), 0);
  const label = period === 1 ? "Today · UTC" : `Last ${period} days`;
  $("#stats").innerHTML = [
    ["Rooms created", report.totals.rooms, "Lifetime · since tracking began"],
    ["Player joins", sum("joins"), label],
    ["Games started", sum("games"), label],
    ["Games finished", sum("completed"), label],
  ]
    .map(
      ([name, value, detail]) =>
        `<div class="stat"><span>${name}</span><strong>${n(value)}</strong><small>${detail}</small></div>`,
    )
    .join("");
  const max = Math.max(1, ...days.map((day) => day.rooms));
  const byDate = new Map(days.map((day) => [day.date, day.rooms]));
  $("#trend").innerHTML = Array.from({ length: period }, (_, i) => {
    const day = new Date(date.getTime() - (period - i - 1) * 86400000)
      .toISOString()
      .slice(0, 10);
    const value = byDate.get(day) ?? 0;
    const title = `${day}: ${n(value)} room${value === 1 ? "" : "s"}`;
    return `<div class="trend-day" role="img" aria-label="${title}" title="${title}"><div class="trend-track"><div class="trend-bar" style="height:${Math.max(2, (value / max) * 100)}px"></div></div><span>${period <= 7 || i % Math.ceil(period / 7) === 0 || i === period - 1 ? day.slice(5).replace("-", "/") : "&nbsp;"}</span></div>`;
  }).join("");
  $("#activity").innerHTML = [
    ["rounds", "Rounds played"],
    ["votes", "Votes cast"],
    ["answers", "Text submissions"],
    ["photos", "Photo submissions"],
    ["drawings", "Doodle submissions"],
    ["audio", "Jingles sent"],
  ]
    .map(
      ([key, label]) =>
        `<div><strong>${n(sum(key))}</strong><span>${label}</span></div>`,
    )
    .join("");
  const completed = sum("completed");
  $("#duration").innerHTML =
    `<p class="duration-number">${completed ? duration(sum("durationMs") / completed) : "—"}</p><p class="duration-help">${completed ? `Average completed game · ${n(completed)} game${completed === 1 ? "" : "s"}` : "The first finished game sets the pace."}</p><p class="duration-help">${n(report.rooms.filter(recent).length)} recently active room${report.rooms.filter(recent).length === 1 ? "" : "s"}. ${n(sum("rooms"))} room${sum("rooms") === 1 ? "" : "s"} created in this period.</p>`;
  renderRooms();
  $("#updated").textContent =
    `Updated ${new Date(report.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
function renderRooms() {
  if (!report) return;
  const filter = $("#room-filter").value;
  const rooms = report.rooms.filter(
    (room) =>
      filter === "all" ||
      (filter === "active" ? recent(room) : room.phase === filter),
  );
  if (!rooms.length) {
    $("#rooms").innerHTML =
      `<p class="empty">${report.rooms.length ? "No rooms in this view. Try another filter." : "Quiet for now. Your next room kicks things off."}</p>`;
    return;
  }
  $("#rooms").innerHTML =
    `<div class="table-wrap" tabindex="0" role="region" aria-label="Room activity table"><table><thead><tr><th scope="col">Room / created</th><th scope="col">Players</th><th scope="col">Game</th><th scope="col">Progress</th><th scope="col">Activity</th><th scope="col">Game time</th><th scope="col">Last action</th></tr></thead><tbody>${rooms
      .map((room) => {
        const c = room.counters;
        const age = Math.max(0, report.generatedAt - room.lastActivityAt);
        const activity = `Text ${c.answers} · Photos ${c.photos} · Doodles ${c.drawings} · Audio ${c.audio} · Votes ${c.votes}`;
        return `<tr><td><span class="room-id">${escape(room.id.slice(0, 8).toUpperCase())}</span><small>${escape(new Date(room.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }))}</small></td><td>${n(room.players)} now<small>${n(c.joins)} joined total</small></td><td>${room.mode === "classic" ? "Truth &amp; Lies" : "Party Mix"}<small><span class="room-state ${recent(room) ? "active" : ""}">${status(room)}</span></small></td><td>${room.round ? `${room.round} / ${room.totalRounds}` : "Not started"}<small>${phase(room.phase)} · ${n(c.completed)} game${c.completed === 1 ? "" : "s"} finished</small></td><td>${n(c.actions)} actions<small title="${activity}">${n(c.votes)} votes · ${n(c.answers + c.photos + c.drawings + c.audio)} submissions</small></td><td>${room.gameStartedAt !== null ? duration(room.gameDurationMs) : "—"}<small>Start → last action${room.phase === "finished" ? " (final)" : ""}</small></td><td>${age < 60000 ? "Just now" : `${duration(age)} ago`}</td></tr>`;
      })
      .join("")}</tbody></table></div>`;
}
async function refresh(silent = false) {
  if (busy) return;
  busy = true;
  $("#refresh").disabled = true;
  try {
    report = await request("usage");
    $("#login").hidden = true;
    $("#dashboard").hidden = false;
    $("#message").textContent = "";
    render();
  } catch (error) {
    if (!silent || !$("#dashboard").hidden)
      $("#message").textContent = error.message;
  } finally {
    busy = false;
    $("#refresh").disabled = false;
  }
}
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#sign-in").disabled = true;
  $("#message").textContent = "";
  try {
    await request("session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: $("#username").value,
        password: $("#password").value,
      }),
    });
    $("#password").value = "";
    await refresh();
    if (!$("#dashboard").hidden) {
      $("#dashboard h1").tabIndex = -1;
      $("#dashboard h1").focus();
    }
  } catch (error) {
    $("#message").textContent = error.message;
  } finally {
    $("#sign-in").disabled = false;
  }
});
$("#sign-out").addEventListener("click", async () => {
  try {
    await request("session", { method: "DELETE" });
    showLogin();
    $("#password").focus();
    $("#message").textContent = "Signed out. Back to the fun?";
  } catch (error) {
    $("#message").textContent = error.message;
  }
});
$("#refresh").addEventListener("click", () => refresh());
$("#load-registrations").addEventListener("click", async () => {
  const button = $("#load-registrations");
  button.disabled = true;
  try {
    const data = await request("registrations");
    $("#registrations").innerHTML =
      `<p><strong>${n(data.total)}</strong> registered for pack updates${data.total > 100 ? " · latest 100 shown" : ""}.</p>` +
      (data.subscribers.length
        ? `<div class="table-wrap"><table><thead><tr><th>Email</th><th>Signed up</th><th>Status</th></tr></thead><tbody>${data.subscribers.map((row) => `<tr><td>${escape(row.email)}</td><td>${escape(new Date(row.createdAt).toLocaleDateString())}</td><td>Awaiting email confirmation</td></tr>`).join("")}</tbody></table></div>`
        : "<p class='admin-muted'>Your first early bird is still on the way.</p>");
  } catch (error) {
    $("#message").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
$("#period").addEventListener("change", render);
$("#room-filter").addEventListener("change", renderRooms);
setInterval(() => {
  if (!document.hidden && !$("#dashboard").hidden) refresh();
}, 30000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !$("#dashboard").hidden) refresh();
});
refresh(true);
