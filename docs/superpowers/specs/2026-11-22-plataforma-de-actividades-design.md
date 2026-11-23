# Chacota como plataforma de actividades

Fecha: 2026-11-22 · Estado: borrador para aprobar

## Por qué

Chacota nació con un solo juego, Tiluchi (quizzes estilo Kahoot), y el código y las pantallas lo reflejan: la página de una organización *es* la lista de tiluchis, y la administración (miembros, branding) convive con las pestañas de Tiluchi. El lead del AWS UG Santa Cruz quiere que Chacota sea una **plataforma abierta de actividades** para meetups y streams: hoy Tiluchi, pronto una **Ruleta** para sortear premios y una **Carrera** en la que el público alienta a su tortuga tocando el celular, y después lo que proponga la comunidad. Es open source: no quiere cerrarle la puerta a ninguna actividad futura.

## Objetivos

1. Separar la **administración de la organización** (datos, branding, miembros, roles, actividades habilitadas) de las **actividades**.
2. Convertir Tiluchi en el **primer módulo** de un sistema de actividades, sin cambiar lo que ve el público al jugar.
3. Extraer lo común de "jugar en vivo" (PIN, unirse, tiempo real, reloj, reconexión, pantalla del presentador, resultados con premios) a una capa reutilizable.
4. Que sumar una actividad nueva sea **un PR con una carpeta nueva** más unas pocas líneas de registro, sin tocar las otras actividades.
5. Dejar la sesión en vivo lista para la **sala opcional** (opción C): las actividades funcionan solas con su PIN y más adelante se podrán encadenar bajo un mismo PIN.

## No objetivos (este trabajo)

- Construir Ruleta, Carrera o la Sala. Son los proyectos siguientes; Ruleta será la primera prueba real del contrato.
- Plugins instalables por npm o cargados en tiempo de ejecución (descartado: Next.js necesita las rutas al compilar y ejecutar código de terceros sin revisar en la cuenta AWS de cada organización es un riesgo).
- Un catálogo/marketplace de actividades de terceros.
- Roles por actividad: los roles siguen siendo de la organización.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que cada actividad nueva sume infraestructura y costo (otra Lambda, otra API de AppSync, otra tabla). Todas comparten **una** API de participantes, **un** AppSync Events y **una** tabla. Presupuesto: ≤ $300/año.
- Que el rendimiento verificado se pierda: 1000 jugadores simultáneos, cero errores, fan-out p95 < 1 s (prueba de carga de `60ad1bb`).
- Que una actividad tenga que importar o modificar código de otra actividad.
- Que el público note el cambio: el flujo de PIN → apodo → jugar → código de verificación queda igual.

## Restricciones

- Stack actual: monorepo pnpm, TypeScript estricto, Next.js 16 (App Router) en Amplify Hosting, Lambda + Hono para participantes, AppSync Events, DynamoDB single-table, CDK. Español por defecto e inglés.
- No hay datos de producción todavía (solo el stack `dev`): **se pueden cambiar claves de DynamoDB sin migración**; los datos de dev se pueden borrar.
- Commits solo con aprobación del lead.

## Enfoques considerados

| Enfoque | Qué implica | Resultado |
|---|---|---|
| **1. Módulos dentro del repo con un registro** | Cada actividad es un paquete `modules/<id>`; un registro central los lista; la sesión en vivo se extrae a un paquete compartido. | **Elegido.** Libertad sin cerrar nada, una sola infraestructura, contribuciones por PR. |
| 2. Plugins npm cargados en runtime | Actividades instalables sin tocar el repo. | Descartado: rutas de Next en compilación, riesgo de seguridad, mucha complejidad. |
| 3. Solo separar pantallas | Inicio con tarjetas y admin aparte, código igual. | Descartado: Ruleta y Carrera empezarían desde cero o copiando código. |

Para cómo entra la gente en un meetup el lead eligió la **opción C, sala opcional**: "la libertad me gusta de poder decidir".

## Diseño

Mockups en el lienzo de diseño (fila "Rework"): https://claude.ai/artifact/GGyqzYtBDtE9tsTSYjSXLx — Inicio de la organización, Administración aparte, Cómo se arma por dentro y la pregunta de la sala.

### Capas

```
Plataforma        packages/core, packages/db        login, organizaciones, miembros, roles, branding,
                                                    superadmin, actividades habilitadas, i18n
Sesión en vivo    packages/live                     sesiones con PIN, jugadores, tokens, tiempo real,
                                                    reloj, reconexión, resultados (top N, código),
                                                    cliente WebSocket, API base de participantes
Actividades       modules/<id>  (ej. modules/tiluchi) contenido propio, reglas en el servidor,
                                                    pantallas de presentador y celular, mensajes es/en
Composición       services/api, apps/web, infra     arman todo a partir del registro de actividades
```

