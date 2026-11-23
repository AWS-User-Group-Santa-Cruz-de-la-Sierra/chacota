# e2e

Partida completa en Chrome: presentador más tres celulares, reconexión, código de verificación, resultados y CSV.

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

Termina con `ALL PASSED`. Las capturas quedan en `e2e/out/`. `E2E_BASE_URL` cambia la URL base (por defecto `http://localhost:3000`).
