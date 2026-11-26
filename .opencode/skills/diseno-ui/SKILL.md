---
name: diseno-ui
description: Usar shadcn tal cual (InputGroup, Select, calendario), color global de marca (tokens --pos-* derivados en el POS) y copia exacta de la estructura de Alegra en todo el sistema, adaptando su HTML/CSS de las capturas a nuestro código.
---

# Diseño de la UI

**Copia exacta de Alegra en todo el sistema** (decisión de Waldy, 23-11-2026 — amplía la del 22-11, que solo cubría el POS): se copia su diseño y se puede adaptar su HTML, CSS, estructura y selectores de las capturas al código propio (Tailwind + shadcn). En el POS (`src/app/(pos)/pos/`) el acento va por los tokens `--pos-*` de `src/app/globals.css` (aliases Tailwind `pos-*`), derivados de `--primary` / `--brand-primary`; el candado `src/lib/pos/diseno-pos.test.ts` prohíbe `--primary` directo y hexes de marca ahí. Lo que siempre es nuestro: el **logo Medoxigas** y la marca.

## shadcn, tal cual

Los componentes viven en `src/components/ui/`. Úsalos; no los edites. Personaliza donde los consumes. Guía general: `docs/plantilla-diseno.md`.

- **Prefijos y sufijos (RD$, %)** dentro del recuadro: `InputGroup`, `InputGroupAddon`, `InputGroupText` e `InputGroupInput` de `src/components/ui/input-group.tsx`.
- **Listas desplegables:** usa `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` y `SelectValue` de `src/components/ui/select.tsx`, o `SelectCampo` de `src/components/select-campo.tsx`. No uses `NativeSelect` (la lista nativa del navegador) fuera de `components/ui`.
- **Fechas:** usa `DatePicker` de `src/components/date-picker.tsx`. No pongas `<input type="date">` nativo en pantallas nuevas.

**No leas tipos en `node_modules`** (`@base-ui/react`, `react-day-picker`, etc.) para adivinar la API. Copia un uso real del repo, como los de la sección siguiente.

## Cómo se usa (copiar de aquí)

### InputGroup (prefijo o sufijo dentro del recuadro)

Patrón de `src/components/documento-venta/documento-venta-form.tsx`. `align="inline-start"` pone el texto a la izquierda (RD$); `align="inline-end"` lo pone a la derecha (%).

```tsx
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

<InputGroup>
  <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
    RD$
  </InputGroupAddon>
  <InputGroupInput
    inputMode="decimal"
    value={precio}
    onChange={(evento) => setPrecio(evento.target.value)}
  />
</InputGroup>

<InputGroup>
  <InputGroupInput
    inputMode="decimal"
    value={porcentaje}
    onChange={(evento) => setPorcentaje(evento.target.value)}
  />
  <InputGroupAddon align="inline-end" className="pr-2 pl-0 text-sm text-slate-500">
    %
  </InputGroupAddon>
</InputGroup>
```

### Select (shadcn sobre Base UI, no NativeSelect)

Patrón de `src/components/contactos/formulario-contacto.tsx`. El `Select` lleva `items` (array `{ value, label }`) y los mismos valores en `SelectItem`.

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPCIONES_TIPO = TIPOS_CONTACTO.map((tipo) => ({ value: tipo.valor, label: tipo.etiqueta }));

<Select
  name="tipo"
  defaultValue={contacto?.tipo ?? "cliente"}
  items={OPCIONES_TIPO}
  onValueChange={cambiarTipo}
>
  <SelectTrigger id="tipo" className="w-full">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {OPCIONES_TIPO.map((tipo) => (
      <SelectItem key={tipo.value} value={tipo.value}>
        {tipo.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

Controlado: `value={...}` y `onValueChange={(valor: string | null) => { if (valor) ... }}`, como en `formulario-contacto.tsx` y `documento-venta-form.tsx`.

### DatePicker, Calendar y Popover

`DatePicker` ya está en `main`: úsalo así, como en `src/components/documento-venta/documento-venta-form.tsx`. `value` y `onChange` van en `yyyy-MM-dd`; la etiqueta se ve en `dd/MM/yyyy`.

```tsx
import { DatePicker } from "@/components/date-picker";

<DatePicker id="fecha" value={fecha} onChange={setFecha} />
```

Para armar un picker a mano (o un rango), copia `src/components/date-picker.tsx` o `src/components/date-range-picker.tsx`. Esencia:

```tsx
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

<Popover open={abierto} onOpenChange={setAbierto}>
  <PopoverTrigger render={<Button type="button" variant="outline" />}>
    {etiqueta}
  </PopoverTrigger>
  <PopoverContent align="start" sideOffset={4} className="w-auto overflow-hidden p-0">
    <Calendar
      mode="single"
      locale={es}
      captionLayout="dropdown"
      selected={fecha}
      defaultMonth={fecha ?? new Date()}
      onSelect={seleccionar}
    />
  </PopoverContent>
</Popover>
```

`PopoverTrigger` usa la prop `render` (no `asChild`). No leas los `.d.ts` de `react-day-picker` ni de `@base-ui` en `node_modules`.

## Colores Medoxigas

Preset por defecto: `src/styles/presets/medoxigas.css`, importado desde `src/app/globals.css`. Azul principal `#1e56c7`, oscuro `#0a2352`, hover `#123c8c`, suave `#eaf0fc`. En los componentes usa tokens (`bg-primary`, `text-primary`, `ring`, `--brand-dark`), no hex sueltos.

Texto en español de RD. Números con formato `es-DO`. Fechas y horas en `America/Santo_Domingo`.

## Guías y exports de Alegra

Estudio en `docs/alegra/` y exports crudos SingleFile fuera del repo en `/root/alegra-refs/` (plantilla y regla de medición; nunca se commitean). Para factura y calendario:

- `docs/alegra/css-factura/GUIA-DISENO-FACTURA.md`
- `docs/alegra/css-factura/GUIA-CALENDARIO.md` (capturas `docs/alegra/capturas/calendario-*.png`)

Se copian medidas, estructura y ritmo adaptándolos con Tailwind + shadcn: el color global `--brand-primary` en Contabilidad y, en el POS, los tokens `--pos-*` que derivan de ese mismo color. Los archivos crudos (`index.html`, `styles.css`, `original/`) no están en el repo a propósito.