Regla de dependencias: plataforma ← sesión en vivo ← actividades ← composición. Una actividad nunca importa otra actividad.

### Qué se mueve a dónde

- `packages/core`: queda solo lo de plataforma (`org.ts`, `ids.ts`, roles, slug, perfil). El esquema de tiluchis, el puntaje, la edición, importadores y exportadores de Kahoot pasan a `modules/tiluchi`. Los exportadores genéricos de tablas (`tableToCsv`, `tableToXlsx`) quedan en plataforma porque los usa el historial.
- `packages/db`: usuarios, organizaciones, miembros, invitaciones. `tiluchis.ts` (CRUD de tiluchis) pasa a `modules/tiluchi`.
- `services/game` se divide:
  - a `packages/live`: PIN, jugadores y apodos con sharding en 10 particiones, tokens HMAC, publicadores (AppSync, local, memoria), cliente WebSocket, reloj, transiciones protegidas, almacenamiento de resultados en partes, servidor local y broker de desarrollo, scripts de prueba de carga.
  - a `modules/tiluchi`: preguntas, respuestas, puntaje, revelar, ranking, el endpoint de responder.
  - a `services/api`: el handler Lambda que compone el núcleo de `live` con las rutas de cada módulo.

### Sesión en vivo (`packages/live`)

Una **sesión** es una partida de cualquier actividad: `{ id, pin, orgId, module, title, hostUserId, status, playerCount, createdAt, endedAt?, roomId?, state }`.

- `status` genérico: `lobby | running | ended`. Las fases internas de cada actividad (pregunta, revelar, ranking en Tiluchi; girando en Ruleta) viven en `state`, que es del módulo.
- `roomId` queda **reservado y vacío** hasta que exista la sala (opción C). Las claves y tokens se diseñan para que un jugador pueda pertenecer a una sala más adelante sin rehacer el esquema; construir la sala no es parte de este trabajo.
- La sesión en vivo ofrece a los módulos: crear sesión, unirse (genérico), listar jugadores, sumar puntaje, transición condicional de estado, publicar eventos, terminar y guardar resultados.
- Claves: `SESSION#<id>` (antes `GAME#`), `ORGSESSIONS#<orgId>` en gsi1, y las particiones de jugadores, apodos y datos del módulo con el mismo sharding de hoy. Los módulos guardan sus datos de la sesión bajo prefijos propios: `SESSION#<id>#<modulo>#...`.
- Eventos en tiempo real: los de plataforma (`player_joined`, `ended`) y los del módulo con prefijo (`tiluchi.question`, `tiluchi.reveal`…). Canales iguales a hoy (`/game/{id}` y `/game/{id}/host`).

### Resultados genéricos

Al terminar, cada módulo entrega sus resultados en una forma común que guarda la sesión en vivo (bajo la organización, sin TTL, en partes como hoy):

- `standings`: `{ rank, nickname, code, score, extra }`. `extra` son columnas propias de la actividad (Tiluchi: correctas, respondidas, tiempo promedio de aciertos).
- `columns`: cómo mostrar y exportar esas columnas extra (clave, título es/en, formato).
- `details`: datos propios de la actividad para su página de detalle (Tiluchi: estadísticas por pregunta).

El historial, el selector de top N, el aviso de empate, el código de verificación y las descargas Excel/CSV son **de plataforma** y funcionan igual para cualquier actividad. Ruleta podrá guardar sus ganadores en la misma forma (puesto = orden del sorteo).

### Contrato de una actividad

Cada módulo es un paquete `@chacota/<id>` en `modules/<id>/` con:

```
modules/ruleta/
  manifest.ts     id, nombre e ícono, color, si usa celulares, versión del contrato
  server/         reglas: cómo avanza, qué publica, cómo calcula resultados; rutas extra de la API
  content/        lo que se prepara antes de jugar (tiluchis en Tiluchi; listas de premios en Ruleta), si tiene
  host/           pantalla del presentador (componentes React de cliente)
  play/           pantalla del celular (opcional)
  messages/       es.json y en.json
  test/
```

El manifiesto incluye además `estado`: `estable` (aparece y se habilita por defecto en organizaciones nuevas), `experimental` (aparece solo si un admin la habilita) u `oculta` (solo tests). *(Decisión de diseño.)*

