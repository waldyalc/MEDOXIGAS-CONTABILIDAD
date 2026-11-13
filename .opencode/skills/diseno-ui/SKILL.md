---
name: diseno-ui
description: Usar shadcn tal cual (InputGroup, Select, calendario), colores Medoxigas y las guías de docs/alegra, sin copiar código de Alegra.
---

# Diseño de la UI

Inspirado en Alegra (formas simples, todo enlazado), con **colores y componentes de Medoxigas**. No es una copia: nada de código, textos largos, logos ni CSS de Alegra.

## shadcn, tal cual

Los componentes viven en `src/components/ui/`. Úsalos; no los edites. Personaliza donde los consumes. Guía general: `docs/plantilla-diseno.md`.

- **Prefijos y sufijos (RD$, %)** dentro del recuadro: `InputGroup`, `InputGroupAddon`, `InputGroupText` e `InputGroupInput` de `src/components/ui/input-group.tsx`. En `prueba` el componente ya está; el formulario de factura (`factura-form.tsx`) todavía no lo usa.
- **Listas desplegables:** usa `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` y `SelectValue` de `src/components/ui/select.tsx`. No uses `NativeSelect` (la lista nativa del navegador) en formularios nuevos ni al retocar los existentes. Hoy varios formularios (incluida la factura) todavía usan `NativeSelect`.
- **Fechas:** en `prueba` no existe `src/components/date-picker.tsx`. Está previsto en la rama `feat/fac-ajustes`. Mientras tanto está `Calendar` (`src/components/ui/calendar.tsx`) y `Popover`. Cuando el date picker entre a `prueba`, úsalo. No pongas `<input type="date">` nativo en pantallas nuevas.

## Colores Medoxigas

Preset por defecto: `src/styles/presets/medoxigas.css`, importado desde `src/app/globals.css`. Azul principal `#1e56c7`, oscuro `#0a2352`, hover `#123c8c`, suave `#eaf0fc`. En los componentes usa tokens (`bg-primary`, `text-primary`, `ring`, `--brand-dark`), no hex sueltos.

Texto en español de RD. Números con formato `es-DO`. Fechas y horas en `America/Santo_Domingo`.

## Guías de Alegra (medidas, no código)

Estudio en `docs/alegra/`. Para factura y calendario:

- `docs/alegra/css-factura/GUIA-DISENO-FACTURA.md`
- `docs/alegra/css-factura/GUIA-CALENDARIO.md` (capturas `docs/alegra/capturas/calendario-*.png`)

Pasan medidas, colores y ritmo. Aplícalos con Tailwind + shadcn y el azul de Medoxigas, no con el teal de Alegra. No copies ni pegues `index.html`, `styles.css` ni `original/` (no están en el repo a propósito).
