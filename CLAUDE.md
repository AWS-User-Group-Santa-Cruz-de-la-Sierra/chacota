# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Chacota is an open-source platform of live **activities** (games) for AWS User Group meetups and streams. The first activity is **Tiluchi**, a Kahoot-style quiz. Anyone can deploy it to their own AWS account. Hard constraints: at most $300/year, 1000 simultaneous players, and Spanish (voseo, default) plus English UI.

## Commands

pnpm is used through corepack (`corepack pnpm …`; plain `pnpm` may not be installed). Node 22+.

```sh
corepack pnpm install
pnpm dev:services          # DynamoDB Local on :8000 + AWS Emulator on :9297 (S3, Cognito, AppSync Events on :4101/:4102) + realtime-tls (plain ws on :4100 for browsers), Podman/Docker
cp apps/web/.env.example apps/web/.env.local
pnpm local:init            # idempotent: table, bucket, user pool, AppSync API, demo org; writes ids to apps/web/.env.{development,production}.local and ends with a smoke check
pnpm dev:game              # participant API on :4000 (+ /media/*); events go through the emulator's AppSync
pnpm dev                   # Next.js on :3000; sign in as dev@chacota.local (superadmin) / Chacota-local-1 (local only)

pnpm test                  # every workspace package (Vitest)
pnpm typecheck
pnpm --filter @chacota/live test                           # one package
pnpm --filter @chacota/tiluchi exec vitest run test/activity.test.ts -t "full game"   # one test
cd apps/web && npx eslint src                              # lint (only apps/web has an ESLint config; root `pnpm lint` has none)
cd apps/web && npx next typegen                            # route types (RouteContext…); the web typecheck script runs it first
pnpm e2e                   # both flows in Chrome (user e2e@chacota.local); needs only the three steps above + dev + dev:game, no AWS account (see e2e/README.md)
```

Infra (CDK, stack `Chacota-<stage>`; `dev` is disposable and only for testing real deploys, not for local dev; `prod` is protected): `cd infra && npx cdk deploy Chacota-dev -c chacota:stage=dev --outputs-file cdk-outputs.dev.json`. `NodejsFunction` bundling shells out to `pnpm`, so it must be on `PATH`. Add `-c chacota:loadTest=true` to deploy the in-AWS 1000-player load test; the README shows how to invoke it, and you redeploy without the flag afterwards.

## Architecture

Layers. Dependencies only point downward, and an activity never imports another activity:

```
packages/core, packages/db   Platform: orgs, roles (owner/admin/editor), branding, users, invites,
                             ActivityManifest + enabled-activities rules, generic CSV/xlsx tables
packages/live                Live sessions any activity reuses: PIN, players (sharded), HMAC player
                             tokens, version-guarded transitions, realtime publishers + browser client,
                             permanent results (top N, 4-letter verification code); contracts
                             ActivityServer (activity.ts) and ActivityWeb (web.ts)
modules/tiluchi              The quiz activity: content (schema, scoring, Kahoot importers/exporters,
                             repo), server (TiluchiActivity, /m/tiluchi/answer), web (Host/Play screens),
                             messages/{es,en}.json
services/api                 Participant Lambda (Hono): /join, /state, /health + each activity's routes
                             under /m/<id>; also local-server.ts (API + broker) and load-test scripts
apps/web                     Next.js 16 App Router: platform frames and pages, composes activities
infra                        CDK; e2e = playwright-core flow against local services
```

A boundaries test (`packages/core/test/boundaries.test.ts`) fails if platform code mentions Tiluchi.

**How a live session flows.** The presenter acts through Next server actions (`apps/web/src/app/[locale]/host/actions.ts`, Cognito session) that call `LiveService` directly. Phones go through the participant Lambda with a player token. All state changes go through `LiveService.transition`, which is conditional on `version`. The presenter also sends the version its screen shows, so double presses are refused instead of skipping a step. Events go to AppSync Events channels `/game/{id}` (everyone) and `/game/{id}/host`. Platform events are `player_joined`, `started` and `ended`. Activity events are namespaced, for example `tiluchi.question`. `frameOnEvent` lets whichever comes first, `started` or the first activity event, start the activity. An `EventHub` buffers events until the activity screen mounts. Scoring and timing are server-side only, using `live.now()`. Results are written once on `end()`, in chunks of 500 rows under `ORG#<orgId>`, and never expire. Live data has a 48h TTL.

