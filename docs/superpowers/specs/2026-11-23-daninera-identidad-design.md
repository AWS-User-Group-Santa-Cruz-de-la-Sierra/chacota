# Dañinera: mascota y favicon de Chacota

Fecha: 2026-11-23 · Tamaño: cambio chico

## Intención

Cerrar la versión final de la identidad visual de Chacota. La carita con sombrero de saó (`~/Downloads/chacota.png`, 1254×1254 RGBA, borde crema tipo sticker) pasa a ser la mascota oficial, **Dañinera**, y reemplaza al pajarito amarillo como logo. La app también necesita un favicon propio basado en ella.

## Enfoques considerados

- **A) Se mantiene la paleta "Noche cruceña"** y Dañinera entra como logo y mascota. *Elegido*: es poco trabajo, respeta los mockups ya aprobados y el borde sticker funciona sobre el morado.
- B) Se rehace la paleta con los tonos de Dañinera (paja, crema, negro, rosa). Se descartó porque obliga a retocar casi todas las pantallas.

Para el favicon se probó reducir el PNG: a 32 px se lee bien y a 16 px no se entiende. Se usa el PNG reducido de todas formas, porque los navegadores actuales usan 32 px o más. Una versión de 16 px dibujada a mano queda para después.

## Diseño

- **Fuente:** el PNG original se copia en `docs/brand/daninera.png`.
- **Asset de la app:** `apps/web/public/brand/daninera.png`, reducido a 256 px.
- **Logo:** `ChacotaMark` (`apps/web/src/components/logo.tsx`) muestra la imagen de Dañinera en lugar del SVG del pajarito y mantiene la prop `size`. `Logo` sigue mostrando la palabra "chacota" al lado. Se aplica en la portada, en la barra de `/app` y en la pantalla del jugador. La imagen tiene `alt="Dañinera"`; queda `aria-hidden` cuando va junto a la palabra.
- **Favicons** (convenciones de archivo de Next en `apps/web/src/app/`):
  - `favicon.ico` con 16, 32 y 48 px, que reemplaza al de por defecto;
  - `icon.png` de 512 px;
  - `apple-icon.png` de 180 px.

  Se generan una sola vez desde el PNG con `sips` y un script descartable que arma el `.ico`. En el repo solo quedan los archivos generados, sin script ni dependencias nuevas.
- **Memoria y documentación:** se registra que la mascota se llama Dañinera y que la paleta no cambió.

## Fuera de alcance

- Cambios de paleta o de tokens.
- Tiluchi: sigue con su hornero y su color teal.
- Un favicon de 16 px dibujado a mano.
- Un manifest de PWA.

## Decisiones del implementador

- Si se usa `<img>` o `next/image` en `ChacotaMark`.
