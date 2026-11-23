# Plataforma de actividades: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** convertir Chacota en una plataforma de actividades enchufables, con la administración de la organización separada y Tiluchi como primer módulo, sin cambiar la experiencia del público.

**Arquitectura:** se separa en tres capas:

- **Plataforma:** `packages/core` y `packages/db`.
- **Sesión en vivo:** el paquete nuevo `packages/live`, que se extrae de `services/game`.
- **Actividades:** el paquete nuevo `modules/tiluchi`.

`services/api` (la Lambda de participantes) y `apps/web` arman todo a partir de un registro explícito de actividades. Todas las actividades comparten una sola Lambda, un solo AppSync Events y una sola tabla.

**Stack:**
- Monorepo pnpm con `corepack pnpm`, TypeScript estricto y Vitest.
- Next.js 16 con App Router y next-intl 4.
- Hono en Lambda, AppSync Events, DynamoDB single-table y CDK.
- Para el e2e, playwright-core con el Chrome instalado.

**Spec:** `docs/superpowers/specs/2026-11-22-plataforma-de-actividades-design.md`. Leela antes de empezar; este plan se apoya en ella.

## Restricciones globales

- Presupuesto ≤ $300/año. Las actividades **no** agregan recursos de AWS, índices, tablas ni variables de entorno; solo usan prefijos de clave en la tabla única, incluido `gsi1` con prefijo `<MODULO>#`.
- Rendimiento a mantener: 1000 jugadores simultáneos, cero errores, fan-out p95 < 1 s, y sharding de jugadores, apodos y datos de la sesión en `SHARDS = 10` particiones (FNV-1a).
- Ninguna actividad importa otra actividad. Las dependencias van en este sentido: `core/db` ← `live` ← `modules/*` ← `services/api`, `apps/web`.
- El público no nota el cambio: PIN → apodo → jugar → pantalla final con el código de 4 letras, con los mismos textos de hoy.
- UI en español (con voseo) por defecto y en inglés.
- Los imports entre paquetes del workspace van **sin** extensión `.js`, porque Turbopack no la resuelve; `infra` sí usa `.js`. Cada paquete nuevo va en `transpilePackages` de `apps/web/next.config.ts`.
- **Cada paso "Commit" requiere la aprobación explícita del lead.** Mostrá el resumen y esperá el sí. Nunca se commitean `.claude/`, `.env*` (salvo `.env.example`) ni `.superpowers/`.
- No hay datos de producción. Se pueden cambiar claves de DynamoDB sin migrar; antes de las pruebas manuales se recrea la tabla local con `corepack pnpm db:init`.
- Rama de trabajo: `feat/activities-platform`, creada desde `feat/scaffold-core`.

## Foco de revisión

1. **Organizaciones sin `activities` guardado** (todas las que existen hoy): se consideran habilitadas todas las actividades `stable`, así que Tiluchi no debe desaparecer. Lo prueba la Tarea 3.
2. **Desactivar Tiluchi con una sesión en curso:** los celulares pueden seguir respondiendo, el presentador puede avanzar y terminar, y el historial sigue visible; lo único que se bloquea es empezar una sesión nueva. Lo prueba la Tarea 8.
3. **Una sesión o un resultado guardado con un `module` que ya no está en el registro:** el historial lo lista igual, con columnas genéricas y sin detalle, y `/host/[id]` responde 404 en vez de romperse. Lo prueban las Tareas 4 y 7.
4. **Dos clics o dos presentadores que avanzan a la vez:** gana uno y el otro recibe el estado actual, sin error en pantalla. Lo prueba la Tarea 4 (`version` condicional).
5. **Links viejos** `/app/orgs/<slug>/tiluchis/<id>` y `/app/orgs/<slug>/results/<id>`: redirigen a las rutas nuevas. Lo prueba la Tarea 8.

---

## Mapa de archivos

```
e2e/                                   NUEVO @chacota/e2e: login Cognito, seed, partida completa
packages/core/src/
  org.ts                               acciones de roles: activity.content / activity.host
  activities.ts                        NUEVO: ActivityManifest, defaultActivities, isActivityEnabled
  tables.ts                            NUEVO (movido de exporters): tableToCsv, tableToXlsx
  (schema, scoring, editing, importers/, exporters/  → se mueven a modules/tiluchi)
packages/db/src/
  orgs.ts                              Org.activities, setOrgActivities
  (tiluchis.ts → modules/tiluchi)
packages/live/                         NUEVO @chacota/live (de services/game)
  src/model.ts                         Session, Player, LiveEvent, Standing, resultados genéricos, playerCode
  src/keys.ts                          SHARDS, shardOf, claves SESSION#…
  src/service.ts                       LiveService
  src/activity.ts                      contrato de servidor ActivityServer
  src/token.ts, src/realtime.ts        sin cambios de lógica
  src/client/index.ts                  cliente WebSocket (navegador)
  src/web.ts                           contrato de UI ActivityWeb (solo tipos)
  src/testing/echo-activity.ts         actividad de ejemplo oculta, solo para tests
modules/tiluchi/                       NUEVO @chacota/tiluchi
  src/manifest.ts
  src/content/                         schema, scoring, editing, importers, exporters, repo (tiluchis.ts)
  src/server/                          engine + TiluchiActivity (ActivityServer) + rutas /m/tiluchi
  src/web/                             Host, Play, ResultsDetails, Icon, editor, lista
  messages/es.json, messages/en.json
services/api/                          NUEVO (reemplaza services/game): app Hono, lambda.ts,
                                       local-server.ts, registry.ts, scripts de carga
apps/web/src/
  activities/registry.server.ts        NUEVO
  activities/registry.client.ts        NUEVO
  i18n/request.ts                      mezcla los mensajes de cada módulo
  lib/live.ts                          (reemplaza lib/game.ts)
  app/[locale]/app/orgs/[slug]/        inicio, historial/, admin/, tiluchi/
  app/[locale]/host/[sessionId]/       marco genérico del presentador
  app/[locale]/play/                   marco genérico del celular
infra/lib/game.ts                      entry → services/api/src/lambda.ts
docs/actividades.md                    NUEVO: guía para crear una actividad
```

