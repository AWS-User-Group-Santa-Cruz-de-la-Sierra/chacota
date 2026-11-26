# Local stack on the AWS Emulator, and the e2e in CI

Date: 2026-11-26 · Status: approved approach (B), design for review

Starts from `main` after PR #23 (the meetup fix, which adds the timeout case to `e2e/src/game.ts`) is merged.

## Why

- **The meetup bug (2026-11-25) lived in a path no test took.** Tiluchi's presenter revealed every question that followed one that ran out of time. Every test had everyone answer, so no question ever timed out. The e2e now covers that case (branch `fix/tiluchi-pregunta-tras-tiempo`), but it only runs by hand, and only with an AWS account. It should run on every PR, without anyone remembering to.
- **Developers complain about `cdk deploy` just to get Cognito.** Local dev today is hybrid. DynamoDB Local, the local broker and the AWS Emulator's S3 run locally, but login uses the real `dev` stack's Cognito pool. That means an AWS account, credentials, and a deployed stack.

Success: a new contributor runs `pnpm dev:services && pnpm local:init && pnpm dev`, signs in and plays a full game with no AWS account, and CI runs the full e2e the same way.

## Goals

1. Local dev needs no AWS account, no credentials and no deployed stack.
2. The AWS pieces the web and API talk to are official AWS emulators:
   - **AWS Emulator** (`dev/aws-emulator`, already in `compose.yaml`): Cognito, S3 and AppSync Events.
   - **DynamoDB Local**: the database.
3. Realtime goes through **emulated AppSync Events**, using the same protocol as prod. The home-made broker on :4001 is retired.
4. A separate CI workflow, `e2e.yml`, runs both e2e flows (Tiluchi and Embolsau) in Chrome against that stack, on every PR and on demand.
5. The e2e keeps covering the meetup case: someone doesn't answer, the question times out, and the next question must stay open and be answerable.

## Non-goals

- Emulating Lambda, API Gateway or CloudFront. The participant API keeps running as `services/api/src/local-server.ts` (the same Hono app the Lambda wraps). Media keeps going through `local-server.ts` `/media/*`.
- Deploying or changing the `dev` or `prod` stacks.
- **Local dev against the `dev` stack.** Decided by the maintainer: local dev and CI use the emulator only. The `dev` stack is for testing real deploys, not for running the app locally. `.env.example` documents one profile, the emulator one.
- **Local data surviving an emulator restart.** The emulator has no way to save its state: Cognito users and S3 files are always gone after a restart, and a volume doesn't help (checked: there's no persistence setting). Decided by the maintainer: no extra machinery for this. See "Restarts" below.
- Load tests, and phones on the LAN (reaching the dev machine from a real phone).

## Anti-goals (failure even if it "works")

- **Any way for the local sign-in or local token check to be active in prod.** It must need an explicit env var, and refuse to start when that var is combined with a non-local setup (see "Auth"). Prod and dev deployments never set it.
- A local setup that silently differs from prod in the parts under test: event names, channels, the realtime protocol, the publish path. The e2e must exercise the same client code (`connectRealtime`) and the same publisher (`AppSyncPublisher`) as prod.
- Making `pnpm dev` slower or losing hot reload.

## Constraints and verified facts (AWS Emulator 1.0.587)

| Area | Fact | How verified |
|---|---|---|
| Cognito | `create-user-pool`, `create-user-pool-client`, `admin-create-user`, `admin-set-user-password`, `admin-initiate-auth` (`ADMIN_USER_PASSWORD_AUTH`) work and return RS256 JWTs. Issuer is `https://127.0.0.1:9297/<poolId>`; JWKS is at `https://127.0.0.1:9297/<poolId>/.well-known/jwks.json`. | Probed |
| Cognito | **No hosted login page.** `create-user-pool-domain` succeeds, but `/oauth2/authorize` and `/login` return 404. | Probed |
| Amplify adapter | `@aws-amplify/adapter-nextjs` 1.8.1 `createServerRunner` builds its token validator from `userPoolId` only (issuer `https://cognito-idp.<region>.amazonaws.com/<pool>`), with no hook to replace it. So `fetchAuthSession` rejects emulator tokens. | Read source |
| AppSync Events | `create-api` with `eventConfig`, `create-channel-namespace`, `create-api-key` work. A real subscriber using our protocol (`aws-appsync-event-ws` subprotocol, `connection_init` → `connection_ack` → `subscribe` → `data`) received an event published over HTTP with an API key. | Probed end to end |
| AppSync Events | By default each API gets two random ports, and port 9297 does not route to them. **`EMULATOR_LISTENER_PORT_RANGE=4101-4110`** makes them predictable: the first API gets HTTP `4101` and realtime `4102`. With those ports published, a subscriber on the Mac received events. | Probed in a temporary emulator |
| AppSync Events | Publishing with a SigV4 (IAM) signature works. The **unchanged** `AppSyncPublisher('127.0.0.1:4101', …)` published, and the subscriber received the event. Node only needs `NODE_EXTRA_CA_CERTS` pointing to the emulator CA. | Probed |
| AWS Emulator | No setting to save state between restarts. The image downloads `LTS/latest`, so the version can drift. | Checked |
| All emulator endpoints | HTTPS with a per-start CA (`~/.aws/emulator/9297/ca.pem`) that browsers don't trust. In-memory: everything is gone after a restart. | Known (CLAUDE.md) |
| DynamoDB | Already DynamoDB Local in dev and CI. | — |

