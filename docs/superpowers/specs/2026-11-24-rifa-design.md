# Rifa solidaria: sorteo con duendes al agua

Fecha: 2026-11-24 · Estado: borrador para aprobar

## Qué es y por qué

Rifa solidaria es la tercera actividad de Chacota, después de Tiluchi y Embolsau. Sirve para elegir al azar a una persona (o un ítem) de una lista, de forma visual y divertida, en la pantalla grande de un meetup o un stream. El nombre viene de las rifas solidarias, algo clásico de Santa Cruz de la Sierra. No hay premios ni plata de por medio: es solo el sorteo.

Cada ronda tiene un ganador. Antes de que salga, X personas se van **"al agua"**: salen sorteadas una por una, cada una con una escena animada y graciosa, y recién después aparece el ganador. La estética es la del carnaval cruceño, con el **duende** como personaje. El duende es una figura de la cultura camba: viste de blanco y tiene un gran sombrero de saó que le tapa toda la cara. Lleva colgado un cartel con el nombre de quien se va al agua.

## Objetivos

- Que el admin arme la lista de dos formas: escribiendo los nombres (**modo lista**) o dejando que la gente se anote con el QR desde el celular (**modo QR**).
- Rondas con X al agua y 1 ganador, con escenas que el público quiera mirar, en la pantalla grande y, en el modo QR, en todos los celulares a la vez.
- Que el admin tenga el control de la bolsa: elige si los que van al agua quedan descartados o vuelven, descarta y devuelve a mano, y reinicia.
- Que funcione en computadora y en celular, tanto la pantalla del admin como la de los participantes.
- Español (voseo) e inglés.

## No objetivos

- Premios, boletos pagos, donaciones o cobros.
- Historial: no hace falta guardar nada. La plataforma igual guarda resultados cuando hay jugadores (ver "Resultados").
- Escenas o personajes subidos por cada organización. El set es fijo y viene con la actividad.
- Más escenas que las cuatro de esta versión.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que el sorteo lo decida un navegador o un celular, o que se pueda manipular.
- Que la pantalla grande y los celulares muestren escenas o resultados distintos.
- Que un doble clic, el clicker o dos pestañas del admin disparen dos rondas a la vez.
- Que recargar la página del admin pierda la bolsa o los ganadores.
- Que en el modo lista aparezcan un lobby, un PIN o un QR que no sirven para nada.
- Que la actividad agregue tablas, Lambdas o variables de entorno, o que importe código de Tiluchi o Embolsau.

## Restricciones

- Presupuesto del proyecto: $300 al año como máximo. Una rifa es barata: unas pocas acciones del admin y un evento por ronda.
- Las reglas, el sorteo y los tiempos corren en el servidor con `live.now()` y un generador aleatorio seguro (`crypto.randomInt`).
- El estado de la rifa va en el estado de la sesión. Por diseño de la plataforma, el registro de la sesión (`SESSION#<id>`) no expira. Por eso las sesiones sin celulares (modo lista) llevan `ttl: live.ttl()` en su registro, y los nombres escritos se borran a las 48 h (ver "Cambio de plataforma"). Si la actividad guarda algo aparte, va bajo `sessionKeys.module(sessionId, 'rifa', ...)` con `ttl: live.ttl()`.
- Los celulares no cargan imágenes de S3. Las escenas son SVG dibujado en código y vienen con la actividad.
- Arranca como `experimental`.

## Enfoques considerados

Cómo encajan los dos modos en la plataforma:

1. **Una sola actividad con sesión en el servidor para los dos modos (elegido).** El modo QR es una sesión normal, con lobby, PIN y celulares. El modo lista también es una sesión, pero "sin celulares": arranca directo en la rifa, sin lobby ni PIN, y nadie se puede unir. En los dos modos sortea el servidor, la bolsa queda guardada en la sesión y las transiciones protegidas por versión evitan las rondas dobles. Requiere un cambio de plataforma: una sesión puede saltarse el lobby, y una actividad puede reemplazar el podio 1-2-3 por su propia pantalla final. Ese cambio hace falta igual en el modo QR, porque ahí tampoco queremos el podio. Lo elegimos porque hay un solo motor para los dos modos y respeta la regla de que el servidor decide.
2. **El modo lista como página solo del navegador y el modo QR como sesión.** El modo lista sale más simple y no toca la plataforma. Pero se pierde al recargar, el sorteo lo decide el navegador y el mismo show queda en dos caminos distintos. Y el cambio de plataforma para quitar el podio hace falta igual por el modo QR. Descartado.
3. **Meter los nombres escritos como "jugadores" dentro de una sesión normal.** Obliga a mostrar el lobby con QR en el modo lista. Descartado.

