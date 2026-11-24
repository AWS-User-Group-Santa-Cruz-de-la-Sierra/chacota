# Embolsau: carrera de embolsados

Fecha: 2026-11-23 · Estado: borrador para aprobar

## Qué es y por qué

Embolsau es la segunda actividad de Chacota, después de Tiluchi. Es una carrera de embolsados con identidad camba. Cada persona elige un animalito del oriente boliviano y lo empuja desde el celular con un botón grande. Si empuja demasiado rápido, el animalito puede tropezar con la bolsa y caerse un momento. La caída es probabilística: el riesgo sube con la velocidad, pero nunca es seguro. Así no gana el que tiene el dedo más rápido sino el que mejor mide el riesgo, y la suerte empareja a todos.

Es para los meetups y streams del AWS User Group: un momento corto, ruidoso y para todo el público, que se ve en la pantalla grande.

## Objetivos

- Una carrera de hasta 100 personas que se lea bien en un proyector y que el público quiera mirar.
- Que sea justa: el servidor decide todo (velocidad, caídas, llegada, puntaje) y el azar evita que gane siempre el más rápido.
- Funcionar dentro del contrato de actividades actual (`ActivityServer` / `ActivityWeb`) sin infraestructura nueva. El único cambio de plataforma es el tope de jugadores (ver más abajo).
- Español (voseo) e inglés.

## No objetivos

- Más de 100 corredores por sesión, o espectadores ("hinchada") para los que no entran.
- Personajes subidos por cada organización. El set es fijo y viene con la actividad.
- Personajes con atributos distintos. Elegir el animalito es solo visual.
- Elegir el personaje en el lobby del celular, porque eso es un cambio de plataforma (ver "Enfoques").

## Anti-objetivos (sería un fracaso aunque funcione)

- Que gane siempre quien toca más rápido, o que un script que toca 50 veces por segundo gane.
- Que caerse se sienta arbitrario. Con el medidor activado, la persona tiene que ver venir el riesgo.
- Que la pantalla grande sea un enjambre ilegible o que la animación vaya a saltos.
- Que la actividad agregue tablas, Lambdas, variables de entorno o que importe código de Tiluchi.

## Restricciones

- Presupuesto del proyecto: $300 al año como máximo. Una carrera de 100 personas, con los toques agrupados en un envío por segundo y unos 40 segundos de carrera, son unas 4000 llamadas más unas 80 lecturas de estado y publicaciones: centavos por carrera.
- La API tiene un límite de 1000 llamadas por segundo (`infra/lib/game.ts`, `throttlingRateLimit: 1000`). Con 100 personas a un envío por segundo quedamos en unas 100 por segundo.
- Las reglas, los tiempos y los puntajes corren en el servidor con `live.now()`. El celular nunca decide.
- Los datos en vivo llevan `ttl: live.ttl()` y van bajo `sessionKeys.module(sessionId, 'embolsau', ...)`, repartidos con `shardOf(playerId)`.
- Se arranca como `experimental`.

## Enfoques considerados

Cómo se arma el estado de la carrera que ve la pantalla grande:

1. **La pantalla del presentador pide el estado (elegido).** Los celulares mandan sus toques agrupados. El presentador llama unas 2 veces por segundo a una acción propia (`hostActions.tick`), que lee a todos los corredores, arma el ranking, detecta las llegadas, mueve las fases por tiempo y publica un solo evento con las posiciones. Lo elegimos porque toda la lógica de la carrera queda en un solo punto del servidor: es justa, no hay escrituras que choquen y es fácil de probar. El costo es que la pestaña del presentador tiene que estar abierta, como ya pasa con Tiluchi.
2. **Cada celular publica su posición.** Cada envío de toques publica la posición de ese jugador a la pantalla grande. Así no hace falta pedir el estado, pero el ranking lo arma el navegador, los celulares no saben su puesto, y detectar los 3 primeros y la cuenta de 10 segundos requiere coordinar escrituras concurrentes. Descartado.
3. **Mandar cada toque sin agrupar.** Es posible con 100 personas (unas 500 llamadas por segundo), pero no deja margen y el costo por carrera se multiplica por 5. Descartado: agrupamos.

