import { createHash } from "node:crypto";
import { EXTRA_PROMPTS } from "./extra-prompts.mjs";
import { CHRISTMAS_PROMPTS } from "./christmas-prompts.mjs";

export const PROMPTS = [
  {
    id: "first-job",
    title: "What was your first job?",
    hint: "An actual job, however unofficial.",
    category: "Origin stories",
    icon: "briefcase",
    decoys: [
      "Working in a café",
      "Washing cars",
      "Babysitting",
      "Packing supermarket shelves",
      "Delivering newspapers",
      "Walking dogs",
    ],
    wildcards: [
      "Professional wedding crasher",
      "Scaring birds off a vineyard",
      "Testing dog biscuits",
      "Dressing as a giant tooth outside a dentist",
    ],
  },
  {
    id: "unexpected",
    title: "What is something unexpected you have done?",
    hint: "A little surprising. Completely true.",
    category: "Plot twists",
    icon: "sparkles",
    decoys: [
      "Sung karaoke alone",
      "Missed a flight while at the airport",
      "Won a dance competition",
      "Accidentally joined the wrong wedding",
      "Appeared on local television",
      "Slept through a fire alarm",
    ],
    wildcards: [
      "Been chased out of a wedding by a peacock",
      "Judged a competitive potato peeling contest",
      "Accidentally bid on a live ostrich",
      "Been mistaken for an undercover magician",
    ],
  },
  {
    id: "fear",
    title: "What is an unusual thing you are afraid of?",
    hint: "Something that actually gives you the creeps.",
    category: "Little secrets",
    icon: "eye",
    decoys: [
      "Balloons popping",
      "Deep swimming pools",
      "Clowns",
      "Escalators",
      "Birds flying indoors",
      "Opening a pressure cooker",
    ],
    wildcards: [
      "Being recognised by a very judgmental goose",
      "The sound of someone eating a banana",
      "A mannequin changing outfits overnight",
      "Getting trapped inside a mascot costume",
    ],
  },
];
export const AGE_GROUPS = ["child", "teen", "adult", "adult26"];

PROMPTS.push(
  {
    id: "favourite-food",
    title: "What is your favourite food?",
    hint: "Something you really love eating.",
    category: "Your favourites",
    decoys: [
      "Pizza",
      "Pancakes",
      "Spaghetti",
      "Chicken nuggets",
      "Watermelon",
      "Macaroni and cheese",
    ],
    wildcards: [
      "Chips dipped in ice cream",
      "Peanut butter and pickle sandwiches",
      "Cold baked beans straight from the tin",
      "Popcorn with tomato sauce",
    ],
  },
  {
    id: "free-time",
    title: "What do you most like doing in your free time?",
    hint: "Your real favourite way to have fun.",
    category: "Your world",
    decoys: [
      "Drawing",
      "Playing football",
      "Reading comics",
      "Building with LEGO",
      "Playing video games",
      "Riding my bike",
    ],
    wildcards: [
      "Making obstacle courses for my toys",
      "Inventing secret languages",
      "Building tiny houses for insects",
      "Teaching my pets dance moves",
    ],
  },
  {
    id: "dream-pet",
    title: "Which animal would you most like as a pet?",
    hint: "Tell us the animal you would really choose, even if it is unusual.",
    category: "Big ideas",
    decoys: [
      "A dog",
      "A cat",
      "A rabbit",
      "A hamster",
      "A parrot",
      "A tortoise",
    ],
    wildcards: [
      "A very polite capybara",
      "A miniature pig",
      "A frog with its own swimming pool",
      "A goat that thinks it is a dog",
    ],
  },
  {
    id: "school-subject",
    title: "Which school subject do you enjoy most?",
    hint: "Pick your actual favourite, even if your friends would never guess.",
    category: "School stories",
    decoys: [
      "Art",
      "Maths",
      "Science",
      "History",
      "Languages",
      "Physical education",
    ],
    wildcards: [
      "Drama, especially playing the villain",
      "Music, especially the loud instruments",
      "Geography, for the strange place names",
      "Science, for the weird experiments",
    ],
  },
  {
    id: "dream-skill",
    title: "Which skill would you most like to learn?",
    hint: "Something you genuinely wish you could do.",
    category: "Future you",
    decoys: [
      "Playing guitar",
      "Skateboarding",
      "Speaking another language",
      "Coding a game",
      "Photography",
      "Cooking",
    ],
    wildcards: [
      "Juggling while riding a unicycle",
      "Doing perfect cartoon voices",
      "Training a pigeon to deliver notes",
      "Making balloon animals at lightning speed",
    ],
  },
);

