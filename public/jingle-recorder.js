import { AUDIO_SECONDS, encodeJingleWav } from "./audio-format.js";

export class JingleRecorder {
  constructor(onChange, onCountdown) {
    this.onChange = onChange;
    this.onCountdown = onCountdown;
    this.generation = 0;
    this.status = "idle";
    this.draft = null;
    this.error = "";
  }
  cancel() {
    this.generation++;
    clearTimeout(this.stopTimer);
    clearInterval(this.countdown);
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.status = "idle";
    this.draft = null;
    this.error = "";
  }
  async start(questionId) {
    this.cancel();
    const generation = this.generation;
    this.questionId = questionId;
    this.status = "asking";
    this.onChange();
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Mic unavailable here. Try the HTTPS game link, or skip this round.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const mimeType = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32000,
      });
      this.recorder = recorder;
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (generation === this.generation) {
          this.cancel();
          this.error = "Mic hiccup. Record again, or skip.";
          this.onChange();
        }
      };
      recorder.onstop = async () => {
        clearTimeout(this.stopTimer);
        clearInterval(this.countdown);
        stream.getTracks().forEach((track) => track.stop());
        if (generation !== this.generation) return;
        this.status = "processing";
        this.onChange();
        let context;
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          if (!blob.size || blob.size > 2000000)
            throw new Error("Try a shorter jingle.");
          context = new (window.AudioContext || window.webkitAudioContext)();
          const buffer = await context.decodeAudioData(
            await blob.arrayBuffer(),
          );
          const channels = Array.from(
            { length: buffer.numberOfChannels },
            (_, index) => buffer.getChannelData(index),
          );
          const bytes = encodeJingleWav(channels, buffer.sampleRate);
          let binary = "";
          for (let i = 0; i < bytes.length; i += 8192)
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          if (generation !== this.generation) return;
          this.draft = "data:audio/wav;base64," + btoa(binary);
          this.status = "ready";
        } catch (error) {
          if (generation !== this.generation) return;
          this.status = "idle";
          this.error = error.message || "That one got lost. Record again.";
        } finally {
          if (context) await context.close().catch(() => {});
        }
        if (generation === this.generation) this.onChange();
      };
      recorder.start(250);
      this.status = "recording";
      this.startedAt = Date.now();
      this.onChange();
      this.stopTimer = setTimeout(() => this.stop(), AUDIO_SECONDS * 1000);
      this.countdown = setInterval(
        () =>
          this.onCountdown(
            Math.max(
              0,
              Math.ceil(AUDIO_SECONDS - (Date.now() - this.startedAt) / 1000),
            ),
          ),
        100,
      );
    } catch (error) {
      if (generation !== this.generation) return;
      this.stream?.getTracks().forEach((track) => track.stop());
      this.status = "idle";
      this.error =
        error.name === "NotAllowedError"
          ? "Mic blocked. Allow it in your browser, or skip."
          : error.message || "Mic unavailable. Try again, or skip.";
      this.onChange();
    }
  }
  stop() {
    if (this.recorder?.state === "recording") this.recorder.stop();
  }
}