Cuándo se elige el animalito:

- **Al arrancar, como primera etapa de la actividad (elegido).** El lobby del celular es de la plataforma y hoy una actividad no puede poner nada ahí (`packages/live/src/web.ts`). Una etapa de "Elegí tu animalito" de unos 15 segundos, después de "Empezar", no toca la plataforma y le da suspenso a la largada.
- **En el lobby.** Se siente más natural, pero necesita un espacio de la actividad en el lobby del celular. Es un cambio de plataforma y quedaría como issue aparte.

## Lo que se decidió

### Configuración de cada carrera

En `/app/orgs/<slug>/embolsau` hay un botón "Nueva carrera" con un formulario corto. No hay contenido guardado: las opciones van como `content` de `createSession` y quedan en el estado de la sesión y en los resultados.

- **Medidor de velocidad:** visible o a ciegas.
- **Largo de la pista:** corta, normal o larga: 120, 160 y 240 m (unos 15, 20 y 30 segundos).
- **Cantidad de carreras:** de 1 a 3, con puntaje acumulado.
- **Tope de jugadores:** hasta 100 (ver "Cambio de plataforma: tope de jugadores").

### Flujo de una sesión

1. Lobby de la plataforma: PIN, QR y apodos, como siempre.
2. El presentador da "Empezar" y empieza la etapa **Elegí tu animalito** (unos 15 s). Cada celular muestra el set de animalitos y la pantalla grande cuántos eligió cada uno. Al que no elige se le asigna uno al azar.
3. **Cuenta regresiva** de 3-2-1 en la pantalla grande y en los celulares.
4. **Carrera.** Termina cuando cruzan la meta los 3 primeros: ahí se abre una cuenta de 10 segundos y después se corta. Si nadie llega, hay un tiempo máximo (lo define el builder según el largo de la pista).
5. **Resultado de la ronda:** tabla de posiciones de la ronda y del acumulado. El presentador da "Siguiente carrera" (vuelve al paso 3 con el mismo animalito) o, en la última ronda, la actividad llama a `live.end()` y la plataforma muestra el podio y el código de 4 letras.

Las fases que dependen del tiempo (fin de la elección, de la cuenta regresiva y de la ronda) las mueve `tick` cuando el reloj del servidor dice que ya pasaron, con `live.transition` protegida por versión. Los botones del presentador usan `advance`.

### Mecánica (servidor)

- El celular manda `POST /m/embolsau/push` más o menos una vez por segundo con un número de secuencia y **los instantes de cada toque** dentro del lote (milisegundos relativos al inicio del lote). *(Decisión del diseñador: si solo se mandara la cantidad, el servidor vería un promedio deformado por la latencia de la red y las caídas no coincidirían con lo que mostró el medidor.)*
- El servidor valida los instantes contra su propio reloj: el lote no puede durar más que el tiempo real transcurrido desde el lote anterior (con un margen chico), los instantes van en orden y no se aceptan lotes repetidos ni del futuro. Con eso reproduce los toques en orden, integra la física y sortea las caídas. El celular informa qué hizo el dedo, y el servidor decide qué pasa.
- Física: cada toque suma velocidad, la bolsa frena con el tiempo y la posición avanza.
- **Tropiezo:** por encima de un umbral de velocidad, la probabilidad de caerse crece con lo que se pasa (zona amarilla: poco riesgo; zona roja: mucho). El sorteo se hace en el servidor con un generador aleatorio seguro. Caerse frena al jugador del todo durante algo más de un segundo, con algo de variación.
  - Zonas y probabilidad de caerte si te quedás un segundo en cada una, decididas por el maintainer después de probarlo (simuladas con 2000 carreras por ritmo):
    - **Verde**, hasta 8 m/s (unos 6 toques/s): 2 %, en cuanto te movés. Quieto no te caés.
    - **Amarillo**, de 8 a 13 m/s (6–10 toques/s): de 5 % a 15 %. Es la mejor apuesta en promedio.
    - **Rojo**, de 13 a 16 m/s (10–12 toques/s): de 26 % a 57 %. Es una apuesta: puede dar la carrera más rápida o hundirla.
    - Una caída dura entre 1 y 1,4 s.