Cómo llega una ronda a las pantallas *(decisión del diseñador)*:

- **Un solo aviso por ronda (elegido).** El servidor sortea toda la ronda de una vez y manda un solo evento `rifa.round` con la secuencia completa (los al agua con su escena, el ganador) y una hora de arranque en el reloj del servidor. Cada pantalla la reproduce sola, sincronizada con `clock.now()`. Alguien muy curioso podría ver el ganador unos segundos antes inspeccionando la red. Para una rifa de meetup no importa: el resultado ya está decidido y no se gana nada con saberlo antes.
- **Un aviso por paso**, que la pantalla del admin va pidiendo, como el `tick` de Embolsau. No hay forma de adelantarse, pero suma partes móviles y depende de que la pestaña del admin siga marcando el ritmo. Descartado.

## Lo que se decidió

### Crear una rifa

En `/app/orgs/<slug>/rifa` hay un formulario "Nueva rifa", como el de Embolsau. No hay contenido guardado: las opciones van como `content` de `createSession` y quedan en el estado de la sesión.

- **Nombre** de la rifa (por defecto "Rifa solidaria", hasta 80 caracteres).
- **Cómo se anota la gente:** "Escribo los nombres" (modo lista) o "Se anotan con el QR" (modo QR).
- **Al agua por ronda (X):** de 0 a 5, por defecto 2. *(Decisión mía: el tope de 5 mantiene cada ronda por debajo de un minuto de animación.)*
- **Nombres** (solo en el modo lista): un nombre por línea. Se recortan los espacios y se ignoran las líneas vacías. De 1 a 40 caracteres por nombre y hasta 500 nombres *(decisión mía)*. Hacen falta al menos 2. Los nombres repetidos se permiten y cuentan como boletos separados, y el formulario avisa que hay repetidos *(decisión mía)*. El servidor valida todo, no solo el formulario.
- En el modo QR no hay tope de inscritos: no se pasa `maxPlayers`.

Al enviar, el admin va directo a `/host/<sessionId>`, como en las otras actividades.

### Flujo de una sesión

- **Modo QR:** lobby de la plataforma (PIN, QR, apodos). El "Empezar" del lobby abre la rifa y muestra la bolsa, sin sortear todavía. No hay un paso aparte para "Abrir la rifa": el mismo `advance` que saca a la sesión del lobby la abre. Desde ahí, cada vez que el admin aprieta el botón principal ("Sortear ronda"), o usa el clicker o el teclado, se sortea una ronda.
- **Modo lista:** sin lobby. La pantalla del admin abre directo en la rifa con la bolsa llena.
- Quien se une con el QR después de empezar entra directo a la bolsa *(confirmado)*.
- El botón "Terminar" de la plataforma cierra la rifa y muestra la pantalla final con la lista de ganadores (ver "Cambio de plataforma").

### Reglas de la bolsa

Cada inscrito (jugador de la plataforma en el modo QR, o nombre de la lista en el modo lista) está en uno de tres estados: **en la bolsa**, **descartado** o **ganador**.

- **Antes de disparar una ronda**, el admin elige qué pasa con los que salgan al agua: **descartarlos** o que **vuelvan a la bolsa**. El selector queda junto al botón principal y se guarda en el estado de la sesión, así el botón, el clicker y el teclado sortean con esa opción.
- **Una ronda** se sortea entre los que están en la bolsa. Con `n` en la bolsa salen `k = min(X, n − 1)` al agua, uno por uno, y después 1 ganador. Esto cubre el caso de pocos en la bolsa: si quedan X o menos, todos menos uno van al agua y el último gana. Si queda uno solo, gana directo, solo con la animación del ganador. Con la bolsa vacía no se puede sortear: el botón se apaga y, si igual llega un `advance`, no hace nada. No hay un error `empty_bag`.
- **El ganador** sale de la bolsa y pasa a la lista de ganadores. No puede volver a ganar hasta un reinicio *(confirmado)*.
- **A mano:** el admin puede descartar a cualquiera que esté en la bolsa y devolver a la bolsa a cualquier descartado.
- **Reiniciar:** todos los inscritos vuelven a la bolsa, incluidos los descartados y los ganadores. La lista de ganadores **no se borra**: queda una marca de "reinicio" en la lista, porque es el único registro *(confirmado)*.
- Mientras se reproduce una ronda no se puede sortear otra ni reiniciar: hasta que termina la reproducción el servidor no hace nada (sin error), y el botón queda apagado *(decisión mía)*. Descartar y devolver sí se puede, y vale para la ronda siguiente.
- La plataforma no se entera de cuándo alguien se va de la sala. Quien se fue sigue en la bolsa hasta que el admin lo descarte.
- En el modo QR, una persona puede anotarse más de una vez (con otro apodo, desde una ventana privada) y cada ingreso cuenta como un boleto. Se acepta: el admin ve todos los apodos y descarta a mano los sospechosos. No hay control por dispositivo *(confirmado)*.

