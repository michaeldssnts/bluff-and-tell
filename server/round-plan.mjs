import { partyMixCounts } from "../public/game-options.js";

// Cycles through one player order across type allocations: both the total
// featured turns and each individual activity differ by at most one per player.
export function fairRoundPlan(
  players,
  count,
  mode,
  { offset = 0, variant = 0 } = {},
) {
  const counts =
    mode === "mixed"
      ? partyMixCounts(count, true, variant)
      : {
          truth: mode === "classic" ? count : 0,
          face: mode === "faces" ? count : 0,
          doodle: mode === "doodles" ? count : 0,
          audio: 0,
        };
  const allocations = {};
  let cursor = offset;
  for (const [type, number] of Object.entries(counts)) {
    allocations[type] = Array.from(
      { length: number },
      () => players[cursor++ % players.length],
    );
  }
  const done = Object.fromEntries(Object.keys(counts).map((type) => [type, 0]));
  const rounds = [];
  for (let index = 0; index < count; index++) {
    const choices = Object.keys(counts).filter(
      (type) => done[type] < counts[type],
    );
    choices.sort(
      (a, b) =>
        (counts[b] * (index + 1)) / count -
        done[b] -
        ((counts[a] * (index + 1)) / count - done[a]),
    );
    const type = choices[0],
      remaining = allocations[type];
    const different = remaining.findIndex(
      (playerId) => playerId !== rounds.at(-1)?.playerId,
    );
    const playerId = remaining.splice(different < 0 ? 0 : different, 1)[0];
    rounds.push({ type, playerId });
    done[type]++;
  }
  return {
    rounds,
    counts,
    nextOffset:
      (offset + ((counts.truth || count) % players.length || 1)) %
      players.length,
  };
}
