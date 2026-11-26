# Local stack on the AWS Emulator + e2e in CI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** local dev and the e2e run with no AWS account. Cognito, S3 and AppSync Events come from the official AWS Emulator, and DynamoDB from DynamoDB Local. A separate GitHub workflow runs both e2e flows on every PR.

**Architecture:**
- `compose.yaml` gives the emulator fixed AppSync ports (4101 HTTP, 4102 realtime) and adds a plain-WebSocket forwarder on 4100 for browsers.
- `pnpm local:init` creates everything the cloud stack would (pool, users, Event API, table, bucket), seeds a demo org and writes the generated ids to env files.
- The web gets a narrow local-auth mode, because the emulator has no hosted login and Amplify only trusts real Cognito issuers.
- The home-made broker on :4001 goes away; the unchanged `AppSyncPublisher` publishes to the emulator.

**Tech Stack:** pnpm workspace, Node 22, Next.js 16, Hono, `@aws-sdk/*` v3, `aws-jwt-verify`, podman/docker compose, `alpine/socat`, GitHub Actions, `playwright-core` with system Chrome.

**Spec:** `docs/superpowers/specs/2026-11-26-local-emulator-e2e-design.md`

**Branch:** `feat/emulador-local`, from `main` with PR #23 merged.

## Global Constraints

- Local dev and CI use the emulator only. No profile for running locally against the `dev` stack.
- Local auth only when `CHACOTA_LOCAL_AUTH=emulator`. The web must throw at startup if that var is set and any of these holds:
  - `AWS_APP_ID` is set
  - `AWS_BRANCH` is set
  - `NODE_ENV === 'production'` and `AMPLIFY_APP_ORIGIN` doesn't start with `http://localhost`
- Prod code paths stay unchanged: `AppSyncPublisher`, `connectRealtime`, the event names and channels, and `createAuthRouteHandlers` when local auth is off.
- Fixed local values:

  | What | Value |
  |---|---|
  | AppSync HTTP | `127.0.0.1:4101` |
  | AppSync realtime (Node) | `wss://127.0.0.1:4102/event/realtime` |
  | AppSync realtime (browser) | `ws://127.0.0.1:4100/event/realtime` |
  | Emulator endpoint | `https://127.0.0.1:9297` |
  | Emulator CA | `$HOME/.aws/emulator/9297/ca.pem` |
  | Port range | `EMULATOR_LISTENER_PORT_RANGE=4101-4110` |
- Seeded names:

  | What | Value |
  |---|---|
  | User pool | `chacota-local` |
  | App client | `chacota-web` |
  | Group | `superadmin` |
  | Dev user (superadmin) | `dev@chacota.local` |
  | E2E user | `e2e@chacota.local` |
  | Local-only password (both users) | `Chacota-local-1` |
  | Event API | `chacota-local` |
  | Namespace | `game` (publish `AWS_IAM`, subscribe `API_KEY`) |
  | Table | `chacota-local` |
  | Bucket | `chacota-media-local` |
  | Demo org | slug `demo`, name `Chacota Demo`, activities `tiluchi` and `embolsau`, one sample quiz |