---

### Task 1: e2e en el repo, contra Tiluchi tal como está hoy

Hoy el e2e es un script en el scratchpad. Hay que traerlo al repo **antes** de tocar nada, para tener la línea base.

**Archivos:**
- Crear: `e2e/package.json` (`@chacota/e2e`, dependencias `playwright-core`, `@aws-sdk/client-cognito-identity-provider`, `@chacota/db`, `tsx`).
- Crear: `e2e/src/login.ts`, `e2e/src/seed.ts`, `e2e/src/game.ts`, `e2e/README.md`.
- Modificar: `package.json` raíz (script `"e2e": "corepack pnpm --filter @chacota/e2e start"`), `.gitignore` (`e2e/out/`).

**Interfaces:**
- Produce: `corepack pnpm e2e`, que sale con código 0 e imprime `ALL PASSED`. Las tareas siguientes lo usan como verificación.

- [ ] **Paso 1: crear la rama.** `git switch -c feat/activities-platform`.
- [ ] **Paso 2: `login.ts`.**
  - Exporta `cognitoCookies(): Promise<{ name: string; value: string }[]>`.
  - Usa `AdminInitiateAuth` con `ADMIN_USER_PASSWORD_AUTH`. Toma de `apps/web/.env.local` el pool y el client (`COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`), y de env `E2E_EMAIL` y `E2E_PASSWORD`.
  - Arma las cookies de Amplify:
    - `CognitoIdentityServiceProvider.<clientId>.LastAuthUser` = sub.
    - `….<sub>.idToken`, `.accessToken`, `.refreshToken`.
    - `….<sub>.clockDrift` = `0`.
- [ ] **Paso 3: `seed.ts`.**
  - Exporta `seed(ownerUserId: string): Promise<{ orgSlug: 'e2e-ug'; tiluchiId: string }>`.
  - Crea la org `e2e-ug` ("E2E User Group", `#0B8048`, activa) si no existe, y el tiluchi "Trivia de prueba" con dos preguntas:
    - q1, quiz de 20 s: "¿Qué servicio es serverless?" con las opciones Lambda (correcta) y EC2.
    - q2, verdadero/falso de 10 s con puntos dobles: "S3 es almacenamiento de objetos", correcta = verdadero.
- [ ] **Paso 4: `game.ts`.** Trae el flujo de `scratchpad/e2e/game.mjs` tal cual:
  - presentador más 3 celulares iPhone 13 (Ana, Beto, Caro), `locale: 'es-BO'`;
  - pregunta 1 con 2 respuestas, revelar y ranking con Ana primera;
  - pregunta 2 con revelado automático y podio;
  - reconexión del celular de Beto;
  - código de 4 letras en el celular de Ana, página de resultados con Ana primera y su código, y CSV con encabezado `Puesto` y el código.
  - Guarda capturas en `e2e/out/`. Las URLs base salen de `E2E_BASE_URL` (por defecto `http://localhost:3000`).
- [ ] **Paso 5: correrlo con los servicios locales levantados** (`dev:services`, `dev:game`, `dev`).
  - Comando: `E2E_EMAIL=… E2E_PASSWORD=… corepack pnpm e2e`.
  - Esperado: 13 líneas `✓` y `ALL PASSED`.
- [ ] **Paso 6: commit** (con aprobación): `test: bring the Chrome e2e game flow into the repo`.

---

### Task 2: paquete `@chacota/tiluchi` con el contenido de Tiluchi

**Archivos:**
- Modificar `pnpm-workspace.yaml`: agregar `modules/*`.
- Crear `modules/tiluchi/package.json` con `exports`:
  - `"."` → `src/index.ts`
  - `"./content"` → `src/content/index.ts`
  - `"./importers"` → `src/content/importers/index.ts`
  - `"./exporters"` → `src/content/exporters/index.ts`
- Mover con `git mv`, sin cambios de lógica:
  - `packages/core/src/{schema,scoring,editing}.ts` y `packages/core/src/{importers,exporters}/` → `modules/tiluchi/src/content/`
  - `packages/db/src/tiluchis.ts` → `modules/tiluchi/src/content/repo.ts`
  - Tests: `packages/core/test/{scoring,editing,importers}.test.ts` → `modules/tiluchi/test/`, y la parte de tiluchis de `packages/db/test/repos.test.ts` → `modules/tiluchi/test/repo.test.ts`.
- Crear `packages/core/src/tables.ts` con `tableToCsv`, `tableToXlsx` y `TableRow`, movidos de `exporters/index.ts`, y el test `packages/core/test/tables.test.ts` (el actual `exporters.test.ts`). Export: `"./tables"`. `exceljs` y `papaparse` quedan como dependencias de los dos paquetes.
- Modificar: `packages/core/src/index.ts`, `packages/db/src/index.ts`, `apps/web/next.config.ts` (`transpilePackages` += `@chacota/tiluchi`), y todos los imports de `apps/web` y `services/game` que usan estos símbolos.

