# e2e

Dos recorridos completos en Chrome, uno detrás del otro:

- **Tiluchi** (`src/game.ts`): presentador más tres celulares, reconexión, código de verificación, resultados, CSV y activar/desactivar la actividad.
- **Embolsau** (`src/embolsau.ts`): el formulario "Nueva carrera", una sesión llena (el tercer celular recibe "Este juego ya está lleno."), elegir animalito, empujar a dos ritmos hasta que la ronda cierra sola, podio, código y las columnas del historial. Usa su propia organización (`e2e-embolsau`).

Requisitos:

- Google Chrome instalado (se usa con `playwright-core`, sin descargar navegadores).
- Servicios locales corriendo: `pnpm dev:services`, `pnpm dev:game` y `pnpm dev`.
- `apps/web/.env.local` apuntando al Cognito del stack `dev`, que es el único con `ADMIN_USER_PASSWORD_AUTH`.
- Credenciales de AWS de esa cuenta (por ejemplo `AWS_PROFILE`) y un usuario de prueba en ese pool:

```bash
aws cognito-idp admin-create-user --user-pool-id <pool> --username e2e-tester@example.com --message-action SUPPRESS
aws cognito-idp admin-set-user-password --user-pool-id <pool> --username e2e-tester@example.com --password '<clave>' --permanent
```

Correr:

```bash
E2E_EMAIL=e2e-tester@example.com E2E_PASSWORD='<clave>' pnpm e2e
```

Termina con `ALL PASSED` y `ALL PASSED (Embolsau)`. Para correr uno solo: `corepack pnpm --filter @chacota/e2e start:tiluchi` o `start:embolsau` (con las mismas variables). Las capturas quedan en `e2e/out/`. `E2E_BASE_URL` cambia la URL base (por defecto `http://localhost:3000`).