- Generated ids go to `apps/web/.env.development.local` **and** `apps/web/.env.production.local`, both gitignored. Keys: `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `EVENTS_API_KEY`.
- Node processes that talk to the emulator start with `NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-$HOME/.aws/emulator/9297/ca.pem}`. It's read at process start, so it goes in the scripts, not in env files.
- Copy is in Spanish (voseo) and English. Imports between workspace packages have no `.js` extension.
- Never commit `.claude/`, `.env*` (except `.env.example`) or `.superpowers/`. The maintainer approves each commit.

## Review Focus

1. **`local:init` run twice without an emulator restart** must change nothing: same pool, same API, data kept, and it still prints the ids. Pinned by Task 2 step 6.
2. **Emulator restarted but DynamoDB kept** (the normal Monday morning): `local:init` must detect the new pool, wipe the table, reseed, and the old browser cookies must be rejected (they're signed by a key that no longer exists) and redirect to the sign-in page instead of erroring. Pinned by Task 2 step 7 and the `verifyLocalIdToken` "unknown key → null" test in Task 3.
3. **The guard against prod:** any Amplify Hosting env var plus `CHACOTA_LOCAL_AUTH=emulator` must refuse to start. Pinned by the `localAuthMode` tests in Task 3.
4. **Expired or tampered id token in the cookie:** treated as signed out, with no 500. Pinned by the `verifyLocalIdToken` tests in Task 3.
5. **A second Event API in the same emulator** (someone ran the AWS CLI by hand) would take other ports from the range. `local:init` must reuse the API named `chacota-local` and fail clearly if its ports aren't 4101/4102. Pinned by Task 2 step 3's port assertion.

---

### Task 1: Emulator services with fixed AppSync ports

**Files:**
- Modify: `compose.yaml`
- Modify: `dev/aws-emulator/Dockerfile`, to print the installed version in the build log, since no versioned download exists: `LTS/latest` returns 200, versioned paths return 403

**Interfaces:**
- Produces: emulator AppSync on `127.0.0.1:4101` and `127.0.0.1:4102`, and the browser forwarder on `127.0.0.1:4100`, after `pnpm dev:services`.

- [ ] **Step 1: Edit `compose.yaml`.**
  - `aws-emulator`: add `EMULATOR_LISTENER_PORT_RANGE: '4101-4110'` and the ports `127.0.0.1:4101:4101` and `127.0.0.1:4102:4102`.
  - Add service `realtime-tls`: image `docker.io/alpine/socat:latest`, `network_mode: service:aws-emulator`, `depends_on: [aws-emulator]`, `restart: unless-stopped`, command `TCP-LISTEN:4100,fork,reuseaddr OPENSSL:127.0.0.1:4102,verify=0`.
  - Because the forwarder shares the emulator's network, publish `127.0.0.1:4100:4100` on **`aws-emulator`**.
  - Update the comments (Spanish, like the file).
- [ ] **Step 2: Dockerfile:** after `rpm -i`, `RUN aws-emulator --version`.
- [ ] **Step 3: Verify.** Run `podman compose up -d --build` (or docker). Then create a probe Event API, namespace and key with the AWS CLI against `https://127.0.0.1:9297` (`AWS_CA_BUNDLE=$HOME/.aws/emulator/9297/ca.pem`, dummy keys, `us-east-1`).
  - Expected: `get-api` reports dns `HTTP 127.0.0.1:4101` and `REALTIME 127.0.0.1:4102`.
  - A subscriber connecting to `ws://127.0.0.1:4100/event/realtime` with no TLS gets `connection_ack`.
  - Delete the probe API.
- [ ] **Step 4: Commit:** `chore(dev): AppSync del emulador en puertos fijos y reenvío ws para el navegador`

### Task 2: `pnpm local:init`

**Files:**
- Create: `services/api/scripts/local-init.ts` (entry point; runs the steps in order and prints a summary)
- Create: `services/api/scripts/local/cognito.ts`, `appsync.ts`, `seed.ts`, `env-file.ts`, `smoke.ts`
- Test: `services/api/test/env-file.test.ts`
- Modify: `services/api/package.json`
  - devDependencies `@aws-sdk/client-cognito-identity-provider`, `@aws-sdk/client-appsync` (same major as the others)
  - script `"local-init": "tsx scripts/local-init.ts"`
- Modify: root `package.json`
  - `"local:init": "NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-$HOME/.aws/emulator/9297/ca.pem} pnpm --filter @chacota/api local-init"`
  - keep `db:init` and `media:init`

