import test from "node:test";
import assert from "node:assert/strict";
import { jpegPdf, drawCertificate } from "../public/certificate.js";
test("certificate PDF has exact binary image length, valid object offsets and one landscape A4 page", () => {
  const jpeg = new Uint8Array([255, 216, 0, 128, 255, 217]);
  const bytes = jpegPdf(jpeg, 1684, 1190),
    pdf = Buffer.from(bytes).toString("latin1");
  assert(pdf.startsWith("%PDF-1.4"));
  assert(pdf.includes("/MediaBox [0 0 842 595]"));
  assert(pdf.includes("/Count 1"));
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(xref, xref + 4), "xref");
  const entries = pdf.slice(xref).split("\n").slice(3, 8);
  entries.forEach((line, i) =>
    assert.equal(
      pdf.slice(Number(line.slice(0, 10)), Number(line.slice(0, 10)) + 7),
      `${i + 1} 0 obj`,
    ),
  );
  const imageStart = pdf.indexOf("stream\n") + 7;
  assert.deepEqual(
    [...bytes.slice(imageStart, imageStart + jpeg.length)],
    [...jpeg],
  );
  assert(pdf.includes("/Length 6 >>"));
});
test("certificate includes every nickname and score, correct ranks, and all tied winners", () => {
  const labels = [];
  const context = {
    fillRect() {},
    strokeRect() {},
    fillText(value, x, y) {
      labels.push({ value: String(value), x, y });
    },
    measureText(value) {
      return { width: Array.from(value).length * 20 };
    },
  };
  const canvas = { getContext: () => context };
  const players = [
    { id: "a", name: "Mia", score: 12 },
    { id: "b", name: "Zee", score: 4 },
    { id: "c", name: "Tumi", score: 12 },
  ];
  drawCertificate(canvas, { players, rounds: 10 });
  assert(labels.some((x) => x.value === "Mia  +  Tumi"));
  assert(labels.some((x) => x.value === "SHARED WINNERS"));
  for (const p of players) assert(labels.some((x) => x.value === p.name));
  assert.equal(labels.filter((x) => x.value === "#1").length, 2);
  assert(labels.some((x) => x.value === "#3"));
  assert(labels.every((x) => x.y > 0 && x.y < 1190));
  assert(labels.some((x) => x.value.startsWith("10 rounds.")));
});