### Sorteo (servidor)

- El sorteo vive en `ActivityServer.advance`, que es el botón principal. Lee la bolsa, sortea con `crypto.randomInt` los `k` al agua y el ganador, y elige al azar una de las cuatro escenas para cada al agua. Después guarda todo con `live.transition` (protegida por versión) y publica `rifa.round` con la secuencia y `startsAt = live.now() + 1500 ms`, para que el evento llegue a todos antes de arrancar.
- Si la rifa todavía no está abierta (el `advance` que saca a la sesión del lobby en el modo QR), `advance` solo la abre, sin sortear. En el modo lista la rifa nace abierta.
- La duración de la reproducción la calcula el servidor con las duraciones fijas de cada escena (unos 6 a 8 s por cada al agua y unos 6 s el ganador). Así sabe hasta cuándo ignorar otra ronda (`round.endsAt`).
- Las acciones del admin son `hostActions`: `setOnOverboard` (descartar o volver), `discard`, `restore` y `reset`. Cada una transiciona con versión y devuelve la nueva `version`, así el botón principal queda sincronizado. Hay una más, `bag()`, que solo lee (ver "Pantalla del admin").
- Cada cambio de la bolsa publica un evento corto (`rifa.bag`) con los ids que cambiaron de estado, para que cada celular sepa si quedó descartado, devuelto o reiniciado.
- El generador aleatorio se puede inyectar, para que los tests sean deterministas.

### Pantalla del admin (`Host`)

Validada con bocetos en esta conversación: la **opción B, "la bolsa a la vista"**.

```
┌───────────────────────────────────────────────────────────────┐
│ [logo org]  Rifa del meetup            rifa · PIN 482 913 (QR)│
│ ┌──────────────────────────────────────┐ ┌──────────────────┐ │
│ │                                      │ │ 👑 Ganadores      │ │
│ │        escenario (escena / ganador)  │ │ Carla   ronda 1  │ │
│ │                                      │ │ Diego   ronda 2  │ │
│ └──────────────────────────────────────┘ └──────────────────┘ │
│ Ana  Beto  👑Carla  Dani  💧Eli  Fer  Gabo  Juan Pablo  …       │
│ Tocá un nombre para descartarlo o devolverlo · ↺ Reiniciar     │
│        [Al agua: descartar | vuelven]  [Terminar] [Sortear]    │
└───────────────────────────────────────────────────────────────┘
```

- Escenario arriba y lista de ganadores por ronda a la derecha (con las marcas de reinicio).
- Abajo, todos los inscritos como cartelitos. En la bolsa se ven normales, los descartados con 💧 y tachados, y los ganadores con 👑 en dorado. El estado no depende solo del color. Tocar un cartelito lo descarta o lo devuelve, y un ganador no se puede tocar. Con muchos inscritos, los cartelitos se achican y la zona se desplaza.
- El selector "Al agua: descartar / vuelven a la bolsa" y "↺ Reiniciar" van en la pantalla de la actividad. "Terminar" y el botón principal son de la plataforma, y el texto del botón lo pone la actividad (`setAdvanceLabel`: "Sortear ronda", "Sorteando…"). Con la bolsa vacía o una ronda en curso, la actividad lo apaga (`setAdvanceDisabled`).
- El subtítulo del encabezado muestra el progreso (`setSubtitle`), por ejemplo "Ronda 3 · 23 en la bolsa".
- En el modo QR, la lista de cartelitos se actualiza cuando entra alguien: cuando cambia `playerCount`, la pantalla vuelve a pedir la bolsa con la acción `bag()`. Devuelve `{ version, entries, rounds, round, winners, onOverboard }`: con la ronda y los ganadores, si la respuesta llega antes que el evento `rifa.round`, la pantalla igual tapa el resultado hasta su paso y no adelanta nada de esa ronda.
- En un celular (admin en el teléfono) se apila: escenario, ganadores, cartelitos y controles. Todo se maneja desde esta pantalla *(confirmado)*.
- La pantalla del admin reproduce cada ronda a partir del evento `rifa.round`, igual que los celulares. Así, dos pestañas del admin (por ejemplo, el celular como control y la laptop en el proyector) muestran las mismas rondas. En el modo lista no se conecta ningún celular: el evento solo lo escucha la pantalla del admin, por la misma conexión en tiempo real que el marco de la plataforma ya usa en todas las sesiones *(decisión mía, después de la revisión: hoy el botón principal del marco no le devuelve a la actividad el resultado de `advance`)*.

