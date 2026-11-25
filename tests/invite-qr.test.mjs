import test from "node:test";
import assert from "node:assert/strict";
import jsQR from "jsqr";
import {
  createInviteQr,
  roomInviteUrl,
  sessionForInvite,
} from "../public/invite-qr.js";

test("the actual QR pixels scan back to the exact room invitation", () => {
  for (const origin of [
    "http://192.168.0.123:4317",
    "https://bluff-and-tell-staging.bluff-and-tell.workers.dev",
    "https://play.example.com",
  ]) {
    const { width, pixels, url } = createInviteQr(origin, "K7P2QX");
    const decoded = jsQR(pixels, width, width, {
      inversionAttempts: "dontInvert",
    });
    assert(decoded, `QR should scan for ${origin}`);
    assert.equal(decoded.data, url);
    assert.equal(decoded.data, `${origin}/?room=K7P2QX`);
    assert(
      pixels.slice(0, width * 4 * 24).every((v) => v === 255),
      "four-module quiet zone must be white",
    );
  }
});
test("invitations include only the room code, without session data or old query parameters", () => {
  const url = roomInviteUrl(
    "https://user:password@example.com/private?token=secret#old",
    "QX72PK",
  );
  assert.equal(url, "https://example.com/?room=QX72PK");
  assert.equal(new URL(url).searchParams.size, 1);
});
test("invalid codes and non-web links cannot become QR invitations", () => {
  for (const code of ["", "abc123", "K7P2QX&token=x", "<script>", "TOOLONG"])
    assert.throws(() => createInviteQr("https://example.com", code));
  assert.throws(() => roomInviteUrl("javascript:alert(1)", "K7P2QX"));
});

test("scanning another room bypasses an old session; scanning your own room reconnects", () => {
  const saved = { code: "K7P2QX", token: "private-session" };
  assert.equal(sessionForInvite(saved, "QX72PK"), null);
  assert.equal(sessionForInvite(saved, "K7P2QX"), saved);
  assert.equal(sessionForInvite(saved, ""), saved);
  assert.equal(sessionForInvite(null, "QX72PK"), null);
});
