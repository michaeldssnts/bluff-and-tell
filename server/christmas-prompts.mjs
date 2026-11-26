// Original, family-friendly preference questions. Keep row order stable: IDs are saved in question history.
const rows = [
  [
    "What would you bribe Santa with?",
    "Cookies|A cup of tea|Chocolate|A handmade card",
    "A singing potato|A reindeer spa voucher|A glitter-powered lawnmower|A lifetime supply of imaginary biscuits",
  ],
  [
    "What would be your first rule as head elf?",
    "More snack breaks|No early mornings|Music all day|Finish on time",
    "Every meeting must be sung|Mandatory penguin slippers|All emails delivered by goose|The stapler gets its own office",
  ],
  [
    "What would you name your pet reindeer?",
    "Biscuit|Coco|Pickles|Noodles",
    "Sir Antlers McWobble|Chairman of the Sleigh|Captain Snack Tax|The Flying Garden Fork",
  ],
  [
    "Which Christmas decoration would you secretly ban?",
    "Tinsel|Flashing lights|Glitter|Singing ornaments",
    "A tree that rates my outfit|Tap-dancing baubles|A six-metre inflatable sprout|A judgmental gingerbread statue",
  ],
  [
    "What would your Christmas superpower be?",
    "Perfect gift picking|Instant gift wrapping|Never burning dinner|Untangling lights instantly",
    "Talking to offended baubles|Turning sprouts into disco balls|Summoning emergency gravy clouds|Teleporting directly into a pudding",
  ],
  [
    "What would you put at the top of your Christmas tree?",
    "A star|An angel|A big ribbon|A family photo",
    "A potato in a tiny crown|A confused rubber duck|A framed electricity bill|A squirrel with a microphone",
  ],
  [
    "Which Christmas job would you be hilariously bad at?",
    "Wrapping gifts|Singing carols|Hanging lights|Baking biscuits",
    "Reindeer flight instructor|Chief bauble whisperer|Santa's beard untangler|Emergency snowflake accountant",
  ],
  [
    "What would your elf name be?",
    "Jingle|Pepper|Cookie|Twinkle",
    "Tinsel McTroublemaker|Professor Biscuit Knees|Glitter Goblin the Third|Deputy Minister of Snacks",
  ],
  [
    "What would you demand in Santa's workshop break room?",
    "A comfy sofa|Free snacks|A coffee machine|A nap corner",
    "A gravy fountain|A karaoke throne|An emotional-support snowman|A slide into a giant mince pie",
  ],
  [
    "What would your Christmas warning label say?",
    "Do not wake before breakfast|Keep away from wrapping paper|May sing without warning|Needs frequent snacks",
    "May turn into a festive goose|Contains unstable amounts of tinsel|Do not feed after the third carol|Reindeer parking hazard",
  ],
  [
    "Which Christmas food would you defend in an argument?",
    "Roast potatoes|Mince pies|Fruit cake|Brussels sprouts",
    "Festive spaghetti in a stocking|Glitter-free gravy ice cream|A bauble-shaped baked bean|The emergency Christmas banana",
  ],
  [
    "What would you sneak off the Christmas dinner table first?",
    "A roast potato|A piece of chocolate|A slice of ham|A bread roll",
    "The gravy boat and its captain|A sprout wearing sunglasses|The turkey's tiny crown|A biscuit disguised as a napkin",
  ],
  [
    "What Christmas dinner disaster would you probably cause?",
    "Burning the potatoes|Forgetting the pudding|Dropping a plate|Making far too much food",
    "Teaching the turkey to tap-dance|Launching sprouts into orbit|Filling the gravy boat with jelly|Accidentally feeding dinner to a snowman",
  ],
  [
    "What would your dream Christmas dessert be?",
    "Chocolate cake|Ice cream|Trifle|Malva pudding",
    "A gingerbread hot tub|A chocolate fountain with a lifeguard|A pudding bigger than the sofa|A mince pie that applauds me",
  ],
  [
    "Which Christmas leftover would you happily eat for breakfast?",
    "Roast potatoes|Cold pudding|Leftover meat|Christmas biscuits",
    "A gravy milkshake|A tinsel-free trifle sandwich|A roast potato in a cereal bowl|A gingerbread remote control",
  ],
  [
    "What would you bring to a Christmas braai?",
    "Garlic bread|Salad|Boerewors|Something sweet",
    "An elf-sized swimming pool|A self-turning sausage|A fan just for the potato salad|A reindeer in an apron",
  ],
  [
    "What would you hide from the Christmas snack thieves?",
    "The good chocolate|The last biscuit|The chips|The fancy cheese",
    "An edible Christmas tree|My emergency gravy flask|A gingerbread bodyguard|A secret stash of festive peas",
  ],
  [
    "What would you rename Brussels sprouts to make them sound exciting?",
    "Mini cabbages|Green gems|Roast bites|Crunchy greens",
    "Elf power pellets|Baby Christmas planets|Tiny balls of betrayal|Reindeer turbo fuel",
  ],
  [
    "What would be your Christmas dinner mascot?",
    "A roast potato|A gingerbread person|A candy cane|A Christmas pudding",
    "A sausage in a Santa hat|A motivational gravy jug|A sprout with a six-pack|A turkey-shaped disco ball",
  ],
  [
    "What would you make for Santa if the cupboards were nearly empty?",
    "Toast|A cheese sandwich|Porridge|A cup of tea",
    "A dramatic drawing of a biscuit|Air pudding with imaginary custard|One celebrity baked bean|A snowflake tasting menu",
  ],
  [
    "Which Christmas gift would make you do a terrible fake smile?",
    "Socks|A scented candle|A plain mug|A calendar",
    "A framed photo of someone else's elbow|A self-help book for baubles|One left reindeer slipper|An alarm clock that shouts sprouts",
  ],
  [
    "What would you ask Santa for if money were no object?",
    "A dream holiday|A new home|A games room|A swimming pool",
    "A personal cloud shaped like me|A castle made of roast potatoes|A private reindeer taxi|A dragon that wraps presents",
  ],
  [
    "What would your signature gift-wrapping style be?",
    "Neat and simple|Too much tape|A gift bag|Lots of ribbons",
    "Wrapped like a suspicious burrito|Six boxes and a treasure map|Disguised as a sleeping goose|A festive blanket held on with hope",
  ],
  [
    "Where would you hide a Christmas present?",
    "At the back of a cupboard|Under the bed|In a suitcase|At a friend's house",
    "Inside a decoy Christmas pudding|In the reindeer's glove compartment|Behind the official snack inspector|On the ceiling with a polite note",
  ],
  [
    "What would you put in a Christmas cracker?",
    "A silly joke|A paper crown|A tiny toy|A chocolate coin",
    "A miniature motivational speaker|A goose-sized parking ticket|A certificate in advanced snacking|A polite but furious potato",
  ],
  [
    "What would be your worst Secret Santa gift idea?",
    "An empty notebook|A boring keyring|A plain tea towel|A tiny candle",
    "A snowman's used bathwater|A subscription to daily sprout facts|A bag of pre-loved glitter|A portrait of the office stapler",
  ],
  [
    "What would you do with a Christmas gift you secretly disliked?",
    "Keep it anyway|Give it to someone else|Swap it|Put it in a cupboard",
    "Build a tiny museum around it|Appoint it head of security|Blame a visiting elf|Enter it in a talent show",
  ],
  [
    "What would you write on a very honest Christmas gift tag?",
    "I hope you like it|I kept the receipt|This made me think of you|I ran out of wrapping paper",
    "The elves refused responsibility|Inspected by one suspicious pigeon|May contain my last brain cell|Wrapped under festive supervision",
  ],
  [
    "What Christmas present would you most want to unwrap right now?",
    "A new game|A good book|Some headphones|A holiday voucher",
    "A trained snack-fetching dragon|A lifetime pass to the pudding buffet|A portable nap dimension|A butler made of gingerbread",
  ],
  [
    "What would you use if you ran out of Christmas wrapping paper?",
    "Newspaper|A reusable bag|A tea towel|An old box",
    "A very dramatic lettuce leaf|A snowman's spare scarf|A map of the North Pole plumbing|A giant elf-sized sock",
  ],
  [
    "What would your Christmas morning entrance look like?",
    "Still in pyjamas|Already dressed|Carrying breakfast|Half asleep",
    "Sliding in on a gravy tray|Arriving with my own elf choir|Emerging from a giant cracker|Parachuting down with a mince pie",
  ],
  [
    "What would tempt you out of bed early on Christmas morning?",
    "Presents|Breakfast|Family arriving|The smell of coffee",
    "Santa offering driving lessons|A reindeer doing the washing up|A talking pudding calling my name|A snowman announcing free Wi-Fi",
  ],
  [
    "What would your ideal Christmas Day dress code be?",
    "Pyjamas|Something colourful|Shorts and a T-shirt|A silly Christmas jumper",
    "Formal antlers and slippers|A roast potato ball gown|A full-body gift bow|Business casual gingerbread armour",
  ],
  [
    "Where would you take a secret Christmas nap?",
    "On the sofa|In a quiet bedroom|In a garden chair|In a hammock",
    "Inside the decorative sleigh|Under a mountain of wrapping paper|In Santa's beard storage cupboard|Behind a decoy choir of cushions",
  ],
  [
    "What would you most likely forget on Christmas Day?",
    "Where I put a present|To take a group photo|Something in the oven|To charge my phone",
    "Which reindeer borrowed my shoes|The password to the gravy vault|My appointment with the tinsel inspector|The snowman's emergency contact",
  ],
  [
    "What would be your Christmas Day catchphrase?",
    "Is there more dessert?|Who wants a game?|Where's the tape?|Just one more photo",
    "Release the emergency mince pies|I am the final roast potato|Somebody reboot the reindeer|The tinsel has chosen me",
  ],
  [
    "What would you do first if Christmas Day had an extra hour?",
    "Have a nap|Play another game|Eat more dessert|Go for a walk",
    "Interview the Christmas tree|Teach the gravy boat to swim|Give every bauble a performance review|Start a support group for lonely crackers",
  ],
  [
    "What Christmas activity would you happily skip?",
    "Washing up|Shopping|Wrapping presents|Tidying afterwards",
    "The annual sprout staring contest|Competitive reindeer ironing|The ceremonial gravy inspection|The midnight tinsel audit",
  ],
  [
    "What would you be in charge of at a Christmas party?",
    "The music|The snacks|The games|Taking photos",
    "Emergency elf complaints|The official pudding countdown|Reindeer valet parking|Keeping the baubles emotionally stable",
  ],
  [
    "What would you pack for Christmas at the beach?",
    "Sunscreen|A picnic|A beach umbrella|A football",
    "Waterproof wrapping paper pyjamas|A surfboard for Santa|An inflatable roast turkey|A tiny cooler just for the elves",
  ],
  [
    "Which Christmas decoration would best describe your personality?",
    "A bright star|A colourful bauble|A string of lights|A big ribbon",
    "A slightly confused inflatable reindeer|A disco sprout|A tree topper with stage fright|A snow globe full of unpaid chores",
  ],
  [
    "What would your Christmas tree complain about?",
    "Too many decorations|Being put up late|The cat|Being stuck in a corner",
    "The baubles keep gossiping|The star has a massive ego|The tinsel won't stop beatboxing|The presents are paying no rent",
  ],
  [
    "What colour would you make Christmas if red and green were banned?",
    "Purple and gold|Blue and silver|Pink and white|Orange and yellow",
    "Roast potato beige|Suspicious gravy brown|Reindeer disco rainbow|Glow-in-the-dark sprout",
  ],
  [
    "What would you name a talking Christmas bauble?",
    "Bob|Twinkle|Sparkle|Dot",
    "Lord Wobblebottom|Professor Hang-in-There|The Minister of Shiny Objects|Sir Rolls Under the Sofa",
  ],
  [
    "What would be your Christmas lights personality?",
    "Warm and cosy|Bright and colourful|Neat and simple|Flashing everywhere",
    "Visible from three neighbouring planets|Synchronised with my chewing|Only lights up for compliments|Powered entirely by festive gossip",
  ],
  [
    "What would you do if your Christmas tree started dancing?",
    "Join in|Film it|Call everyone over|Stand back and watch",
    "Demand a tree-off|Offer it a talent contract|Ask whether the baubles agreed|Charge it for dance lessons",
  ],
  [
    "Which room would you decorate first for Christmas?",
    "The living room|The kitchen|My bedroom|The front entrance",
    "The secret pudding bunker|The reindeer staff toilet|My cupboard of questionable decisions|The elf complaints department",
  ],
  [
    "What would be your most ridiculous Christmas decoration idea?",
    "A giant bow|Lights on every window|A huge wreath|A tree in every room",
    "A life-size statue of me as a sprout|A tap-dancing gravy fountain|An inflatable Santa doing yoga|A chandelier made of festive sausages",
  ],
  [
    "What would you put inside your personal Christmas snow globe?",
    "My family|My favourite place|My pet|A little Christmas tree",
    "Me arguing with a gingerbread mayor|An elf stuck in a tiny traffic jam|A snowman having a barbecue|A reindeer doing my homework",
  ],
  [
    "What would you do with a lifetime supply of Christmas tinsel?",
    "Decorate every room|Share it with friends|Make crafts|Donate most of it",
    "Start a very shiny country|Knit a jumper for the moon|Open a reindeer hair salon|Camouflage myself at every Christmas party",
  ],
  [
    "Which Christmas song would get you singing the loudest?",
    "Jingle Bells|Silent Night|We Wish You a Merry Christmas|Deck the Halls",
    "O Little Town of Roast Potatoes|The Twelve Days of Missing Socks|Away in a Gravy Boat|Hark the Hungry Relatives Sing",
  ],
  [
    "What would your Christmas carol stage name be?",
    "DJ Jingle|The Festive Voice|Captain Christmas|The Merry Singer",
    "MC Mince Pie Panic|DJ Gravy Boat|The Artist Formerly Known as Sprout|Lil Tinsel Thunder",
  ],
  [
    "What would be your signature Christmas dance move?",
    "A little shoulder shuffle|The running man|A dramatic spin|Clapping out of time",
    "The panicked gift wrapper|The gravy boat wobble|The reindeer reverse park|The sprout escaping the plate",
  ],
  [
    "What would you use as a microphone for Christmas karaoke?",
    "A wooden spoon|A hairbrush|A remote control|A rolled-up magazine",
    "A professionally trained carrot|The royal gravy ladle|A candy cane with stage fright|An elf-sized traffic cone",
  ],
  [
    "What would your Christmas talent show act be?",
    "Singing|Dancing|Telling jokes|Doing impressions",
    "Juggling imaginary mince pies|Translating reindeer gossip|Competitive bauble balancing|Whistling through a gingerbread house",
  ],
  [
    "What would make you laugh during a serious Christmas photo?",
    "Someone pulling a face|A terrible joke|A pet getting in the way|Someone sneezing",
    "Santa moonwalking past the window|A sprout demanding its own photo|An elf directing us through a megaphone|The tree quietly photobombing us",
  ],
  [
    "What would be the title of your Christmas film?",
    "The Missing Present|One Very Long Christmas|Home for the Holidays|The Last Mince Pie",
    "Santa Stole My Parking Spot|Revenge of the Disco Sprout|My Uncle Is a Gingerbread Biscuit|The Gravy Boat Has Landed",
  ],
  [
    "What Christmas film role would suit you best?",
    "The organised one|The forgetful relative|The cheerful neighbour|The snack thief",
    "The emotionally complicated bauble|Santa's unpaid stunt double|The villainous roast potato|The reindeer with a secret podcast",
  ],
  [
    "What would you call your Christmas band?",
    "The Jingle Crew|The Merry Makers|The Snowflakes|The Festive Four",
    "Gravy and the Questionable Decisions|The Roasting Potatoes|Sleigh My Name|The Antler Management Department",
  ],
  [
    "What Christmas sound would you make your doorbell play?",
    "Sleigh bells|A short carol|A cheerful greeting|A gentle chime",
    "A reindeer saying wrong house|A dramatic potato solo|An elf announcing snack inspection|Santa coughing out a kazoo",
  ],
  [
    "What would your excuse be for eating Santa's biscuits?",
    "I thought they were spare|I was checking they were fresh|I forgot who they were for|I only meant to have one",
    "The biscuit ordered me to|I was protecting Santa from crumbs|A reindeer dared me|It was a North Pole quality audit",
  ],
  [
    "What would you do if you were caught shaking a Christmas present?",
    "Put it down quickly|Pretend to tidy|Admit I was curious|Laugh and confess",
    "Claim it was doing the shaking|Ask the box for legal advice|Blame a tiny earthquake|Declare myself chief rattle inspector",
  ],
  [
    "What would you blame on a visiting Christmas elf?",
    "Missing chocolates|A messy kitchen|A badly wrapped present|The TV remote going missing",
    "My sudden talent for interpretive gravy dance|A sofa full of candy canes|The tree's suspicious new moustache|A Christmas pudding in the shoe cupboard",
  ],
  [
    "What Christmas problem would you make much more dramatic than necessary?",
    "Running out of tape|A broken ornament|A missing ingredient|Tangled lights",
    "A bauble refusing to sparkle|An elf with a one-star attitude|Santa using the wrong chimney lane|A mince pie filing a formal complaint",
  ],
  [
    "What would be your excuse for a badly wrapped Christmas present?",
    "I ran out of time|The paper was too small|The tape would not stick|It was an awkward shape",
    "Wrapped during a reindeer turbulence incident|The paper and I had creative differences|An elf sneezed halfway through|It is a limited-edition festive potato",
  ],
  [
    "What would you do if the Christmas dinner gravy disappeared?",
    "Make some more|Use another sauce|Ask everyone where it went|Eat without it",
    "Call the gravy detective|Interrogate the mashed potatoes|Declare a festive state of emergency|Put the sprouts under surveillance",
  ],
  [
    "What would be your Christmas shopping downfall?",
    "Buying snacks for myself|Leaving it too late|Forgetting the list|Buying too many gifts",
    "Following a suspicious elf into a hat shop|Adopting every decorative reindeer|Buying insurance for the baubles|Ordering a life-size gingerbread garage",
  ],
  [
    "What would you do if your paper Christmas crown kept falling off?",
    "Fix it with tape|Wear it sideways|Take it off|Get another one",
    "Hire a crown assistant|Blame my royal aura|Demand a smaller kingdom|Challenge gravity to a festive duel",
  ],
  [
    "What would your Christmas dinner victory speech be about?",
    "Finishing all the cooking|Making the best dessert|Keeping everyone happy|Finally sitting down",
    "Defeating the last roast potato|Surviving the sprout uprising|Restoring peace to the gravy boat|Being crowned sofa monarch",
  ],
  [
    "What would you most likely lose among the Christmas wrapping paper?",
    "The scissors|A small present|My phone|A gift tag",
    "An entire elf marching band|My official snack licence|A reindeer driving certificate|A tiny and furious gingerbread landlord",
  ],
  [
    "What would you do if you accidentally gave someone their own gift back?",
    "Admit it|Laugh about it|Offer to swap it|Promise a replacement",
    "Call it a festive reunion|Explain that it missed them|Blame a reindeer delivery loop|Say the gift chose its own adventure",
  ],
  [
    "Where would you take Santa on his day off?",
    "The beach|A quiet café|A picnic|A theme park",
    "A beard-only trampoline park|A workshop complaints escape room|A roast potato wellness retreat|A penguin disco with valet sleigh parking",
  ],
  [
    "What vehicle would you choose if Santa's sleigh broke down?",
    "A van|A bicycle|A train|A helicopter",
    "A rocket-powered shopping trolley|A giant flying roast potato|A goose with excellent references|A gravy boat with racing stripes",
  ],
  [
    "What would you teach Santa to do?",
    "Use a smartphone|Dance|Take better selfies|Play a new game",
    "Reverse park a reindeer|Speak fluent bauble|Breakdance without beard injuries|Bake a biscuit that gives compliments",
  ],
  [
    "What would you ask a reindeer if it could talk?",
    "Do you like flying?|What is your favourite snack?|Who is the fastest?|Do you get tired?",
    "Who handles your air traffic antlers?|Do the elves pay for parking?|Is Santa a back-seat sleigh driver?|Why is there glitter in my sandwich?",
  ],
  [
    "What would be your North Pole holiday souvenir?",
    "A handmade ornament|A scarf|A photo with Santa|A little wooden toy",
    "An elf-sized parking fine|A jar of premium reindeer opinions|A snowflake with a birth certificate|A personally offended candy cane",
  ],
  [
    "What would you order at an elf café?",
    "Hot chocolate|Tea and cake|A cheese toastie|A fruit smoothie",
    "A double-shot tinsel latte|A deconstructed mince pie emergency|A snowman-approved iced soup|A gravy cappuccino with antler art",
  ],
  [
    "What would you name Santa's holiday group chat?",
    "Christmas Crew|The Festive Family|Present Planning|The Merry Bunch",
    "Sleigh What Now|Antlers and Other Problems|The Last Biscuit Investigation|Please Stop Replying Ho Ho Ho",
  ],
  [
    "What would you put on a reindeer's Christmas wish list?",
    "More carrots|A warm blanket|A comfortable harness|A day off",
    "Antler-mounted Wi-Fi|A personal cloud garage|An elf-free snack drawer|A flying licence for the dog",
  ],
  [
    "What would your first announcement as Santa be?",
    "Everyone gets a gift|More time off for the elves|An extra biscuit break|We are leaving early",
    "The sleigh now accepts potato payments|All chimneys need a snack hatch|Reindeer may work from home|Ho ho ho is now a legally protected sneeze",
  ],
  [
    "What would you install in Santa's sleigh?",
    "A better seat|A snack box|A music system|A navigation screen",
    "A gravy-powered turbo button|A beard defroster with mood lighting|A trampoline emergency exit|A machine that turns complaints into biscuits",
  ],
  [
    "Which Christmas object would you bring to life for a day?",
    "A gingerbread person|A toy train|A snowman|An ornament",
    "A gravy boat with sea legs|A dramatic paper crown|A mince pie with legal training|A stocking that does motivational speeches",
  ],
  [
    "What would you build your dream gingerbread house around?",
    "A huge kitchen|A games room|A garden|A cosy bedroom",
    "A moat of custard|A biscuit helipad|A chocolate garage for a tiny dragon|A panic room for the jelly babies",
  ],
  [
    "What would a Christmas version of you be made of?",
    "Chocolate|Gingerbread|Candy canes|Marshmallows",
    "Roast potatoes and mild panic|Tinsel and questionable timing|Gravy held together by confidence|A thousand tiny paper crowns",
  ],
  [
    "What would you keep in an emergency Christmas kit?",
    "Sticky tape|Spare batteries|Chocolate|A phone charger",
    "A pocket-sized replacement Santa|An inflatable gravy boat|Emergency antler stabilisers|A spare personality for family photos",
  ],
  [
    "What would your Christmas party animal be?",
    "A penguin|A reindeer|A dog|A polar bear",
    "A goose in festive formalwear|A disco-dancing garden snail|A roast potato with rhythm|A hamster operating a tiny sleigh",
  ],
  [
    "What would you name a competitive Christmas game?",
    "Gift Grab|Festive Challenge|Christmas Charades|The Big Christmas Quiz",
    "Extreme Sprout Avoidance|Competitive Gravy Whispering|The Annual Bauble Beef|Sleigh Parking Championship",
  ],
  [
    "What would you put in a Christmas time capsule?",
    "A family photo|A Christmas card|A favourite recipe|A small decoration",
    "The last surviving roast potato|An elf's resignation letter|A recording of the pudding arguing|My official licence to jingle",
  ],
  [
    "What would your dream Christmas hideout have?",
    "A comfy chair|Lots of snacks|A good view|A pile of books",
    "A no-carols force field|A secret biscuit tunnel|A reindeer-powered hammock|A gravy moat with a drawbridge",
  ],
  [
    "What would you rename Christmas dinner?",
    "The Big Feast|Family Food Day|The Long Lunch|The Christmas Spread",
    "The Annual Potato Summit|Operation Unbutton the Trousers|The Gravy Games|The International Sprout Negotiations",
  ],
  [
    "What would your personal Christmas flag have on it?",
    "A star|A Christmas tree|A snowflake|A wrapped gift",
    "A roast potato holding a tiny flag|A reindeer in a dressing gown|A glorious spoon of gravy|A mince pie riding a goose",
  ],
  [
    "Which Christmas tradition would you happily invent?",
    "A family game tournament|A beach picnic|A handmade gift swap|A silly hat contest",
    "Annual roast potato knighthoods|A formal apology to the sprouts|The ceremonial washing of Santa's slippers|A family reindeer driving test",
  ],
  [
    "What would your festive family award be for?",
    "Best wrapping|Best dessert|Best outfit|Funniest joke",
    "Most dramatic reaction to socks|Outstanding service to the gravy boat|Fastest disappearance at washing-up time|Lifetime achievement in festive nibbling",
  ],
  [
    "What would you write in a very honest Christmas card?",
    "Let's see each other more|Thank you for this year|I hope you get a proper rest|I am glad you are in my life",
    "You are my favourite festive liability|May your gravy never judge you|I tolerate your carol choices with love|You are the sprout I would actually choose",
  ],
  [
    "What would your Christmas pet's job be?",
    "Gift inspector|Snack guard|Photo assistant|Wrapping supervisor",
    "Chief ribbon demolition officer|Director of suspicious bauble activity|Reindeer customs inspector|Official sofa crumb accountant",
  ],
  [
    "What would you do with one spare Christmas wish?",
    "Give it to someone else|Save it|Wish for a holiday|Ask for more time together",
    "Give every sprout a tiny holiday|Make all wrapping paper fold itself|Teach the family dog festive diplomacy|Ensure no biscuit ever breaks in tea",
  ],
  [
    "What would you turn into a Christmas competition?",
    "Gift wrapping|Baking biscuits|Decorating|Telling jokes",
    "Synchronised sofa napping|Professional reindeer impersonations|Speed apologising to the Christmas tree|Extreme candy cane archaeology",
  ],
  [
    "What would you call your Christmas cleaning service?",
    "Festive Fresh|The Tidy Elves|Christmas Clean-Up|Sparkle Squad",
    "Ho Ho Hoover|The Crumb Before Christmas|Sleigh the Mess|The Ministry of Missing Sellotape",
  ],
  [
    "What would be your Christmas scent of choice?",
    "Cinnamon|Pine|Fresh biscuits|Oranges",
    "Freshly polished reindeer antlers|A nervous gingerbread landlord|The smell of getting the last potato|Festive confidence with notes of gravy",
  ],
  [
    "What would you do with the very last Christmas biscuit?",
    "Eat it|Share it|Save it for later|Offer it to someone else",
    "Give it a royal farewell|Appoint it honorary Santa|Hire a gingerbread security team|Frame it as a warning to the others",
  ],
];
export const CHRISTMAS_PROMPTS = rows.map(
  ([title, decoys, wildcards], index) => ({
    id: `christmas-${String(index + 1).padStart(3, "0")}`,
    title,
    category: "Christmas Chaos",
    hint: "Pick what you would really choose. Then add one glorious lie.",
    decoys: decoys.split("|"),
    wildcards: wildcards.split("|"),
    family: true,
  }),
);
export const CHRISTMAS_DOODLES = [
  "Draw {name} as a very overworked Christmas elf",
  "Draw {name} riding a runaway reindeer",
  "Draw {name} as the star on top of the Christmas tree",
  "Draw {name} defending the last roast potato",
  "Draw {name} stuck inside a giant Christmas cracker",
  "Draw {name} trying to wrap a giraffe for Christmas",
  "Draw {name} as a gingerbread superhero",
  "Draw {name} arriving at Christmas dinner on a sleigh",
  "Draw {name} as a snowman on a beach holiday",
  "Draw {name} winning the ugly Christmas jumper contest",
  "Draw {name} giving Santa a driving lesson",
  "Draw {name} hiding from the Christmas washing up",
];
export const CHRISTMAS_PHOTOS = [
  "Copy {name}’s “Santa brought socks again” face",
  "Copy {name}’s “I ate Santa’s last biscuit” face",
  "Copy {name}’s “the Christmas tree just sneezed” face",
  "Copy {name}’s “the reindeer stole my lunch” face",
  "Copy {name}’s “I won the last roast potato” face",
  "Copy {name}’s “my Christmas jumper just started singing” face",
  "Copy {name}’s “there is an elf in my pudding” face",
  "Copy {name}’s “the gift started barking” face",
];
// Audio rounds are performances, not recordings of real people or copyrighted songs.
export const CHRISTMAS_AUDIO = [
  "Give us Santa’s “Ho, ho, ho!” after eating too many mince pies.",
  "Give us Santa’s “Ho, ho, ho!” with a surprise case of hiccups.",
  "Give us Santa’s “Ho, ho, ho!” while trying not to wake the reindeer.",
  "Give us Santa’s “Ho, ho, ho!” after discovering a parking ticket on his sleigh.",
  "Give us Santa’s “Ho, ho, ho!” as if he just won a dance competition.",
  "Give us Santa’s “Ho, ho, ho!” with his beard stuck in a zip.",
  "Give us Santa’s “Ho, ho, ho!” as a very posh Christmas dinner guest.",
  "Give us Santa’s “Ho, ho, ho!” after stepping on a squeaky toy.",
  "Give us Santa’s “Ho, ho, ho!” as a sleepy Christmas morning whisper.",
  "Give us Santa’s “Ho, ho, ho!” as a tiny but very confident elf.",
];
