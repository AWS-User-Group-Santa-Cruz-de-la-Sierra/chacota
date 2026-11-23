# Dañinera: mascota y favicon — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** reemplazar el pajarito del logo de Chacota por la mascota Dañinera y darle a la app favicons propios basados en ella.

**Arquitectura:** Next carga los íconos por convención de archivos en `apps/web/src/app/`, así que no hace falta tocar metadata. Se generan una sola vez con `sips` y un script descartable fuera del repo (scratchpad) que arma el `.ico`; solo se commitean los archivos generados.

**Tech stack:** Next 16, React 19, Vitest, Node 24, macOS `sips`.

**Spec:** `docs/superpowers/specs/2026-11-23-daninera-identidad-design.md`

## Restricciones globales

- No se agregan dependencias nuevas.
- La paleta (`globals.css` `@theme`) no se toca.
- Tiluchi no se toca.
- El nombre de la mascota es exactamente "Dañinera" (con ñ).
- La imagen fuente es `~/Downloads/chacota.png` (1254×1254 RGBA).

## Foco de revisión

- `favicon.ico` tiene que abrir en navegadores y en el Finder. Las entradas con 256 px o más se escriben como 0 en el byte de ancho/alto. Acá no hay ninguna.
- El logo tiene que verse con la proporción correcta en `size` 30 y 36. Es una imagen cuadrada y no debe deformarse.
- `apps/web/src/app/favicon.ico` vive fuera de `[locale]`. El proxy de next-intl no debe interceptar `/favicon.ico`, `/icon.png` ni `/apple-icon.png`: hay que verificarlo con curl.
- La imagen de 256 px no puede pixelarse en pantallas retina a 36 px (72 px reales), y eso alcanza.

---

### Tarea 1: generar los íconos (una sola vez)

**Archivos (generados):** `docs/brand/daninera.png` (copia del original), `apps/web/public/brand/daninera.png` (256), `apps/web/src/app/icon.png` (512), `apps/web/src/app/apple-icon.png` (180), `apps/web/src/app/favicon.ico` (16/32/48, reemplaza al actual)

- [ ] **Paso 1:** generar los PNG con `sips -z N N`. Armar el `.ico` con un script descartable en el scratchpad: encabezado de 6 bytes, una entrada de 16 bytes por tamaño y los PNG embebidos.
- [ ] **Paso 2: verificar.** `sips -g pixelWidth` da 256, 512 y 180. `file favicon.ico` dice "3 icons". La imagen de 32 px abre bien.
- [ ] **Paso 3: commit** de los archivos generados: `feat(web): Dañinera como ícono de Chacota`.

### Tarea 2: logo con Dañinera

**Archivos:**
- Modificar: `apps/web/src/components/logo.tsx`
- Modificar: memoria `chacota-project-decisions.md`

**Interfaces:**
- Consume: `/brand/daninera.png` (Tarea 1).
- Produce: `ChacotaMark({ size?: number; label?: string })`. Sin `label` queda `alt=""` + `aria-hidden`; con `label` usa ese alt. Se quita la prop `color`: verificar con grep que nadie la pase. `Logo({ size })` no cambia de firma.

- [ ] **Paso 1:** `ChacotaMark` renderiza `<img src="/brand/daninera.png" width={size} height={size}>` con `object-contain`. Se usa `<img>` y no `next/image` porque es un asset local chico; si ESLint marca `@next/next/no-img-element`, se desactiva en esa línea igual que en `presenter.tsx`. `Logo` pasa `aria-hidden` porque la palabra "chacota" ya da el nombre.
- [ ] **Paso 2:** `corepack pnpm --filter @chacota/web typecheck` y `cd apps/web && npx eslint src` → sin errores. 
- [ ] **Paso 3: verificación visual.** Con `pnpm dev`, revisar en el navegador que `/`, `/app` y `/play` muestren a Dañinera sin deformarse. `curl -sI localhost:3000/favicon.ico`, `/icon.png` y `/apple-icon.png` tienen que dar 200 con content-type de imagen. La pestaña tiene que mostrar a Dañinera.
- [ ] **Paso 4:** actualizar la memoria del proyecto: la mascota es Dañinera, reemplaza al pajarito y la paleta "Noche cruceña" se mantiene.
- [ ] **Paso 5: commit** del logo + spec + plan: `feat(web): Dañinera reemplaza al pajarito en el logo`.