Las reglas de presentador (empezar, avanzar, terminar, contar respuestas) **siguen corriendo en Next** como server actions, con la sesión de Cognito, como hoy. El módulo exporta desde `server/` funciones puras de servidor que usan tanto la composición web (presentador) como `services/api` (participantes); el código del módulo se empaqueta en los dos. *(Decisión de diseño: no se mueve la autenticación del presentador a la Lambda.)*

Los módulos **no agregan infraestructura**: ni índices, ni tablas, ni variables de entorno propias. Solo usan prefijos de clave dentro de la tabla única, incluido `gsi1` con prefijos propios (`<MODULO>#...`). Si una actividad algún día necesita algo más, se discute como cambio de plataforma. *(Decisión de diseño; va en `docs/actividades.md`.)*

El registro (`activities.ts` en la composición) es una lista explícita de módulos. Sumar una actividad = el paquete + una línea en el registro del servidor, una en el del cliente y las páginas de contenido bajo su ruta.

### Rutas web

| Ruta | Qué es |
|---|---|
| `/app/orgs/[slug]` | **Inicio**: tarjetas de actividades habilitadas (del registro), "Más actividades" y últimas sesiones de todas |
| `/app/orgs/[slug]/historial` y `/historial/[sesion]` | Historial y premios, genérico |
| `/app/orgs/[slug]/admin/...` | General y branding, Miembros y roles, Actividades habilitadas, Invitaciones |
| `/app/orgs/[slug]/<actividad>/...` | Área de cada actividad (Tiluchi: lista, editor, import/export). En Next son archivos de ruta finos que reexportan las páginas del módulo |
| `/host/[sesion]` | Presentador: el marco (lobby con PIN y QR, branding, pantalla completa, avanzar) es de plataforma; la pantalla de juego la pone el módulo |
| `/play` | Celular: unirse, lobby, reconexión y pantalla final con código son de plataforma; durante el juego manda el módulo |

Las rutas viejas de Tiluchi redirigen a las nuevas mientras haya links guardados en dev (o se descartan: no hay producción).

### Organización y permisos

- `org.activities`: lista de actividades habilitadas. Una organización nueva tiene todas las estables habilitadas; un owner o admin (`org.update`) las activa o desactiva.
- Desactivar una actividad oculta su tarjeta y su área y bloquea sesiones **nuevas**; una sesión en curso termina normalmente y su historial sigue visible. El contenido no se borra. *(Decisión de diseño.)*
- La tarjeta **"Más actividades"** lleva a Admin › Actividades habilitadas, que lista las disponibles (estables y experimentales) para activar, y un link a `docs/actividades.md` para proponer una nueva. *(Decisión de diseño.)*
- Los roles (owner, admin, editor) siguen igual. Las acciones `tiluchi.edit` y `game.host` pasan a ser genéricas: `activity.content` (preparar contenido de cualquier actividad) y `activity.host` (presentar).

### API de participantes (`services/api`)

Una sola Lambda y un solo HTTP API, como hoy:

- Plataforma: `POST /join`, `GET /state`, `GET /health`.
- Módulos: `POST /m/<id>/...` (Tiluchi: `POST /m/tiluchi/answer`). El throttling del HTTP API se mantiene (ráfaga 2000, 1000/s).

### Documentación para la comunidad

`docs/actividades.md`: cómo crear una actividad paso a paso, usando Tiluchi como ejemplo, y qué revisar en el PR.

## Verificación

- Todos los tests actuales siguen pasando (se mueven con su código).
- El test de punta a punta en Chrome (presentador + 3 celulares, partida completa, reconexión, código, resultados y CSV) hoy es un script fuera del repo. **Primer paso del trabajo:** traerlo al repo como `e2e/` (playwright-core con el Chrome instalado) contra Tiluchi tal como está, y correrlo después de cada paso de la migración. "Sin cambios" = mismos textos, pasos y resultados que verifica ese script. *(Decisión de diseño.)*
- La prueba de carga de 1000 jugadores se repite en el stack `dev` de AWS después del rework con los mismos umbrales. El stack `dev` es descartable y ya se despliega en esta etapa; producción no se toca. *(Decisión de diseño.)*
- `infra` no agrega recursos por actividad (test de CDK).
- Una actividad de ejemplo mínima en los tests (no visible) demuestra que el registro, el historial y el presentador funcionan con un módulo que no es Tiluchi.

## Lo que decide quien construye

- Nombres exactos de archivos y tipos, y cómo se reparten los componentes compartidos de UI.
- Si el namespace de AppSync sigue llamándose `game` o pasa a `live`.
- El orden de los pasos de la migración, siempre que cada paso deje tests y e2e en verde.