PROMPTS.push(
  {
    id: "ridiculous-purchase",
    title: "What is the most ridiculous thing you have spent money on?",
    hint: "A real purchase. Small and completely pointless counts.",
    category: "Questionable decisions",
    decoys: [
      "A gadget I only used once",
      "An enormous box of snacks",
      "A souvenir I could not fit in my luggage",
      "An outfit for my pet",
      "A kitchen gadget that promised too much",
      "A subscription I forgot to cancel",
    ],
    wildcards: [
      "A tiny sofa for a pet",
      "A life-size cardboard cutout of myself",
      "A formal outfit for a garden gnome",
      "A single potato sent through the post",
    ],
  },
  {
    id: "pointless-rivalry",
    title: "What harmless thing are you weirdly competitive about?",
    hint: "The tiny thing you take far too seriously. Be honest.",
    category: "Unnecessary rivalries",
    decoys: [
      "Board games",
      "Finding the cheapest groceries",
      "Parking perfectly",
      "Remembering song lyrics",
      "Packing the dishwasher",
      "Getting the last word",
    ],
    wildcards: [
      "Walking past strangers without being overtaken",
      "Winning arguments with the satnav",
      "Stopping the microwave with one second left",
      "Making the most dramatic sneeze",
    ],
  },
  {
    id: "terrible-excuse",
    title: "What is the silliest excuse you have used to get out of plans?",
    hint: "An actual excuse you have used, even if nobody believed it.",
    category: "Absolutely believable",
    decoys: [
      "My phone was dying",
      "I had an early start",
      "I was waiting for a delivery",
      "I already had plans",
      "My pet needed me",
      "I had mixed up the dates",
    ],
    wildcards: [
      "I said my houseplant looked lonely",
      "I blamed a completely imaginary plumber",
      "I said the cat had locked me out",
      "I claimed I was supervising a slow-cooker emergency",
    ],
  },
);

const PROMPT_SETS = {
  child: ["favourite-food", "free-time", "dream-pet"],
  teen: ["school-subject", "free-time", "dream-skill"],
  adult: ["first-job", "unexpected", "fear"],
  adult26: ["first-job", "unexpected", "fear"],
};
const SILLY_PROMPTS = [
  "ridiculous-purchase",
  "pointless-rivalry",
  "terrible-excuse",
];
export function promptPackForRoom(room) {
  if (room.promptPack) return room.promptPack;
  return room.players.length > 0 &&
    room.players.every((p) => p.ageGroup === "adult26")
    ? "extra-silly"
    : "personal";
}
export function normalisePromptHistory(value) {
  if (!Array.isArray(value)) return [];
  const valid = new Set(ALL_PROMPTS.map((p) => p.id));
  return value
    .filter((id, index) => valid.has(id) && value.lastIndexOf(id) === index)
    .slice(-90);
}
export function promptPoolForPlayer(player, room) {
  if (room?.flowVersion === 2 && room.settings.questionPack === "christmas")
    return CHRISTMAS_PROMPTS;
  // New games share one question bank. Employment history is not required.
  if (room?.flowVersion === 2)
    return PROMPTS.filter((p) => p.id !== "first-job");
  if (player.ageGroup === null) return [];
  const age = player.ageGroup ?? "adult";
  if (room && promptPackForRoom(room) === "extra-silly")
    return PROMPTS.filter(
      (p) => SILLY_PROMPTS.includes(p.id) || p.silly || p.family,
    );
  const legacy = PROMPT_SETS[age] ?? PROMPT_SETS.adult;
  return PROMPTS.filter(
    (p) => legacy.includes(p.id) || (!p.silly && p.audiences?.includes(age)),
  );
}
export function promptsForPlayer(player, room) {
  if (room?.flowVersion === 2 && room.phase !== "lobby") {
    const q = room.queue[room.questionIndex];
    return room.phase === "writing" && q?.playerId === player.id
      ? [ALL_PROMPTS.find((p) => p.id === q.promptId)].filter(Boolean)
      : [];
  }
  if (player.ageGroup === null) return [];
  // Saved games keep their existing prompts until replay; no draft changes mid-game.
  if (!room?.promptSeed || player.ageGroup === undefined) {
    const ids =
      room && promptPackForRoom(room) === "extra-silly"
        ? SILLY_PROMPTS
        : (PROMPT_SETS[player.ageGroup ?? "adult"] ?? PROMPT_SETS.adult);
    return ids.map((id) => PROMPTS.find((p) => p.id === id));
  }
  const history = new Map(
    normalisePromptHistory(player.promptHistory).map((id, index) => [
      id,
      index,
    ]),
  );
  const ranked = promptPoolForPlayer(player, room).map((prompt) => ({
    prompt,
    recent: history.get(prompt.id) ?? -1,
    rank: createHash("sha256")
      .update(`${room.promptSeed}:${player.id}:${prompt.id}`)
      .digest("hex"),
  }));
  // Unseen questions first, then least-recently seen. Seeded ordering is stable on reconnect.
  ranked.sort((a, b) => a.recent - b.recent || a.rank.localeCompare(b.rank));
  return ranked.slice(0, 3).map((row) => row.prompt);
}

PROMPTS.push(...EXTRA_PROMPTS);
export const ALL_PROMPTS = [...PROMPTS, ...CHRISTMAS_PROMPTS];
