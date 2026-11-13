---
name: diseno-ui
description: Usar shadcn tal cual (InputGroup, Select, calendario), colores Medoxigas y las guías de docs/alegra, sin copiar código de Alegra.
---

# Diseño de la UI

Inspirado en Alegra (formas simples, todo enlazado), con **colores y componentes de Medoxigas**. No es una copia: nada de código, textos largos, logos ni CSS de Alegra.

## shadcn, tal cual

Los componentes viven en `src/components/ui/`. Úsalos; no los edites. Personaliza donde los consumes. Guía general: `docs/plantilla-diseno.md`.

- **Prefijos y sufijos (RD$, %)** dentro del recuadro: `InputGroup`, `InputGroupAddon`, `InputGroupText` e `InputGroupInput` de `src/components/ui/input-group.tsx`.
- **Listas desplegables:** usa `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` y `SelectValue` de `src/components/ui/select.tsx`. No uses `NativeSelect` (la lista nativa del navegador) en formularios nuevos ni al retocar los existentes. Hoy varios formularios todavía usan `NativeSelect`.
- **Fechas:** si existe `src/components/date-picker.tsx`, úsalo (`DatePicker`). Lo introdujo `feat/fac-ajustes`. Si aún no está en tu rama, copia el patrón Calendar + Popover de abajo (o de `src/components/date-range-picker.tsx`). No pongas `<input type="date">` nativo en pantallas nuevas.

**No leas tipos en `node_modules`** (`@base-ui/react`, `react-day-picker`, etc.) para adivinar la API. Copia un uso real del repo, como los de la sección siguiente.

## Cómo se usa (copiar de aquí)

### InputGroup (prefijo o sufijo dentro del recuadro)

Patrón de `factura-form.tsx` en `feat/fac-ajustes`. `align="inline-start"` pone el texto a la izquierda (RD$); `align="inline-end"` lo pone a la derecha (%).

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

### Select (shadcn sobre @base-ui, no NativeSelect)

Patrón exacto de `src/app/(main)/dashboard/contactos/_components/contactos-cliente.tsx`. El `Select` lleva `items` (array `{ value, label }`) y los mismos valores en `SelectItem`.

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPCIONES_TIPO = TIPOS_CONTACTO.map((tipo) => ({ value: tipo.valor, label: tipo.etiqueta }));

<Select name="tipo" defaultValue={contacto?.tipo ?? "cliente"} items={OPCIONES_TIPO}>
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

Controlado (como en la factura de `feat/fac-ajustes`): `value={...}` y `onValueChange={(valor: string | null) => { if (valor) ... }}`.

### DatePicker, Calendar y Popover

Si `src/components/date-picker.tsx` está en tu rama (vino en `feat/fac-ajustes`), úsalo así, como en `factura-form.tsx` de esa rama. `value` y `onChange` van en `yyyy-MM-dd`; la etiqueta se ve en `dd/MM/yyyy`.

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

## Guías de Alegra (medidas, no código)

Estudio en `docs/alegra/`. Para factura y calendario:

- `docs/alegra/css-factura/GUIA-DISENO-FACTURA.md`
- `docs/alegra/css-factura/GUIA-CALENDARIO.md` (capturas `docs/alegra/capturas/calendario-*.png`)

Pasan medidas, colores y ritmo. Aplícalos con Tailwind + shadcn y el azul de Medoxigas, no con el teal de Alegra. No copies ni pegues `index.html`, `styles.css` ni `original/` (no están en el repo a propósito).
