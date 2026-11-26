import test from "node:test";
import assert from "node:assert/strict";
import { JingleRecorder } from "../public/jingle-recorder.js";
function browser(t, getUserMedia, Recorder = class {}) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    oldRecorder = globalThis.MediaRecorder;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia } },
  });
  globalThis.MediaRecorder = Recorder;
  t.after(() => {
    if (saved) Object.defineProperty(globalThis, "navigator", saved);
    else delete globalThis.navigator;
    if (oldRecorder) globalThis.MediaRecorder = oldRecorder;
    else delete globalThis.MediaRecorder;
  });
}
test("leaving while a microphone permission request is pending releases a late stream", async (t) => {
  let allow,
    stops = 0;
  browser(
    t,
    () =>
      new Promise((resolve) => {
        allow = resolve;
      }),
  );
  const recorder = new JingleRecorder(
    () => {},
    () => {},
  );
  const started = recorder.start("q1");
  assert.equal(recorder.status, "asking");
  recorder.cancel();
  allow({ getTracks: () => [{ stop: () => stops++ }] });
  await started;
  assert.equal(stops, 1);
  assert.equal(recorder.status, "idle");
  assert.equal(recorder.draft, null);
});
test("cancel stops the recorder, microphone and timers without keeping a draft", async (t) => {
  let stops = 0,
    recorderStops = 0;
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    constructor() {
      this.state = "inactive";
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      recorderStops++;
    }
  }
  browser(
    t,
    async () => ({ getTracks: () => [{ stop: () => stops++ }] }),
    Recorder,
  );
  const recorder = new JingleRecorder(
    () => {},
    () => {},
  );
  await recorder.start("q1");
  assert.equal(recorder.status, "recording");
  recorder.cancel();
  assert.equal(stops, 1);
  assert.equal(recorderStops, 1);
  assert.equal(recorder.status, "idle");
});
test("denied microphones produce a useful retry or skip message", async (t) => {
  browser(t, async () => {
    throw new DOMException("Blocked", "NotAllowedError");
  });
  const recorder = new JingleRecorder(
    () => {},
    () => {},
  );
  await recorder.start("q1");
  assert.equal(recorder.status, "idle");
  assert.match(recorder.error, /skip/);
});
