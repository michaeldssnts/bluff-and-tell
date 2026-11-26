export const PHOTO_FILTERS = [
  ["original", "Original"],
  ["noir", "🎬 Noir"],
  ["toasty", "🍞 Toasty"],
  ["disco", "🪩 Disco"],
  ["comic", "💥 Comic"],
];
const LIMIT = 56000;
export function filterPixels(pixels, filter) {
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    if (filter === "noir")
      pixels[i] =
        pixels[i + 1] =
        pixels[i + 2] =
          0.299 * r + 0.587 * g + 0.114 * b;
    else if (filter === "toasty") {
      pixels[i] = 0.393 * r + 0.769 * g + 0.189 * b;
      pixels[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
      pixels[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
    } else if (filter === "disco") {
      pixels[i] = g;
      pixels[i + 1] = b;
      pixels[i + 2] = r;
    } else if (filter === "comic") {
      for (let channel = 0; channel < 3; channel++)
        pixels[i + channel] =
          Math.round(
            Math.max(
              0,
              Math.min(255, (pixels[i + channel] - 128) * 1.4 + 128),
            ) / 51,
          ) * 51;
    }
  }
  return pixels;
}
async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
          reject(new Error("Couldn’t open that photo. Try a JPG or PNG."));
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
export function boundedJpeg(canvas) {
  // Lower both quality and dimensions if necessary; never return an oversized upload.
  for (;;) {
    for (const quality of [0.78, 0.65, 0.5, 0.35, 0.22]) {
      const image = canvas.toDataURL("image/jpeg", quality);
      if (image.startsWith("data:image/jpeg;base64,") && image.length <= LIMIT)
        return image;
    }
    if (canvas.width <= 96)
      throw new Error("That photo is too large. Choose another one.");
    const smaller = document.createElement("canvas");
    smaller.width = smaller.height = Math.max(
      96,
      Math.floor(canvas.width * 0.75),
    );
    smaller
      .getContext("2d")
      .drawImage(canvas, 0, 0, smaller.width, smaller.height);
    canvas = smaller;
  }
}
export async function preparePhoto(file) {
  const source = await decode(file);
  try {
    const w = source.width,
      h = source.height,
      side = Math.min(w, h);
    if (!side) throw new Error("Couldn’t open that photo. Choose another one.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 320;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 320, 320);
    context.drawImage(
      source,
      (w - side) / 2,
      (h - side) / 2,
      side,
      side,
      0,
      0,
      320,
      320,
    );
    return boundedJpeg(canvas);
  } finally {
    source.close?.();
  }
}
export async function applyPhotoFilter(source, filter) {
  if (filter === "original") return source;
  if (!PHOTO_FILTERS.some(([id]) => id === filter))
    throw new Error("Choose a photo filter.");
  const image = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Couldn’t apply that filter. Try another."));
    image.src = source;
  });
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 320;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, 320, 320);
  const frame = context.getImageData(0, 0, 320, 320);
  filterPixels(frame.data, filter);
  context.putImageData(frame, 0, 0);
  return boundedJpeg(canvas);
}
// Only the current unsent photo is kept in this tab, so a refresh can recover it.
export class PhotoDraft {
  constructor(storage) {
    this.storage = storage;
    this.value = null;
  }
  matches(context) {
    return (
      this.value &&
      ["code", "playerId", "questionId"].every(
        (key) => this.value[key] === context?.[key],
      )
    );
  }
  restore(context) {
    try {
      this.value = JSON.parse(this.storage.getItem("bt-photo-draft"));
    } catch {
      this.value = null;
    }
    if (
      !this.matches(context) ||
      ![this.value?.source, this.value?.image].every(
        (image) =>
          typeof image === "string" &&
          image.startsWith("data:image/jpeg;base64,") &&
          image.length <= LIMIT,
      )
    )
      this.clear();
  }
  set(context, source) {
    this.value = {
      ...context,
      source,
      image: source,
      filter: "original",
      requestId: null,
    };
    this.save();
  }
  filtered(filter, image) {
    this.value = { ...this.value, filter, image, requestId: null };
    this.save();
  }
  save() {
    try {
      this.storage.setItem("bt-photo-draft", JSON.stringify(this.value));
    } catch {}
  }
  clear() {
    this.value = null;
    try {
      this.storage.removeItem("bt-photo-draft");
    } catch {}
  }
}
