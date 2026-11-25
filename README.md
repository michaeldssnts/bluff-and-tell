# Bluff & Tell

**Know your friends. Believe nothing.** A responsive multiplayer party quiz for 2–8 players, built for phone browsers first. No app-store memberships are needed. The local website runs with Node.js; Cloudflare deployment uses the pinned Wrangler development tool.

## Try it locally

From this directory:

```sh
npm start
```

Open **http://localhost:4317**. The server also prints a Wi-Fi address: friends on the same Wi-Fi can open that address on their phones. A computer firewall can prevent other devices from connecting. The computer and server must stay running. A localhost URL cannot be used by friends outside your Wi-Fi.

Create a real room and choose **Copy invite link**. The copied URL contains the room code and can be pasted into WhatsApp, email, Teams, or any other messenger. A visitor opens the link, enters a nickname, joins the preselected room, and chooses their private age group in the lobby. Localhost previews copy the computer’s Wi-Fi address when available; those links still only work on the same network while the preview is running. Published HTTPS links work over the internet.

You can also share the room code manually, or choose **Try a solo demo**. Demo players are explicitly labelled and use shorter timers. Use different browsers/private windows to simulate separate human players; tabs in the same browser share a saved guest session.

Local rooms are stored in `.local/rooms.json` (ignored by Git). Treat that file as private: it contains game answers and session credentials. Rooms expire after 24 hours. Local expiry cleanup runs on startup and whenever rooms are saved. Local HTTP is for trusted Wi-Fi testing; use HTTPS for internet hosting.

## Two-player games

Couples and pairs of friends can start as soon as both players have joined. No bots or extra players are required. They alternate being featured and guessing: the featured player cannot vote on their own question, so there is one eligible voter per round. The same +2 correct-guess / +1 authored-lie scoring applies. The single voter has the full configured voting window; after a vote is submitted, voting closes after at most three more seconds, with changes allowed until that deadline. Both players receive the same number of questions.

## Gameplay

1. The host creates a room. Players join with a code or invite link and a nickname. Once inside the lobby, each player privately chooses their age group: Under 13, 13–17, 18–25, or 26 and over. The host can start after everyone has chosen; each player then receives three suitable prompts.
2. The host chooses 1 or 2 questions per player, writing time, and voting time.
3. Everyone privately writes a truth and a lie for three prompts. Complete pairs autosave after a short pause in typing. Partial answers stay on the device. Press **I'm ready** to finish, or edit again before the host starts.
4. Each question has the truth, the player's lie, a plausible decoy, and an outrageous decoy. Options are shuffled. Unusual answers can be true.
5. Default phases: 10s reading, 45s discussion, 30s voting, 30s reveal, up to 60s storytelling. Writing defaults to 6 minutes. Hosts can pause, add a minute, advance non-voting phases, and hand over hosting. If a host stops checking in for over 90 seconds, another player can take over.
6. The featured player cannot vote on their own question. Other players can change a vote until the deadline. Once everyone votes, the remaining voting time becomes at most 3 seconds.
7. Correct guesses earn 2 points; each vote for the featured player's own lie earns that player 1 point. Other decoys earn nobody points. Missing a vote earns 0.
8. All players receive the same number of featured questions, reduced equally if someone submits fewer complete pairs. If anyone has no complete pair at writing timeout, the game waits for the host to add time.
9. Reveal votes and points, hear the story, then see final standings and truthful answer history. Replay reuses the room and clears the last game's answers and scores.

When every player selects 26 and over, the room uses an extra-silly set about ridiculous purchases, pointless rivalries and terrible excuses. The pack is frozen when the host starts. Mixed-age rooms use each player’s suitable personal set.

