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

// Victory card for the final scores. Drawn locally; only the sharer's own name and score appear.
export function drawVictoryCard(canvas, { name, won, tie, rank, total, points, url }) {
  canvas.width = 1080;
  canvas.height = 1080;
  const c = canvas.getContext("2d");
  c.fillStyle = "#211439";
  c.fillRect(0, 0, 1080, 1080);
  c.strokeStyle = "#6b4e92";
  c.lineWidth = 3;
  c.strokeRect(36, 36, 1008, 1008);
  // Confetti, fixed positions so the card looks the same every time.
  const colours = ["#d8fa85", "#ffadd1", "#c5a2ff", "#ffb777"];
  for (let i = 0; i < 70; i++) {
    const x = (i * 157) % 1000 + 40,
      y = (i * 89) % 330 + 60;
    c.save();
    c.translate(x, y);
    c.rotate((i * 37) % 180);
    c.fillStyle = colours[i % 4];
    c.fillRect(-9, -4, 18, 8);
    c.restore();
  }
  const text = (value, x, y, size, color = "#fff9f2", weight = 700, align = "center") => {
    c.fillStyle = color;
    c.textAlign = align;
    c.font = `${weight} ${size}px Arial, sans-serif`;
    c.fillText(value, x, y);
  };
  // Trophy
  c.fillStyle = "#d8fa85";
  c.beginPath();
  c.moveTo(470, 300);
  c.lineTo(610, 300);
  c.lineTo(600, 380);
  c.quadraticCurveTo(540, 440, 480, 380);
  c.closePath();
  c.fill();
  c.fillRect(528, 420, 24, 50);
  c.fillRect(495, 470, 90, 18);
  text("BLUFF & TELL", 540, 560, 40, "#d8fa85");
  const headline = won ? (tie ? "Shared the win!" : "I won!") : `I came #${rank} of ${total}`;
  let size = 110;
  c.font = `700 ${size}px Arial, sans-serif`;
  while (c.measureText(headline).width > 900 && size > 50) c.font = `700 ${--size}px Arial, sans-serif`;
  text(headline, 540, 690, size);
  let nameSize = 52;
  c.font = `700 ${nameSize}px Arial, sans-serif`;
  while (c.measureText(name).width > 880 && nameSize > 24) c.font = `700 ${--nameSize}px Arial, sans-serif`;
  text(name, 540, 770, nameSize, "#ffadd1");
  text(`${points} ${points === 1 ? "point" : "points"} · one truth, three lies`, 540, 840, 36, "#d6c9e6", 400);
  text("Think you can beat me?", 540, 930, 40);
  const address = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  text(address, 540, 990, 28, "#d8fa85", 400);
}