**Interfaces:**
- Produce `@chacota/tiluchi/content`, que exporta:
  - del esquema: `Tiluchi`, `PlayableTiluchi`, `Question`, `TIME_LIMITS`, `LIMITS`;
  - del puntaje: `isAnswerCorrect`, `computePoints`;
  - de la edición: `newQuestion`, `changeType`, `isQuestionValid`, `withFreshIds`, `move`, `newChoice`;
  - del repo: `createTiluchi`, `getTiluchi`, `listTiluchis`, `saveTiluchi`, `deleteTiluchi`, `StoredTiluchi`, `TiluchiSummary`, `MAX_TILUCHI_BYTES`.
- Produce `@chacota/core/tables`: `tableToCsv(rows: TableRow[]): string` y `tableToXlsx(rows: TableRow[], sheetName: string): Promise<ArrayBuffer>`.
- `@chacota/core` deja de exportar todo lo de Tiluchi.

- [ ] **Paso 1:** mover los archivos y los tests con `git mv` y ajustar imports. `@chacota/tiluchi` depende de `@chacota/core` y `@chacota/db`.
- [ ] **Paso 2: agregar el test** `packages/core/test/boundaries.test.ts`. Lee los `.ts` de `packages/core/src` y `packages/db/src` y espera `expect(source).not.toMatch(/tiluchi/i)`, salvo en comentarios. Así la plataforma queda sin rastros de una actividad.
- [ ] **Paso 3: verificar.** `corepack pnpm -r typecheck && corepack pnpm -r test`. Esperado: todo en verde (core 43, db 11, tiluchi, game 17, infra 10, repartidos entre los paquetes nuevos).
- [ ] **Paso 4:** `corepack pnpm e2e`. Esperado: `ALL PASSED`.
- [ ] **Paso 5: commit** (con aprobación): `refactor: move Tiluchi content into @chacota/tiluchi`.

---

### Task 3: actividades y permisos genéricos en la plataforma

**Archivos:**
- Crear: `packages/core/src/activities.ts` y `packages/core/test/activities.test.ts`.
- Modificar: `packages/core/src/org.ts` (acciones) y `packages/core/test/org.test.ts`.
- Modificar: `packages/db/src/orgs.ts` y `packages/db/test/repos.test.ts`.
- Modificar: los usos de `'tiluchi.edit'` y `'game.host'` en `apps/web`.

**Interfaces:**
- Produce en `@chacota/core`:
  ```ts
  export const ACTIVITY_CONTRACT_VERSION = 1;
  export const ActivityId = z.string().regex(/^[a-z][a-z0-9-]{1,30}$/);
  export type ActivityStatus = 'stable' | 'experimental' | 'hidden';
  export interface ActivityManifest {
    id: string; contractVersion: number; status: ActivityStatus;
    usesPhones: boolean; color: string; // HexColor
  }
  export function defaultActivities(all: ActivityManifest[]): string[];          // ids estables
  export function availableActivities(all: ActivityManifest[]): ActivityManifest[]; // sin las ocultas
  export function enabledActivities(org: { activities?: string[] }, all: ActivityManifest[]): ActivityManifest[];
  export function isActivityEnabled(org: { activities?: string[] }, id: string, all: ActivityManifest[]): boolean;
  ```
- `OrgAction`: se reemplaza `'tiluchi.edit'` por `'activity.content'` y `'game.host'` por `'activity.host'`. Los tres roles tienen las dos acciones.
- Produce en `@chacota/db`: `Org.activities?: string[]` y `setOrgActivities(db: Db, orgId: string, activities: string[]): Promise<void>`. Esta última actualiza `updatedAt`.

- [ ] **Paso 1: tests que fallan** en `activities.test.ts`, con tres manifiestos de prueba (a: stable, b: experimental, c: hidden):
  ```ts
  expect(defaultActivities(all)).toEqual(['a']);
  expect(availableActivities(all).map((m) => m.id)).toEqual(['a', 'b']);
  expect(enabledActivities({}, all).map((m) => m.id)).toEqual(['a']);            // org vieja
  expect(enabledActivities({ activities: ['b'] }, all).map((m) => m.id)).toEqual(['b']);
  expect(enabledActivities({ activities: ['c', 'gone'] }, all)).toEqual([]);    // ocultas y desconocidas nunca
  expect(isActivityEnabled({}, 'a', all)).toBe(true);
  ```
  En `org.test.ts`: `can('editor', 'activity.host')` y `can('editor', 'activity.content')` son `true`, y `can('editor', 'org.update')` es `false`.
  En `repos.test.ts`: después de `setOrgActivities(db, org.id, ['a'])`, `getOrg` devuelve `activities: ['a']`.
- [ ] **Paso 2:** correr `corepack pnpm --filter @chacota/core --filter @chacota/db test`. Esperado: FAIL.
- [ ] **Paso 3:** implementar y reemplazar las acciones en `apps/web` (`requireOrgAccess(slug, 'activity.host')`, etc.).
- [ ] **Paso 4:** `corepack pnpm -r typecheck && corepack pnpm -r test && corepack pnpm e2e`. Esperado: verde y `ALL PASSED`.
- [ ] **Paso 5: commit** (con aprobación): `feat: activity manifests, enabled activities and generic roles`.

---

### Task 4: `@chacota/live`, la sesión en vivo genérica

Se crea **al lado** de `services/game`, que todavía no se borra.

**Archivos:**
- Crear `packages/live/package.json`. Exports: `"."` → `src/index.ts`, `"./client"` → `src/client/index.ts`, `"./web"` → `src/web.ts`, `"./testing"` → `src/testing/echo-activity.ts`.
- Copiar desde `services/game/src`: `token.ts` y `realtime.ts` sin cambios, y `client/index.ts` cambiando `GameEvent` por `LiveEvent`.
- Crear: `src/model.ts`, `src/keys.ts`, `src/activity.ts`, `src/service.ts`, `src/web.ts`, `src/testing/echo-activity.ts` e `src/index.ts`.
- Tests: `packages/live/test/service.test.ts` y `packages/live/test/keys.test.ts`. Usan DynamoDB Local, igual que `services/game/test`.

