import qrcode from "./vendor/qrcode.js";

export function roomInviteUrl(origin, code) {
  if (!/^[A-Z2-9]{6}$/.test(code)) throw new Error("Choose a valid room.");
  const url = new URL("/", origin);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Use a web link.");
  url.username = "";
  url.password = "";
  url.searchParams.set("room", code);
  return url.href;
}

export function createInviteQr(origin, code) {
  const url = roomInviteUrl(origin, code);
  const qr = qrcode(0, "M");
  qr.addData(url, "Byte");
  qr.make();
  // Keep four clear modules around the code, with crisp, solid pixels.
  const quiet = 4,
    scale = 6;
  const modules = qr.getModuleCount();
  const width = (modules + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < modules; row++) {
    for (let column = 0; column < modules; column++) {
      if (!qr.isDark(row, column)) continue;
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const offset =
            (((row + quiet) * scale + y) * width +
              (column + quiet) * scale +
              x) *
            4;
          pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
        }
    }
  }
  return { url, width, pixels };
}

// A fresh invitation takes priority over reconnecting to a different room.
export function sessionForInvite(saved, inviteCode) {
  return inviteCode && saved?.code !== inviteCode ? null : saved;
}