The first version contains eleven authored prompts, arranged into three-question sets for children, teenagers and adults, with matching prepared decoy banks. Age groups stay private and are validated when saving the player’s lobby profile. New players can enter the room without selecting an age group first. Existing saved players without an age group retain their original adult prompt set. It does not use AI to generate or judge personal answers. Each author can privately review and swap the two extra decoys during writing if either could also be true about them. The reviewed decoys are then kept when their question is built. Ads are intentionally not activated: account setup, consent and moderation decisions are still needed. There are no automatic drinking penalties.

## Architecture

- `public/`: dependency-free responsive website, accessible forms and dialogs, install manifest and service worker.
- `server/engine.mjs`: portable, server-authoritative game rules. Deadlines are absolute server timestamps. If all devices disconnect, the next request advances the game through elapsed phases.
- `server/api.mjs`: authenticated room endpoints, safe player snapshots, idempotency keys for action retries, and create/join/action rate limits.
- `server/store.mjs`: serialized file storage locally; optimistic conditional writes with strongly consistent reads in DynamoDB. Concurrent submissions cannot silently overwrite each other.
- `server/local.mjs`: Node.js local HTTP server. Local frontend and backend have no third-party dependencies.
- `server/lambda.mjs`: the same API and rules on AWS Lambda. The AWS SDK is pinned in `server/package-lock.json`.
- `infrastructure/template.yaml`: AWS SAM definition for S3, CloudFront HTTPS, API Gateway, Lambda, DynamoDB TTL, short log retention and an optional monthly budget alert.

The browser receives its own drafts, public room information and current options. It never receives the unrevealed answer key, other players' private submission sheets, or other players' votes before the reveal. Session tokens are sent in authorization headers, not invite URLs. Input is escaped before rendering. Responses and game APIs are not cached. The service worker caches only the application shell: multi-device play still requires connectivity.

## Tests

```sh
npm test
npm run check
```

Tests cover phase timing, private snapshots, permissions, score calculation, late and stale votes, room expiry, replay, duplicate requests, concurrent joining and file persistence. Cloud deployment must additionally be validated and tested in the destination AWS account.

## Cloudflare hosting (recommended)

Use Node.js 22.13+ and `npm ci`. This project keeps its source locally in `/Users/michael/Documents/Bluff-and-tell/` and uses a separate Git repository from the remittance dashboard. Local rooms, credentials, dependency folders and generated deployment state are ignored by Git.

The website is served as Worker static assets. The existing server-authoritative game engine and API run in Cloudflare Workers with Node compatibility. Each room has its own SQLite-backed Durable Object, protected with storage transactions. A second Durable Object class limits create/join/action attempts per hashed client IP across rooms. Room expiry is enforced immediately on reads and an alarm removes the expired room from active storage. No API response is cached. Cloudflare platform storage recovery policies also apply.

`wrangler.jsonc` declares explicit `staging` and `production` environments. These deploy as **bluff-and-tell-staging** and **bluff-and-tell**, each with its own room and rate-limit namespaces. Version preview URLs are disabled: staging uses its own persistent deployment rather than production room storage. No live deployment is created until the production command is run.

```sh
npm ci
npm test
npm run check
npm run cloudflare:check
npm run cloudflare:dev
```

The final command opens a local Cloudflare runtime (normally port 8787), without uploading game data. In a second terminal, run `npm run cloudflare:test` to check a complete two-player game, private profiles, scoring, duplicate actions and concurrent joins. This creates synthetic test rooms only; all test players leave at the end. Rate-limit tests should use fresh local state rather than public staging traffic.

To connect your own account and publish staging:

```sh
npm run cloudflare:login -- --scopes account:read user:read workers_scripts:write
npm run cloudflare:deploy:staging
```

Approve the official Cloudflare OAuth screen yourself. Do not paste keys into chat or commit account credentials. If asked, choose a free `workers.dev` account subdomain. The deployment prints the resulting HTTPS address. Verify health and run `node scripts/check-cloudflare.mjs https://THE-RETURNED-STAGING-ADDRESS` before sharing widely. Also join from two devices on different internet connections.