**Interfaces:**
- Consumes: Task 1 ports; `createTable(client, name)` from `packages/db/src/table.ts`; `createOrg`, `setOrgActivities` from `@chacota/db`; `createTiluchi` from `@chacota/tiluchi/content`; `AppSyncPublisher` and `connectRealtime` from `@chacota/live` and `@chacota/live/client`.
- Produces:
  - `ensureUserPool(client): Promise<{ userPoolId: string; clientId: string; created: boolean }>` in `cognito.ts`. Finds the pool by name or creates it. A new pool also gets:
    - the client `chacota-web`, with `ALLOW_ADMIN_USER_PASSWORD_AUTH`, `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`
    - id and access token validity of 12 hours
    - the group `superadmin`
    - both users (email verified, permanent password), with the dev user added to `superadmin`
  - `ensureEventApi(client): Promise<{ apiId: string; apiKey: string }>` in `appsync.ts`. Finds the API by name or creates it with its namespace and an API key; reuses an existing key. Throws `Error('Event API chacota-local is not on 127.0.0.1:4101/4102 …')` if its dns differs.
  - `seedFresh(db, ownerUserId): Promise<void>` in `seed.ts`. Deletes and recreates the table, then creates the demo org owned by `ownerUserId` with both activities and one 2-question sample quiz (Spanish).
  - `envFileContent(values: Record<string, string>): string` and `writeEnvFiles(values): void` in `env-file.ts`. Writes both files under `apps/web/`, with a header comment saying they're generated by `pnpm local:init`.
  - `smokeCheck(ids): Promise<void>` in `smoke.ts`. Does an `admin-initiate-auth` for the dev user, then a subscribe on `wss://127.0.0.1:4102` plus a publish with `AppSyncPublisher('127.0.0.1:4101', 'us-east-1')` on `/game/smoke`, received within 5 s. Throws with a message naming the emulator version from `--version` and which check failed.

- [ ] **Step 1: Write the failing test** `services/api/test/env-file.test.ts`, `describe('envFileContent')`:
  - `envFileContent({ COGNITO_USER_POOL_ID: 'us-east-1_abc', EVENTS_API_KEY: 'da2-x' })` starts with `# Generado por pnpm local:init` and contains the lines `COGNITO_USER_POOL_ID=us-east-1_abc` and `EVENTS_API_KEY=da2-x`.
  - Keys come out sorted.
  - It throws on a value containing a newline.
- [ ] **Step 2:** `pnpm --filter @chacota/api exec vitest run test/env-file.test.ts` → FAIL (module not found).
- [ ] **Step 3:** implement `env-file.ts`, then the other modules and `local-init.ts`. Order:
  1. bucket (reuse `create-local-bucket` logic)
  2. `ensureUserPool`
  3. if `created`: `seedFresh(db, <dev user sub>)`; otherwise create the table only if it's missing
  4. `ensureEventApi`
  5. `writeEnvFiles({ COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, EVENTS_API_KEY })`
  6. `smokeCheck`
  7. print the users, password and URLs

  Clients use endpoint `https://127.0.0.1:9297`, region `us-east-1` and dummy credentials.
- [ ] **Step 4:** the env-file test → PASS.
- [ ] **Step 5:** `pnpm local:init` on a freshly started emulator → prints `user pool created`, `table reset`, `demo org seeded`, `smoke check ok`. Both env files exist.
- [ ] **Step 6:** run `pnpm local:init` again → prints `user pool reused`, the same ids, `smoke check ok`. Org `demo` still exists, checked with `aws dynamodb scan` against :8000 or a quick `getOrgBySlug`.
- [ ] **Step 7:** restart only the emulator (`podman compose restart aws-emulator`), run `pnpm local:init` → `user pool created`, `table reset`, and new ids in the env files.
- [ ] **Step 8: Commit:** `feat(dev): pnpm local:init crea Cognito, AppSync, tabla, bucket y una org de demo en el emulador`

### Task 3: Local auth mode in the web

