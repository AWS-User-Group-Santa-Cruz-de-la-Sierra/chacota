# Marca de la organización e imágenes en Tiluchi

Fecha: 2026-11-23 · Estado: aprobado · Maquetas: lienzo "Chacota — identidad visual", fila "Tiluchi con identidad propia · marca de la org · imágenes" (https://claude.ai/artifact/GGyqzYtBDtE9tsTSYjSXLx)

## Por qué

Hoy una organización solo elige un color, y ese color casi no se ve: pinta un cuadrito en el hub y el ícono del encabezado del presentador. El lead quiere que, cuando una comunidad usa Chacota en su meetup, **la pantalla proyectada se sienta de esa comunidad** (su logo y su color) y que **se note que lo que se juega es un Tiluchi**. Hoy el pajarito amarillo es a la vez el logo de Chacota y el ícono de Tiluchi, así que Tiluchi no tiene identidad propia. Además, poder poner **imágenes y fondos** en las preguntas mejora mucho la experiencia.

## Objetivos

1. La organización sube su **logo** desde su administración. Se ve en la **pantalla proyectada**: en el lobby ("<org> presenta") y en chico arriba mientras corre la actividad.
2. El **color de la org** pasa a tener uso real en la pantalla proyectada: pinta el panel de la org en el lobby y una franja arriba mientras corre la actividad.
3. Tiluchi tiene **logo propio**: el hornero con el "?" en el ala sobre su horno de barro (archivo que dio el lead). Su color de actividad pasa a ser el del hornero. Chacota se queda con su pajarito amarillo en morado.
4. En Tiluchi, **todo opcional**:
   - **fondo del cuestionario**: se usa en todas las preguntas;
   - **fondo por pregunta**: reemplaza al del cuestionario solo en esa pregunta;
   - **imagen por pregunta**: se muestra junto a la pregunta.
   Si una pregunta tiene fondo e imagen, se ven los dos.
5. En desarrollo local, S3 se emula con el **emulador oficial de AWS** (AWS Emulator), igual que hoy DynamoDB usa DynamoDB Local. Cuanto más emulado, menos costo y setup de desarrollo.

## No objetivos

- Imágenes, logo o fondos en los **celulares**: la pantalla del participante no cambia.
- Exportar/importar imágenes en los formatos de Kahoot (xlsx/CSV): siguen siendo solo texto.
- Borrar archivos huérfanos (imágenes reemplazadas o subidas y nunca guardadas). El costo es despreciable; se puede sumar después.
- Una versión simplificada del hornero en SVG para tamaños chicos (queda como seguimiento; ver "Logo de Tiluchi").
- Una marca nueva para Chacota: se queda con la actual.
- Mostrar el logo de la org en el hub o en el resto de la app web.
- GIFs animados o video.

## Anti-objetivos

- Que el costo suba de forma notable. Las imágenes solo las baja la pantalla proyectada (una por sesión), nunca los 1000 celulares. Presupuesto: ≤ $300/año.
- Abrir el bucket al público.
- Que el lobby o la pregunta queden ilegibles con un color de org claro o con un fondo cargado.
- Que el color de la org cambie los colores de las respuestas (luna, hoja, tajibo, sol): tienen que seguir distinguiéndose.
- Que una imagen que falta (por ejemplo, tras reiniciar el emulador) rompa la pantalla.
- Que el código de plataforma mencione a Tiluchi (`packages/core/test/boundaries.test.ts`).

## Restricciones

- Lo que ya existe: bucket `Media` privado (`BLOCK_ALL`, SSE-S3, CORS para `PUT` desde los orígenes de la app, regla que borra `tmp/` al día). El campo `Org.logoKey` en `packages/db/src/orgs.ts` existe pero nadie lo escribe. Tiluchi tiene `imageUrl` por pregunta y `coverImageUrl` en el esquema; el servidor manda `imageUrl` en `PublicQuestion`, pero nadie lo setea ni lo muestra.
- No hay datos de producción: los campos de imagen se pueden renombrar sin migración.
- Las actividades no agregan infraestructura ni variables de entorno; lo nuevo de medios es de plataforma.
- No hay nada desplegado todavía: todo se desarrolla en local. Cuando se despliegue, la web va a correr en Amplify Hosting (SSR). Para no sumar costo de optimización de imágenes, se usa `<img>` común, no `next/image`.
- Commits solo con aprobación del lead.

## Enfoques considerados

**Cómo se sirven las imágenes en producción** (el bucket es privado):

| Enfoque | Qué implica | Resultado |
|---|---|---|
| **A · CloudFront delante del bucket** (OAC) | URL fija y cacheable por imagen; el bucket sigue cerrado; nivel gratis de CloudFront (1 TB/mes) → costo esperado $0. En local, la misma variable de base de URL apunta al emulador. | **Elegido por el lead.** |
| B · URL firmadas al mostrar | Sin infraestructura nueva, pero las URL vencen, la imagen viaja en eventos del Lambda de participantes (habría que firmar en dos lugares y renovar en sesiones largas) y el caché del navegador rinde menos. | Descartado. |
| C · Bucket público | Rompe `BLOCK_ALL`. | Descartado sin más. |

**Emulador local de S3:** el lead pidió usar los emuladores oficiales de Amazon. AWS Emulator (oficial, gratis, lanzado el 2026-11-11) incluye S3. Las alternativas quedaron fuera: MinIO dejó de publicar imágenes Docker (oct-2025) y LocalStack ahora pide cuenta y token. Según las reseñas, el emulador guarda el estado solo en memoria, no evalúa IAM y su S3 pasa más o menos 2 de cada 3 pruebas de fidelidad: por eso el plan arranca con una prueba (ver "Desarrollo local").

## Diseño

### Medios (plataforma)

- **Claves, no URLs.** El contenido guarda **claves** de S3 y nunca URLs absolutas. La URL se arma al mostrar: `MEDIA_PUBLIC_URL + '/' + key`. Así funciona igual en local y en producción, y si cambia el dominio no hay que migrar nada.
- **Formato de clave:** `orgs/<orgId>/media/<uuid>.<ext>`. Cada clave es inmutable (un archivo nuevo es una clave nueva), así que se puede cachear para siempre.
- **Subida:**
  1. El navegador achica la imagen antes de subirla. Lado mayor: 1920 px para fondos e imágenes y 512 px para logos. El resultado es WebP si el navegador sabe codificarlo y, si no, PNG cuando hay transparencia o JPEG cuando no la hay.
  2. Una server action (`requireOrgAccess`) firma un `PUT` directo a la clave final, firmando también `Content-Type` y `Content-Length`. Tope: 2 MB después de achicar; tipos permitidos: `image/webp`, `image/png`, `image/jpeg`.
  3. El navegador sube con esa URL.
  4. Al guardar (org o tiluchi), el servidor valida que cada clave empiece con `orgs/<orgId>/`, es decir, que sea de esa org.
- **Sin `tmp/` en esta versión (decisión del diseñador).** Se sube directo a la clave final y se aceptan huérfanos. Los costos: unos centavos al año en el peor caso. La regla de `tmp/` queda en el bucket por si se usa después.
- **Dónde vive el código:** la firma y la validación van en `apps/web/src/lib/media.ts`, porque solo la web sube archivos. El Lambda de participantes no toca S3. La resolución de clave a URL (`mediaUrl(key)`) es una función pura, que se puede poner en `@chacota/live/client` o en la web.
- **SVG:** no se suben. Si alguien elige un SVG, el navegador lo convierte a imagen al achicarlo. Así se evita servir scripts dentro de SVGs.
- **Imagen que falta:** `<img onError>` la oculta, la pantalla sigue y el fondo cae al color normal.

### Infraestructura (CDK)

- En `ChacotaData`: una `cloudfront.Distribution` con origen `S3BucketOrigin.withOriginAccessControl(mediaBucket)`.
  - Política de caché optimizada para caché.
  - Solo `GET`/`HEAD`, HTTPS.
  - `PriceClass_100`.
  - Dominio por defecto `*.cloudfront.net`: no hace falta certificado.
  - Se puede restringir a `orgs/*`; el resto puede negar acceso.
- Nuevo output `MediaUrl` (`https://<dist>.cloudfront.net`).
- **La app todavía no está desplegada:** se desarrolla en local y el hosting de la web en Amplify aún no existe. Por eso el CDK crea una política administrada para el servidor de la web (`WebServerPolicy`) y saca su ARN como output. La política da `s3:PutObject` sobre `orgs/*` del bucket de medios. Si conviene, también puede juntar los permisos de DynamoDB que la web ya necesita. Quien arme el hosting en Amplify (es otro proyecto) solo tiene que adjuntarla al rol de cómputo. En local, la web firma con las credenciales del emulador.
- Variable nueva de la web: `MEDIA_PUBLIC_URL`. También `MEDIA_BUCKET` si no existe, y en local `S3_ENDPOINT`. Van en `apps/web/.env.example` y `apps/web/src/lib/env.ts`.

### Desarrollo local

- **Primer paso del plan, una prueba corta y descartable:** levantar AWS Emulator en `compose.yaml` y comprobar cuatro cosas:
  1. crear el bucket;
  2. `PUT` con URL firmada desde el navegador (CORS);
  3. `GET` anónimo de un objeto desde el navegador;
  4. que el SDK funcione con `forcePathStyle`.
- **Si todo anda:**
  - `compose.yaml` suma el servicio del emulador. Hay que confirmar el nombre de imagen y el puerto en la documentación de AWS; las reseñas mencionan el `2772`.
  - Un script `pnpm media:init` crea el bucket local, igual que `pnpm db:init`.
  - En local, `MEDIA_PUBLIC_URL` apunta al emulador con estilo de ruta (`http://localhost:<puerto>/<bucket>`).
- **Fallbacks si algo no anda:**
  - **`GET` anónimo:** el servidor local (`services/api/src/local-server.ts`) suma una ruta que lee del emulador y sirve el archivo. `MEDIA_PUBLIC_URL` apunta a esa ruta.
  - **CORS del `PUT`:** en local la subida pasa por una server action que recibe el archivo y lo escribe con el SDK. La interfaz del uploader no cambia.
- Se actualizan `CLAUDE.md` (comandos) y el README.
- **Tests:**
  - La lógica de medios (validación de clave, armado de URL, tope de tamaño) se prueba sin S3.
  - La firma se prueba contra un cliente S3 falso.
  - La CI no necesita el emulador.

### Organización

- **Datos:** `Org.logoKey`, que ya existe. `updateOrg` ya lo acepta. Hay que permitir **quitarlo**: hoy `updateOrg` ignora los `undefined`, así que falta un `REMOVE`.
- **Formulario de la org** (`/app/orgs/[slug]/admin`, `org-form.tsx`):
  - un campo "Logo" con vista previa, "Cambiar" y "Quitar";
  - recomendación: PNG con fondo transparente;
  - el selector de color sigue igual, con un texto que explica dónde se usa (lobby y franja de la pantalla proyectada).
- **Sesión:** `createSession` copia `logoKey` a la sesión, igual que ya hace con `orgName` y `primaryColor`. El presentador lo lee de la sesión, así que un cambio de logo no afecta a una sesión que ya está corriendo.

### Pantalla del presentador (plataforma, `host/[sessionId]`)

Basado en las maquetas `Lobby`, `PreguntaImagen` y `PreguntaFondo`.

- **Lobby:**
  - **Panel izquierdo** con fondo del color de la org: arriba el logo de la org (si no hay, el nombre en grande) y la línea "<org> presenta"; abajo el logo y el nombre de la actividad (`activity.Icon` + nombre) y el título.
  - **Lado derecho** en noche: QR, PIN y jugadores, igual que hoy.
- **Mientras corre:**
  - franja de 8 px del color de la org arriba de todo;
  - en el encabezado, el logo de la org en chico (si no hay, el nombre) con el título y el subtítulo;
  - el ícono de la actividad a la derecha, junto al PIN.
- **Contraste:** el texto sobre el color de la org es blanco (`#FFFFFF`) o negro (`#000000`), el que dé más contraste. Con uno de los dos siempre se llega al menos a 4.58:1. Con noche no alcanza: en colores intermedios queda en ~4.3:1. El color de la org se muestra tal cual lo eligieron.
- **Fondo:** detrás de todo el marco, a pantalla completa, cuando la actividad lo pide. Lleva un velo noche con opacidad fija de 0.72 (decisión del diseñador; se puede ajustar). Encima van el encabezado y el contenido.
- **Podio:** sin cambios.
- **Contrato nuevo en `HostScreenProps`** (`packages/live/src/web.ts`), genérico y sin nada de Tiluchi:
  - `setBackground(key: string | null)`: la actividad pide fondo, o ninguno; el marco lo resuelve y lo dibuja;
  - `mediaUrl(key: string): string`: para que la actividad muestre sus propias imágenes.
- Se documenta en `docs/actividades.md`.

### Tiluchi

- **Esquema** (`modules/tiluchi/src/content/schema.ts`):
  - pregunta: `imageUrl` → `imageKey?` y nuevo `backgroundKey?`;
  - cuestionario: nuevo `backgroundKey?`;
  - `coverImageUrl` queda como está (fuera de alcance);
  - `changeType` y `copyOf` conservan las claves (las copias comparten archivos, lo que es correcto porque no se borran).
- **Al guardar:** la server action valida que las claves sean de la org.
- **Export/import JSON propio** (`exporters/index.ts`, `importers/json.ts`): el export incluye `imageKey`, `backgroundKey` y el `backgroundKey` del cuestionario. Al importar, las claves que no empiezan con `orgs/<orgId>/` de la org destino se descartan y el importador avisa cuántas imágenes se quitaron. Nunca se referencian archivos de otra org. `copyOf` solo copia dentro de la misma org, así que conserva las claves.
- **Servidor:** `PublicQuestion` lleva `imageKey` y `backgroundKey` efectivos (el de la pregunta, o si no el del cuestionario). Como el snapshot del presentador ya trae `questions`, la pantalla puede resolverlos sin pedir nada más. Los celulares reciben las claves y las ignoran.
- **Editor** (`/app/orgs/[slug]/tiluchi/[id]`, `editor.tsx`):
  - en los datos del cuestionario, "Fondo (todas las preguntas)";
  - en cada pregunta, "Imagen" y "Fondo de esta pregunta";
  - todos con vista previa chica, "Cambiar" y "Quitar";
  - el fondo de la pregunta indica cuando hereda el del cuestionario.
- **Host** (`modules/tiluchi/src/web/host.tsx`):
  - **pregunta con imagen:** imagen a la izquierda (~40 % del ancho, `object-fit: contain`), con contador, tiempo y enunciado a la derecha, y las respuestas abajo;
  - **pregunta sin imagen:** como hoy;
  - **revelado:** mantiene la imagen;
  - **ranking:** sin imagen;
  - **fondo:** con `setBackground` al entrar a cada pregunta, se mantiene durante el revelado y el ranking de esa pregunta;
  - **"Preparate":** usa el fondo de la pregunta que viene.
- **Play (celular):** sin cambios.

### Logo de Tiluchi

- **Archivo:** el lead dio el PNG del hornero (1254×1254, con transparencia). El original está en `docs/superpowers/specs/assets/tiluchi-hornero.png`.
  - Es la versión que el lead dejó en Descargas (`tiluchi.png`). Abajo puede quedar algo del borde rojizo que dejó quitarle el fondo. Se nota sobre fondos claros; si molesta, se limpia al generar los tamaños de 512 y 128 px.
  - Se guarda en el módulo, por ejemplo `modules/tiluchi/src/web/assets/tiluchi.png`, en versiones de 512 y 128 px.
- **Componente:** `TiluchiIcon` pasa a mostrar el PNG e ignora `color`. Hay que verificar que Next/Turbopack resuelve una importación estática de imagen desde un paquete en `transpilePackages`. Si no, se sirve como dato inline o desde el módulo de otra forma, nunca desde `apps/web/public`, porque eso rompe el límite de capas.
- **Logo de Chacota:** `TiluchiMark` y `Logo` en `apps/web/src/components/logo.tsx` siguen con el pajarito amarillo. El nombre `TiluchiMark` pasa a `ChacotaMark`, para que el código de plataforma no mencione a Tiluchi.
- **Color de la actividad:** `tiluchiManifest.color` cambia del morado al tono del ala del hornero (≈ `#C4561F`), oscurecido hasta que el texto blanco cumpla 4.5:1. Este color pinta la tarjeta en el hub.
- **Tamaños:** por debajo de ~40 px el "?" del ala casi no se ve. En esta versión el PNG se usa a 44 px o más (encabezado del presentador: 44 px; tarjeta del hub: 52 px); la versión simplificada en SVG queda como seguimiento.

## Lo que decidió el lead

- El logo de la org es solo para la presentación (pantalla proyectada).
- El logo de Tiluchi es el hornero que dio el lead.
- Fondos: del cuestionario y por pregunta, más una imagen por pregunta, todo opcional.
- En local se usan los emuladores oficiales de Amazon.
- Las imágenes se sirven con CloudFront (enfoque A).

## Lo que decidió el diseñador (se puede revisar)

- Claves en vez de URLs; subida directa a la clave final, sin `tmp/`, aceptando huérfanos.
- Achicar en el navegador (1920 px y 512 px), tope de 2 MB, sin SVG.
- Velo del fondo en 0.72; el texto sobre el color de la org es blanco o negro, el que dé más contraste.
- En el import JSON se descartan, con aviso, las claves de otras orgs.
- Como todavía no hay hosting, el CDK solo crea la política `WebServerPolicy`; adjuntarla al rol de Amplify queda para cuando se arme el hosting.
- La imagen se ve en la pregunta y en el revelado, no en el ranking.
- `TiluchiMark` pasa a llamarse `ChacotaMark`.
- Color de Tiluchi basado en el ala del hornero.
- Sin cambios en el celular, el hub ni el podio.

## Para quien construye

- Nombre de imagen y puerto de AWS Emulator, y cuál fallback hace falta según la prueba.
- Textos en `es` y `en` (`orgAdmin.*` para el formulario de la org, `tiluchi.editor.*` para el editor y `host.*` para el marco).
- Diseño fino de los selectores de imagen, siguiendo los componentes de `apps/web/src/components/ui`.
