// Draw locally so sharing never uploads player details or game answers.
export function drawShareCard(canvas, format, url) {
  const story = format === "story";
  canvas.width = 1080;
  canvas.height = story ? 1920 : 1080;
  const c = canvas.getContext("2d");
  const h = canvas.height;
  c.fillStyle = "#211439";
  c.fillRect(0, 0, 1080, h);
  c.strokeStyle = "#6b4e92";
  c.lineWidth = 3;
  c.strokeRect(36, 36, 1008, h - 72);
  c.fillStyle = "#382451";
  c.beginPath();
  c.arc(1020, story ? 720 : 340, 330, 0, Math.PI * 2);
  c.fill();
  const top = story ? 285 : 100;
  const text = (value, x, y, size, color = "#fff9f2", weight = 700) => {
    c.fillStyle = color;
    c.font = `${weight} ${size}px Arial, sans-serif`;
    c.fillText(value, x, y);
  };
  text("BLUFF & TELL", 90, top, 44, "#d6f58a");
  text("Know your friends.", 90, top + 128, 77);
  text("Believe nothing.", 90, top + 220, 77, "#d6f58a");
  const cardY = top + (story ? 365 : 292);
  c.save();
  c.translate(540, cardY + 112);
  c.rotate(-0.035);
  c.fillStyle = "#f2a9cc";
  c.fillRect(-450, -110, 900, 220);
  text("ONE TRUTH. THREE LIES.", -405, -46, 27, "#211439");
  text("Wait… that’s actually true?!", -405, 31, 49, "#211439");
  text(
    "Your next game night just got suspicious.",
    -405,
    81,
    29,
    "#211439",
    400,
  );
  c.restore();
  const bottom = story ? 1340 : 780;
  text("Laugh yourself silly.", 90, bottom, 57);
  text(
    "2–8 players  ·  Any phone  ·  No download",
    90,
    bottom + 64,
    32,
    "#d6c9e6",
    400,
  );
  text("Bring your people. Play Bluff & Tell.", 90, bottom + 135, 33);
  // Keep long preview addresses inside the frame.
  const address = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  let size = 30;
  c.font = `400 ${size}px Arial, sans-serif`;
  while (c.measureText(address).width > 890 && size > 12) {
    c.font = `400 ${--size}px Arial, sans-serif`;
  }
  text(address, 90, bottom + 191, size, "#d6f58a", 400);
}

export function cardBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image unavailable"))),
      "image/png",
    );
  });
}
