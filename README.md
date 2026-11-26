# Chacota

Juegos comunitarios para meetups y streams, hechos por y para los AWS User Groups.
Es open source (Apache-2.0) y cualquiera puede desplegarlo en su propia cuenta de AWS.

Chacota es una plataforma de **actividades**: cada organización elige cuáles ofrece, y la comunidad puede sumar nuevas (ver [Crear una actividad](docs/actividades.md)). La primera es **Tiluchi**: quizzes estilo Kahoot con editor, modo presentador y modo participante.

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
| Plataforma de actividades: administración aparte, Tiluchi como módulo | ✅ |

## Estructura

| Carpeta | Qué es |
|---|---|
| `packages/core`, `packages/db` | Plataforma: organizaciones, roles, branding, registro de actividades |
| `packages/live` | Sesión en vivo que comparten las actividades: PIN, jugadores, tiempo real, resultados |
| `modules/tiluchi` | La actividad Tiluchi: preguntas, importación de Kahoot, reglas y pantallas |
| `services/api` | API de participantes (Lambda) con las rutas de cada actividad |
| `apps/web` | Next.js: inicio con actividades, administración, presentador, celular, historial |
| `infra` | CDK |
| `e2e` | Partida completa en Chrome |

## Desarrollo local

Requiere Node 22+ y Podman o Docker. Los scripts locales asumen macOS, Linux o WSL (shell POSIX). No necesitás cuenta de AWS: todo corre sobre el AWS Emulator oficial (Cognito, S3, AppSync Events) y DynamoDB Local.

```sh
corepack enable            # o: npm i -g pnpm
corepack pnpm install
pnpm dev:services          # DynamoDB Local + AWS Emulator
cp apps/web/.env.example apps/web/.env.local
pnpm local:init            # tabla, bucket, user pool, AppSync y organización demo; es idempotente

pnpm dev:game              # API de participantes :4000
pnpm dev                   # http://localhost:3000
# o todo en una terminal (servicios, local:init, API y web):
pnpm dev:all
```

En Linux con Docker rootful, el contenedor escribe `~/.aws/emulator` (y la CA `ca.pem`) como root: `pnpm dev:services` ya crea el directorio con tu usuario antes de levantar, pero si la CA queda ilegible corré `sudo chmod -R a+rX ~/.aws/emulator`. `pnpm local:init` espera a que los servicios y la CA estén listos (hasta 60 s) antes de empezar.

Ingresá en http://localhost:3000 con `dev@chacota.local` / `chacota` (superadmin, solo local).

El emulador guarda todo en memoria. Si lo reiniciás, corré `pnpm local:init` otra vez (empieza el mundo local de cero) y reiniciá `pnpm dev` y `pnpm dev:game`. Si venís de la configuración anterior, corré una vez `podman compose up -d --build` (si compose se queja, borrá el contenedor viejo `chacota-realtime-tls-1`). El stack `dev` de CDK ya no hace falta para desarrollar: sirve solo para probar despliegues reales.

Para jugar desde celulares en la misma red WiFi, el presentador sigue en `localhost` y en `apps/web/.env.local` usas la IP de tu máquina (por ejemplo `192.168.1.10`):

```sh
CHACOTA_PUBLIC_ORIGIN=http://192.168.1.10:3000   # lo que muestra el QR
GAME_API_URL=http://192.168.1.10:4000
EVENTS_REALTIME_URL=ws://192.168.1.10:4100/event/realtime
```

(`realtime-tls` de `compose.yaml` publica el 4100 solo en `127.0.0.1`: para celulares cambiá ese puerto a `4100:4100`.)

y arrancas el juego con `ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.10:3000 pnpm dev:game`.


## Primer superadmin (nube)

Solo en un despliegue real: en local no hace falta, porque `dev@chacota.local` ya es superadmin. Para aprobar organizaciones, registrate una vez y luego:

```sh
aws cognito-idp admin-add-user-to-group --user-pool-id <UserPoolId> \
  --username <tu-email> --group-name superadmin --profile <tu-perfil>
```

Después cerrá sesión y volvé a entrar.

## Tests

```sh
pnpm test        # todos los paquetes (necesita DynamoDB Local corriendo)
pnpm typecheck
pnpm e2e         # partidas completas en Chrome, sin cuenta de AWS (ver e2e/README.md)
```

## Prueba de carga

La prueba corre dentro de AWS: una conexión doméstica no aguanta 1000 sockets. Lambdas "trabajadoras" simulan 100 jugadores cada una, y otra hace de presentador.

```sh
cd infra && npx cdk deploy Chacota-dev -c chacota:stage=dev -c chacota:loadTest=true --outputs-file cdk-outputs.dev.json
aws lambda invoke --function-name <LoadTestFunction> --cli-read-timeout 900 \
  --cli-binary-format raw-in-base64-out --payload '{"role":"orchestrator","players":1000,"questions":3}' out.json
```

Resultado en `us-east-1` (noviembre 2026, después de separar las actividades), con 1000 jugadores, 3 preguntas y sin errores: se unieron 1000/1000 en 4.2 s y se guardaron 3000/3000 respuestas.

| Métrica | p50 | p95 |
|---|---|---|
| Unirse (HTTP) | 293 ms | 1.7 s (arranque de Lambdas) |
| Responder (HTTP) | 47 ms | 67 ms |
| Pregunta → celulares (AppSync Events) | 67 ms | 116 ms |
| Revelación con ranking → celulares | 0.5–1.0 s | 0.7–1.2 s |

Desde Bolivia suma unos 150 ms de red. Para pruebas chicas desde tu máquina: `pnpm --filter @chacota/api exec tsx scripts/load-test.ts --players 300 --concurrency 20`.

## Resultados y premios

Al terminar cada sesión, de cualquier actividad, se guardan los resultados completos en la organización (**Historial y premios**), y no expiran como los datos en vivo:

- Ranking de todos los jugadores con puntaje y las columnas de cada actividad. En Tiluchi: respuestas correctas y tiempo promedio de aciertos, que sirve para desempatar.
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
