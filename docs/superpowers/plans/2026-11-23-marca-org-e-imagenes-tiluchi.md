# Marca de la org e imágenes en Tiluchi — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La pantalla proyectada muestra el logo y el color de la org. Tiluchi tiene logo propio (el hornero) y admite fondo de cuestionario, fondo por pregunta e imagen por pregunta, todo opcional. Las imágenes viven en S3: se sirven con CloudFront en la nube y con AWS Emulator en local.

**Architecture:**
- El contenido guarda **claves** de S3 (`orgs/<orgId>/media/<uuid>.<ext>`) y nunca URLs. La URL se arma al mostrar con `MEDIA_PUBLIC_URL`.
- El navegador achica la imagen, pide a una server action un `PUT` firmado y sube directo.
- El marco del presentador (plataforma) dibuja el logo, el color y el fondo. La actividad pide el fondo con `setBackground(key)` y resuelve sus imágenes con `mediaUrl(key)`, dos props nuevas de `HostScreenProps`.

**Tech Stack:** pnpm monorepo, TypeScript, Next.js 16, Vitest, AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`), CDK (`aws-cloudfront`, `aws-cloudfront-origins`), AWS Emulator y DynamoDB Local con Podman/Docker.

**Spec:** `docs/superpowers/specs/2026-11-23-marca-org-e-imagenes-tiluchi-design.md`. Las maquetas están en el lienzo https://claude.ai/artifact/GGyqzYtBDtE9tsTSYjSXLx (fila "Tiluchi con identidad propia").

## Global Constraints

- Imports entre paquetes del workspace **sin** `.js`; `infra` usa `.js`.
- `packages/core` y `packages/db` no mencionan "tiluchi" (lo exige `packages/core/test/boundaries.test.ts`).
- Las actividades no agregan infraestructura ni variables de entorno.
- **Tipos permitidos:** `image/webp`, `image/png`, `image/jpeg`. Tope de 2 MB (`2 * 1024 * 1024`) después de achicar. No se suben SVG.
- **Lado mayor al achicar:** 1920 px para fondos e imágenes y 512 px para logos.
- **Formato de clave:** `orgs/<orgId>/media/<uuid>.<ext>`, con `ext` `webp`, `png` o `jpg`.
- **Fondo:** velo noche (`#1A0E2E`) con opacidad 0.72.
- **Texto sobre el color de la org:** `#FFFFFF` o `#000000`, el que dé más contraste.
- **Celulares, hub y podio:** sin cambios. Las imágenes usan `<img>` común, no `next/image`.
- **Textos de la UI:** español con voseo y su versión en inglés, en `apps/web/messages/{es,en}.json` (`orgForm.*`, `host.*`) y `modules/tiluchi/messages/{es,en}.json` (`tiluchi.*` y `editor.*`, donde ya vivan las claves del editor).
- **Commits:** uno por tarea. Nunca `.claude/` ni `.env*` (salvo `.env.example`). Cada mensaje termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Color de org claro o intermedio** (`#FFFF00`, `#808080`, `#6B2FD6`): el texto encima tiene que llegar a 4.5:1. Lo cubre la Tarea 2 (`readableTextColor`).
2. **Clave de otra org o con trucos** (`orgs/<otra>/…`, `orgs/<id>x/…`, `orgs/<id>/media/../x`, `tmp/…`): se rechaza al guardar y se descarta al importar. Lo cubren la Tarea 2 (`isOrgMediaKey`) y la Tarea 8.
3. **Subida inválida** (SVG, 0 bytes, más de 2 MB, tipo vacío): se rechaza al firmar, sin URL. Lo cubre la Tarea 3 (`checkUpload`).
4. **Herencia de fondos:** pregunta sin fondo → usa el del cuestionario; pregunta con fondo propio → gana el suyo; sin ninguno → ninguno. Lo cubre la Tarea 8 (`publicQuestion`).
5. **Quitar el logo** (campo vacío al guardar): el atributo `logoKey` desaparece de DynamoDB, no queda en `""`. Lo cubre la Tarea 5 (`updateOrg` con `null`).

---

### Task 1: AWS Emulator en local (S3)

Prueba y setup juntos. El resultado decide qué fallback hace falta (spec, "Desarrollo local").