- **Anti-trampa:** se limita la cantidad de toques por segundo que se aceptan (un valor humano, alrededor de 12). Con más que eso igual se cae, porque queda en rojo. *Decisión del diseñador:* un bot que toca a un ritmo justo y parejo no se detecta en esta versión. Los premios de un meetup son chicos, el medidor deja que cualquier persona apunte al mismo ritmo, y el código de 4 letras más la mirada del presentador ya sirven de control. Si hiciera falta, después se puede detectar un ritmo demasiado regular a partir de los instantes de cada toque.
- La función de física y de riesgo es pura y se comparte entre el servidor (que decide) y el celular (que solo la usa para dibujar el medidor). Las constantes se ajustan jugando.
- Cada jugador tiene un registro propio en su partición con posición, velocidad, `downUntil`, caídas, `finishedAt` y animalito. Lo escribe solo su propio `push`, así que no hay choques.

### `tick` (presentador, unas 2 veces por segundo)

- Lee los 10 shards de corredores, arma el ranking (los que llegaron por `finishedAt`, los demás por metros) y detecta los 3 primeros para abrir la cuenta de 10 s.
- Publica `embolsau.standings` **solo en el canal del presentador** `/game/{id}/host`, con cada corredor: id, apodo, animalito, metros, velocidad, si está caído y su puesto. La pantalla grande lo usa para animar.
- Guarda el puesto de cada corredor. Cada celular lo recibe en la respuesta de su propio `push` ("12°"), así los celulares no reciben el ranking completo. *(Decisión del diseñador: con 100 jugadores el ranking completo también entraría, pero así el camino a más jugadores no exige rehacer nada.)* Los cambios de fase que ven todos (elección, cuenta regresiva, largada, fin de ronda) sí van al canal público.
- Mueve las fases por tiempo como se describe arriba.

### Puntaje y resultados

- Puntos de cada ronda, decididos por el maintainer:
  - El 1° en cruzar la meta se lleva **1000**.
  - Los que cruzan después se llevan **300 + 700 × (1 − Δ / T)**. Δ son los segundos detrás del 1° y T los segundos entre la llegada del 1° y el corte de la ronda. Quedan entre 1000 y 300.
  - Los que no llegan se llevan **300 × metros / largo de la pista**, entre 0 y 300. Así cruzar la meta siempre vale más que no llegar, y nadie se va con las manos vacías por una mala ronda.
  - El orden de la ronda: los que llegaron, por tiempo, y después los demás, por metros. El total va a `player.score` (`live.addScore`), así el podio y el historial de la plataforma funcionan como en Tiluchi.
- Columnas extra en el historial: tiempo de la mejor ronda, metros totales, caídas y animalito. El detalle guarda las opciones con que se jugó y las posiciones por ronda.

### Pantalla grande (`Host`)

Validada con bocetos en esta conversación (opción C, tamaño 28):

- La multitud sale junta. La cámara sigue a los punteros y muestra unos **75 m de pista**, con personajes grandes y en perspectiva: los de atrás de la multitud se ven más chicos.
- Los rezagados se salen por la izquierda y quedan en un contador ("← 23 quedaron atrás").
- Abajo hay una tira con la pista entera y cada corredor como un puntito. Un recuadro marca el tramo que muestra la cámara.
- Arriba a la derecha está el cuadro de punteros (top 3), con los nombres de los tres primeros sobre sus cabezas.
- Al caerse, el personaje se tumba con un "¡pum!" y después sigue.
- La animación interpola entre un `standings` y el siguiente usando la velocidad, para que no vaya a saltos.
- Se dibuja en `<canvas>` por rendimiento.