### Celular (`Play`, solo modo QR)

- Fuera de una ronda muestra su estado: "Estás en la bolsa", "Quedaste descartado" o "¡Ganaste en la ronda N!".
- Durante una ronda reproduce la misma secuencia que la pantalla grande, sincronizada con el reloj del servidor.
- Al que **se va al agua**: después de su escena se le inunda la pantalla. Sube el agua con olas y burbujas, su cartel queda flotando arriba y abajo dice "Volvés a la bolsa" o "Quedaste descartado", según lo que eligió el admin.
- Al que **gana**: su nombre en neón (titila al prenderse), una corona dorada que cae y rebota, lluvia de oro y "¡Ganaste!".
- Quien se reconecta a mitad de una ronda la retoma donde va, a partir de `startsAt` y del `snapshot`.
- Justo después de un reinicio, el `snapshot` del celular trae `round: null`: el celular espera la ronda siguiente en vez de volver a la última, igual que uno que vio el reinicio en vivo.

### Escenas

Validadas con bocetos animados en esta conversación (ver "Referencias"). Cada una dura unos 6 a 8 s y termina con "¡Al agua!". El servidor elige una al azar para cada persona que va al agua.

1. **El retrete:** el cartel con el nombre cae a la taza con agua clara, alguien tira la cadena y el cartel se va girando en espiral hasta desaparecer, con burbujas.
2. **El globazo (carnaval):** el duende lleva el cartel en el pecho. Le tiran un globo de agua: se aplasta, el sombrero salta y el cartel se moja. Con el segundo globo el cartel se rompe en dos y cae al pasto. De fondo, banderitas verdes, blancas y de colores, serpentinas, confeti en el pasto y un letrero que dice "Carnavalito".
3. **El lagarto:** el duende espera en la orilla y en el río asoman dos ojitos. El lagarto salta, lo atrapa y lo jala al agua. Salpicón, ondas, y al final flotan el sombrero de saó y el cartel.
4. **El micro 72:** el duende espera en la parada del 72. Llega una nube y un diluvio lo deja tirado en la vereda. Pasa el micro de la línea 72 (blanco con líneas azul y roja), frena un poquito ("¡Pará, 72!"), acelera, lo salpica y no lo levanta.

**El ganador:** se apaga todo y se prende un foco dorado. El nombre se enciende en neón, cae la corona y rebota, hay confeti y destellos, y un duende salta con una bolsa de dulces tirando caramelos.

- Todo es SVG dibujado en código, con animaciones CSS, a partir del SVG de referencia del maintainer. El cuerpo y el sombrero del duende van por separado para poder animarlos. El cartel se dibuja con el nombre de la persona: los nombres largos se achican para entrar.
- Con `prefers-reduced-motion`, las escenas se reemplazan por una versión corta con poco movimiento (el cartel cae y se moja; el ganador aparece sin titilar) *(decisión mía)*.

### Pantalla final

Al apretar "Terminar", la pantalla grande muestra la lista de ganadores por ronda, con las marcas de reinicio, en lugar del podio de la plataforma. También se ve si se recarga la página. En el modo QR, los celulares muestran "¡Gracias!" y el código de 4 letras, sin el renglón de "Quedaste en el puesto N". El ganador ve además "Ganaste en la ronda N", y el código sirve para comprobar quién es.

### Resultados

- **Modo lista:** no hay jugadores de la plataforma, así que no se guarda nada (la plataforma no guarda sesiones sin jugadores).
- **Modo QR:** la plataforma guarda los resultados de siempre. Para que tengan sentido, cada victoria suma 1 punto al jugador, y `results` agrega la columna "Ganó en" con los números de ronda (por ejemplo "1, 4") *(decisión mía; el historial no es un objetivo)*.