**Files:**
- Modify: `compose.yaml`, `package.json` (root), `apps/web/.env.example`, `CLAUDE.md`, `README.md`
- Create: `apps/web/scripts/create-local-bucket.ts`
- Modify: `apps/web/package.json` (script `media:init`, devDeps `tsx`; deps `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)

**Interfaces:**
- Produces:
  - variables `S3_ENDPOINT` (local), `MEDIA_BUCKET`, `MEDIA_PUBLIC_URL`;
  - bucket local `chacota-media-local`;
  - script `pnpm media:init`;
  - una nota en `CLAUDE.md` que dice qué fallback se aplicó, si hizo falta alguno.

- [ ] **Step 1:** Buscar en la documentación oficial de AWS Emulator (anuncio del 2026-11-11, README del repo de AWS) la imagen de contenedor, el puerto y cómo se habilita S3. Anotar la URL de la fuente en el commit.
- [ ] **Step 2:** Agregar el servicio `aws-emulator` a `compose.yaml`, con imagen fijada a una versión y el puerto publicado. Correr `pnpm dev:services`. Esperado: el contenedor queda `Up`.
- [ ] **Step 3:** Escribir `create-local-bucket.ts` siguiendo el patrón de `packages/db/scripts/create-local-table.ts`:
  - endpoint `S3_ENDPOINT` (por defecto `http://localhost:<puerto>`), `forcePathStyle: true`, credenciales `local`/`local`;
  - crea `MEDIA_BUCKET` (por defecto `chacota-media-local`) si no existe;
  - `PutBucketCors`: `PUT` y `GET` desde `http://localhost:3000`, header `content-type`.

  Root: `"media:init": "pnpm --filter @chacota/web media:init"`. Correr `pnpm media:init`. Esperado: `Bucket chacota-media-local ready at http://localhost:<puerto>`.
- [ ] **Step 4:** Probar los cuatro puntos con un script descartable en el scratchpad, sin commitearlo:
  - (a) `getSignedUrl(PutObjectCommand{ContentType:'image/png', ContentLength:n})` y luego `curl -X PUT -H 'content-type: image/png' --data-binary @x.png <url>` → 200;
  - (b) `curl -i -X OPTIONS -H 'Origin: http://localhost:3000' -H 'Access-Control-Request-Method: PUT' <url>` → la respuesta trae `Access-Control-Allow-Origin`;
  - (c) `curl -i http://localhost:<puerto>/chacota-media-local/<key>` sin firma → 200 con `content-type: image/png`;
  - (d) `curl -i -H 'Origin: http://localhost:3000' <mismo GET>` → no lo bloquea CORS. Basta con que `<img>` lo cargue, porque `<img>` no necesita CORS.
- [ ] **Step 5:** Aplicar el fallback que corresponda según el resultado:
  - **Si falla (c):** sumar a `services/api/src/local-server.ts` la ruta `GET /media/*`, que lee del emulador con el SDK y responde con el `ContentType` del objeto. En local, `MEDIA_PUBLIC_URL=http://localhost:4000/media`.
  - **Si fallan (a) o (b):** registrar `MEDIA_UPLOAD_MODE=proxy` para que la Tarea 3 suba a través de la server action.
  - **Si todo anda:** `MEDIA_PUBLIC_URL=http://localhost:<puerto>/chacota-media-local`.
- [ ] **Step 6:** Actualizar la documentación:
  - `apps/web/.env.example`: bloque "Medios (AWS Emulator)" con `S3_ENDPOINT`, `MEDIA_BUCKET` y `MEDIA_PUBLIC_URL`, más los valores de nube (`MediaBucketName` y `MediaUrl` de cdk-outputs, sin `S3_ENDPOINT`);
  - `CLAUDE.md` (Commands): `pnpm media:init` después de `pnpm db:init`, con una línea sobre el emulador (estado en memoria: hay que repetir `media:init` después de reiniciarlo);
  - `README.md`: lo mismo.
- [ ] **Step 7: Commit** `chore(dev): emulate S3 locally with AWS Emulator`

### Task 2: Claves de medios y contraste (core)

**Files:**
- Create: `packages/core/src/media.ts`, `packages/core/src/color.ts`, `packages/core/test/media.test.ts`, `packages/core/test/color.test.ts`
- Modify: `packages/core/src/index.ts` (exporta ambos)

**Interfaces:**
- Produces:
  - `MEDIA_CONTENT_TYPES = ['image/webp','image/png','image/jpeg'] as const`, `type MediaContentType`, `MAX_MEDIA_BYTES = 2_097_152`;
  - `newOrgMediaKey(orgId: string, contentType: MediaContentType): string`;
  - `isOrgMediaKey(key: string, orgId: string): boolean`;
  - `mediaUrl(baseUrl: string, key: string): string`;
  - `contrastRatio(a: string, b: string): number`;
  - `readableTextColor(background: string): '#FFFFFF' | '#000000'`.

- [ ] **Step 1: Tests**

```ts
// media.test.ts
it('builds keys under the org', () => {
  expect(newOrgMediaKey('o1', 'image/webp')).toMatch(/^orgs\/o1\/media\/[A-Za-z0-9_-]+\.webp$/);
  expect(newOrgMediaKey('o1', 'image/jpeg')).toMatch(/\.jpg$/);
});
it.each([
  ['orgs/o1/media/abc.webp', true],
  ['orgs/o2/media/abc.webp', false],
  ['orgs/o1x/media/abc.webp', false],
  ['orgs/o1/media/../o2/abc.webp', false],
  ['orgs/o1/media/abc.svg', false],
  ['tmp/o1/abc.webp', false],
  ['', false],
])('isOrgMediaKey(%s) → %s', (key, ok) => expect(isOrgMediaKey(key, 'o1')).toBe(ok));
it('joins base and key with one slash', () => {
  expect(mediaUrl('https://d.cloudfront.net/', 'orgs/o/media/a.png')).toBe('https://d.cloudfront.net/orgs/o/media/a.png');
  expect(mediaUrl('http://localhost:2772/b', 'orgs/o/media/a.png')).toBe('http://localhost:2772/b/orgs/o/media/a.png');
});
// color.test.ts
it('matches WCAG for black on white', () => expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0));
it.each(['#FFFF00', '#808080', '#6B2FD6', '#0B8048', '#FBF8FF', '#1A0E2E', '#777777'])('%s gets text with ≥ 4.5:1', (bg) => {
  expect(contrastRatio(bg, readableTextColor(bg))).toBeGreaterThanOrEqual(4.5);
});
it('uses white on the Chacota purple and black on yellow', () => {
  expect(readableTextColor('#6B2FD6')).toBe('#FFFFFF');
  expect(readableTextColor('#FFC629')).toBe('#000000');
});
```

- [ ] **Step 2:** `pnpm --filter @chacota/core exec vitest run test/media.test.ts test/color.test.ts` → FAIL (no exports).
- [ ] **Step 3:** Implementar:
  - `isOrgMediaKey` valida con regex anclada `^orgs/<orgId escapado>/media/[A-Za-z0-9_-]+\.(webp|png|jpg)$`;
  - `newOrgMediaKey` usa `newId()`;
  - `contrastRatio` usa la luminancia relativa de WCAG 2.x.
- [ ] **Step 4:** Mismo comando → PASS. Correr también `pnpm --filter @chacota/core test`; boundaries tiene que seguir en verde.
- [ ] **Step 5: Commit** `feat(core): media keys and readable text color`

### Task 3: Subida firmada (web)

**Files:**
- Create: `apps/web/src/lib/media.ts` (server-only), `apps/web/src/lib/media.test.ts`, `apps/web/src/lib/image-resize.ts` (cliente), `apps/web/src/components/image-picker.tsx`, `apps/web/src/app/[locale]/app/media-actions.ts`
- Modify: `apps/web/src/lib/env.ts`, `apps/web/messages/{es,en}.json` (namespace nuevo `imagePicker`)

**Interfaces:**
- Consumes: Tarea 2.
- Produces:
  - `env.media: { bucket: string; publicUrl: string; endpoint?: string; uploadMode: 'presigned' | 'proxy' }`, que lee `MEDIA_BUCKET`, `MEDIA_PUBLIC_URL`, `S3_ENDPOINT` y `MEDIA_UPLOAD_MODE` (por defecto `presigned`);
  - `checkUpload(input: { contentType: string; size: number }): 'bad_type' | 'too_big' | 'empty' | null`;
  - `createUploadUrl(orgId: string, contentType: MediaContentType, size: number): Promise<{ key: string; url: string }>` (`PutObjectCommand` con `ContentType` y `ContentLength`, expira en 300 s);
  - server action `requestMediaUploadAction(slug: string, purpose: 'logo' | 'content', input: { contentType: string; size: number }): Promise<{ ok: true; key: string; url: string } | { ok: false; error: 'bad_type' | 'too_big' | 'empty' }>`. Con `logo` exige `org.update`; con `content`, `activity.content`;
  - en modo `proxy`: `uploadMediaAction(slug, purpose, form: FormData): Promise<{ ok: true; key: string } | { ok: false; error }>`;
  - `prepareImage(file: File, maxSide: number): Promise<Blob>`: canvas, WebP si `toBlob` devuelve `image/webp` y, si no, PNG (si hay alfa) o JPEG con calidad 0.9;
  - `<ImagePicker label hint? value={key|undefined} mediaBaseUrl maxSide purpose slug onChange={(key: string | null) => void} />`: vista previa con `<img>` (oculta en `onError`), botones "Elegir"/"Cambiar" y "Quitar", y error traducido.

- [ ] **Step 1: Test**

```ts
it.each([
  [{ contentType: 'image/webp', size: 1000 }, null],
  [{ contentType: 'image/svg+xml', size: 1000 }, 'bad_type'],
  [{ contentType: '', size: 1000 }, 'bad_type'],
  [{ contentType: 'image/png', size: 0 }, 'empty'],
  [{ contentType: 'image/png', size: 2_097_153 }, 'too_big'],
  [{ contentType: 'image/png', size: 2_097_152 }, null],
])('checkUpload(%o) → %s', (input, expected) => expect(checkUpload(input)).toBe(expected));
```

  `media.ts` importa `server-only`. Si Vitest falla por eso, separar `checkUpload` en `media-rules.ts` sin `server-only` y testear ese archivo.
- [ ] **Step 2:** `pnpm --filter @chacota/web exec vitest run src/lib/media.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `checkUpload`, `createUploadUrl` (cliente S3 con `forcePathStyle: !!endpoint` y credenciales `local` si hay endpoint, como `createDb`), las actions, `prepareImage` e `ImagePicker`. La action llama a `checkUpload` antes de firmar. `ImagePicker` sigue estos pasos: `prepareImage` → action → `fetch(url, { method: 'PUT', headers: { 'content-type': blob.type }, body: blob })` → `onChange(key)`.
- [ ] **Step 4:** Test → PASS. `cd apps/web && npx eslint src && pnpm --filter @chacota/web typecheck` → sin errores.
- [ ] **Step 5: Commit** `feat(web): signed image uploads and image picker`

### Task 4: CloudFront y política para la web (infra)

**Files:**
- Modify: `infra/lib/data.ts`, `infra/lib/chacota-stack.ts`, `infra/test/stack.test.ts`

**Interfaces:**
- Produces:
  - `ChacotaData.mediaDistribution: cloudfront.Distribution`;
  - `ChacotaData.webServerPolicy: iam.ManagedPolicy`;
  - outputs `MediaUrl` (`https://<domain>`) y `WebServerPolicyArn`.

- [ ] **Step 1: Tests** en `stack.test.ts`:

```ts
it('serves media through CloudFront with origin access control', () => {
  const t = synth();
  t.resourceCountIs('AWS::CloudFront::Distribution', 1);
  t.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  t.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({ PriceClass: 'PriceClass_100',
      DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https', AllowedMethods: ['GET', 'HEAD'] }) }),
  });
  t.hasOutput('MediaUrl', {});
});
it('gives the web server a policy to upload org media only', () => {
  const t = synth();
  t.hasResourceProperties('AWS::IAM::ManagedPolicy', {
    PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Action: 's3:PutObject',
      Resource: { 'Fn::Join': ['', Match.arrayWith([Match.stringLikeRegexp('/orgs/\\*$')])] } })]) },
  });
  t.hasOutput('WebServerPolicyArn', {});
});
```

  `'keeps the media bucket private'` tiene que seguir pasando.
- [ ] **Step 2:** `cd infra && npx vitest run test/stack.test.ts` → FAIL los dos nuevos.
- [ ] **Step 3:** Implementar en `data.ts`:
  - `new cloudfront.Distribution(this, 'MediaCdn', { defaultBehavior: { origin: origins.S3BucketOrigin.withOriginAccessControl(mediaBucket), viewerProtocolPolicy: REDIRECT_TO_HTTPS, allowedMethods: ALLOW_GET_HEAD, cachePolicy: CachePolicy.CACHING_OPTIMIZED }, priceClass: PRICE_CLASS_100 })`;
  - `new iam.ManagedPolicy(this, 'WebServerPolicy', …)` con `s3:PutObject` sobre `mediaBucket.arnForObjects('orgs/*')`;
  - la política también da a la tabla los permisos que la web usa hoy: `table.grantReadWriteData(policy)`, si se puede aplicar a una política; si no, statements equivalentes.

  Outputs en `chacota-stack.ts`.
- [ ] **Step 4:** Test → PASS. `cd infra && npx cdk synth Chacota-dev -c chacota:stage=dev -q` → sin errores (con el contexto que ya pide `readConfig`).
- [ ] **Step 5: Commit** `feat(infra): CloudFront for media and web server policy`

### Task 5: Logo de la organización

**Files:**
- Modify: `packages/db/src/orgs.ts`, `packages/db/test/repos.test.ts`, `apps/web/src/app/[locale]/app/actions.ts`, `apps/web/src/app/[locale]/app/orgs/org-form.tsx`, `apps/web/src/app/[locale]/app/orgs/[slug]/admin/page.tsx`, `apps/web/messages/{es,en}.json` (`orgForm.logo`, `orgForm.logoHint`, `orgForm.primaryColorHint`)

**Interfaces:**
- Consumes: `isOrgMediaKey` (Tarea 2) e `ImagePicker` (Tarea 3, con `purpose="logo"` y `maxSide={512}`).
- Produces: `updateOrg(db, orgId, changes)`, donde `changes.logoKey?: string | null` y `null` borra el atributo.

- [ ] **Step 1: Test** en `repos.test.ts`:

```ts
it('sets and removes the logo', async () => {
  const org = await createOrg(db(), { slug: 'logo-org', name: 'Logo' }, 'u1');
  expect((await updateOrg(db(), org.id, { logoKey: `orgs/${org.id}/media/a.webp` })).logoKey).toBe(`orgs/${org.id}/media/a.webp`);
  const removed = await updateOrg(db(), org.id, { logoKey: null });
  expect(removed).not.toHaveProperty('logoKey');
});
```

- [ ] **Step 2:** `pnpm --filter @chacota/db exec vitest run test/repos.test.ts -t "logo"` → FAIL. Requiere DynamoDB Local.
- [ ] **Step 3:** En `updateOrg`, las entradas con `null` van a una cláusula `REMOVE`.

  `updateOrgAction` lee `logoKey` del form:
  - `''` → `null`;
  - una clave → se valida con `isOrgMediaKey(key, org.id)`; si no pasa, devuelve `{ error: 'invalid', fieldErrors: { logoKey: 'invalid' } }`;
  - campo ausente → no lo toca.

  `OrgForm` (solo en `mode === 'edit'`) muestra `ImagePicker` y un `<input type="hidden" name="logoKey">` con el valor actual. Recibe `orgId`, `slug` y `mediaBaseUrl` de `admin/page.tsx`. Debajo del color va el hint: "Se usa en el lobby y en una franja de la pantalla proyectada." / "Used in the lobby and as a stripe on the projected screen."
- [ ] **Step 4:** Test → PASS. Typecheck y lint de la web → sin errores. Prueba manual en local: subir un logo, recargar, ver la vista previa, quitarlo y guardar.
- [ ] **Step 5: Commit** `feat(orgs): upload and remove the organization logo`

### Task 6: Sesión con logo y contrato de fondo (live)

**Files:**
- Modify: `packages/live/src/model.ts`, `packages/live/src/service.ts`, `packages/live/src/web.ts`, `packages/live/test/service.test.ts`, `apps/web/src/app/[locale]/host/actions.ts`, `docs/actividades.md`

**Interfaces:**
- Produces:
  - `Session.logoKey?: string`;
  - `createSession` acepta `logoKey?: string`;
  - `snapshot().session.logoKey`;
  - `HostScreenProps.setBackground(key: string | null): void`;
  - `HostScreenProps.mediaUrl(key: string): string`.

- [ ] **Step 1: Test** en `service.test.ts`:

```ts
it('copies the org logo to the session', async () => {
  const s = await live.createSession({ orgId, orgName: 'AWS UG', logoKey: `orgs/${orgId}/media/l.webp`, hostUserId: 'host', module: 'echo', content: { rounds } });
  expect((await live.snapshot(s.id)).session.logoKey).toBe(`orgs/${orgId}/media/l.webp`);
});
```

- [ ] **Step 2:** `pnpm --filter @chacota/live exec vitest run test/service.test.ts -t "logo"` → FAIL.
- [ ] **Step 3:** Implementar. `startTiluchiAction` pasa `logoKey: org.logoKey`. En `docs/actividades.md`, en la sección de la pantalla del presentador, documentar `setBackground` y `mediaUrl` con un ejemplo de una línea.
- [ ] **Step 4:** Test → PASS. `pnpm typecheck`: falla en el presentador hasta la Tarea 7, que suma las props. Para no dejar un commit roto, esta tarea agrega ya en `presenter.tsx` `setBackground={() => {}}` y `mediaUrl={(k) => k}` como implementación mínima.
- [ ] **Step 5: Commit** `feat(live): session logo and background contract for activities`

### Task 7: Marco del presentador con la marca de la org

**Files:**
- Modify: `apps/web/src/app/[locale]/host/[sessionId]/page.tsx`, `apps/web/src/app/[locale]/host/[sessionId]/presenter.tsx`, `apps/web/src/components/logo.tsx` (`TiluchiMark` → `ChacotaMark`, actualizar quienes lo importan), `apps/web/messages/{es,en}.json` (`host.presents`: "{org} presenta" / "{org} presents")

**Interfaces:**
- Consumes:
  - `readableTextColor` y `mediaUrl` (Tarea 2);
  - `snapshot.session.logoKey` y las props nuevas (Tarea 6);
  - `env.media.publicUrl` (Tarea 3).
- Produces: `Presenter` recibe `logoKey?: string` y `mediaBaseUrl: string`, e implementa `setBackground` y `mediaUrl` de verdad.

- [ ] **Step 1:** En `page.tsx` pasar `logoKey={session.logoKey}` y `mediaBaseUrl={env.media.publicUrl}`.
- [ ] **Step 2:** Lobby, según la maqueta `Lobby`:
  - **Panel izquierdo** con `style={{ background: primaryColor, color: readableTextColor(primaryColor) }}`, de arriba abajo: logo (`<img>` de 240×96, `object-contain`, oculto en `onError`) o, si no hay, `orgName` en `font-display text-5xl`; `t('presents', { org: orgName })`; `activity.Icon size={96}` con el nombre de la actividad (`ta('card.name')`); título en `text-6xl`.
  - **Lado derecho:** el QR, el PIN y los jugadores de hoy.
  - **Pantallas angostas** (`< lg`): el panel queda arriba.
- [ ] **Step 3:** Mientras corre:
  - `<div className="h-2" style={{ background: primaryColor }} />` fijo arriba;
  - en el encabezado, el logo de la org a 40 px de alto (o el nombre) con título y subtítulo, y `activity.Icon size={44}` a la derecha, junto al PIN.
- [ ] **Step 4:** Fondo:
  - estado `background: string | null`;
  - `setBackground` lo guarda;
  - si hay fondo, el contenedor raíz renderiza dos capas `absolute inset-0` detrás de todo: `<img src={mediaUrl(base, key)} className="h-full w-full object-cover" onError={ocultar}>` y `<div style={{ background: 'rgba(26,14,46,0.72)' }}>`;
  - el contenido queda `relative`;
  - al pasar a `ended`, `setBackground(null)`.
- [ ] **Step 5:** Verificación:
  - `cd apps/web && npx eslint src && pnpm --filter @chacota/web typecheck` → sin errores;
  - en local, con `pnpm dev:services`, `pnpm dev:game` y `pnpm dev`: lobby con y sin logo, y con color claro (`#FFC629`, texto negro) y oscuro;
  - pasar a la primera pregunta y ver la franja y el logo chico.
- [ ] **Step 6: Commit** `feat(host): org logo, color panel and background layer on the presenter`

### Task 8: Esquema, motor e importación de Tiluchi

**Files:**
- Modify: `modules/tiluchi/src/content/schema.ts`, `modules/tiluchi/src/content/editing.ts`, `modules/tiluchi/src/content/exporters/index.ts`, `modules/tiluchi/src/content/importers/json.ts`, `modules/tiluchi/src/content/importers/types.ts`, `modules/tiluchi/src/content/index.ts`, `modules/tiluchi/src/server/model.ts`, `modules/tiluchi/src/server/engine.ts`, `modules/tiluchi/src/server/activity.ts`, `apps/web/src/app/[locale]/app/orgs/[slug]/tiluchi/[id]/actions.ts`, `apps/web/src/app/[locale]/app/orgs/[slug]/tiluchi/[id]/page.tsx`, `modules/tiluchi/messages/{es,en}.json` (warning `media_removed`)
- Create: `modules/tiluchi/src/content/media.ts`
- Test: `modules/tiluchi/test/engine.test.ts`, `modules/tiluchi/test/editing.test.ts`, `modules/tiluchi/test/importers.test.ts`, `modules/tiluchi/test/media.test.ts`

**Interfaces:**
- Consumes: `isOrgMediaKey` (Tarea 2).
- Produces:
  - `questionBase.imageKey?: string` (reemplaza a `imageUrl`) y `questionBase.backgroundKey?: string`;
  - `Tiluchi.backgroundKey?: string`;
  - `TiluchiState.backgroundKey?: string`;
  - `PublicQuestion` cambia `imageUrl` por `imageKey?: string` y suma `backgroundKey?: string` (el efectivo);
  - `publicQuestion(q: Question, quizBackgroundKey?: string): PublicQuestion`;
  - `tiluchiMediaKeys(t: Pick<Tiluchi, 'backgroundKey' | 'questions'>): string[]`;
  - `dropForeignMedia<T extends { backgroundKey?: string; questions: Question[] }>(t: T, orgId: string): { tiluchi: T; removed: number }`;
  - `ImportWarningCode` suma `'media_removed'`.

- [ ] **Step 1: Tests**

```ts
// engine.test.ts
it('uses the question background, else the quiz background', () => {
  expect(publicQuestion({ ...quiz, backgroundKey: 'q-bg' }, 'quiz-bg').backgroundKey).toBe('q-bg');
  expect(publicQuestion(quiz, 'quiz-bg').backgroundKey).toBe('quiz-bg');
  expect(publicQuestion(quiz).backgroundKey).toBeUndefined();
  expect(publicQuestion({ ...quiz, imageKey: 'img' }).imageKey).toBe('img');
});
// editing.test.ts
it('keeps image and background when changing type', () => {
  const q = { ...newQuestion('quiz'), imageKey: 'i', backgroundKey: 'b' };
  expect(changeType(q, 'poll')).toMatchObject({ imageKey: 'i', backgroundKey: 'b' });
});
// media.test.ts
it('drops keys from other orgs and counts them', () => {
  const own = 'orgs/o1/media/a.webp', other = 'orgs/o2/media/b.webp';
  const { tiluchi, removed } = dropForeignMedia({ backgroundKey: other, questions: [{ ...quiz, imageKey: own, backgroundKey: other }] }, 'o1');
  expect(removed).toBe(2);
  expect(tiluchi.backgroundKey).toBeUndefined();
  expect(tiluchi.questions[0]).toMatchObject({ imageKey: own });
  expect(tiluchi.questions[0]).not.toHaveProperty('backgroundKey');
});
// importers.test.ts
it('round-trips image and background keys through Chacota JSON', () => {
  const json = exportChacotaJson({ title: 'T', backgroundKey: 'orgs/o1/media/bg.webp', questions: [{ ...quiz, imageKey: 'orgs/o1/media/a.webp' }] });
  const { tiluchi } = importChacotaJson(json);
  expect(tiluchi.backgroundKey).toBe('orgs/o1/media/bg.webp');
  expect(tiluchi.questions[0]).toMatchObject({ imageKey: 'orgs/o1/media/a.webp' });
});
```

- [ ] **Step 2:** `pnpm --filter @chacota/tiluchi test` → FAIL los nuevos.
- [ ] **Step 3:** Implementar.
  - **Esquema:** las claves son `z.string().max(200).optional()`. La pertenencia a la org se valida en la web, no en el esquema.
  - **Export/import:** `exportChacotaJson` acepta y escribe `backgroundKey`. `ChacotaDocument` incluye `backgroundKey` opcional y sigue en la versión 1. `ImportedTiluchi` suma `backgroundKey?`.
  - **Motor:** `prepare` copia `content.backgroundKey` al estado. `activity.ts` pasa `session.state.backgroundKey` a cada `publicQuestion`.
  - **Guardar:** `saveTiluchiAction` devuelve `{ ok: false, error: 'invalid' }` si alguna clave de `tiluchiMediaKeys` no pasa `isOrgMediaKey(k, org.id)`.
  - **Importar:** `importQuestionsAction` aplica `dropForeignMedia(…, org.id)` y, si `removed > 0`, agrega `{ code: 'media_removed', detail: String(removed) }`.
  - **Editor:** `page.tsx` pasa `backgroundKey` en `initial`.
- [ ] **Step 4:** `pnpm --filter @chacota/tiluchi test && pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(tiluchi): quiz and question backgrounds and question images in content`

### Task 9: Editor de Tiluchi con imágenes

**Files:**
- Modify: `apps/web/src/app/[locale]/app/orgs/[slug]/tiluchi/[id]/editor.tsx`, `apps/web/src/app/[locale]/app/orgs/[slug]/tiluchi/[id]/page.tsx` (pasa `mediaBaseUrl`), y los mensajes del editor en el archivo donde ya viven (`editor.background`, `editor.questionImage`, `editor.questionBackground`, `editor.inheritsBackground`).

**Interfaces:**
- Consumes: `ImagePicker` (Tarea 3, con `purpose="content"` y `maxSide={1920}`) y los campos de la Tarea 8.

- [ ] **Step 1:** En la sección de datos del cuestionario, `ImagePicker` "Fondo (todas las preguntas)" / "Background (all questions)", que llama a `update({ backgroundKey: key ?? undefined })`.
- [ ] **Step 2:** En `QuestionForm`, después de tipo y tiempo:
  - `ImagePicker` "Imagen" / "Image" → `onChange({ ...q, imageKey })`;
  - `ImagePicker` "Fondo de esta pregunta" / "Background for this question" → `onChange({ ...q, backgroundKey })`;
  - si `!q.backgroundKey && tiluchi.backgroundKey`, el hint dice "Usa el fondo del cuestionario" / "Uses the quiz background".

  `QuestionForm` recibe `quizBackgroundKey`, `slug` y `mediaBaseUrl`.
- [ ] **Step 3:** Verificación:
  - lint y typecheck de la web → sin errores;
  - en local: poner un fondo de cuestionario, una imagen en la pregunta 1 y un fondo propio en la pregunta 2, guardar y recargar → los tres siguen ahí;
  - quitar uno y guardar → desaparece.
- [ ] **Step 4: Commit** `feat(tiluchi-editor): pick quiz background, question image and background`

### Task 10: Pantalla del presentador de Tiluchi

**Files:**
- Modify: `modules/tiluchi/src/web/host.tsx`

**Interfaces:**
- Consumes: `HostScreenProps.setBackground` y `mediaUrl` (Tarea 6), y `PublicQuestion.imageKey` y `backgroundKey` (Tarea 8).

- [ ] **Step 1:** Fondo:
  - `const bgIndex = screen.kind === 'waiting' ? 0 : screen.index`;
  - `useEffect(() => setBackground(questions[bgIndex]?.backgroundKey ?? null), [bgIndex, …])`.

  Así "Preparate" ya muestra el fondo de la pregunta que viene, y el revelado y el ranking mantienen el de su pregunta. Si un índice ya pasó y `waiting` vuelve a aparecer, aceptar `questions[0]`.
- [ ] **Step 2:** Pregunta y revelado con `imageKey`, según la maqueta `PreguntaImagen`:
  - grid `lg:grid-cols-[2fr_3fr]` con `<img src={mediaUrl(key)} alt="" className="max-h-[45vh] w-full rounded-3xl object-contain" onError={ocultar}>` a la izquierda;
  - a la derecha, el bloque de contador, tiempo y enunciado actual, con el enunciado en `text-4xl lg:text-5xl`;
  - `AnswerTiles` abajo.

  Sin `imageKey`, el layout de hoy. El ranking no muestra imagen.
- [ ] **Step 3:** Verificación:
  - `pnpm --filter @chacota/tiluchi typecheck` y lint de la web → sin errores;
  - en local, jugar el cuestionario de la Tarea 9 con un celular (o una segunda pestaña en `/play`): ver el fondo heredado, el fondo propio y la imagen;
  - el celular sigue igual;
  - reiniciar el emulador (`podman compose restart aws-emulator`) en medio de una sesión → las imágenes desaparecen y la pantalla sigue funcionando.
- [ ] **Step 4: Commit** `feat(tiluchi-host): question image layout and backgrounds`

### Task 11: Logo y color de Tiluchi

**Files:**
- Create: `modules/tiluchi/src/web/assets/tiluchi-512.png`, `modules/tiluchi/src/web/assets/tiluchi-128.png`, `modules/tiluchi/src/web/assets.d.ts`, `modules/tiluchi/test/manifest.test.ts`
- Modify: `modules/tiluchi/src/web/icon.tsx`, `modules/tiluchi/src/manifest.ts`

**Interfaces:**
- Consumes: `contrastRatio` (Tarea 2).
- Produces: `TiluchiIcon({ size })` muestra el hornero; `tiluchiManifest.color` cambia al tono del ala.

- [ ] **Step 1: Test**

```ts
it('lets white text read on the Tiluchi color', () => {
  expect(contrastRatio(tiluchiManifest.color, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  expect(tiluchiManifest.color).not.toBe('#6B2FD6');
});
```

- [ ] **Step 2:** `pnpm --filter @chacota/tiluchi exec vitest run test/manifest.test.ts` → FAIL.
- [ ] **Step 3:** Generar los tamaños desde `docs/superpowers/specs/assets/tiluchi-hornero.png`: `sips -Z 512 … --out …-512.png` y lo mismo con 128.
  - Si el borde rojizo de abajo se ve sobre `#FCEFDF`, limpiarlo antes de escalar: pasar a transparentes los píxeles semitransparentes rojizos del borde, con un script descartable que use `sharp` o Python con Pillow. Si no se puede, dejarlo y avisar.
  - Cambiar `tiluchiManifest.color` partiendo de `#C4561F` y oscureciéndolo hasta pasar el test (por ejemplo `#B04A18`).
  - `TiluchiIcon`: `<img src={size > 64 ? logo512.src : logo128.src} width={size} height={size} alt="" />`. Va con importación estática y `declare module '*.png' { const v: { src: string }; export default v; }` en `assets.d.ts`.
- [ ] **Step 4:** Test → PASS. Verificar que `pnpm dev` carga el ícono en el hub (`/app/orgs/<slug>`) y en el presentador.
  - **Si Turbopack no resuelve la importación del paquete transpilado:** generar `assets/logo.ts` con el PNG de 128 en base64 (`export const logo128 = 'data:image/png;base64,…'`) más uno de 256 para tamaños mayores, e importar de ahí. Nunca desde `apps/web/public`.
- [ ] **Step 5: Commit** `feat(tiluchi): hornero logo and activity color`

### Task 12: Repaso final

- [ ] **Step 1:** `pnpm test && pnpm typecheck && (cd apps/web && npx eslint src)` → todo en verde, con DynamoDB Local y el emulador levantados.
- [ ] **Step 2:** `pnpm e2e` (requiere `E2E_EMAIL` y `E2E_PASSWORD`) → el flujo completo sigue pasando sin imágenes.
- [ ] **Step 3:** Revisar `CLAUDE.md`:
  - el registro de actividades no cambia;
  - sumar a "Conventions and gotchas" una línea: "Media: content stores S3 keys (`orgs/<orgId>/media/…`), never URLs; `MEDIA_PUBLIC_URL` builds them".
- [ ] **Step 4: Commit** `docs: media conventions` (si hubo cambios)
