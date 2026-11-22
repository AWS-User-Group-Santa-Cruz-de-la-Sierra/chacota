# Chacota

Juegos comunitarios para meetups y streams, hechos por y para los AWS User Groups.
Es open source (Apache-2.0) y cualquiera puede desplegarlo en su propia cuenta de AWS.

**Tiluchi** es el primer juego: quizzes estilo Kahoot con editor, modo presentador y modo participante.

## Estado

| Hito | Estado |
|---|---|
| Monorepo + CI | ✅ |
| `@chacota/core`: schema, puntaje, import/export | ✅ |
| Auth + organizaciones | ⏳ |
| Editor | ⏳ |
| Motor de partida en tiempo real (AppSync Events) | ⏳ |
| Presentador + participante | ⏳ |

## Desarrollo

```sh
corepack enable   # o: npm i -g pnpm
pnpm install
pnpm test
```

## Importar preguntas

| Formato | Notas |
|---|---|
| `.xlsx` | Plantilla de Kahoot: Question, Answer 1–4, Time limit (sec), Correct answer(s). Encabezados en inglés o español. |
| `.csv` | Mismas columnas que la plantilla. |
| `.json` | Formato nativo de Chacota (`chacota.tiluchi` v1), sin pérdida de datos. |

Las filas con dos respuestas *Verdadero/Falso* (o *True/False*) se convierten en preguntas de verdadero o falso. Las filas sin respuesta correcta se importan como encuestas.