**Files:**
- Create: `apps/web/src/lib/local-auth.ts`
- Test: `apps/web/src/lib/local-auth.test.ts`
- Modify: `apps/web/src/lib/env.ts`
  - `cognito.domain` is required only when local auth is off
  - add getter `localAuth: { endpoint: string } | null`, with `endpoint` from `COGNITO_LOCAL_ENDPOINT` (required when on)
- Modify: `apps/web/src/lib/auth.ts` (`getSessionUser` only)
- Modify: `apps/web/src/app/api/auth/[slug]/route.ts`
- Create: `apps/web/src/app/[locale]/local-sign-in/page.tsx` and `actions.ts`
- Modify: `apps/web/messages/es.json` and `en.json` (namespace `localAuth`)
- Modify: `apps/web/package.json`: add dependencies `aws-jwt-verify` (the version the Amplify adapter already resolves) and `@aws-sdk/client-cognito-identity-provider`

**Interfaces:**
- Produces (all in `local-auth.ts`):
  - `localAuthMode(env: NodeJS.ProcessEnv = process.env): boolean`. True only for `CHACOTA_LOCAL_AUTH === 'emulator'`; throws `Error('CHACOTA_LOCAL_AUTH=emulator is for local development only')` under the Global Constraints conditions.
  - `authCookies(clientId: string, tokens: { idToken: string; accessToken: string; refreshToken: string }): { name: string; value: string }[]`. The same five names and order as `e2e/src/login.ts`: `LastAuthUser`, `idToken`, `accessToken`, `refreshToken`, `clockDrift=0`, prefixed `CognitoIdentityServiceProvider.<clientId>`. The sub is read from the id token's payload.
  - `idTokenFromCookies(get: (name: string) => string | undefined, clientId: string): string | undefined`. Reads `LastAuthUser`, then that user's `idToken`.
  - `verifyLocalIdToken(token: string, opts: { endpoint: string; userPoolId: string; clientId: string; jwks?: object }): Promise<Record<string, unknown> | null>`
    - uses `JwtRsaVerifier.create({ issuer: \`${endpoint}/${userPoolId}\`, audience: clientId, jwksUri: \`${endpoint}/${userPoolId}/.well-known/jwks.json\` })`
    - also requires `token_use === 'id'`
    - `opts.jwks`, when given, goes to `cacheJwks` (for tests)
    - returns null on any verification error
  - `clearAuthCookies(clientId)` is the delete counterpart, used by sign-out.
