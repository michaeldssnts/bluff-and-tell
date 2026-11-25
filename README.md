# Bluff & Tell

**Know your friends. Believe nothing.**

A party game for 2–8 players. Share real answers, invent convincing lies, and discover ridiculous things about your favourite people.

## How to play

1. Create a room and share its invite link or code.
2. Everyone joins on their own phone, chooses a nickname and age group, and answers a few prompts.
3. Pick the truth from four options: one truth and three lies.
4. Enjoy the reveal, hear the real story, and see who knows the group best.

Correct guesses earn 2 points. Each person who picks your own lie earns you 1 point, and you get a 1-point bonus if nobody spots your truth.

## Features

- Private rooms with invite links and room codes.
- Questions suited to each player's age group.
- No timers: each step moves on as soon as everyone is ready.
- Quick or full games.
- Confetti and a shareable victory card at the end.
- A solo demo to try the game.
- Downloadable social cards to recommend the game.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm ci
npm start
```

Open http://localhost:4317 in your browser. Multiplayer play requires a connection between devices.

## Development checks

```sh
npm test
npm run check
```

## Deploying

Code goes to GitHub first, then Cloudflare:

- **Pull requests** run the checks and tests.
- **Merging to `main`** runs the tests, deploys to staging (https://bluff-and-tell-staging.bluff-and-tell.workers.dev) and checks the live site.
- **Production** only deploys when someone runs the *Test and deploy* workflow by hand from `main` in GitHub Actions and chooses `production`.

The workflow needs two repository secrets: `CLOUDFLARE_API_TOKEN` (a Cloudflare API token with the *Edit Cloudflare Workers* permissions) and `CLOUDFLARE_ACCOUNT_ID`.