**Data.** Single DynamoDB table (pk/sk, gsi1, TTL `ttl`). Sessions are `SESSION#<id>`. Players, nicknames and per-activity hot data are spread over 10 shards (`shardOf`, FNV-1a) to stay under per-partition write limits at 1000 players. Activities add no infrastructure (no tables, GSIs, Lambdas or env vars): they use `sessionKeys.module(...)` and their own key prefixes.

**Web composition.** An activity is registered in four places:
- `services/api/src/registry.ts`
- `apps/web/src/activities/registry.server.ts`
- `apps/web/src/activities/registry.client.ts`
- `apps/web/src/activities/registry.messages.ts`

Its package also goes in `transpilePackages` (`apps/web/next.config.ts`). `/host/[sessionId]` and `/play` are platform frames (lobby, PIN/QR, join, reconnection, podium, code) that render the activity's `Host`/`Play` while it runs.

Org pages live under `/app/orgs/[slug]`:
- The hub (activity cards).
- `/historial` (results and prizes).
- `/admin` (general, `/admin/miembros`, `/admin/actividades`).
- Each activity's own area, for example `/tiluchi`.

Disabling an activity hides it and blocks new sessions (`startSessionGuard`), but running sessions and history stay. Old URLs are redirected in `next.config.ts`. The full contributor guide is `docs/actividades.md`.

## Conventions and gotchas

- Imports between workspace packages have **no `.js` extension** (Turbopack can't resolve `.js`→`.ts`). `infra` is the exception: it uses `.js`.
- Tailwind only scans `apps/web` by default. `globals.css` has `@source '../../../../modules'` so activity screens get their classes. A globbed path there silently matched nothing once. If activity UI looks unstyled, check this first.
- next-intl 4, locales `es` (default, no prefix) and `en`. Platform texts are in `apps/web/messages/*.json`. Activity texts are merged in under the activity id (`tiluchi.host.*`). The `admin` namespace belongs to the superadmin page and org-admin texts use `orgAdmin`.
- Next 16 specifics in use: `proxy.ts` instead of middleware, async `params`, `experimental.authInterrupts` for `forbidden()`.
- Media: content stores S3 keys (`orgs/<orgId>/media/<uuid>.<ext>`, see `packages/core/src/media.ts`), never URLs; `mediaUrl(MEDIA_PUBLIC_URL, key)` builds them (CloudFront in the cloud). Saving checks `isOrgMediaKey`. Activities show images through `HostScreenProps.mediaUrl` and `setBackground`. Phones never load media.
- Linux with rootful Docker: the emulator writes `~/.aws/emulator` and `ca.pem` as root; create the dir before `up` (`dev:services` does) and `sudo chmod -R a+rX ~/.aws/emulator` if the CA is unreadable.
- Media in local dev: AWS Emulator only serves HTTPS with its own CA (`~/.aws/emulator/9297/ca.pem`, regenerated on each start), which browsers don't trust. So the browser uploads and reads through `local-server.ts` (`/media/*` on :4000), which talks to the emulator. Restart `pnpm dev:game` and the web after restarting the emulator.
- Local dev runs entirely on the AWS Emulator (no AWS account): Cognito, S3, AppSync Events and DynamoDB Local. `apps/web/src/lib/local-auth.ts` + `/local-sign-in` replace the Hosted UI, only with `CHACOTA_LOCAL_AUTH=emulator` (the web refuses to start with it on Amplify or a non-localhost production origin); no token refresh, sign in again when the id token expires. Commands that talk to the emulator run with `NODE_EXTRA_CA_CERTS` set to its CA.
- The emulator keeps everything in memory and its CA changes on each start. After restarting it, rerun `pnpm local:init` (it detects the new user pool and resets the local world: table wiped, demo org reseeded) and restart `pnpm dev` and `pnpm dev:game`, since Node reads the CA only at startup. Old cookies are rejected (back to sign-in). The emulator image is unpinned (AWS only publishes `latest`); the smoke check in `local:init` fails loudly if its behaviour changes.
- CI (`.github/workflows/e2e.yml`) runs both e2e flows on every PR and push to main with no secrets; failures upload `e2e-evidencias`.
- Server-side tests that touch DynamoDB use `useTestDb()` from `@chacota/db/testing` (a throwaway table per file).
- Commits: the maintainer approves commits explicitly. Never commit `.claude/`, `.env*` (except `.env.example`) or `.superpowers/`.