Cloudflare's Workers Free plan has request and CPU limits; SQLite Durable Objects have separate request, duration and storage limits. Static asset requests are free. Free limits can stop operations until reset. The current frontend polls every two seconds, so eight connected players use roughly 14,400 polling requests per hour, plus actions. Monitor actual usage during the beta; the free plan is intended here for small play-tests, not unlimited concurrent games. A paid upgrade must be a deliberate choice.

GitHub repository: `https://github.com/michaeldssnts/bluff-and-tell`. We can later connect it through Workers Builds for automatic staging deployments using `npm run cloudflare:deploy:staging`. Keep production deployments deliberate until the game has been play-tested. The free `workers.dev` staging address needs no purchased domain. A custom domain can be connected later.

```sh
npm run cloudflare:deploy:production
```

The AWS deployment below is retained as an alternative and is not used by Cloudflare.

## Alternative: deploy on your AWS account

No cloud resources have been deployed or charged by this project. Required software: a supported Node.js LTS release (22+ for the AWS tooling), AWS CLI v2, and AWS SAM CLI. Sign in with your own AWS CLI profile/SSO. Do not paste AWS access keys into source code or chat.

AWS Free Tier terms depend on account age, selected plan, services and usage. New-customer credits/time-limited offers are not permanent free hosting. Set billing alerts before deployment. The template optionally creates an **account-wide USD 5 monthly alert at 80%** when `BudgetEmail` is supplied. It is an alert, **not a spending cap**. API throttling and a Lambda concurrency limit reduce bursts but do not prevent all possible charges.

From this directory, after configuring your AWS account and desired region:

```sh
npm ci --prefix server
sam validate --lint --template-file infrastructure/template.yaml
sam build --template-file infrastructure/template.yaml
sam deploy --guided
```

Use `bluff-and-tell` as the stack name. Review SAM's change set and IAM permissions before deployment. If prompted, supply your own budget-alert email. Some accounts have low Lambda concurrency quotas: if AWS rejects `ReservedConcurrentExecutions: 5`, inspect your quota before choosing to remove that reservation.

Then upload the website:

```sh
node scripts/publish-assets.mjs bluff-and-tell
```

The script obtains the correct bucket/distribution from stack outputs, uploads the website and invalidates its cache. Open the printed HTTPS URL, create a room, and join from a second device on a different connection to validate internet play. Test secret-answer protection, end-of-timer votes, reconnects and a full game before wider distribution.

CloudFront sends `/api/*` to API Gateway with caching disabled and all viewer headers except Host forwarded; static files come from the private S3 bucket through origin access control. The service uses same-origin API requests, so no cross-origin browser permission is required. Under CloudFront, API Gateway sees edge source IPs; IP-based application limits may group several viewers together. For larger deployments, add a trusted per-viewer rate-limiting layer and load-test the database write contention.

The backend rejects expired rooms immediately. DynamoDB TTL physically removes expired records asynchronously. No answer bodies or credentials are deliberately logged. The deployment is designed for a small beta, not unbounded public traffic. Limits do not replace monitoring or abuse review.

### Your domain at Xneelo

Keep the domain at Xneelo. A later step is to add an ACM certificate in `us-east-1`, attach the chosen hostname to CloudFront, and add the requested validation/DNS records at Xneelo. A subdomain such as `play.yourdomain.com` is simplest. The generated CloudFront HTTPS URL works without buying a new domain. Custom-domain resources are not created by this initial template.

### Teardown

After backing up anything you intentionally want to keep, empty this project's website bucket and remove this project's SAM stack. A nonempty S3 bucket prevents stack deletion. Review the deployment's artifact bucket and billing console for remaining resources. Do not delete unrelated account resources.

## Planned next steps

Play-test with real groups; improve prompt variety; add answer reporting and host moderation before broader public access; configure optional banner ads only on suitable screens; then consider mobile-store packaging. The room API and game engine can be reused by a future native app.