**Interfaces:**
- Produce en `model.ts`:
  ```ts
  export type SessionStatus = 'lobby' | 'running' | 'ended';
  export interface Session<TState = unknown> {
    id: string; pin: string; orgId: string; module: string; title: string; hostUserId: string;
    orgName: string; primaryColor?: string;
    status: SessionStatus; version: number; playerCount: number;
    createdAt: string; endedAt?: string; roomId?: string; // roomId reservado: siempre undefined por ahora
    state: TState;
  }
  export interface Player { id: string; sessionId: string; nickname: string; score: number; joinedAt: number; data?: Record<string, unknown> }
  export interface Standing { nickname: string; score: number }
  export interface RankEntry { rank: number; score: number }
  export type PlatformEvent =
    | { type: 'player_joined'; nickname: string; playerCount: number }
    | { type: 'started'; serverNow: number }
    | { type: 'ended'; podium: Standing[]; ranks: Record<string, RankEntry> };
  export type ModuleEvent = { type: `${string}.${string}`; [key: string]: unknown };
  export type LiveEvent = PlatformEvent | ModuleEvent;
  export interface ResultColumn { key: string; label: { es: string; en: string }; format: 'int' | 'seconds' | 'text' }
  export interface ResultEntry { rank: number; nickname: string; code: string; score: number; extra: Record<string, number | string | null> }
  export interface ModuleResults { columns: ResultColumn[]; extra: Record<string /*playerId*/, ResultEntry['extra']>; details: unknown }
  export interface SessionResultsSummary { sessionId: string; orgId: string; module: string; title: string; hostUserId: string;
    createdAt: string; endedAt: string; playerCount: number; podium: Standing[] }
  export interface SessionResults extends SessionResultsSummary { columns: ResultColumn[]; standings: ResultEntry[]; details: unknown }
  export const channels = { public: (id: string) => `/game/${id}`, host: (id: string) => `/game/${id}/host` };
  export function playerCode(playerId: string): string; // misma implementación y alfabeto que hoy
  export const NICKNAME_MAX = 20;
  ```
- Produce en `keys.ts`:
  - `SHARDS = 10` y `shardOf(value)` (FNV-1a, igual que hoy).
  - `sessionKeys`:
    - `session(id)` → `SESSION#id / META`
    - `pin(pin)` → `PIN#pin / PIN`
    - `playersPk(id, shard)` → `SESSION#id#P{shard}`
    - `player(id, playerId)` y `nickname(id, nick)` → `SESSION#id#N{shard}`
    - `module(id, module, ...parts)` → pk `SESSION#id#<module>#<parts…>`
    - `result(orgId, endedAt, id)` → `ORG#orgId / RESULT#endedAt#id`
    - `resultRows(orgId, id, chunk)` → `ORG#orgId / RESROWS#id#000`
  - En gsi1 se usa `ORGSESSIONS#orgId` / `createdAt`.
  - `LIVE_TTL_SECONDS = 48 * 3600`.
- Produce en `activity.ts`:
  ```ts
  export interface ActivityServer<TContent = unknown, TState = unknown> {
    manifest: ActivityManifest;
    /** Valida el contenido y arma el estado inicial. Lanza LiveError('not_playable'). */
    prepare(content: TContent): { title: string; state: TState };
    /** El presentador avanza. Usa live.transition/live.publish; devuelve la sesión nueva o llama live.end. */
    advance(live: LiveService, session: Session<TState>): Promise<Session<TState>>;
    /** Lo que necesita un cliente que se reconecta (presentador si playerId es undefined). */
    snapshot(live: LiveService, session: Session<TState>, playerId?: string): Promise<Record<string, unknown>>;
    /** Columnas extra y detalle al terminar. */
    results(live: LiveService, session: Session<TState>, players: Player[]): Promise<ModuleResults>;
    /** Acciones del presentador además de avanzar (Tiluchi: contar respuestas). */
    hostActions?: Record<string, (live: LiveService, session: Session<TState>, args: unknown) => Promise<unknown>>;
    /** Rutas de participantes montadas en /m/<id>. */
    routes?(app: Hono, live: LiveService): void;
  }
  ```
- Produce en `service.ts` la clase `LiveService`, con constructor `(db: Db, publisher: Publisher, activities: ActivityServer[], options: { tokenSecret: string; now?: () => number })`:
  - Sesiones:
    - `createSession(input: { orgId, orgName, primaryColor?, hostUserId, module: string, content: unknown }): Promise<Session>`: llama a `prepare` y reintenta PIN con la condición de TTL, igual que hoy.
    - `getSession(id)` y `findSessionIdByPin(pin)`.
    - `advance(id)`: si está en `lobby`, pasa a `running`, publica `started` y delega en el módulo; si está en `running`, solo delega en el módulo; si está en `ended`, lanza `LiveError('session_ended')`.
    - `transition(session, changes: { status?: SessionStatus; state?: unknown; endedAt?: string })`: condición `version = :v`, `SET version = version + 1`. Si la condición falla, lanza `LiveError('invalid_transition')`.
    - `publish(sessionId, event: LiveEvent, channel?)`.
    - `end(id)`: idempotente. Guarda los resultados en partes de 500, igual que hoy, y no guarda nada si no hay jugadores. Publica `ended`.
    - `hostAction(id, name, args)`.
  - Jugadores:
    - `join(pin, nickname): Promise<{ token, player, sessionId, module }>`: misma transacción y `ADD playerCount` fuera de la transacción.
    - `verifyToken(token)`, `getPlayer(sessionId, playerId)` y `listPlayers(sessionId)`.
    - `queryShards<T>(pkOf: (shard: number) => string): Promise<T[]>`.
    - `snapshot(id, playerId?)`: `{ session: { id, title, orgName, primaryColor, status, module }, player?, module: <activity.snapshot>, serverNow }`.
  - Resultados:
    - `listResults(orgId, limit = 100): Promise<SessionResultsSummary[]>`.
    - `getResults(session): Promise<SessionResults | undefined>`.
    - `listUnfinishedSessions(orgId)`: menos de 48 h, `playerCount > 0` y sin terminar.
  - Expone `readonly db`, `readonly now` y `ttl()`.
  - Errores: `LiveError` con los códigos `session_not_found | session_ended | nickname_taken | invalid_nickname | invalid_token | invalid_transition | not_playable | unknown_activity | activity_disabled`. Los módulos lanzan los suyos con su propia clase de error y el código que prefieran.
