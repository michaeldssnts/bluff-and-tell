import { rankedScores } from "./reveal-effects.js";

// A self-contained PDF with a high-resolution certificate image. Nicknames keep
// the browser's Unicode rendering; no fonts, photos or recordings are uploaded.
export function jpegPdf(jpeg, width, height) {
  const encode = (text) => new TextEncoder().encode(text);
  const parts = [],
    offsets = [0];
  let length = 0;
  const add = (bytes) => {
    parts.push(bytes);
    length += bytes.length;
  };
  const text = (value) => add(encode(value));
  const object = (id, body) => {
    offsets[id] = length;
    text(`${id} 0 obj\n${body}\nendobj\n`);
  };
  text("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Certificate 4 0 R >> >> /Contents 5 0 R >>",
  );
  offsets[4] = length;
  text(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  add(jpeg);
  text("\nendstream\nendobj\n");
  const commands = "q\n842 0 0 595 0 0 cm\n/Certificate Do\nQ\n";
  object(
    5,
    `<< /Length ${encode(commands).length} >>\nstream\n${commands}endstream`,
  );
  const xref = length;
  text("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++)
    text(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
export function drawCertificate(canvas, { players, rounds }) {
  const ranked = rankedScores(players),
    winners = ranked.filter((p) => p.rank === 1);
  canvas.width = 1684;
  canvas.height = 1190;
  const c = canvas.getContext("2d");
  c.fillStyle = "#fff9f2";
  c.fillRect(0, 0, 1684, 1190);
  c.strokeStyle = "#211439";
  c.lineWidth = 4;
  c.strokeRect(30, 30, 1624, 1130);
  c.fillStyle = "#211439";
  c.fillRect(50, 50, 1584, 220);
  function text(
    value,
    x,
    y,
    size,
    color = "#211439",
    weight = 700,
    max = 1480,
    align = "left",
  ) {
    c.fillStyle = color;
    c.textAlign = align;
    c.font = `${weight} ${size}px Arial, sans-serif`;
    while (c.measureText(value).width > max && size > 14)
      c.font = `${weight} ${--size}px Arial, sans-serif`;
    c.fillText(value, x, y);
  }
  text("BLUFF & TELL", 90, 108, 36, "#d8fa85");
  text("CERTIFIED GAME-NIGHT LEGENDS", 90, 198, 66, "#fff9f2");
  text(
    winners.length > 1 ? "SHARED WINNERS" : "THE WINNER",
    90,
    323,
    22,
    "#725489",
  );
  // Up to eight tied winners wrap across two lines without clipping long nicknames.
  const winnerNames = winners.map((p) => p.name);
  const lines = [];
  let line = "";
  c.font = "700 42px Arial, sans-serif";
  for (const name of winnerNames) {
    const next = line ? line + "  +  " + name : name;
    if (c.measureText(next).width > 1450 && line) {
      lines.push(line);
      line = name;
    } else line = next;
  }
  if (line) lines.push(line);
  const winnerSize = lines.length > 2 ? 30 : 42;
  lines.forEach((line, i) =>
    text(line, 90, 375 + i * 43, winnerSize, "#211439", 700, 1490),
  );
  const tableTop = 410 + (lines.length - 1) * 43;
  text("RANK", 104, tableTop + 20, 20, "#725489");
  text("THE PEOPLE WHO MADE IT RIDICULOUS", 240, tableTop + 20, 20, "#725489");
  text("POINTS", 1570, tableTop + 20, 20, "#725489", 700, 180, "right");
  const rowHeight = Math.min(66, (1065 - tableTop - 45) / ranked.length);
  ranked.forEach((p, i) => {
    const y = tableTop + 38 + i * rowHeight;
    c.fillStyle = p.rank === 1 ? "#d8fa85" : i % 2 ? "#f0e8f7" : "#f7f0fa";
    c.fillRect(90, y, 1504, rowHeight - 5);
    const baseline = y + rowHeight * 0.63;
    text("#" + p.rank, 104, baseline, 27);
    text(p.name, 240, baseline, 29, "#211439", 700, 1040);
    text(String(p.score), 1570, baseline, 34, "#211439", 700, 170, "right");
  });
  text(
    `${rounds} rounds. Maximum nonsense. Bragging rights earned.`,
    90,
    1112,
    23,
    "#725489",
    400,
  );
  text(
    "Know your friends. Believe nothing.",
    1594,
    1112,
    23,
    "#725489",
    400,
    540,
    "right",
  );
  return canvas;
}
export function certificatePdf(data) {
  const canvas = drawCertificate(document.createElement("canvas"), data);
  const raw = atob(canvas.toDataURL("image/jpeg", 0.94).split(",")[1]);
  const bytes = Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
  return new Blob([jpegPdf(bytes, canvas.width, canvas.height)], {
    type: "application/pdf",
  });
}
