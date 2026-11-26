export const AUDIO_SECONDS = 5;
export const AUDIO_SAMPLE_RATE = 12000;
export const MAX_AUDIO_DATA_LENGTH = 162000;
export const MAX_REQUEST_LENGTH = 164000;

// A small, common playback format for recordings made by different browsers.
export function encodeJingleWav(channels, sourceRate) {
  if (!channels.length || !Number.isFinite(sourceRate) || sourceRate <= 0)
    throw new Error("No recording found.");
  const length = Math.min(
    channels[0].length,
    Math.floor(sourceRate * AUDIO_SECONDS),
  );
  const samples = Math.floor((length * AUDIO_SAMPLE_RATE) / sourceRate);
  if (samples < AUDIO_SAMPLE_RATE / 4)
    throw new Error("Give us at least a little jingle!");
  const bytes = new Uint8Array(44 + samples * 2),
    view = new DataView(bytes.buffer);
  const text = (at, value) =>
    [...value].forEach((letter, i) =>
      view.setUint8(at + i, letter.charCodeAt(0)),
    );
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, AUDIO_SAMPLE_RATE, true);
  view.setUint32(28, AUDIO_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const start = Math.floor((i * sourceRate) / AUDIO_SAMPLE_RATE),
      end = Math.min(
        length,
        Math.max(
          start + 1,
          Math.floor(((i + 1) * sourceRate) / AUDIO_SAMPLE_RATE),
        ),
      );
    let total = 0;
    for (const channel of channels)
      for (let at = start; at < end; at++)
        total += Number.isFinite(channel[at]) ? channel[at] : 0;
    const sample = Math.max(
      -1,
      Math.min(1, total / ((end - start) * channels.length)),
    );
    view.setInt16(44 + i * 2, sample * (sample < 0 ? 32768 : 32767), true);
  }
  return bytes;
}

export function jingleDuration(bytes) {
  if (bytes.length < 44) throw new Error("That jingle did not come through.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at, n) => String.fromCharCode(...bytes.slice(at, at + n));
  if (
    text(0, 4) !== "RIFF" ||
    text(8, 4) !== "WAVE" ||
    text(12, 4) !== "fmt " ||
    text(36, 4) !== "data" ||
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== AUDIO_SAMPLE_RATE ||
    view.getUint32(28, true) !== AUDIO_SAMPLE_RATE * 2 ||
    view.getUint16(32, true) !== 2 ||
    view.getUint16(34, true) !== 16 ||
    view.getUint32(4, true) !== bytes.length - 8 ||
    view.getUint32(40, true) !== bytes.length - 44 ||
    (bytes.length - 44) % 2
  )
    throw new Error("Try recording that jingle again.");
  const seconds = (bytes.length - 44) / (AUDIO_SAMPLE_RATE * 2);
  if (seconds < 0.25 || seconds > AUDIO_SECONDS)
    throw new Error("Jingles must be between a moment and five seconds.");
  return seconds;
}