- Produce en `web.ts` (solo tipos):
  ```ts
  export interface HostScreenProps { sessionId: string; snapshot: Record<string, unknown>; serverNow: number;
    subscribe(listener: (e: LiveEvent) => void): () => void; advance(): Promise<void>;
    hostAction(name: string, args?: unknown): Promise<unknown>; pending: boolean; playerCount: number }
  export interface PlayScreenProps { sessionId: string; playerId: string; token: string; apiUrl: string;
    snapshot: Record<string, unknown>; serverNow: number; subscribe(listener: (e: LiveEvent) => void): () => void;
    setScore(score: number): void }
  export interface ActivityWeb { id: string; Icon: ComponentType<{ size?: number }>; Host: ComponentType<HostScreenProps>;
    Play?: ComponentType<PlayScreenProps>; ResultsDetails?: ComponentType<{ details: unknown }> }
  ```
- Produce en `testing/echo-activity.ts` `echoActivity: ActivityServer<{ rounds: number }, { round: number; rounds: number }>`:
  - manifiesto `{ id: 'echo', status: 'hidden', … }`;
  - cada `advance` suma 1 a `round`, publica `echo.round` y termina al pasar `rounds`;
  - `results` agrega la columna `rounds`;
  - `routes` monta `POST /m/echo/score`, que suma 10 puntos al jugador del token.

- [ ] **Paso 1: tests que fallan** en `packages/live/test/service.test.ts`, todos con `echoActivity`:
  - `'runs a session of any activity'`:
    - crear, unir a Ana y Beto, avanzar hasta el final;
    - `expect(publisher.events.map(e => e.type)).toEqual(['player_joined','player_joined','started','echo.round','echo.round','ended'])` con `rounds: 2`;
    - `getResults` devuelve `module: 'echo'`, `columns[0].key === 'rounds'` y `standings[0].code === playerCode(ana.player.id)`.
  - `'rejects duplicate nicknames regardless of case'`: el mismo de hoy, con `LiveError('nickname_taken')`.
  - `'lets one of two racing advances win'`: `Promise.allSettled([advance, advance])` → exactamente 1 `fulfilled`, y el rechazado es `LiveError('invalid_transition')`.
  - `'lets many players join at once'`: 40 a la vez, cero rechazos y `playerCount` 40.
  - `'stores results of big sessions in chunks'`: 1100 jugadores, `standings.length === 1100` y apodos únicos (timeout 60 s).
  - `'keeps results newest first, skips empty sessions, lists unfinished ones'`: el mismo test de hoy, adaptado.
  - `'refuses unknown activities'`: `createSession({ module: 'nope' })` → `LiveError('unknown_activity')`.
  - `'still lists results whose activity is no longer registered'`: termina una sesión `echo`, crea otro `LiveService` sin actividades y `listResults` la incluye.
  - En `keys.test.ts`: la distribución de `shardOf` es la misma de hoy.
- [ ] **Paso 2:** `corepack pnpm --filter @chacota/live test`. Esperado: FAIL.
- [ ] **Paso 3: implementar** portando la lógica de `services/game/src/service.ts`.
  - La única diferencia de concurrencia: la condición de transición pasa de `status/questionIndex` a `version`.
  - Lo propio de Tiluchi (racha, respuestas, puntaje) **no** entra en `live`.
- [ ] **Paso 4:** `corepack pnpm --filter @chacota/live test && corepack pnpm -r typecheck`. Esperado: PASS.
- [ ] **Paso 5: commit** (con aprobación): `feat: @chacota/live generic live sessions`.

---

### Task 5: Tiluchi como `ActivityServer`

**Archivos:**
- Crear: `modules/tiluchi/src/manifest.ts`, `src/server/engine.ts` (movido de `services/game/src/engine.ts`), `src/server/activity.ts`, `src/server/routes.ts`, `src/server/index.ts` y el export `"./server"`.
- Tests: `modules/tiluchi/test/engine.test.ts` (movido) y `modules/tiluchi/test/activity.test.ts`, que porta `services/game/test/service.test.ts` a la API nueva.

