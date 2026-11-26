import test from "node:test";
import assert from "node:assert/strict";
import {
  PhotoDraft,
  filterPixels,
  boundedJpeg,
  preparePhoto,
} from "../public/photo-tools.js";
const context = { code: "ABC234", playerId: "a", questionId: "round1" };
const image = "data:image/jpeg;base64,AAAA";
function storage() {
  const saved = new Map();
  return {
    getItem: (k) => saved.get(k) || null,
    setItem: (k, v) => saved.set(k, v),
    removeItem: (k) => saved.delete(k),
  };
}
test("pending photo, selected filter and retry identity survive refresh; other rounds and players cannot reuse it", () => {
  const saved = storage(),
    draft = new PhotoDraft(saved);
  draft.set(context, image);
  draft.filtered("disco", image + "AAAA");
  draft.value.requestId = "same-retry";
  draft.save();
  const restored = new PhotoDraft(saved);
  restored.restore(context);
  assert.equal(restored.value.filter, "disco");
  assert.equal(restored.value.requestId, "same-retry");
  restored.restore({ ...context, playerId: "b" });
  assert.equal(restored.value, null);
  draft.set(context, image);
  restored.restore({ ...context, questionId: "round2" });
  assert.equal(restored.value, null);
  draft.set(context, image);
  restored.restore({ ...context, code: "XYZ234" });
  assert.equal(restored.value, null);
});
test("confirming a send clears the pending draft; editing starts a new retry identity", () => {
  const saved = storage(),
    draft = new PhotoDraft(saved);
  draft.set(context, image);
  draft.value.requestId = "old";
  draft.filtered("noir", image);
  assert.equal(draft.value.requestId, null);
  draft.clear();
  const restored = new PhotoDraft(saved);
  restored.restore(context);
  assert.equal(restored.value, null);
});
test("blocked storage does not prevent in-memory photo preview and sending", () => {
  const fail = () => {
    throw Error("Storage blocked");
  };
  const draft = new PhotoDraft({
    getItem: fail,
    setItem: fail,
    removeItem: fail,
  });
  draft.restore(context);
  draft.set(context, image);
  assert(draft.matches(context));
  assert.doesNotThrow(() => draft.clear());
});
test("filters transform colours, preserve alpha and leave original pixels unchanged", () => {
  const pixel = () => new Uint8ClampedArray([200, 100, 50, 255]);
  assert.deepEqual([...filterPixels(pixel(), "original")], [200, 100, 50, 255]);
  const noir = filterPixels(pixel(), "noir");
  assert.equal(noir[0], noir[1]);
  assert.equal(noir[1], noir[2]);
  assert.deepEqual([...filterPixels(pixel(), "disco")], [100, 50, 200, 255]);
  for (const filter of ["noir", "toasty", "disco", "comic"])
    assert.equal(filterPixels(pixel(), filter)[3], 255);
  assert.notDeepEqual([...filterPixels(pixel(), "comic")], [200, 100, 50, 255]);
});
test("encoding reduces dimensions as well as quality until the upload is bounded", () => {
  const original = globalThis.document;
  const sizes = [];
  const canvas = (width) => ({
    width,
    height: width,
    getContext: () => ({ drawImage() {} }),
    toDataURL() {
      sizes.push(this.width);
      return (
        "data:image/jpeg;base64," + "A".repeat(this.width > 200 ? 60000 : 20000)
      );
    },
  });
  globalThis.document = { createElement: () => canvas(0) };
  try {
    const result = boundedJpeg(canvas(320));
    assert(result.length <= 56000);
    assert(sizes.includes(180));
  } finally {
    globalThis.document = original;
  }
});
test("unencodable photos fail explicitly instead of returning oversized data", () => {
  assert.throws(
    () =>
      boundedJpeg({ width: 96, toDataURL: () => image + "A".repeat(60000) }),
    /too large/,
  );
});

test("image decoding falls back when bitmap decoding fails and releases its temporary URL", async () => {
  const originals = {
    bitmap: globalThis.createImageBitmap,
    Image: globalThis.Image,
    document: globalThis.document,
    create: URL.createObjectURL,
    revoke: URL.revokeObjectURL,
  };
  const released = [];
  globalThis.createImageBitmap = async () => {
    throw Error("Bitmap decode unavailable");
  };
  URL.createObjectURL = () => "blob:synthetic-photo";
  URL.revokeObjectURL = (url) => released.push(url);
  globalThis.Image = class {
    width = 640;
    height = 480;
    set src(value) {
      queueMicrotask(() => this.onload());
    }
  };
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toDataURL: () => image,
    }),
  };
  try {
    assert.equal(await preparePhoto({}), image);
    assert.deepEqual(released, ["blob:synthetic-photo"]);
  } finally {
    globalThis.createImageBitmap = originals.bitmap;
    globalThis.Image = originals.Image;
    globalThis.document = originals.document;
    URL.createObjectURL = originals.create;
    URL.revokeObjectURL = originals.revoke;
  }
});
