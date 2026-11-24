# Crear una actividad para Chacota

Chacota es una plataforma de actividades para meetups y streams. Cada actividad, como Tiluchi (quizzes), una ruleta de premios o una carrera, es una carpeta dentro de `modules/` que se enchufa a la plataforma. Esta guía explica cómo sumar una.

Hay dos ejemplos para mirar mientras leés:

- `modules/tiluchi/`: una actividad completa, con contenido, presentador, celular y resultados.
- `packages/live/src/testing/echo-activity.ts`: la actividad más chica posible, que solo existe para los tests.

## Qué hace la plataforma y qué hace tu actividad

| La plataforma (no la toques) | Tu actividad |
|---|---|
| Login, organizaciones, miembros, roles y branding | Lo que se prepara antes de jugar, si hace falta (Tiluchi tiene sus preguntas) |
| PIN, QR, unirse con apodo, tokens, reconexión | Qué pasa cada vez que el presentador avanza |
| Tiempo real (AppSync Events) y reloj del servidor | Los eventos que se publican mientras corre |
| Lobby, podio, código de verificación de 4 letras | La pantalla del presentador y la del celular mientras corre |
| Historial, top N, aviso de empate, Excel y CSV | Columnas extra de resultados y su detalle |

## Estructura

```
modules/<id>/
  package.json        "@chacota/<id>", con exports "./server", "./web", "./model" y los mensajes
  src/manifest.ts     el manifiesto
  src/server/         reglas (ActivityServer) y rutas de participantes
  src/web/            pantallas (ActivityWeb)
  src/content/        lo que se prepara antes, si tiene
  messages/es.json    textos en español (con voseo), bajo la clave de tu actividad
  messages/en.json    textos en inglés
  test/
```

`<id>` son letras minúsculas, números y guiones, por ejemplo `ruleta`. Ese id se usa en todos lados: la URL (`/app/orgs/<slug>/<id>`), las rutas de la API (`/m/<id>/...`), los eventos (`<id>.algo`) y los mensajes (`<id>.card.name`).

## 1. El manifiesto

```ts
import type { ActivityManifest } from '@chacota/core';

export const ruletaManifest: ActivityManifest = {
  id: 'ruleta',
  contractVersion: 1,
  status: 'experimental',
  usesPhones: false,
  color: '#D63A72',
};
```

`status` acepta tres valores:

- `stable`: aparece y viene activada en las organizaciones nuevas.
- `experimental`: aparece en Organización › Actividades y un admin la activa si quiere. Las actividades nuevas empiezan así.
- `hidden`: no aparece nunca. Sirve para tests o para trabajo en curso.

## 2. El servidor: `ActivityServer`

Está definido en `packages/live/src/activity.ts`.

```ts
export const ruletaActivity: ActivityServer<RuletaContent, RuletaState> = {
  manifest: ruletaManifest,
  prepare(content) { /* valida y arma el estado inicial; si no se puede jugar: throw new LiveError('not_playable') */ },
  async advance(live, session) { /* el presentador avanzó: live.transition(...) + live.publish(...), o live.end(...) */ },
  async snapshot(live, session, playerId) { /* lo que necesita una pantalla que se reconecta */ },
  async finalSnapshot(live, session, playerId) { /* datos finales para Final y PlayFinal, opcional */ },
  async results(live, session, players) { /* columnas extra, valores por jugador y detalle */ },
  hostActions: { /* acciones extra del presentador, opcional */ },
  routes(app, getLive) { /* rutas de celulares bajo /m/<id>, opcional */ },
};
```

Reglas:

- **Estado:** guardá el estado en `session.state` con `live.transition(session, { state })`. La transición falla con `invalid_transition` si otro presentador avanzó primero, así que no hace falta otro bloqueo.
- **Eventos:** llevan el prefijo de tu id, por ejemplo `{ type: 'ruleta.spin', ... }`. Los eventos `player_joined`, `started` y `ended` son de la plataforma.
- **Puntaje:** el puntaje de cada jugador va en `player.score`. `live.addScore` suma puntos; para algo más complejo podés usar una transacción, como hace Tiluchi al responder. Los datos propios de cada jugador van en `player.data`.
- **Tope de jugadores:** si `prepare` devuelve `maxPlayers`, la plataforma no deja entrar a nadie más cuando se llena (`session_full`, "Este juego ya está lleno"). Sin `maxPlayers` no hay tope.
- **Sin celulares:** si `prepare` devuelve `phones: false`, la sesión nace en `running`, nadie puede unirse (`join` responde `session_not_found`) y el presentador no muestra PIN ni QR. Esas sesiones no guardan resultados, así que tampoco hay link "Resultados". Además, su registro vence con los datos en vivo (48 h): pasado ese plazo, la sesión y su pantalla final ya no existen.
- **Datos finales:** `finalSnapshot` es lo que ve `Final` (presentador) y `PlayFinal` (celular) cuando la sesión terminó. Llega como `snapshot().module` en vez de lo que devuelve `snapshot`.
- **Terminar:** llamá a `live.end(session.id)`. La plataforma guarda los resultados, publica `ended` y muestra el podio (o tu `Final`, si la definiste). Las sesiones sin celulares no guardan resultados.
- **Tiempos:** se miden con el reloj del servidor (`live.now()`), nunca con el del celular.

## 3. Datos: cero infraestructura nueva

Todas las actividades comparten una sola tabla de DynamoDB, una sola Lambda y una sola API de AppSync Events. Así el costo se mantiene bajo (el presupuesto del proyecto es de 300 dólares al año como máximo), y por eso **una actividad no agrega tablas, índices, Lambdas ni variables de entorno**.