### Datos

- El estado de la sesión (`RifaState`) guarda el modo, X, la opción "descartar o volver", si la rifa ya está abierta (`opened`), los ids descartados y ganadores, la lista de ganadores con sus marcas de reinicio, cuántas rondas van y la última ronda (secuencia, `startsAt` de cada paso, `endsAt`). En el modo lista también guarda los nombres, cada uno con un id propio. Con 1000 inscritos esto entra con holgura en un ítem de DynamoDB.
- Todo cambio va por `live.transition`. Solo escribe el admin, así que no hay escrituras concurrentes de muchos celulares ni hace falta repartir en particiones.
- **Cuánto duran los datos:**
  - **Modo lista:** el registro de la sesión, con los nombres escritos, se borra a las 48 h *(confirmado)*.
  - **Modo QR:** el registro de la sesión queda, como en cualquier actividad. Guarda los ids de los ganadores con su apodo, igual que los resultados de la plataforma, que también conservan los apodos.

### Nombre e identidad

- Nombre: **Rifa solidaria**. Id `rifa`: URLs `/app/orgs/<slug>/rifa`, API `/m/rifa/*` (no hace falta ninguna ruta propia en esta versión), eventos `rifa.*` y mensajes `rifa.*`.
- Ícono: el sombrero de saó. Color de la tarjeta: un rosado o magenta de carnaval donde el texto blanco se lea con contraste de al menos 4.5:1 *(decisión mía)*.

## Cambio de plataforma

Va en su propio commit, con sus tests en `packages/live` y en `apps/web`, antes de la actividad.

1. **Sesiones sin celulares.** `prepare` puede devolver `phones: false`. La sesión se guarda con ese dato y se crea directamente en `running`, sin lobby. Su registro lleva `ttl: live.ttl()`, así se borra a las 48 h, porque nunca tiene resultados que dependan de él *(confirmado)*. `join` la rechaza como si no existiera (`session_not_found`). El marco del presentador no muestra el PIN en el encabezado. Las sesiones de siempre siguen igual.
2. **Pantalla final propia.** Una actividad puede reemplazar el podio:
   - En el presentador con un componente propio (por ejemplo `ActivityWeb.Final`).
   - En el celular, quitando el renglón del puesto (el código se queda).
   - La pantalla final tiene que poder pedir datos de la actividad también con la sesión terminada (hoy `snapshot` devuelve `{}` del módulo cuando la sesión terminó), y verse igual después de recargar.

   El mecanismo exacto queda para el builder. Tiluchi y Embolsau siguen con el podio.
3. Actualizar `docs/actividades.md` con las dos opciones nuevas.

## Lo que queda para el builder

- El mecanismo exacto del cambio de plataforma (nombres de campos y props, cómo llega la pantalla final a los datos después de terminar).
- Cómo la actividad apaga el botón principal del marco (bolsa vacía o ronda en curso), y que un sorteo que no corresponde (bolsa vacía, ronda en curso) no rompa el botón. Resuelto: `advance` no hace nada y devuelve la sesión como estaba, sin error, porque `advanceSessionAction` solo atrapa `invalid_transition` y `session_ended`.
- El arte fino de las escenas y del duende a partir de los bocetos, y las duraciones exactas de cada escena.
- Qué muestra el cartel con nombres muy largos y cuánto se achican los cartelitos con cientos de inscritos.
- Los textos finales en español (voseo) y en inglés.
- Tests con DynamoDB Local:
  - `prepare` en los dos modos y su validación.
  - El sorteo, con `k = min(X, n − 1)`, bolsa de 1 y bolsa vacía, y con el generador aleatorio inyectado.
  - Descartar y devolver, al agua descartados o de vuelta, reinicio, y que el ganador no repita hasta un reinicio.
  - Dos sorteos a la vez, donde solo uno pasa.
  - Que no se pueda sortear durante la reproducción.
  - Una sesión completa en cada modo.
- Una prueba e2e del recorrido, como la de Embolsau.

## Referencias

Los bocetos están en `.superpowers/brainstorm/27589-1795497188/content/` (carpeta local, fuera de git):
- `pantalla-admin.html`: opción B.
- `escenas-al-agua-v2.html`: las cuatro escenas, el ganador y los dos celulares.
- El SVG del duende que pasó el maintainer en esta conversación está dentro de esos bocetos (`d-body` y `d-hat`).

## Preguntas abiertas

Ninguna.
