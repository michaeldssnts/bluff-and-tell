// Authored answer banks: each row has four plausible options and four wildcards.
const family = [
  [
    "secret-talent",
    "What surprising talent do you actually have?",
    "Whistling|Drawing cartoons|Remembering birthdays|Balancing on one foot|Wiggling my ears|Doing an excellent robot dance|Making a spoon stick to my nose|Imitating a very offended duck",
  ],
  [
    "weird-snack",
    "What unusual snack combination do you genuinely like?",
    "Chips with chocolate|Cheese with jam|Popcorn with sweets|Toast with banana|Ice cream with chips|Pickles dipped in peanut butter|Cereal straight from a mug|A sandwich with crisps inside",
  ],
  [
    "pet-complaint",
    "What would a pet complain about most if it lived with you?",
    "Too many cuddles|Not enough snacks|My singing|Being woken up|My terrible impressions of it|My refusal to share the sofa equally|The lack of a personal butler|My embarrassing dance moves",
  ],
  [
    "useless-superpower",
    "Which completely useless superpower would you choose?",
    "Always finding a matching sock|Knowing when toast is ready|Never losing a pen|Remembering every joke|Making dramatic wind indoors|Understanding what pigeons gossip about|Turning broccoli into slightly smaller broccoli|Summoning exactly one teaspoon",
  ],
  [
    "personal-theme-song",
    "What kind of music should play whenever you enter a room?",
    "Pop music|Rock music|Jazz|Dance music|A dramatic villain theme|A tiny kazoo solo|Circus music with extra cymbals|A choir announcing that I have arrived",
  ],
  [
    "funny-collection",
    "What unusual thing would you happily collect?",
    "Stickers|Interesting stones|Keyrings|Postcards|Tiny hats for absolutely everything|Photographs of confused statues|Objects shaped like potatoes|Receipts from imaginary adventures",
  ],
  [
    "animal-self",
    "Which animal best matches your personality?",
    "A dog|A cat|A dolphin|An owl|A suspicious meerkat|A goose with strong opinions|A capybara on holiday|A raccoon with a clipboard",
  ],
  [
    "dream-invention",
    "What invention would make your day much better?",
    "A bag that packs itself|A self-cleaning room|A homework organiser|A snack dispenser|A robot that finds the TV remote|A pillow that politely cancels mornings|Socks that walk themselves to the wash|A personal applause button",
  ],
  [
    "silly-nickname",
    "Which ridiculous nickname would suit you best?",
    "The Professor|Speedy|The Captain|The Chef|Lord of the Lost Socks|Captain Snack Emergency|The Human Snooze Button|The Duke of Questionable Decisions",
  ],
  [
    "dramatic-reaction",
    "What harmless thing gets your most dramatic reaction?",
    "Losing a game|Cold food|A missing charger|An unexpected alarm|A biscuit breaking in my drink|A sock sliding into my shoe|A fly refusing to leave|Someone eating the last good crisp",
  ],
  [
    "tiny-victory",
    "What tiny achievement makes you feel like a champion?",
    "Finishing a puzzle|Catching something I dropped|Finding a lost item|Beating my own score|Stopping a timer on exactly zero|Peeling an orange in one piece|Getting a blanket perfectly straight|Opening a packet without spilling anything",
  ],
  [
    "talking-object",
    "Which object in your home would tell the funniest stories about you?",
    "My shoes|My phone|My bed|The fridge|The chair covered in clothes|The mirror that sees my dance practice|The snack cupboard|The remote I keep sitting on",
  ],
  [
    "laugh-trigger",
    "What almost always makes you laugh?",
    "Funny animal videos|A terrible pun|Someone laughing|A silly voice|A dog wearing tiny shoes|A very serious person saying a silly word|A pigeon walking like a manager|A dramatic sneeze at the wrong moment",
  ],
  [
    "food-mashup",
    "Which strange food would you honestly try?",
    "Chocolate-covered crisps|Sweetcorn ice cream|Pineapple pancakes|Cheese and apple toast|A pizza shaped like a sock|A burger served in a doughnut|Spaghetti in a waffle cone|A formal three-course breakfast cereal",
  ],
  [
    "silly-rule",
    "What harmless rule would you introduce for one day?",
    "Extra snack breaks|No early mornings|Everyone gets a nap|Games after lunch|All greetings must be sung|Every chair needs a silly name|Disagreements must be settled by a dance-off|Everyone must compliment a potato",
  ],
  [
    "mystery-skill",
    "Which skill do you think you could secretly be brilliant at?",
    "Baking|Acting|Painting|Playing drums|Competitive blanket folding|Making convincing dinosaur noises|Judging a biscuit contest|Giving motivational speeches to plants",
  ],
  [
    "mascot-choice",
    "Which mascot would you choose to represent you?",
    "A lion|A penguin|A fox|A panda|A mildly confused avocado|A goose in a waistcoat|A potato with excellent eyebrows|A hamster carrying a megaphone",
  ],
  [
    "ridiculous-hat",
    "Which silly hat would you actually wear to a party?",
    "A pirate hat|A cowboy hat|A glittery top hat|A paper crown|A tiny umbrella hat|A hat shaped like a roast chicken|A traffic cone with a ribbon|A miniature garden on my head",
  ],
  [
    "dance-name",
    "What would you call your signature dance move?",
    "The Shuffle|The Spin|The Side-Step|The Wiggle|The Panicked Penguin|The Lost Shopping Trolley|The Overcooked Noodle|The Confused Dishwasher",
  ],
  [
    "dream-trophy",
    "What silly achievement should you win a trophy for?",
    "Best snack finder|Best storyteller|Fastest puzzle solver|Best joke teller|Most dramatic sigh|Losing something already in my hand|Being comfortable in impossible positions|Opening the fridge with optimism",
  ],
  [
    "gadget-fail",
    "Which everyday gadget causes you the most trouble?",
    "The TV remote|Headphones|A printer|A phone charger|A toaster with trust issues|A talking device that ignores me|A game controller with one stubborn button|A lamp that only behaves for other people",
  ],
  [
    "boredom-project",
    "What would you most likely make on a very boring afternoon?",
    "A drawing|A snack|A playlist|A cardboard model|A luxury hotel for an insect|A tiny film starring a spoon|A map of the route to the fridge|A crown for the household vacuum cleaner",
  ],
  [
    "soundtrack-task",
    "Which everyday activity deserves dramatic background music?",
    "Getting out of bed|Packing a bag|Looking for keys|Doing the washing-up|Carrying too many snacks at once|Rescuing a biscuit from a drink|Opening a noisy packet quietly|Walking past a suspicious pigeon",
  ],
  [
    "talking-food",
    "Which food would have the funniest voice if it could talk?",
    "A banana|A carrot|A potato|A strawberry|A very posh baked bean|A cucumber with a villain laugh|A marshmallow that whispers secrets|A broccoli floret giving a weather report",
  ],
];
const youth = [
  [
    "costume-moment",
    "Which costume would you most enjoy wearing?",
    "A superhero|An astronaut|A pirate|A dinosaur|A detective investigating missing biscuits|A wizard whose spells only make toast|A traffic light on holiday|A giant pigeon demanding respect",
  ],
  [
    "playground-game",
    "Which game could you happily play for hours?",
    "Hide-and-seek|Football|Tag|A treasure hunt|Competitive pretending the floor is lava|An obstacle course for socks|A staring contest with a teddy bear|A championship of moving very slowly",
  ],
  [
    "invented-game",
    "What would be the main activity in a game you invented?",
    "Finding hidden clues|Building a city|Racing|Solving puzzles|Delivering pizzas to dragons|Rescuing lost sandwiches|Managing a school for confused ghosts|Training potatoes for the Olympics",
  ],
  [
    "cartoon-world",
    "What kind of cartoon world would you most like to visit?",
    "A superhero city|A magical forest|A space station|An underwater kingdom|A town run entirely by ducks|A bakery where the cakes talk back|A world where every door tells a joke|A castle with a suspiciously bossy hamster",
  ],
  [
    "backpack-find",
    "What is the strangest thing you might find at the bottom of your bag?",
    "An old snack|A missing pen|A forgotten note|A small toy|A collection of mysterious crumbs|A rock I decided was important|A sock with no clear explanation|A treasure map drawn on a tissue",
  ],
  [
    "funniest-word",
    "Which word sounds funniest to you?",
    "Wobble|Noodle|Gobble|Fluffy|Kerfuffle|Flibbertigibbet|Bumfuzzle|Snollygoster",
  ],
  [
    "pretend-business",
    "What sort of shop would you most like to run?",
    "A sweet shop|A game shop|A bookshop|A pet shop|A tiny-hat shop for very large dogs|A shop selling spare dragon wings|A lost-sock detective agency|A spa for extremely stressed teddy bears",
  ],
  [
    "magic-school-subject",
    "Which made-up subject should be taught at school?",
    "Video game design|Pet care|Cooking snacks|Magic tricks|Advanced dragon parking|Professional excuse detection|The history of suspicious sandwiches|How to negotiate with your alarm clock",
  ],
  [
    "desk-pet",
    "Which tiny creature would you choose as a classroom mascot?",
    "A hamster|A gecko|A fish|A stick insect|A snail with a timetable|A frog wearing reading glasses|A beetle who marks homework|A very strict imaginary dragon",
  ],
  [
    "homework-helper",
    "What would your ideal homework helper do first?",
    "Explain the question|Find my books|Organise my notes|Bring me a snack|Translate instructions into pirate language|Give my pencil a motivational speech|Distract my toy collection|Announce every correct answer with a trumpet",
  ],
  [
    "school-mascot",
    "What should be the mascot of a school named after you?",
    "An eagle|A tiger|A dolphin|A wolf|A sleepy waffle|A very confident potato|A raccoon holding an award|A dinosaur who forgot its homework",
  ],
  [
    "dream-club",
    "Which unusual club would you join?",
    "A film club|A robotics club|A baking club|A magic club|The Society of Extremely Silly Walks|Competitive Cloud Naming|The International Biscuit Investigation Squad|A club for inventing unnecessary clubs",
  ],
  [
    "funny-challenge",
    "Which silly challenge would you be best at?",
    "Balancing a book|Making funny faces|Building a card tower|Drawing with my eyes closed|Keeping a straight face while saying wobble|Walking like a royal penguin|Giving a weather report about my breakfast|Inventing names for imaginary cheeses",
  ],
  [
    "room-museum",
    "What would be the main attraction if your room became a museum?",
    "My books|My posters|My games|My drawings|The legendary chair of abandoned clothes|The ancient collection of missing pen lids|A mysterious object under the bed|The monument to unfinished projects",
  ],
  [
    "toy-adventure",
    "Where would your toys go on a secret adventure?",
    "The garden|The kitchen|The park|The beach|Inside the mysterious laundry mountain|A secret city behind the sofa|The headquarters of the missing socks|A moon made of breakfast cereal",
  ],
  [
    "bedtime-stall",
    "What would most tempt you to stay up a little longer?",
    "One more chapter|A good film|Another game|A conversation|An urgent meeting with the snack cupboard|A very important blanket investigation|A stuffed animal with breaking news|A sudden need to count every star",
  ],
  [
    "game-rule",
    "Which extra rule would you add to your favourite game?",
    "An extra life|A bonus round|Team swaps|More time|The winner must bow to a cushion|Everyone must announce their moves like a sports commentator|A banana becomes the referee|All arguments are judged by a teddy bear",
  ],
  [
    "first-robot",
    "What would you ask your own robot to do?",
    "Tidy my room|Find lost things|Make snacks|Help with projects|Interview the family furniture|Teach the goldfish some manners|Fold a fitted sheet without getting trapped|Cheer every time I put on my shoes",
  ],
  [
    "pocket-surprise",
    "What would you most like to find in a mystery pocket?",
    "A coin|A toy|A sweet|A secret note|A tiny certificate saying I am excellent|A treasure map to the biscuit tin|A very small crown|A polite apology from my missing sock",
  ],
  [
    "comic-villain",
    "What would your harmless comic-book villain do?",
    "Hide the remote|Steal snacks|Change alarm sounds|Move the cushions|Replace every spoon with a tiny fork|Make all shoes squeak dramatically|Give every pigeon a whistle|Make every password the word noodle",
  ],
  [
    "silly-dare",
    "Which harmless dare would you be most willing to try?",
    "Sing a song|Do an impression|Wear a funny hat|Invent a dance|Give a serious speech to a potato|Ask a cushion about its career plans|Walk like a penguin for a minute|Pretend the fridge is a famous celebrity",
  ],
  [
    "best-recess",
    "What would make a break feel like the best one ever?",
    "A great game|My favourite snack|Time with friends|A fun surprise|A parade of dogs in tiny jackets|A surprise trampoline meeting|An official invitation from the Biscuit King|A cloud shaped exactly like my face",
  ],
  [
    "invisible-day",
    "What harmless thing would you do if you were invisible for an hour?",
    "Explore a museum|Watch animals|Hide in a game|Leave surprise notes|Make a teddy bear appear to give a speech|Start a rumour that the sofa can float|Give a dramatic voice to a houseplant|Become a very polite imaginary ghost",
  ],
  [
    "grownup-catchphrase",
    "Which grown-up phrase would you most likely say?",
    "Where are my keys?|We are leaving in five minutes|Turn that light off|Have you packed your bag?|Who keeps putting spoons in here?|I am not arguing with a cushion|This meeting could have been a snack|I need a holiday from this holiday",
  ],
];
const adult = [
  [
    "kitchen-disaster",
    "What is your most believable kitchen disaster?",
    "Burning toast|Forgetting an ingredient|Overcooking pasta|Dropping dinner|Setting off the alarm with a single crouton|Creating soup that requires a fork|Baking something the dog refused|Accidentally inventing concrete pudding",
  ],
  [
    "wrong-place",
    "Where would you most likely turn up by mistake?",
    "The wrong shop|The wrong meeting room|The wrong street|The wrong restaurant|A serious meeting about ornamental cabbages|Someone else's surprise party|An audition for a very boring superhero|A conference for competitive soup tasters",
  ],
  [
    "lost-object",
    "What do you lose most often?",
    "My keys|My phone|My glasses|My charger|The thing I was holding a second ago|My confidence in the printer|The other sock before leaving the room|My train of thought halfway to the fridge",
  ],
  [
    "wrong-lyrics",
    "What do you do when you forget a song's lyrics?",
    "Hum|Sing more quietly|Make up words|Stop singing|Confidently sing a shopping list|Blame a fictional remix|Perform the instrumental with my face|Replace every word with an enthusiastic potato",
  ],
  [
    "childhood-belief",
    "Which strange idea could you have believed as a child?",
    "The moon followed the car|Adults knew everything|Seeds could grow in my stomach|TV characters lived inside the TV|The fridge light had its own tiny employee|Clouds were badly parked sheep|The washing machine ate socks deliberately|The satnav was a very small person",
  ],
  [
    "abandoned-hobby",
    "Which hobby are you most likely to start very enthusiastically?",
    "Painting|Gardening|Running|Playing guitar|Competitive bread appreciation|Building furniture for houseplants|Learning one impressive magic trick forever|Training for an imaginary cheese championship",
  ],
  [
    "household-debate",
    "What household debate could you argue about for far too long?",
    "Room temperature|What to watch|Where things belong|When to wash dishes|Whether the decorative cushion has a job|The correct emotional support mug|Whether the fridge needs a legal representative|The seniority of different tea towels",
  ],
  [
    "queue-thoughts",
    "What are you most likely to think about while standing in a queue?",
    "What to eat later|My shopping list|The weather|Whether I chose the slow queue|Which stranger would survive a duck invasion|Whether my basket looks suspicious|How to leave without losing my imaginary place|Why the person ahead needs eleven kinds of mustard",
  ],
  [
    "accidental-outfit",
    "What clothing mistake are you most likely to make?",
    "Mismatched socks|An inside-out shirt|The wrong shoes|Leaving a label on|Dressing exactly like the restaurant curtains|Arriving as the unofficial office magician|Looking like I am sponsored by laundry|Wearing the confidence of someone in the wrong decade",
  ],
  [
    "missed-trend",
    "Which trend would you be most likely to misunderstand?",
    "A new dance|A fashion trend|An online joke|A food trend|Thinking a slang word is a new kitchen appliance|Calling every gadget a small television|Joining a challenge that ended three years ago|Assuming a filter is something for a kettle",
  ],
  [
    "small-luxury",
    "Which tiny luxury makes you unreasonably happy?",
    "Fresh bedding|A quiet cup of tea|Good parking|A long shower|A biscuit that survives dunking|A cancellation that restores my whole evening|An empty laundry basket I can admire|The remote being exactly where I expected",
  ],
  [
    "travel-mishap",
    "Which travel mishap sounds most like you?",
    "Overpacking|Missing a turn|Forgetting a charger|Arriving too early|Packing snacks as if crossing a continent|Following the satnav into a philosophical crisis|Giving my suitcase a motivational speech|Waving at someone who was greeting a person behind me",
  ],
  [
    "mistaken-identity",
    "What would a stranger most likely mistake you for?",
    "A teacher|A tour guide|A shop assistant|An event organiser|The world's least convincing undercover detective|An expert in decorative vegetables|The person responsible for the suspicious buffet|A retired champion of competitive napping",
  ],
  [
    "unread-instructions",
    "What do you usually do before reading the instructions?",
    "Try every button|Ask someone|Watch a video|Guess|Declare the instructions emotionally unavailable|Negotiate with the flat-pack furniture|Blame a screw that looks smug|Invent an entirely new purpose for the object",
  ],
  [
    "fridge-secret",
    "What would your fridge reveal about you?",
    "I like leftovers|I buy too many sauces|I forget vegetables|I keep good snacks|I believe one lemon can fix my life|I am emotionally attached to a mystery jar|I repeatedly check for food that has not appeared|I treat expiry dates like a puzzle tournament",
  ],
  [
    "adult-surprise",
    "What ordinary adult task surprised you most?",
    "Meal planning|Booking appointments|Buying cleaning products|Remembering bin day|Learning how many kinds of light bulb exist|Realising cushions need almost constant management|Having a favourite parking spot|Developing strong opinions about a sponge",
  ],
  [
    "appliance-fear",
    "Which household appliance would win an argument against you?",
    "The printer|The washing machine|The microwave|The dishwasher|A kettle with a superior attitude|The vacuum that knows all my secrets|A fridge that has seen my midnight decisions|A toaster with a law degree",
  ],
  [
    "phone-autocorrect",
    "What would be the worst harmless autocorrect mistake for you?",
    "Getting a name wrong|Sending a nonsense word|Changing the meeting time|Adding an accidental emoji|Calling my manager a majestic turnip|Signing off as Supreme Biscuit Commander|Inviting everyone to my imaginary llama rehearsal|Promising to bring eleven emotional-support cabbages",
  ],
  [
    "car-singing",
    "What kind of performer are you when nobody can hear you?",
    "A pop star|A rock singer|A musical theatre lead|A backing vocalist|A dramatic opera goose|A one-person wedding band|A stadium announcer for my own commute|A surprisingly emotional kazoo soloist",
  ],
  [
    "shopping-detour",
    "What do you most often buy when you only went in for one thing?",
    "Snacks|Something on special|A drink|A household item|A plant that apparently needed rescuing|A gadget promising a completely new personality|Enough biscuits for a small emergency government|A very convincing object with no clear purpose",
  ],
];
const silly = [
  [
    "chore-olympics",
    "Which household task do you secretly think deserves an Olympic medal?",
    "Folding laundry|Packing the dishwasher|Changing bedding|Taking out the bins|Wrestling a fitted sheet into submission|Finding the end of sticky tape|Carrying every shopping bag in one trip|Removing a duvet cover without entering another dimension",
  ],
  [
    "tiny-inconvenience",
    "What tiny inconvenience makes you behave like a dramatic movie villain?",
    "Slow Wi-Fi|A cold cup of tea|A missing charger|A squeaky door|A sock seam with a personal grudge|A spoon sliding into my soup|A website asking whether I am still there|A cupboard refusing to hold one more plastic tub",
  ],
  [
    "inanimate-grudge",
    "Which object could you hold a completely unreasonable grudge against?",
    "A printer|A door handle|A chair|A shopping trolley|The sock that vanished during a crisis|A fitted sheet with political ambitions|The tiny screw left after assembly|A cereal packet that opens from the wrong end",
  ],
  [
    "imaginary-complaint",
    "What ridiculous complaint would you send to the universe?",
    "Mornings are too early|Weekends are too short|Queues are too slow|Weather is badly timed|My houseplants refuse to contribute to rent|Gravity keeps getting involved in my snacks|The moon has never acknowledged my support|I did not authorise my knees to make that noise",
  ],
  [
    "dramatic-review",
    "What everyday thing could you write a dramatic one-star review about?",
    "My alarm clock|The weather|Traffic|A stubborn app|Monday's complete lack of customer service|The emotional instability of an avocado|A biscuit's poor structural integrity|The sofa's aggressive commitment to napping",
  ],
  [
    "useless-expertise",
    "What completely unnecessary topic could you give a confident talk about?",
    "Snack rankings|TV theme songs|Mug sizes|Parking etiquette|The hidden hierarchy of household spoons|Why one cushion is clearly in charge|The emotional journey of a forgotten potato|How to look busy while waiting for the kettle",
  ],
  [
    "secret-routine",
    "What tiny ritual do you take surprisingly seriously?",
    "Making tea|Choosing music|Arranging pillows|Checking the weather|Inspecting every biscuit before selection|Negotiating with the snooze button|Giving the car a compliment before a long journey|Opening the fridge like it might contain breaking news",
  ],
  [
    "ridiculous-argument",
    "Which silly argument could you defend with far too much confidence?",
    "The best biscuit|The correct sandwich cut|The ideal bedtime|The best TV snack|Whether a hot dog needs a passport|Whether ducks know they are waterproof|Which household appliance would be the worst flatmate|Whether soup counts as a very wet salad",
  ],
  [
    "emergency-snack",
    "What snack would you protect in a completely imaginary emergency?",
    "Chocolate|Crisps|Biscuits|Cheese|The emergency emergency biscuits|A single ceremonial potato|A family-size packet labelled entirely mine|The snack I hid from my future self",
  ],
  [
    "fake-job-title",
    "Which fake job title best describes your role at home?",
    "Head Chef|Chief Organiser|Technical Support|Activities Coordinator|Director of Unnecessary Worry|Senior Executive of Looking for Things|Minister for Biscuit Affairs|Chief Duvet Negotiator",
  ],
  [
    "home-tour",
    "What would be the funniest stop on a guided tour of your home?",
    "The kitchen|My desk|The garage|The spare room|The official chair of things I will wear again|The drawer of cables with mysterious careers|The cupboard containing seventeen identical containers|The sacred shelf of abandoned hobbies",
  ],
  [
    "victory-speech",
    "What small achievement would make you give an unnecessary victory speech?",
    "Finishing the washing|Fixing a device|Getting a refund|Cooking a good meal|Pairing every sock on the first attempt|Opening a jar everyone else had declared impossible|Getting the USB plug in the right way first time|Guessing exactly how much pasta to cook",
  ],
  [
    "warning-label",
    "What warning label should come attached to you?",
    "Needs regular snacks|Slow to wake up|Easily distracted|May burst into song|Do not operate before the second cup of tea|Will defend a terrible pun in court|Contains strong opinions about insignificant things|May adopt a houseplant during any outing",
  ],
  [
    "remote-control-power",
    "Which extra button would you add to your life's remote control?",
    "Pause|Mute|Skip traffic|Find lost things|Make this meeting a sandwich|Undo that awkward wave|Summon a supportive dog|Explain why I entered this room",
  ],
  [
    "secret-fanclub",
    "What ordinary thing could you start an embarrassingly enthusiastic fan club for?",
    "Fresh bread|A favourite mug|A good blanket|Comfortable shoes|The corner piece of a tray bake|The plastic tub with the matching lid|A trolley with all four wheels cooperating|The unexpected cancellation of a plan",
  ],
  [
    "delegation-bot",
    "What oddly specific task would you give a personal assistant robot?",
    "Find my keys|Water the plants|Pack lunch|Sort the washing|Politely argue with the printer on my behalf|Tell the laundry chair its services are no longer needed|Taste-test the first biscuit for quality control|Stand in the kitchen remembering what I came for",
  ],
  [
    "neighbour-mystery",
    "What harmless mystery could your neighbours investigate about you?",
    "My delivery schedule|My odd singing|My early alarm|My collection of mugs|Why I gave a plant a motivational speech|Why I appeared to salute the recycling bin|Why I carried one potato like a royal baby|Why I was arguing with a fitted sheet at noon",
  ],
  [
    "committee-topic",
    "What minor issue would you call an extremely serious household meeting about?",
    "The shopping list|What to watch|The thermostat|Washing-up duty|The missing teaspoon investigation|The emotional wellbeing of the decorative cushions|The snack cupboard's suspicious accounting|Whether the vacuum cleaner needs a performance review",
  ],
  [
    "snack-heist",
    "What would be your role in a very low-stakes biscuit heist?",
    "The planner|The lookout|The distraction|The getaway driver|The person who eats the evidence too early|The dramatic narrator nobody requested|The specialist in noisy packaging|The person who asks whether this meeting has snacks",
  ],
  [
    "unhelpful-app",
    "What completely unnecessary app would you probably download?",
    "A plant identifier|A countdown app|A shopping organiser|A sound-effects app|A translator for dramatic sighs|A satnav for finding the sofa|A daily horoscope for my toaster|A performance dashboard for my naps",
  ],
  [
    "personal-documentary",
    "What would a documentary about your ordinary day be called?",
    "The Daily Routine|One More Cup|Against the Clock|A Work in Progress|The Biscuit Was Here a Minute Ago|In Search of the Other Sock|A Series of Mild Inconveniences|Why Is There a Spoon in My Pocket?",
  ],
];
function expand(rows, audiences, category, extra = {}) {
  return rows.map(([id, title, bank]) => {
    const options = bank.split("|");
    if (options.length !== 8) throw new Error(`Invalid answer bank: ${id}`);
    return {
      id,
      title,
      hint: "Your honest answer. A short phrase is perfect.",
      category,
      audiences,
      ...extra,
      decoys: options.slice(0, 4),
      wildcards: options.slice(4),
    };
  });
}
export const EXTRA_PROMPTS = [
  ...expand(family, ["child", "teen", "adult", "adult26"], "Little quirks", {
    family: true,
  }),
  ...expand(youth, ["child", "teen"], "Big imaginations"),
  ...expand(adult, ["adult", "adult26"], "Everyday plot twists"),
  ...expand(silly, ["adult26"], "Gloriously ridiculous", { silly: true }),
];