## Approaches considered

- **A. Everything on the AWS Emulator, with web, API and Chrome in containers on the emulator's network.** The most faithful, and it avoids the port problem. But developers lose plain `pnpm dev` hot reload, and it's the biggest change. Rejected for now.
- **B. AWS Emulator for Cognito, S3 and AppSync Events; DynamoDB Local; web and API run as today.** A fixed-port forwarder exposes the emulated AppSync API. **Chosen.** It removes the `cdk` step and the home-made broker with the least disruption, and works the same on a Mac and in CI.
- **C. Keep the `dev` Cognito pool and only add CI**, with AWS credentials via OIDC. Smallest change, but it doesn't fix the developers' complaint. Rejected.

## Design

### 1. Services (`compose.yaml`)

- `dynamodb`: unchanged.
- `aws-emulator`:
  - adds `EMULATOR_LISTENER_PORT_RANGE=4101-4110`
  - publishes `127.0.0.1:4101-4102`
  - **pinned** to a known version. If the official download has versioned URLs, pin the exact RPM. If not, cache the image by version, and `local:init` runs a smoke check (see below) that fails loudly when behavior changes.
- **New `realtime-tls`:** a tiny forwarder (`socat`, e.g. `alpine/socat`) for **browsers only**. Browsers don't trust the emulator's per-start CA, so this listens on plain `127.0.0.1:4100` and forwards to the emulator's realtime port with TLS (`TCP-LISTEN:4100,fork,reuseaddr` → `OPENSSL:aws-emulator:4102,verify=0`). The config is static, with no ports file. Node (web server, participant API, e2e) talks to `4101`/`4102` directly over TLS with `NODE_EXTRA_CA_CERTS`.

### 2. One init command: `pnpm local:init`

It replaces `db:init` and `media:init` for local use; both stay as aliases. It's idempotent, and safe to rerun after an emulator restart:
1. DynamoDB table `chacota-local` (existing script).
2. S3 bucket `chacota-media-local` (existing script).
3. Cognito: a user pool and app client (`ALLOW_ADMIN_USER_PASSWORD_AUTH`, `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`), a `superadmin` group, and two seeded users:
   - `dev@chacota.local`, superadmin
   - `e2e@chacota.local`, plain user, for the e2e

   Both get a known **local-only** password, printed by the command and listed in `.env.example`.
4. AppSync: an Event API named `chacota-local` with a `game` namespace. Subscribe uses an API key and publish uses IAM, as in prod (verified). Plus the API key.
5. **Smoke check:** one Cognito login and one AppSync publish/subscribe round trip, so a changed emulator fails here with a clear message instead of deep inside the e2e.
6. Writes the generated ids (pool id, client id, API key) to `apps/web/.env.emulator.local` and prints them. **Builder's call:** whether `pnpm dev` loads that file automatically, or the developer copies it once. The ids change on every emulator restart, so automatic loading is preferred.

### Restarts

An emulator restart loses Cognito and S3, so `local:init` recreates the users with new ids. To avoid orphaned data, **`local:init` starts the local world fresh whenever it creates a new user pool**: it deletes and recreates the DynamoDB table, then seeds:
- the two users
- a demo org owned by `dev@chacota.local`, with Tiluchi and Embolsau enabled and one sample quiz, so nobody starts from zero

Rerunning `local:init` while the emulator keeps running changes nothing (idempotent). Because the table is wiped whenever the pool (and so every user id) is new, the e2e seed (`e2e/src/seed.ts`) never meets an org owned by a user who no longer exists: it needs no change.

### 3. Realtime and publish config

- The browser's `RealtimeConfig` becomes `httpDns: 127.0.0.1:4101`, `realtimeUrl: ws://127.0.0.1:4100/event/realtime`, `apiKey: <generated>`. No client code change.
- The publisher is the unchanged `AppSyncPublisher` with `EVENTS_HTTP_DNS=127.0.0.1:4101` (verified).
- `publisherFromEnv`: if `EVENTS_LOCAL_URL` isn't set, AppSync is used. The local broker (`LocalPublisher`, the `:4001` part of `local-server.ts`) is removed once the e2e passes on emulated AppSync. `MemoryPublisher` stays for unit tests.
- Local publish credentials: the emulator runs with `--auth off`, so any static keys work. The web and API get `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` dummy values from the local env file.