### Celular (`Play`)

```
┌──────────────────────┐
│ [tu animalito]   12° │
│ velocidad            │
│ ▓▓▓▓▓▓▓▓░░░░░        │  verde / amarillo / rojo (solo si el medidor está activado)
│  ┌────────────────┐  │
│  │   ¡EMPUJÁ!     │  │  botón grande, media pantalla
│  └────────────────┘  │
└──────────────────────┘
```

- Al caerse, el botón se apaga un ratito: "¡Te caíste! Levantándote…".
- El celular no carga imágenes de S3. Los animalitos del set fijo vienen empaquetados con la actividad como estáticos (como `modules/tiluchi/src/web/assets`), así que esto no rompe la regla de media.

### Personajes

- Set fijo de animalitos del oriente, dibujados por el maintainer y empaquetados en `modules/embolsau/src/web/assets`. Hacen falta un cuadro quieto/saltando, uno caído y un ícono para elegir. El formato exacto lo define el builder junto con quien hace los assets. Mientras tanto se usan dibujos de relleno.
- Varios jugadores pueden elegir el mismo animalito. Para distinguirlos en la multitud se puede variar el color de la bolsa.

### Nombre e identidad

- Nombre: **Embolsau**. Id `embolsau`: URLs `/app/orgs/<slug>/embolsau`, API `/m/embolsau/*`, eventos `embolsau.*` y mensajes `embolsau.*`.

## Lo que queda para el builder

- Las constantes de la física y del riesgo (umbral, zonas, duración de la caída), ajustadas jugando, y los puntos por puesto.
- El tiempo máximo de cada ronda según el largo de la pista.
- Qué ve un celular que se reconecta (`snapshot`) en cada fase, y qué pasa con quien se une a mitad de una ronda.
- Diseño visual fino de la pantalla grande y del celular, con la marca (`bg-noche`, `bg-tajibo`, `bg-sol`…).
- Tests con DynamoDB Local: `prepare`, `push`, `tick`, `advance`, `results` y al menos una sesión completa de varias rondas con un reloj y un generador aleatorio controlados.

## Cambio de plataforma: tope de jugadores

Decidido por el maintainer: si la carrera ya tiene el máximo de jugadores, quien intenta unirse recibe un mensaje de que está llena.

- `createSession` acepta un `maxPlayers` opcional, que se guarda en la sesión. Si no viene, no hay tope, así Tiluchi sigue igual.
- `LiveService.join` rechaza con un nuevo `LiveError('session_full')` cuando la sesión ya llegó al tope. El control tiene que ser atómico: con muchos celulares uniéndose a la vez, no puede quedar nadie de más. Por ejemplo, reservar el lugar con un `ADD playerCount` condicionado a `playerCount < maxPlayers` antes de crear al jugador, y devolverlo si el apodo ya está tomado. El mecanismo exacto queda para el builder.
- `/join` del participante responde 409 con `session_full`, y la pantalla de unirse muestra "La carrera está llena" / "This game is full" (textos de la plataforma, es/en).
- Embolsau pasa el tope elegido en el formulario (por defecto 100). **El máximo es fijo en 100** y se valida en el servidor, no solo en el formulario.

### Para más adelante (fuera de esta versión)

- Pedir más de 100 jugadores, con aprobación de un superadmin.
- Los costos están bien hasta 1000 jugadores (unos $0,50 por sesión de 3 rondas). Para habilitarlo habría que agrupar los toques cada 2 segundos por encima de 300 jugadores, por el límite de 1000 llamadas por segundo de la API, y validarlo con la prueba de carga que ya existe.
- Va en su propio commit, con sus tests en `packages/live`, antes de la actividad.

## Preguntas abiertas

Ninguna.