- Los datos en vivo de una sesión van bajo `sessionKeys.module(sessionId, '<id>', ...partes)`. Si escriben cientos de celulares a la vez, repartilos en particiones con `shardOf(playerId)`, como las respuestas de Tiluchi. Ponele `ttl: live.ttl()` a todo lo que sea en vivo.
- El contenido permanente de la organización va con `pk = ORG#<orgId>` y un `sk` con tu prefijo, por ejemplo `RULETA#<id>`. Tiluchi usa `TILUCHI#<id>`.
- Si necesitás listar algo por otro criterio, usá `gsi1` con un prefijo propio (`<ID>#...`).

Si tu actividad necesita algo que esto no cubre, abrí un issue antes del PR: es un cambio de plataforma.

## 4. Las pantallas: `ActivityWeb`

Está definido en `packages/live/src/web.ts`.

```ts
export const ruletaWeb: ActivityWeb = {
  id: 'ruleta',
  Icon: RuletaIcon,              // SVG, recibe size y color
  Host: RuletaHost,              // presentador mientras corre
  Play: RuletaPlay,              // celular mientras corre; omitilo si no usa celulares
  ResultsDetails: RuletaDetails, // detalle en el historial, opcional
  LobbySummary: RuletaResumen,   // texto bajo el título en el lobby ("12 preguntas · unos 8 minutos"), opcional
  Final: RuletaFinal,            // reemplaza el podio en la pantalla del presentador al terminar, opcional
  PlayFinal: RuletaPlayFinal,    // reemplaza la línea "terminaste en el puesto N" en el celular, opcional
};
```

- **`Host`** recibe `subscribe` (los eventos de tu actividad, incluidos los que llegaron antes de montarse), `advance`, `setAdvanceLabel` (el texto del botón principal), `setAdvanceDisabled(true)` (deshabilita el botón principal y también la barra espaciadora, la flecha y el clicker mientras tu actividad está ocupada, por ejemplo en una animación; también bloquea las llamadas a `advance()` de tu propia actividad), `setSubtitle` (el progreso que se muestra junto al título, por ejemplo "Pregunta 2 de 10"), `hostAction` y `clock`. Para imágenes: `mediaUrl(key)` da la URL pública de una clave de S3 (guardá claves, nunca URLs) y `setBackground(key | null)` pone una imagen detrás de toda la pantalla, con un velo oscuro, por ejemplo `useEffect(() => setBackground(ronda.fondo ?? null), [ronda])`. El lobby, el podio, el botón "Terminar" y la pantalla completa son de la plataforma.
- **`Play`** recibe `token` y `apiUrl` para llamar a tus rutas (`${apiUrl}/m/<id>/...`), `subscribe`, `clock` y `setScore`. Unirse, el lobby, la reconexión y la pantalla final con el código son de la plataforma.
- **`Final` y `PlayFinal`:** sin ellos, al terminar la plataforma muestra el podio y el puesto de cada jugador. Con `Final`, el presentador ve tu pantalla en lugar del podio; con `PlayFinal`, el celular ve la tuya en lugar del puesto, y el código de verificación sigue abajo. Los dos reciben lo que devuelve `finalSnapshot`; `PlayFinal` recibe además el `playerId`, y `finalSnapshot` recibe el `playerId` solo cuando lo pide un celular.
- **Estilos:** usá las clases de Tailwind y los colores de la marca (`bg-noche`, `bg-morado`, `bg-verde`, `bg-tajibo`, `bg-sol`, `text-niebla`). Tailwind lee `modules/*/src`, así que tus clases funcionan.
- **Accesibilidad:** los botones son `<button>` y las respuestas no dependen solo del color.

## 5. Textos

Los mensajes de `messages/es.json` y `messages/en.json` quedan bajo la clave de tu actividad. En los componentes se usan con `useTranslations('<id>.host')` y similares. La tarjeta del inicio necesita dos claves:

```json
{ "card": { "name": "Ruleta", "description": "Sorteo de premios en la pantalla grande" } }
```

## 6. Registrarla

Cada registro es una línea:

| Archivo | Qué agregar |
|---|---|
| `services/api/src/registry.ts` | la actividad del servidor, para las rutas de celulares |
| `apps/web/src/activities/registry.server.ts` | la actividad del servidor, para el presentador |
| `apps/web/src/activities/registry.client.ts` | las pantallas |
| `apps/web/src/activities/registry.messages.ts` | los mensajes es/en |

Agregá también `@chacota/<id>` en `transpilePackages` de `apps/web/next.config.ts` y en las dependencias de `apps/web` y `services/api`.

Por último, sumá las páginas de contenido, si tu actividad las tiene. Van en `apps/web/src/app/[locale]/app/orgs/[slug]/<id>/`. Usá `requireOrgAccess(slug, 'activity.content')` y `requireActivity(org, '<id>')`, y mirá `.../tiluchi/` como ejemplo. Para empezar una sesión: `getLive().createSession({ module: '<id>', content, ... })`, después de revisar `startSessionGuard`.

## 7. Qué revisamos en el PR

- [ ] La actividad no importa código de otra actividad.
- [ ] No agrega infraestructura y sus claves usan su prefijo.
- [ ] Las reglas corren en el servidor: el celular nunca decide puntajes ni tiempos.
- [ ] Tests con DynamoDB Local para `prepare`, `advance` y `results`, al menos una partida completa, como `modules/tiluchi/test/activity.test.ts`.
- [ ] Textos en español y en inglés.
- [ ] Empieza como `experimental`.
- [ ] `pnpm test`, `pnpm typecheck` y `pnpm e2e` pasan.