**Interfaces:**
- Consume: `LiveService` y `ActivityServer` (Tarea 4), y `@chacota/tiluchi/content` (Tarea 2).
- Produce:
  - `tiluchiManifest: ActivityManifest = { id: 'tiluchi', contractVersion: 1, status: 'stable', usesPhones: true, color: '#6B2FD6' }`.
  - `tiluchiActivity: ActivityServer<Tiluchi, TiluchiState>`.
  - `TiluchiState = { tiluchiId: string; questions: Question[]; phase: 'lobby' | 'question' | 'reveal' | 'leaderboard'; questionIndex: number; questionStartedAt?: number }`.
  - Constantes: `QUESTION_LEAD_MS = 3000` y `ANSWER_GRACE_MS = 1500`.
  - Eventos:
    - `tiluchi.question` = `{ index, total, question: PublicQuestion, startedAt, serverNow }`
    - `tiluchi.reveal` = `{ index, correct, counts, answered, top, ranks }`
    - `tiluchi.leaderboard` = `{ index, top }`
  - Respuestas: se guardan con `sessionKeys.module(id, 'tiluchi', 'A' + pad(index), shard)`, sk `ANSWER#playerId`.
  - Racha: se guarda en `player.data.streak`.
  - `hostActions.countAnswers(live, session, { index })` devuelve un número.
  - Rutas:
    - `routes`: `POST /m/tiluchi/answer` con Bearer y body `{ questionIndex, value }`.
    - Códigos de error, mapeados como hoy: `not_accepting_answers` 409, `wrong_question` 409, `already_answered` 409, `invalid_answer` 400.
  - `results`:
    - columnas `correct`, `answered` y `avgCorrectTime` (formato `seconds`), con etiquetas es/en iguales a las de hoy;
    - `details = { questionCount, questionsPlayed, questions: QuestionResult[] }`.

- [ ] **Paso 1: tests que fallan** en `activity.test.ts`, portando uno por uno los de hoy:
  - partida completa con los puntajes exactos: Ana 1000 en q1, 1600 en q2 (750 × 2 + 100 de racha) y 2600 en total;
  - `getResults(...).standings[0]` = `{ rank: 1, nickname: 'Ana', code: playerCode(anaId), score: 2600, extra: { correct: 2, answered: 2, avgCorrectTime: 2500 } }`;
  - una sola respuesta por pregunta, dentro de la ventana, con `-500 ms` de tolerancia;
  - tokens falsos;
  - `not_playable` sin preguntas;
  - el JSON de `tiluchi.question` no contiene `correct`.
- [ ] **Paso 2:** `corepack pnpm --filter @chacota/tiluchi test`. Esperado: FAIL.
- [ ] **Paso 3:** implementar portando `services/game/src/service.ts` (`startQuestion`, `reveal`, `showLeaderboard`, `answer`, `resetStreaksOfSilentPlayers`).
- [ ] **Paso 4:** `corepack pnpm --filter @chacota/tiluchi test`. Esperado: PASS.
- [ ] **Paso 5: commit** (con aprobación): `feat: Tiluchi as the first activity module`.

---

### Task 6: `services/api` reemplaza a `services/game`

**Archivos:**
- Crear:
  - `services/api/package.json` (`@chacota/api`);
  - `src/registry.ts`: `export const activities: ActivityServer[] = [tiluchiActivity]`;
  - `src/app.ts`: `createApi(getLive, allowedOrigins)`, con `POST /join`, `GET /state`, `GET /health` y `activity.routes(app.basePath('/m/' + id), live)` para cada actividad;
  - `src/lambda.ts`, `src/local-server.ts` y `scripts/load-test.ts` / `scripts/load-lambda.ts` (movidos y adaptados a `/m/tiluchi/answer`).
- Test: `services/api/test/app.test.ts`.
- Modificar:
  - `infra/lib/game.ts`: entry `services/api/src/lambda.ts`;
  - `infra/lib/load-test.ts`: la ruta al script;
  - `package.json` raíz: `dev:game` → `corepack pnpm --filter @chacota/api dev`;
  - `.github/workflows/ci.yml` si nombra el paquete.
- Borrar: `services/game/` completo. Antes, `apps/web` pasa a usar `@chacota/live` y `@chacota/tiluchi/server` mediante `apps/web/src/lib/live.ts`, que reemplaza a `lib/game.ts` (ver Interfaces).

**Interfaces:**
- Produce en `apps/web/src/lib/live.ts`:
  - `getLive(): LiveService`, con las actividades de `apps/web/src/activities/registry.server.ts` (el mismo `[tiluchiActivity]`);
  - `clientLiveConfig()`, igual que el `clientGameConfig` actual;
  - `requireSessionHost(sessionId): Promise<{ user, session }>`, que usa `activity.host`;
  - `orgForSession(session)`.
- En esta tarea las pantallas de `apps/web` (presentador y celular) siguen siendo las de Tiluchi. Solo se adaptan a los nombres nuevos de eventos (`tiluchi.question`, etc.), a `/m/tiluchi/answer` y al snapshot nuevo. La separación de la UI es la Tarea 7.

- [ ] **Paso 1: tests que fallan** en `app.test.ts`, con Hono `app.request`:
  - `POST /join` con un PIN inválido → 400 `bad_request`;
  - `POST /m/tiluchi/answer` sin token → 401 `invalid_token`;
  - `POST /m/echo/score` existe cuando el registro incluye `echoActivity`;
  - `GET /health` → `{ ok: true }`.
- [ ] **Paso 2:** implementar y mover. `corepack pnpm -r typecheck && corepack pnpm -r test`. Esperado: verde. El test de CDK sigue en 10/10 sin recursos nuevos.
- [ ] **Paso 3:** `corepack pnpm db:init`, reiniciar `dev:game` y `dev`, y correr `corepack pnpm e2e`. Esperado: `ALL PASSED`.
- [ ] **Paso 4: commit** (con aprobación): `refactor: participant API composes activities; remove services/game`.

---

### Task 7: marcos genéricos de presentador, celular e historial

**Archivos:**
- Mover la UI de Tiluchi a `modules/tiluchi/src/web/` (export `"./web"`, `'use client'` donde corresponda):
  - `host.tsx`: la parte "en juego" de `presenter.tsx`, es decir pregunta, revelar y ranking;
  - `play.tsx`: pregunta y revelar de `player.tsx`;
  - `results-details.tsx`: la tabla "Preguntas" de la página de resultados;
  - `icon.tsx`;
  - `index.ts`: `tiluchiWeb: ActivityWeb`.
