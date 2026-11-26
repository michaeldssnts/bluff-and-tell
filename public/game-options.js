export const GAME_LENGTHS = [5, 10, 20, 30];
export function estimateMinutes(questions, players = 4) {
  return Math.round(questions * players * 0.7);
}
export function progressState(question, phase) {
  const completed =
    question.number - 1 + (["reveal", "story"].includes(phase) ? 1 : 0);
  return {
    completed,
    remaining: question.total - completed,
    total: question.total,
  };
}

// Largest-remainder rounding keeps the requested mix and exact game length.
export function partyMixCounts(total, includeAudio = true, variant = 0) {
  const weights = includeAudio
    ? { truth: 70, face: 10, doodle: 10, audio: 10 }
    : { truth: 80, face: 10, doodle: 10, audio: 0 };
  const counts = Object.fromEntries(
    Object.entries(weights).map(([type, weight]) => [
      type,
      Math.floor((total * weight) / 100),
    ]),
  );
  const tieOrder = [
    "truth",
    ...["face", "doodle", "audio"].slice(variant % 3),
    ...["face", "doodle", "audio"].slice(0, variant % 3),
  ];
  const ranked = Object.keys(weights).sort(
    (a, b) =>
      ((total * weights[b]) % 100) - ((total * weights[a]) % 100) ||
      tieOrder.indexOf(a) - tieOrder.indexOf(b),
  );
  let extra = total - Object.values(counts).reduce((a, b) => a + b, 0);
  for (const type of ranked) if (extra-- > 0) counts[type]++;
  return counts;
}
