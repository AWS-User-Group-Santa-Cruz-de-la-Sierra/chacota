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
| Resultados permanentes para premios (top N, código de verificación, CSV/Excel) | ✅ |

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

## Prueba de carga

La prueba corre dentro de AWS: una conexión doméstica no aguanta 1000 sockets. Lambdas "trabajadoras" simulan 100 jugadores cada una, y otra hace de presentador.

```sh
cd infra && npx cdk deploy Chacota-dev -c chacota:stage=dev -c chacota:loadTest=true --outputs-file cdk-outputs.dev.json
aws lambda invoke --function-name <LoadTestFunction> --cli-read-timeout 900 \
  --cli-binary-format raw-in-base64-out --payload '{"role":"orchestrator","players":1000,"questions":3}' out.json
```

Resultado en `us-east-1` (noviembre 2026), con 1000 jugadores y 3 preguntas y sin errores:

| Métrica | p50 | p95 |
|---|---|---|
| Unirse (HTTP) | 299 ms | 1.7 s (arranque de Lambdas) |
| Responder (HTTP) | 46 ms | 65 ms |
| Pregunta → celulares (AppSync Events) | 79 ms | 204 ms |
| Revelación con ranking → celulares | 0.6–0.9 s | 0.8–1.1 s |

Desde Bolivia suma unos 150 ms de red. Para pruebas chicas desde tu máquina: `pnpm --filter @chacota/game exec tsx scripts/load-test.ts --players 300 --concurrency 20`.

## Resultados y premios

Al terminar cada partida se guardan los resultados completos en la organización (pestaña **Resultados**), y no expiran como los datos en vivo:

- Ranking de todos los jugadores con puntaje, respuestas correctas y tiempo promedio de aciertos, que sirve para desempatar.
- Cada jugador ve un **código de 4 letras** en su celular al terminar. Pedilo para verificar a los ganadores, porque los apodos los elige cada uno.
- Selector de top 3/5/10 o cualquier número, con aviso si hay un empate justo en el corte.
- Descarga en Excel o CSV, del ranking completo o solo de los ganadores.

Si alguien se olvidó de terminar una partida, aparece en **Partidas sin terminar** con un botón para cerrarla y guardar sus resultados (dentro de las 48 horas).

## Importar preguntas

| Formato | Notas |
|---|---|
| `.xlsx` | Plantilla de Kahoot: Question, Answer 1–4, Time limit (sec), Correct answer(s). Encabezados en inglés o español. |
| `.csv` | Mismas columnas que la plantilla. |
| `.json` | Formato nativo de Chacota (`chacota.tiluchi` v1), sin pérdida de datos. |

Las filas con dos respuestas *Verdadero/Falso* (o *True/False*) se convierten en preguntas de verdadero o falso. Las filas sin respuesta correcta se importan como encuestas.