- Mover a `modules/tiluchi/messages/{es,en}.json` las claves de Tiluchi de los namespaces `host`, `play` y `editor`. Las del marco quedan en `apps/web/messages`: lobby, PIN, unirse, "¡Estás dentro!", podio, "Tu código" y "¡Gracias por jugar!".
- Crear `apps/web/src/activities/registry.client.ts`: `export const activityWebs: Record<string, ActivityWeb> = { tiluchi: tiluchiWeb }`.
- Modificar `apps/web/src/i18n/request.ts`: `messages = { ...base, tiluchi: tiluchiMessages[locale] }`, a partir de una lista de mensajes por módulo en `registry.messages.ts`.
- Mover y renombrar en `apps/web/src/app/[locale]`:
  - `host/[gameId]` → `host/[sessionId]`: marco con lobby, PIN, QR, jugadores, pantalla completa, "Empezar", podio y "Ver resultados". Mientras corre, muestra `<activityWebs[module].Host …/>`.
  - `play/`: marco con unirse, lobby, reconexión, `/state` y pantalla final con el código. Mientras corre, muestra `<Play …/>`.
  - `host/actions.ts`: `advanceSessionAction(id)`, `endSessionAction(id)` y `hostActionAction(id, name, args)`.
  - `app/orgs/[slug]/results/**` → `app/orgs/[slug]/historial/**`.
  - La ruta de export `api/orgs/[slug]/results/[gameId]/export` → `api/orgs/[slug]/historial/[sessionId]/export`. Las columnas salen de `results.columns`, con la etiqueta del locale y el formato `seconds` en segundos con 1 decimal.
- Test: `apps/web/src/lib/results.test.ts` (Vitest; si falta, agregar la config en `apps/web`).

**Interfaces:**
- Consume: `ActivityWeb`, `HostScreenProps` y `PlayScreenProps` (Tarea 4), y `LiveService.snapshot` y `hostAction`.
- Produce `standingsTable(results: SessionResults, locale: 'es' | 'en', t, top?: number): TableRow[]`, con este encabezado:
  ```
  [t('col.rank'), t('col.nickname'), t('col.code'), t('col.score'), ...columns.map(c => c.label[locale])]
  ```

- [ ] **Paso 1: test que falla** en `results.test.ts`:
  - con un `SessionResults` de Tiluchi, `standingsTable(r, 'es', t)` devuelve `['Puesto','Apodo','Código','Puntaje','Correctas','Respondidas','Tiempo prom. de aciertos (s)']` y la fila `[1,'Ana','GCPK',3062,2,2,0.3]`;
  - con `module: 'gone'` y `columns: []`, devuelve solo las 4 columnas de plataforma.
- [ ] **Paso 2:** implementar los marcos y mover la UI. La página de detalle del historial muestra `ResultsDetails` solo si la actividad está registrada. `/host/[sessionId]` de una actividad que no está registrada responde `notFound()`.
- [ ] **Paso 3:** actualizar `e2e/src/game.ts` solo en las URLs que cambian (`/historial/…`). Los textos, los pasos y las verificaciones no se tocan.
- [ ] **Paso 4:** `corepack pnpm -r typecheck && corepack pnpm -r test && (cd apps/web && npx eslint src) && corepack pnpm e2e`. Esperado: todo verde y `ALL PASSED`.
- [ ] **Paso 5: commit** (con aprobación): `refactor: generic presenter, player and history shells`.

---

### Task 8: inicio con actividades, administración aparte y área de Tiluchi

Ver los mockups "Inicio de la organización" y "Organización: administración aparte" en https://claude.ai/artifact/GGyqzYtBDtE9tsTSYjSXLx (fila "Rework").

**Archivos (en `apps/web/src/app/[locale]/app/orgs/[slug]/`):**
- `layout.tsx`: encabezado de la org y navegación **Actividades · Historial y premios · ⚙ Organización**. Organización solo aparece con `org.update`.
- `page.tsx`: el inicio.
  - Una tarjeta por cada actividad de `enabledActivities(org, manifests)`, con su color, `Icon`, nombre y descripción de `messages[<id>].card`, y un link a `./<id>`.
  - La tarjeta "Más actividades" lleva a `./admin/actividades`.
  - "Últimas sesiones" muestra las 5 más recientes de `listResults`, con el nombre de la actividad.
- `tiluchi/page.tsx` (lista y "Nuevo tiluchi") y `tiluchi/[id]/page.tsx` (editor): rutas finas.
  - Hacen la autenticación con `requireOrgAccess` y `requireActivity(org, 'tiluchi')`, cargan los datos y renderizan componentes de `@chacota/tiluchi/web`.
  - Las server actions del editor pasan a `tiluchi/[id]/actions.ts` y llaman al repo de `@chacota/tiluchi/content`.
- `admin/layout.tsx`, con menú lateral: General y branding · Miembros y roles · Actividades · Invitaciones.
  - `admin/page.tsx`: el formulario actual de `settings`.
  - `admin/miembros`: lo actual de `members`, incluidas las invitaciones.
  - `admin/actividades`: checkboxes con `availableActivities`, marcadas según `enabledActivities`. Guarda con `setOrgActivitiesAction`, que exige `org.update`. Incluye un link a `docs/actividades.md` en GitHub.
- Redirecciones en `apps/web/next.config.ts`, permanentes en `redirects()`, con y sin prefijo de locale:
  - `/app/orgs/:slug/tiluchis/:id` → `/app/orgs/:slug/tiluchi/:id`
  - `/app/orgs/:slug/results/:path*` → `/app/orgs/:slug/historial/:path*`
  - `/app/orgs/:slug/settings` → `/app/orgs/:slug/admin`
  - `/app/orgs/:slug/members` → `/app/orgs/:slug/admin/miembros`
