// Competition ranks preserve ties; movement compares totals before this round.
export function rankedScores(players, gains = {}) {
  return [...players]
    .sort((a, b) => b.score - a.score)
    .map((player) => {
      const gain = gains[player.id] ?? 0;
      const rank = 1 + players.filter((p) => p.score > player.score).length;
      const previousRank =
        1 +
        players.filter(
          (p) => p.score - (gains[p.id] ?? 0) > player.score - gain,
        ).length;
      return { ...player, gain, rank, climbed: previousRank - rank };
    });
}

export class RevealChime {
  constructor() {
    this.enabled = true;
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.output)
      this.output.gain.setValueAtTime(
        enabled ? 1 : 0,
        this.context.currentTime,
      );
  }
  unlock() {
    if (!this.enabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.context ??= new Audio();
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
    } catch {
      /* Scores remain usable when audio is unavailable. */
    }
  }
  play(final = false) {
    const context = this.context;
    if (!this.enabled || context?.state !== "running") return;
    if (!this.output) {
      this.output = context.createGain();
      this.output.connect(context.destination);
    }
    const notes = final
      ? [523.25, 659.25, 783.99, 1046.5]
      : [659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      const start = context.currentTime + index * 0.12;
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0, start);
      volume.gain.linearRampToValueAtTime(0.07, start + 0.015);
      volume.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
      oscillator.connect(volume);
      volume.connect(this.output);
      oscillator.start(start);
      oscillator.stop(start + 0.35);
      oscillator.onended = () => {
        oscillator.disconnect();
        volume.disconnect();
      };
    });
  }
}
