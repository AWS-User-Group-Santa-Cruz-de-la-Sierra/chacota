# Chacota

Juegos comunitarios para meetups y streams, hechos por y para los AWS User Groups.
Es open source (Apache-2.0) y cualquiera puede desplegarlo en su propia cuenta de AWS.

**Tiluchi** es el primer juego: quizzes estilo Kahoot con editor, modo presentador y modo participante.

## Estado

| Hito | Estado |
|---|---|
| Monorepo + CI | ✅ |
| `@chacota/core`: schema, puntaje, import/export | ✅ |
| Auth + organizaciones | ✅ |
| Editor + import/export | ✅ |
| Motor de partida en tiempo real (AppSync Events) | ✅ |
| Presentador + participante | ✅ |

## Desarrollo local

Requiere Node 22+, Podman o Docker, y una cuenta de AWS solo para Cognito (el login).

```sh
corepack enable            # o: npm i -g pnpm
pnpm install

# 1. Login real con Cognito (una sola vez). Crea un User Pool "dev" con callbacks a localhost.
cd infra && AWS_PROFILE=<tu-perfil> npx cdk deploy Chacota-dev -c chacota:stage=dev --outputs-file cdk-outputs.dev.json && cd ..

# 2. DynamoDB Local (emulador oficial de AWS) y la tabla
pnpm dev:services
pnpm db:init

# 3. Variables de entorno: copia apps/web/.env.example a apps/web/.env.local
#    y completa COGNITO_* con los valores de infra/cdk-outputs.dev.json

pnpm dev:game              # API de juego :4000 + broker de eventos :4001 (emula AppSync Events)
pnpm dev                   # http://localhost:3000
```

Para jugar desde celulares en la misma red WiFi, el presentador sigue en `localhost` y en `apps/web/.env.local` usas la IP de tu máquina (por ejemplo `192.168.1.10`):

```sh
CHACOTA_PUBLIC_ORIGIN=http://192.168.1.10:3000   # lo que muestra el QR
GAME_API_URL=http://192.168.1.10:4000
EVENTS_HTTP_DNS=192.168.1.10:4001
EVENTS_REALTIME_URL=ws://192.168.1.10:4001/event/realtime
```

y arrancas el juego con `ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.10:3000 pnpm dev:game`.

Para ser superadmin (aprobar organizaciones), regístrate una vez y luego:

```sh
aws cognito-idp admin-add-user-to-group --user-pool-id <UserPoolId> \
  --username <tu-email> --group-name superadmin --profile <tu-perfil>
```

Después cierra sesión y vuelve a entrar.

## Tests

```sh
pnpm test        # core, db (necesita DynamoDB Local corriendo) e infra
pnpm typecheck
```

## Importar preguntas

| Formato | Notas |
|---|---|
| `.xlsx` | Plantilla de Kahoot: Question, Answer 1–4, Time limit (sec), Correct answer(s). Encabezados en inglés o español. |
| `.csv` | Mismas columnas que la plantilla. |
| `.json` | Formato nativo de Chacota (`chacota.tiluchi` v1), sin pérdida de datos. |

Las filas con dos respuestas *Verdadero/Falso* (o *True/False*) se convierten en preguntas de verdadero o falso. Las filas sin respuesta correcta se importan como encuestas.