- `apps/web/src/lib/activities.ts`: `requireActivity(org, id)`, que llama a `notFound()` si la actividad no está habilitada.
- Iniciar una sesión (`startSessionAction(slug, module, contentId)`) devuelve `{ error: 'activity_disabled' }` si está desactivada. `advance` y `end` **no** lo revisan.
- Mensajes nuevos es/en: `nav.activities`, `nav.history`, `nav.organization`, `hub.*` y `adminNav.*`.

- [ ] **Paso 1: test que falla** en `apps/web/src/lib/activities.test.ts`:
  - `startSessionGuard({ activities: [] }, 'tiluchi', manifests)` → `'activity_disabled'`;
  - `startSessionGuard({}, 'tiluchi', manifests)` → `null`.
  - `startSessionGuard` es la función pura que usa la action.
- [ ] **Paso 2:** implementar las páginas, las redirecciones y la action.
- [ ] **Paso 3: agregar a `e2e/src/game.ts`** dos casos, al final:
  - (a) `GET /app/orgs/e2e-ug/tiluchis/<id>` termina en `/app/orgs/e2e-ug/tiluchi/<id>`;
  - (b) se desactiva Tiluchi en Admin › Actividades durante una partida nueva que ya está en la pregunta 1. El celular de Ana igual puede responder (`¡Respuesta enviada!`), el presentador llega al podio, la tarjeta de Tiluchi ya no aparece en el inicio y el historial sigue mostrando la partida. Después se vuelve a activar.
- [ ] **Paso 4:** `corepack pnpm -r typecheck && corepack pnpm -r test && (cd apps/web && npx eslint src) && corepack pnpm e2e`. Esperado: verde y `ALL PASSED`. Revisar las capturas de `e2e/out/` contra los mockups.
- [ ] **Paso 5: commit** (con aprobación): `feat: activities hub, separate organization admin, Tiluchi area`.

---

### Task 9: guía para la comunidad, despliegue en dev y prueba de carga

**Archivos:**
- Crear `docs/actividades.md`. Usa Tiluchi y `echoActivity` como ejemplos y cubre:
  - la estructura `modules/<id>/`;
  - el manifiesto y los estados `stable`, `experimental` y `hidden`;
  - `ActivityServer` y `ActivityWeb`, campo por campo;
  - las claves permitidas (`sessionKeys.module`, prefijos en gsi1) y la regla de **cero infraestructura nueva**;
  - mensajes es/en;
  - las tres líneas de registro (`services/api/src/registry.ts`, `apps/web/src/activities/registry.server.ts` y `registry.client.ts`, más `registry.messages.ts`) y las rutas finas;
  - qué revisar en el PR.
- Modificar `README.md`: estado (fila "Plataforma de actividades ✅"), estructura del repo, `pnpm dev:game` y un link a la guía.

- [ ] **Paso 1:** escribir la guía y el README.
- [ ] **Paso 2: verificación completa.** `corepack pnpm -r typecheck && corepack pnpm -r test && corepack pnpm e2e`. Esperado: verde y `ALL PASSED`.
- [ ] **Paso 3: desplegar en dev** con la prueba de carga activada, usando el perfil SSO del lead y el shim de pnpm en el PATH:
  ```
  cd infra && npx cdk deploy Chacota-dev -c chacota:stage=dev -c chacota:loadTest=true --outputs-file cdk-outputs.dev.json
  ```
  Esperado: `UPDATE_COMPLETE`.
- [ ] **Paso 4: correr la prueba de carga.** `aws lambda invoke --function-name <LoadTestFunction> --payload '{"role":"orchestrator","players":1000,"questions":3}' --cli-binary-format raw-in-base64-out out.json`. Esperado en `out.json`:
  - `joined: 1000`, `answersStored` ≥ 990 por pregunta (los bots responden al azar dentro de 5 s), `endedDelivered: 1000` y `errors: {}`;
  - `questionFanout.p95` < 1000 y `revealFanout*.p95` < 1500.
  - Actualizar la tabla de resultados del README con los números nuevos.
- [ ] **Paso 5:** volver a desplegar sin `-c chacota:loadTest=true` para sacar las Lambdas de carga. Esperado: `UPDATE_COMPLETE`.
- [ ] **Paso 6: commit** (con aprobación): `docs: guide for building activities; load test after rework`.

---

## Autorrevisión

- **Cobertura de la spec:**
  - capas → Tareas 2, 4, 5 y 6;
  - qué se mueve a dónde → Tareas 2, 4, 5 y 6;
  - sesión en vivo con `roomId` reservado → Tarea 4;
  - resultados genéricos → Tareas 4 y 7;
  - contrato y registro → Tareas 4, 6, 7 y 9;
  - rutas web y redirecciones → Tareas 7 y 8;
  - organización, permisos, desactivar y "Más actividades" → Tareas 3 y 8;
  - API `/m/<id>` → Tareas 5 y 6;
  - guía → Tarea 9;
  - verificación: e2e en la Tarea 1 y en cada tarea, carga en la Tarea 9, CDK sin recursos nuevos en la Tarea 6, y actividad de ejemplo oculta en las Tareas 4 y 6.
- **Consistencia de nombres:**
  - `LiveService`, `ActivityServer`, `ActivityWeb`, `SessionResults`, `ResultColumn`, `enabledActivities` y `sessionKeys.module` se usan igual en todas las tareas;
  - las acciones `activity.content` y `activity.host` son las de la Tarea 3.