### 4. Auth: a local-only mode

This is the only part that touches prod code paths, so it's deliberately narrow.

- **Switch:** `CHACOTA_LOCAL_AUTH=emulator`, plus `COGNITO_LOCAL_ENDPOINT=https://127.0.0.1:9297`.
- **Guard:** at startup the web throws, refusing to run, when local auth is on and any of these hold:
  - `NODE_ENV === 'production'` **and** `AMPLIFY_APP_ORIGIN` is not `http://localhost…`
  - an Amplify Hosting env var is present (`AWS_APP_ID` or `AWS_BRANCH`)

  A unit test covers the guard.
- **Session reading:** `getSessionUser` in `apps/web/src/lib/auth.ts` is still the single place that turns cookies into a user. In local mode:
  - it reads the **same cookie names** Amplify uses (`CognitoIdentityServiceProvider.<clientId>.<sub>.idToken`, etc.)
  - it verifies the id token with `aws-jwt-verify`'s `JwtRsaVerifier` (issuer `<endpoint>/<poolId>`, JWKS `<endpoint>/<poolId>/.well-known/jwks.json`, audience `clientId`, token use `id`), trusting the emulator CA through `NODE_EXTRA_CA_CERTS`
  - everything after the claims (user upsert, superadmin group) is unchanged.
- **Sign-in:** `requireUser` redirects to `/api/auth/sign-in` in both modes. In local mode that route serves a minimal local sign-in page: email and password, labelled "Local development", in Spanish and English. It calls the emulator's `InitiateAuth` (`USER_PASSWORD_AUTH`), sets the same cookies as the Amplify adapter (same names, `SameSite=Lax`, `HttpOnly` as the adapter does, same max age), and redirects to `/app`. Sign-out clears them. In normal mode the route is the existing `createAuthRouteHandlers`, unchanged.
- **Token refresh:** not needed locally. When the id token expires, the developer signs in again. Builder's call: a longer token lifetime on the local pool client.
- `COGNITO_DOMAIN` is no longer required in local mode.
- **The e2e login** (`e2e/src/login.ts`) gets tokens from the emulator with `admin-initiate-auth`, as today, against the local endpoint and with dummy credentials, and sets the same cookies. `E2E_EMAIL`/`E2E_PASSWORD` default to the seeded e2e user.

### 5. The e2e

- No new flows. `game.ts` (with the no-answer timeout and Q2-stays-open checks from the meetup fix) and `embolsau.ts` run unchanged, apart from the login and env.
- Playwright: the browser only talks plain HTTP/WS to `localhost`, so no certificate exceptions are needed.

### 6. CI: `.github/workflows/e2e.yml`

- Triggers: `pull_request`, `push` to `main`, `workflow_dispatch`. Separate from `ci.yml`. Whether it **blocks merging** is a GitHub branch-protection setting the maintainer decides; the workflow doesn't assume either way.
- Steps:
  1. Checkout, pnpm, Node, install.
  2. `docker compose up -d --build` (the emulator image builds from the official RPM; cache the layer).
  3. Wait for `/__admin/health` and DynamoDB.
  4. `pnpm local:init`.
  5. Build the web (`next build`) and start it with `next start` on :3000, closer to prod than `next dev`. Start `local-server.ts` on :4000.
  6. `pnpm e2e`.
  7. On failure, upload `e2e/out/` screenshots and service logs as artifacts.
- Chrome: the `ubuntu-latest` runner has Google Chrome, which is what `playwright-core` with `channel: 'chrome'` uses.
- No AWS credentials and no secrets.

### 7. Docs

- Update `CLAUDE.md` "Commands" and the local-dev gotchas (no more `dev` stack, no `:4001` broker), and `e2e/README.md` (no Cognito user to create, no AWS credentials).
- `apps/web/.env.example`: an emulator profile as the default, and the `dev`-stack values as the alternative.

## Order of work (each step is usable on its own)

1. Emulator port range, version pin, `realtime-tls` forwarder, and `local:init` (AppSync, Cognito, seeded users, fresh start, smoke check).
2. Switch realtime to emulated AppSync, remove the broker, and confirm the e2e still passes. Login still goes through `dev` Cognito at this point; the switch comes in step 3.
3. Local auth mode (guard, session reading, sign-in page, e2e login), plus unit tests for the guard and the token check.
4. `e2e.yml`, then docs (emulator-only profile).

## Left to the builder

- Exact file name and loading of the generated local env.
- Local pool token lifetimes.
- The look of the local sign-in page (minimal, platform styling, clearly marked local).

## Open (needs the maintainer)

- None blocking. Making `e2e.yml` a required check is a GitHub setting for later.