- Cookie attributes when setting: `path: '/'`, `sameSite: 'lax'`, `httpOnly: true`, `secure: false` in local mode, `maxAge: 60*60*24*30` (the adapter's).

- [ ] **Step 1: Write the failing tests** `local-auth.test.ts`:
  - `localAuthMode`:
    - `{}` → false
    - `{ CHACOTA_LOCAL_AUTH: 'emulator' }` → true
    - with `AWS_APP_ID: 'd1'` → throws
    - with `AWS_BRANCH: 'main'` → throws
    - with `NODE_ENV: 'production', AMPLIFY_APP_ORIGIN: 'https://chacota.awsug.scz.net'` → throws
    - with `NODE_ENV: 'production', AMPLIFY_APP_ORIGIN: 'http://localhost:3000'` → true (the CI `next start` case)
  - `authCookies` + `idTokenFromCookies`: round trip. Build a fake id token whose payload `sub` is `'u1'`, then `idTokenFromCookies(name => map.get(name), 'c1')` returns it. The names match the e2e's list exactly (assert the array of names).
  - `verifyLocalIdToken`: generate an RSA key pair with `node:crypto` and sign RS256 JWTs in the test, passing the public JWK via `opts.jwks`.
    - a valid id token (iss `https://127.0.0.1:9297/us-east-1_p`, aud `c1`, `token_use: 'id'`, exp in 1 h) → returns claims with `sub`
    - expired → null
    - wrong `aud` → null
    - `token_use: 'access'` → null
    - signed by another key (unknown `kid`) → null
- [ ] **Step 2:** `cd apps/web && npx vitest run src/lib/local-auth.test.ts` → FAIL.
- [ ] **Step 3:** implement `local-auth.ts` to pass.
- [ ] **Step 4:** tests → PASS.
- [ ] **Step 5: Wire it up.**
  - `getSessionUser`: when `localAuthMode()`, claims come from `verifyLocalIdToken(idTokenFromCookies(name => cookieStore.get(name)?.value, clientId), …)` instead of `fetchAuthSession`. Everything after `claims` is unchanged.
  - Route `[slug]`: when `localAuthMode()`:
    - `sign-in` → redirect to `/local-sign-in`
    - `sign-out` → clear the cookies, redirect `/`
    - otherwise 404

    Otherwise it's the existing handler.
  - Page `/local-sign-in`: email and password, the title "Ingreso local · AWS Emulator" / "Local sign-in · AWS Emulator", and a hint showing the seeded emails.
  - Server action `localSignIn(formData)`: `InitiateAuth` `USER_PASSWORD_AUTH` against `env.localAuth.endpoint`, set `authCookies`, `redirect('/app')`. On a wrong password it re-renders with a `localAuth.error` message.
  - The page and action call `notFound()` when local auth is off.
- [ ] **Step 6: Verify by hand.**
  - `pnpm local:init`, then `CHACOTA_LOCAL_AUTH=emulator COGNITO_LOCAL_ENDPOINT=https://127.0.0.1:9297 pnpm dev` (with the CA var).
  - Open `/app` → lands on `/local-sign-in`.
  - Sign in as the dev user → `/app` shows the `demo` org and the superadmin menu.
  - Sign out → `/`.
  - Restart the emulator and run `local:init` → reload `/app`: back on `/local-sign-in`, with no error page.
- [ ] **Step 7:** `cd apps/web && npx eslint src && npx next typegen && pnpm --filter @chacota/web typecheck` → clean.
- [ ] **Step 8: Commit:** `feat(web): ingreso local contra el Cognito del emulador, solo con CHACOTA_LOCAL_AUTH=emulator`

### Task 4: Realtime on emulated AppSync, broker removed, e2e on the emulator

**Files:**
- Modify: `services/api/src/local-server.ts`
  - delete the broker section
  - use `publisherFromEnv()`
  - log the AppSync endpoint instead of the broker
- Modify: `services/api/package.json`
  - drop `ws` and `@types/ws` if nothing else imports them (check with grep first)
  - `"dev": "tsx watch --env-file-if-exists=../../apps/web/.env.development.local src/local-server.ts"`
- Modify: `packages/live/src/realtime.ts`: delete `LocalPublisher` and the `EVENTS_LOCAL_URL` branch of `publisherFromEnv`
- Modify: root `package.json`: prefix `dev`, `dev:game` and `e2e` with the `NODE_EXTRA_CA_CERTS` default from the Global Constraints
- Modify: `apps/web/.env.example`
  - one emulator profile with the realtime values from the Global Constraints, `CHACOTA_LOCAL_AUTH=emulator`, `COGNITO_LOCAL_ENDPOINT=https://127.0.0.1:9297`, dummy `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, `AWS_REGION=us-east-1`
  - no `EVENTS_LOCAL_URL`
  - a note that the ids come from `pnpm local:init`
- Modify: `e2e/src/env.ts`: `webEnv()` merges `.env.local`, then `.env.development.local` (later wins)
- Modify: `e2e/src/login.ts`:
  - endpoint from `COGNITO_LOCAL_ENDPOINT`, dummy credentials
  - `E2E_EMAIL` defaults to `e2e@chacota.local` and `E2E_PASSWORD` to `Chacota-local-1`
  - `required()` is no longer needed for them

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `pnpm e2e` passes against the emulator with only the generated env and the defaults.

- [ ] **Step 1:** `grep -rn "LocalPublisher\|EVENTS_LOCAL_URL\|from 'ws'" --exclude-dir=node_modules .` lists only the files above. Make the edits.
- [ ] **Step 2:** `pnpm test && pnpm typecheck` → green (the live tests use `MemoryPublisher`).
- [ ] **Step 3: Full run from scratch:**
  1. `podman compose down`, then `pnpm dev:services`
  2. `pnpm local:init`
  3. `pnpm dev:game` and `pnpm dev` (with `.env.local` copied from the new `.env.example`)
  4. `pnpm e2e`

  Expected: `ALL PASSED` and `ALL PASSED (Embolsau)`, including "presenter auto-reveals when the time runs out" and Q2 staying open.
- [ ] **Step 4:** `pnpm e2e` again in the same session → `ALL PASSED` (reruns with the same pool).
- [ ] **Step 5: Commit:** `feat(dev): eventos en vivo por el AppSync del emulador; se quita el bróker local y el e2e corre sin cuenta de AWS`

### Task 5: `e2e.yml` workflow

**Files:**
- Create: `.github/workflows/e2e.yml`

**Interfaces:**
- Consumes: `pnpm dev:services` (via `docker compose`), `pnpm local:init`, `pnpm e2e`.

- [ ] **Step 1: Write the workflow.**
  - Name `E2E`; on `pull_request`, `push` to `main`, `workflow_dispatch`; `ubuntu-latest`; timeout 30 min.
  - Steps:
    1. checkout
    2. `pnpm/action-setup@v4`
    3. `setup-node` (`.nvmrc`, pnpm cache)
    4. `pnpm install --frozen-lockfile`
    5. `docker compose up -d --build`
    6. wait up to 60 s for `curl -sk https://127.0.0.1:9297/__admin/health` and `curl -s http://127.0.0.1:8000`
    7. `cp apps/web/.env.example apps/web/.env.local`
    8. `pnpm local:init`
    9. `pnpm --filter @chacota/web build` with `NODE_EXTRA_CA_CERTS`
    10. start `pnpm --filter @chacota/web start` and `pnpm dev:game` in the background with logs to files, wait for :3000 and :4000
    11. `pnpm e2e`
    12. `if: failure()`: upload `e2e/out/` and the log files, plus `docker compose logs` output, as an artifact
  - `env` at job level: `NODE_EXTRA_CA_CERTS: ${{ env.HOME }}/.aws/emulator/9297/ca.pem` won't resolve, so set it with `echo "NODE_EXTRA_CA_CERTS=$HOME/.aws/emulator/9297/ca.pem" >> "$GITHUB_ENV"` in an early step.
  - No secrets, no AWS credentials.
- [ ] **Step 2:** `npx --yes @action-validator/cli .github/workflows/e2e.yml`, or `actionlint` if installed → no errors.
- [ ] **Step 3:** push the branch and open a draft PR → the `E2E` run passes. On failure, read the artifact, fix, push.
- [ ] **Step 4: Commit:** `ci: e2e completo en Chrome contra el emulador en cada PR`

### Task 6: Docs

**Files:**
- Modify: `CLAUDE.md`
  - "Commands": `dev:services`, then `local:init` instead of `db:init`/`media:init`; `pnpm e2e` without credentials
  - "Local dev is hybrid" → emulator only, local sign-in
  - drop the `:4001` broker mentions
  - the restart gotcha: rerun `local:init`, restart `dev`/`dev:game`, local data is reset
- Modify: `e2e/README.md`: requirements are now just the services, `local:init` and Chrome; mention the CI workflow
- Modify: `README.md`: any quick-start that mentions `cdk` for local dev

- [ ] **Step 1:** edit (Spanish where the file is Spanish).
- [ ] **Step 2:** `grep -rn "4001\|EVENTS_LOCAL_URL\|db:init\|cdk-outputs.dev" CLAUDE.md README.md e2e/README.md apps/web/.env.example` → only intended mentions remain.
- [ ] **Step 3: Commit:** `docs: desarrollo local y e2e solo con el emulador`
