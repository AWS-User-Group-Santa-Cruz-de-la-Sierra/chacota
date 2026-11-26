# e2e

Dos recorridos completos en Chrome, uno detrás del otro:

- **Tiluchi** (`src/game.ts`): presentador más tres celulares, reconexión, código de verificación, resultados, CSV y activar/desactivar la actividad.
- **Embolsau** (`src/embolsau.ts`): el formulario "Nueva carrera", una sesión llena (el tercer celular recibe "Este juego ya está lleno."), elegir animalito, empujar a dos ritmos hasta que la ronda cierra sola, la carrera esperando al presentador, "Ver podio", código y las columnas del historial. Usa su propia organización (`e2e-embolsau`).

Requisitos (no hace falta cuenta de AWS: todo corre sobre el AWS Emulator):

- Google Chrome instalado (se usa con `playwright-core`, sin descargar navegadores).
- `pnpm dev:services`, `cp apps/web/.env.example apps/web/.env.local` y `pnpm local:init` (una vez; repetilo si reiniciás el emulador).
- `pnpm dev:game` y `pnpm dev` corriendo.

El login usa el usuario `e2e@chacota.local` que siembra `local:init` (clave local, ya incluida).

Correr:

```bash
pnpm e2e
```

Termina con `ALL PASSED` y `ALL PASSED (Embolsau)`. Para correr uno solo: `corepack pnpm --filter @chacota/e2e start:tiluchi` o `start:embolsau` . Las capturas quedan en `e2e/out/`. `E2E_BASE_URL` cambia la URL base (por defecto `http://localhost:3000`).

En CI, `.github/workflows/e2e.yml` corre los dos recorridos en cada PR, en cada push a main y a demanda, sin secretos. Si falla, sube capturas y logs como el artefacto `e2e-evidencias`. Que bloquee o no el merge depende de la protección de la rama.
