# Búsqueda global flotante

**Estado:** propuesta de diseño. No implementa código, no crea migraciones y no toca datos.
**Rama:** `feat/busqueda-global-spec-orq-2`, desde `prueba` `9ad5813`.
**Decisión de Waldy que manda:** es una **ventana flotante** como la de Alegra (≈ 870 × 690 px, centrada, fondo oscurecido, sidebar de Medoxigas detrás). **No es una página completa**: no existe ni existirá `/dashboard/buscar`.
**Idea central:** grupos por entidad (rail de categorías + tarjetas con metadata y acciones), búsqueda inteligente por fases (determinista → lenguaje natural con LLM → embeddings/OCR para contratos).

---

## Resumen para Waldy (lo que te toca decidir)

1. La ventana reemplaza al `CommandDialog` de hoy y **mantiene el mismo disparador** del topbar y `⌘K` / `Ctrl+K`. Si la migración nueva no está aplicada, la ventana sigue funcionando con Recientes + Ir a + Reportes, igual que hoy.
2. El rail queda exactamente con tus 7 categorías. Mientras escribes sin elegir categoría se ven **todos los grupos**; al tocar una, se filtra. No invento una octava categoría.
3. La búsqueda determinista resuelve nombres, RNC/cédula, NCF, número, referencia, teléfono, correo, monto y fechas (octubre, el mes pasado, esta semana). La IA solo entra cuando la frase es larga y el determinista no encontró nada; **nunca en cada tecla**.
4. Contratos/documentos queda como fase aparte (tabla nueva + OCR + pgvector). El rail ya tiene "Documentos" con un vacío honesto hasta entonces.
5. Hay 12 decisiones abiertas en la sección 6.2; las que más te tocan: etiqueta "Clientes" vs "Contactos", oscuridad del fondo, y qué proveedor de IA se usa.

---

## 0. Lo que existe hoy (verificado en el repo)

| Pieza | Archivo real | Comportamiento actual |
| --- | --- | --- |
| Disparador y diálogo | `src/app/(main)/dashboard/_components/header/busqueda-global.tsx:119-278` | `CommandDialog` con `sm:max-w-lg` (512 px), `top-1/3`, lista `max-h-72` (288 px). Tres grupos: **Recientes** (localStorage, 5), **Ir a** (sidebar aplanado) y **Reportes**. |
| Atajo | `busqueda-global.tsx:140-150` | `⌘K` / `Ctrl+K` escuchado en `document`, ignorando `Alt`. Abre y limpia el texto. |
| Recientes | `busqueda-global.tsx:26-27,85-109` | Clave `medoxigas.busqueda.recientes`, máximo 5, forma `{titulo, url}`, en `localStorage`. |
| Barra del topbar | `src/app/(main)/dashboard/layout.tsx:53-65` | Botón de 36 px (`h-9`), `max-w-xl`, centrado, con `Kbd` "⌘ K"; en móvil solo el icono (`md:hidden`, líneas 166-174 del componente). |
| Sidebar | `layout.tsx:26-34` | `--sidebar-width: 271px`, `z-10` (`src/components/ui/sidebar.tsx:233`). |
| Header | `layout.tsx:46-65` | 70 px, blanco con borde `#e2e8f0`, `z-50` cuando `data-navbar-style=sticky` (línea 50). |
| Diálogo base | `src/components/ui/dialog.tsx:26-63` | Overlay `bg-black/10` + `backdrop-blur-xs`; contenido centrado `sm:max-w-sm`, `rounded-xl`, `ring-1`. |
| `cmdk` | `src/components/ui/command.tsx:36-67,92-106` | `CommandDialog` fuerza `top-1/3 translate-y-0`; `CommandList` corta en 288 px. |
| Búsqueda por lista | `src/lib/listas/busqueda.ts` | `limpiarBusqueda` (quita `"` `\` `*`, máx. 80), `patronIlike`, `condicionesTexto`, `numeroBuscado`, `numeroDocumento` (solo ≤ 6 dígitos, para no confundir con RNC/NCF). |
| Búsqueda de contactos | `src/lib/contactos/busqueda.ts:28-72` | Server action, `ilike` en nombre/RNC/teléfono/correo, 25 por página. |
| Coincidencias | `src/lib/listas/coincidencias.ts` | Ids de contactos por nombre/RNC (tope 200), facturas por número/NCF, pagos por factura. Es el patrón que hoy resuelve "buscar por nombre del cliente" en las listas: **dos viajes** a la base. |
| Rutas por id | `src/lib/enlaces.ts` | `rutaContacto`, `rutaProducto`, `rutaFactura`, `rutaCompra`, `rutaPagoRecibido`, `rutaPagoProveedor`, `rutaGasto`, `rutaCotizacion`, `rutaConduce`, `rutaNotaCreditoVenta`, `rutaNotaDebitoVenta`, `rutaOrdenCompra`, `rutaNotaCreditoCompra`, `rutaFacturaRecurrente`, `rutaAsiento`, `rutaCuenta`. Ya están todas. |
| Catálogo de reportes | `src/lib/reportes/catalogo-reportes.ts:34-86` | 34 entradas; **23 con ruta** y 11 sin ruta (Flujo de caja, 606, 607, 608, IT1, IR-17, etc.). |
| Menú | `src/navigation/sidebar/sidebar-items.ts:59-267` | 10 módulos raíz y 25 subítems; `filtrarItemsPorRol` ya existe. |
| Índices | `supabase/migrations/20261115900000_indices_rendimiento.sql` | Nombre, fecha, número, contacto. **Ninguno de trigrama.** Según `HANDOFF.md`, esta migración seguía sin aplicar al cerrar F16. |
| RLS | `supabase/migrations/20261113140000_motor_contable.sql:2090-2113` | `select` para `authenticated` si `rol_actual()` no es null; escrituras revocadas en todas las tablas. `rol_actual()` en `:397-407`. |
| Volumen real | `HANDOFF.md` | ~19,481 facturas, 5,002 compras, 3,002 pagos a proveedores, 1,023 contactos, 322 productos, ~32,000 documentos y ~258,000 líneas de asiento. |
| Formato de dinero | `src/lib/facturacion/formato.ts:16` y `src/lib/compras/formato.ts:13` | `formatoMoneda` **duplicado** en dos módulos. La ventana no debe crear una tercera copia. |
| Fechas RD | `src/lib/fechas/rangos.ts` | `hoyEnRd`, `rangoEsteMes`, `rangoMesAnterior`, `rangoEstaSemana`, `etiquetaRango`. Reutilizables por el parser. |

**Lo que no existe hoy:** RPC o vista unificada de búsqueda; `pg_trgm` / `unaccent`; buscador global del lado del servidor; recientes por usuario en base; tabla de documentos/contratos; adjuntos; cualquier uso de IA (no hay SDK, ni claves, ni tablas).

---

## 1. UX de la ventana flotante

### 1.1 Forma y medidas

| Propiedad | Valor |
| --- | --- |
| Tipo | `Dialog` (modal), no ruta. Portales al `body`. |
| Ancho × alto | **870 × 690 px** fijos en escritorio |
| Condición de escritorio | viewport ≥ 1024 px de ancho **y** ≥ 780 px de alto |
| Centrado | Centro del **viewport** (no del área de contenido) |
| Backdrop | `black/40` en claro, `black/55` en oscuro, `backdrop-blur-[2px]` |
| Radio | 16 px (`rounded-2xl`); tarjetas 12 px; pastillas 6 px |
| Borde | `ring-1 ring-foreground/10` (el mismo del `DialogContent`) |
| Sombra | `shadow-2xl` suave; el fondo ya separa |
| Z-index | 50 (overlay y popup), con verificación contra el header sticky |

**Responsive**

| Viewport | Comportamiento |
| --- | --- |
| ≥ 1024 × 780 | 870 × 690 centrado |
| 768 – 1023, o alto < 780 | `min(660px, 100vw−32)` × `min(620px, 100dvh−32)`; rail a 168 px; tarjetas a 1 columna si el panel baja de 600 px |
| < 768 | **Sheet inferior** (sección 1.11) |

Nunca se permite scroll de página detrás (`Dialog` ya lo bloquea con `aria-modal`).

### 1.2 Anatomía (medidas exactas)

```
┌────────────────────────────────────────── 870 × 690 ──────────────────────────────────────────┐
│  ⌕  Busca facturas, clientes, NCF, montos…        «factura de Pedro octubre»   ✨ IA   Esc    │ 64
├──────────────┬────────────────────────────────────────────────────────────────────────────────┤
│ Recientes  5 │  Todos los resultados · 27                                     [Quitar filtro]  │
│ Clientes  12 │                                                                                │
│ Productos  4 │  Facturación                                                   8  Ver todos →   │
│ Facturación 8│  ┌──────────────────────────────┐ ┌──────────────────────────────┐             │
│ Compras    0 │  │ 🧾 B0100000123    RD$ 4,500  │ │ 🧾 B0100000124    RD$ 1,200  │             │
│ Documentos – │  │ Pedro Pérez · 12/10/2026     │ │ Pedro Pérez · 03/10/2026     │             │
│ Otros      3 │  │ Cobrada                  ⋯   │ │ Por cobrar               ⋯   │             │
│              │  └──────────────────────────────┘ └──────────────────────────────┘             │
│   190 px     │                                                                                │
│              │  Clientes                                                     12  Ver todos →   │
│              │  ┌──────────────────────────────┐ ┌──────────────────────────────┐             │
│              │  │ PP Pedro Pérez     Cliente   │ │ PD Pedro Díaz    Proveedor   │             │
│              │  │ 1-01-12345-6                 │ │ 1-01-98765-4                 │             │
│              │  └──────────────────────────────┘ └──────────────────────────────┘             │
│              │                                              … 586 px de alto                  │
├──────────────┴────────────────────────────────────────────────────────────────────────────────┤
│ ↑↓ Mover   ↵ Abrir   ⌘↵ Pestaña nueva   Tab Categorías   Esc Cerrar                           │ 40
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Cabecera 64 px**, borde inferior de 1 px.
- **Cuerpo 586 px** = rail 190 + separador 1 + panel 679.
- **Pie 40 px**, borde superior, 12 px de tipografía.
- Panel: padding 20; ancho útil 639; **dos columnas de 313 px con 12 de separación**.

### 1.3 Cabecera: el input

- `InputGroup` de 44 px de alto, radio 10, borde `--input`, fondo `--background`; al enfocar, anillo de 2 px con `--ring` (el patrón de `docs/alegra/css-pagos/GUIA-FORMULARIOS.md`).
- Icono `Search` de 16 px a la izquierda, **no** un botón.
- Placeholder: `Busca facturas, clientes, NCF, montos…` (cambia a `Busca «factura de Pedro en octubre»` a los 4 s sin escribir, como sugerencia rotativa; se detiene al primer carácter).
- A la derecha: chip **IA** (solo si la IA está habilitada y la consulta parece frase), y `Kbd` `Esc`.
- El input es `role="combobox"`, `aria-expanded="true"`, `aria-controls="resultados-busqueda"`, `aria-autocomplete="list"`, `aria-label="Buscar en Medoxigas Contabilidad"`.
- `autoFocus` al abrir; `enterKeyHint="search"` en móvil. **No** se envía formulario: Enter abre el resultado activo.
- Al abrir con texto previo (reabrir tras cerrar), se conserva la última consulta de la sesión y se selecciona el texto.

### 1.4 Rail de categorías (190 px)

| # | Categoría | Icono | Fuente | Conteo |
| --- | --- | --- | --- | --- |
| 1 | Recientes | `Clock` | localStorage (+ base, fase 2) | Sí |
| 2 | Clientes | `Users` | `contactos` | Sí |
| 3 | Productos | `Tag` | `productos` | Sí |
| 4 | Facturación | `Receipt` | facturas, notas, cotizaciones, conduces, recurrentes, pagos recibidos | Sí |
| 5 | Compras | `ShoppingCart` | facturas de proveedor, notas, órdenes, pagos a proveedores, gastos | Sí |
| 6 | Documentos | `FileText` | contratos/adjuntos (fase 4) | "Próximamente" |
| 7 | Otros | `Shapes` | asientos, cuentas, reportes, navegación | Sí |

- Ítem: 36 px de alto, `rounded-lg`, icono 16, etiqueta 13 px medium, conteo 11 px `tabular-nums` a la derecha (`text-muted-foreground`).
- Activo: `bg-secondary text-secondary-foreground` (el `#eaf0fc` / `#0a2352` de Medoxigas). Hover: `bg-muted`.
- **Sin selección por defecto mientras hay texto**: se muestran todos los grupos y una línea "Todos los resultados · 27" con `[Quitar filtro]` si el usuario fijó una categoría.
- Conteo 0: el ítem sigue visible y clicable, con "0" atenuado. Sirve para que el usuario aprenda la taxonomía.
- Pie del rail (opcional, solo si sobra alto): "La búsqueda no cambia datos" en 11 px. No hace falta.

### 1.5 Grupos por entidad

- Cabecera de grupo **sticky** de 36 px: icono 16, nombre 13 px semibold, conteo 12 px, y a la derecha `Ver todos →` (12 px, `text-primary`) cuando hay más de los que se muestran.
- Orden fijo: el del rail. Nunca se reordena por cantidad (el orden estable evita que la ventana "baile" entre pulsaciones).
- Modo **todos**: máximo **4 tarjetas por grupo**; el resto se alcanza con `Ver todos`.
- Modo **categoría fijada**: 20 tarjetas + botón `Ver más` que **añade** otras 20 sin saltar de página.
- Los grupos vacíos no se pintan en modo todos; en modo categoría se pinta el vacío de la sección 1.9.

### 1.6 Tarjeta de resultado (313 × 76 px)

Tres zonas y una fila inferior:

```
┌─────────────────────────────────────────────────────────────┐
│ [avatar/icono 32]  B0100000123            RD$ 4,500      ⋯  │
│                    Pedro Pérez · 12/10/2026                 │
│                    [Cobrada]  01 · Crédito fiscal           │
└─────────────────────────────────────────────────────────────┘
```

- **Identificador** (13 px semibold, truncado): NCF para facturas y notas; número para pagos, compras y asientos; nombre para clientes y productos.
- **Subtítulo** (12 px, `text-muted-foreground`): contacto + fecha `DD/MM/AAAA`; para productos, referencia; para cuentas, código.
- **Monto** (13 px medium, `tabular-nums`, derecha): `formatoMoneda`. En clientes no hay monto: se muestra el RNC/cédula.
- **Fila inferior** (11 px): `PillEstado` (`exito`/`pendiente`/`peligro`/`neutro`/`info`, ya tiene variantes oscuras en `tabla-lista.tsx:36-42`) + un dato de contexto.
- **`⋯`** de 28 px, visible al hover y al foco: `DropdownMenu` con las acciones de la entidad (sección 2.3).
- La tarjeta entera es un **`<a href>`** real (no `onClick`): permite `⌘`/`Ctrl`+clic, clic central y "abrir en pestaña nueva". Al hacer clic normal se guarda el reciente y se cierra la ventana.
- Foco: `ring-2 ring-ring` + `bg-secondary/60` cuando la tarjeta está activa por teclado.
- Avatar: iniciales para contactos (`Avatar` de shadcn), icono por tipo para documentos (16 px, `text-muted-foreground` en un cuadrado `bg-muted rounded-md`).

### 1.7 Acciones rápidas (solo en el estado vacío)

Visibles solo para `admin` y `contador`; `lector` no las ve (no puede crear). Abren formularios que ya existen; **la ventana no crea nada**.

| Acción | Ruta | Nota |
| --- | --- | --- |
| Nueva factura | `/dashboard/facturacion/nueva` | |
| Nueva compra | `/dashboard/compras/nueva` | |
| Registrar pago | `/dashboard/pagos-recibidos/nuevo` | |
| Pago a proveedor | `/dashboard/compras/pagos/nuevo` | |
| Nuevo gasto | `/dashboard/gastos/nuevo` | |
| Nuevo asiento | `/dashboard/contabilidad/asientos/nuevo` | |
| Nuevo contacto | `/dashboard/contactos?nuevo=1` | Requiere leer `nuevo=1` en `contactos-cliente.tsx` (hoy el alta es un diálogo sin URL). Cambio de ~6 líneas. |
| Nuevo producto | `/dashboard/productos?nuevo=1` | Igual, en `productos-cliente.tsx`. |

Presentación: 2 columnas × 4 filas de 40 px (`bg-muted/40`, radio 10, icono 16 + etiqueta 13). Altura total 184 px.

### 1.8 Sugerencias (estado vacío)

Tres tipos, en este orden:

1. **Recientes** — 4 tarjetas compactas de 148 × 64 en una fila (8 si hay espacio, en dos filas). Título, tipo y fecha relativa ("hace 2 días").
2. **Acciones rápidas** — la tabla de arriba.
3. **Sugerencias** — 3 chips de 32 px que **rellenan el input** (no navegan):
   - `factura de Pedro en octubre`
   - `B0100000123`
   - `compras de la semana pasada`

Si no hay recientes (primer uso), en su lugar va una línea: "Tus últimas búsquedas aparecerán aquí" + los 3 chips.

### 1.9 Estados

| Estado | Qué se ve | Reglas |
| --- | --- | --- |
| **Vacío** (sin texto) | Recientes + Acciones rápidas + Sugerencias | Nunca un panel blanco vacío. |
| **Muy corto** (< 2 caracteres) | Solo Sugerencias, con la línea "Escribe al menos 2 letras" | Evita contar 19,000 filas por una letra. |
| **Cargando** | 3 esqueletos de tarjeta (76 px) en el grupo activo, `Skeleton` de shadcn | Si ya había resultados, se quedan al 60 % de opacidad y los esqueletos van arriba del grupo. **Nunca** un spinner que tape la ventana. |
| **Con resultados** | Grupos + conteo total en la barra superior | `aria-live="polite"`: "27 resultados en 4 grupos". |
| **Sin resultados** | "Sin resultados para «xyz»" + 2 ayudas: "Prueba con el NCF, el número o el nombre del cliente" y "Quitar filtros" si hay categoría fijada | No se ofrece "crear" desde aquí (fase 1). |
| **Error** | `Alert` dentro del panel: "No se pudo buscar. Reintentar" + se conservan los últimos resultados | Nunca un toast de error de búsqueda; nunca cerrar la ventana. `console.error` permitido por Biome. |
| **Migración ausente** | Recientes + Ir a + Reportes (lo de hoy), con una nota discreta al pie: "Búsqueda de documentos no disponible" | Es el fallback y permite publicar la UI antes del SQL. |
| **Sin permiso** | El rail no pinta categorías sin acceso y el servidor no devuelve filas | `lector` sí busca; solo pierde las acciones de creación. |

### 1.10 Teclado y accesibilidad

| Tecla | Acción |
| --- | --- |
| `⌘K` / `Ctrl+K` | Abrir / cerrar (toggle) desde cualquier pantalla |
| `Esc` | Cerrar y devolver el foco al disparador |
| Escribir | Filtra (debounce 250 ms) |
| `↓` | Desde el input: foco a la primera tarjeta. Dentro de la lista: siguiente |
| `↑` | Anterior; desde la primera, vuelve al input |
| `↵` | Abrir la tarjeta enfocada |
| `Tab` | Input → rail → tarjetas → pie; `Shift+Tab` al revés |
| `⌘↵` / `Ctrl+↵` | Abrir en pestaña nueva |

**Patrón elegido:** foco real (roving) sobre enlaces, no `aria-activedescendant`. Razón: las tarjetas son enlaces de verdad, y `role="option"` con un `<a>` dentro es ARIA inválido. El input mantiene `aria-controls="resultados-busqueda"` y el contenedor es `role="list"` con `role="listitem"`.

- Cada tarjeta lleva `aria-label` completo: "Factura B0100000123 de Pedro Pérez, 12 de octubre de 2026, RD$ 4,500, cobrada".
- Contraste AA en claro y oscuro; `muted-foreground` sobre `popover` ya cumple en el preset Medoxigas.
- Movimiento: 120 ms `fade` + `zoom-in-95` (lo que ya trae `DialogContent`); se respeta `prefers-reduced-motion` porque las clases `animate-in` de Tailwind ya lo hacen.
- El rail es `role="tablist"`? **No**: son filtros, no pestañas. `nav` + lista de botones con `aria-pressed`.

### 1.11 Móvil: sheet

- `Sheet` (`src/components/ui/sheet.tsx`) con `side="bottom"`, alto `92dvh`, `rounded-t-2xl`, `pb-[env(safe-area-inset-bottom)]`.
- Cabecera del sheet: asa de 36 × 4 + input de 44 px + botón "Cancelar" (44 px de alto, texto, no icono).
- Rail convertido en **chips horizontales** de 36 px con scroll (`overflow-x-auto`, sin scrollbar visible), 12 px de separación.
- Tarjetas a 1 columna, 72 px; grupos con 3 resultados y `Ver más`.
- Pie de atajos oculto (no hay teclado físico); en su lugar, una línea de 32 px: "Toca para abrir · mantén para acciones".
- El disparador sigue siendo el botón de icono del topbar (`md:hidden`, ya existe).
- Al cerrar, el sheet devuelve el foco al icono; el teclado en pantalla se cierra solo.

### 1.12 Modo oscuro

| Elemento | Claro | Oscuro |
| --- | --- | --- |
| Ventana | `bg-popover` (#fff) | `bg-popover` (#101f42 del preset) |
| Borde | `ring-foreground/10` | `ring-white/10` |
| Backdrop | `black/40` | `black/55` (el fondo ya es oscuro; hace falta más para separar) |
| Rail | `bg-muted/30` | `bg-black/20` |
| Ítem activo | `bg-secondary` | `bg-secondary/25` |
| Tarjeta | `bg-card` + `ring-1 ring-border` | `bg-white/[0.03]` + `ring-white/10` |
| Tarjeta activa | `bg-secondary/60 ring-ring` | `bg-white/[0.07] ring-ring` |
| Resaltado del término | `bg-primary/15 text-foreground` | `bg-primary/30 text-foreground` |
| Monto | `text-foreground tabular-nums` | igual |

Nada de hex sueltos: solo tokens del tema. Los `PillEstado` ya traen `dark:`.

### 1.13 Relación con el sidebar, el topbar y `⌘K`

- **El sidebar sigue visible detrás**, atenuado por el backdrop. Con 40 % de negro se reconoce; con 70 % desaparece y Waldy pidió verlo detrás. No se oculta ni se colapsa al abrir.
- **Centrado en el viewport**, no en el área de contenido. Con el sidebar de 271 px abierto, el panel queda 135 px a la derecha del centro del contenido: es lo mismo que hace Alegra y evita acoplar la ventana al layout.
- **El disparador no cambia**: misma barra de 36 px en el topbar, mismo icono en móvil, mismo `Kbd`. Solo deja de abrir un `CommandDialog` y abre la ventana.
- **`⌘K` se mantiene global** en `document`, con `preventDefault`, ignorando `Alt` y `defaultPrevented`. Se añade el toggle (hoy solo abre).
- El header tiene `z-50` cuando `data-navbar-style=sticky` (`layout.tsx:50`). El portal del diálogo también es `z-50` y va después en el DOM, así que gana; aun así, la ventana usará `z-[60]` en su `className` para no depender del orden del DOM. Es un detalle a verificar con la barra sticky activa.
- **No se agrega** `/` como atajo: choca con los inputs y con los formularios del sistema.

### 1.14 Lo que esta ventana no es

- No es una página ni tiene URL propia; no se enlaza desde el menú.
- No reemplaza las búsquedas de cada lista (siguen dentro de su tarjeta, con su paginación).
- No es un chat ni un asistente conversacional.
- No crea, edita ni anula datos: solo navega y abre formularios existentes.
- No muestra entidades para las que el rol no tiene lectura.

---

## 2. Entidades y resultados

### 2.1 Catálogo de entidades (fase 1: 16 + 2 estáticas)

| Entidad (`entidad`) | Grupo | Tabla | Ruta de la tarjeta | Rol |
| --- | --- | --- | --- | --- |
| `contacto` | Clientes | `contactos` | `rutaContacto(id)` | todos |
| `producto` | Productos | `productos` | `rutaProducto(id)` | todos |
| `factura` | Facturación | `facturas` | `rutaFactura(id)` | todos |
| `nota_credito_venta` | Facturación | `notas_credito_venta` | `rutaNotaCreditoVenta(id)` | todos |
| `nota_debito_venta` | Facturación | `notas_debito_venta` | `rutaNotaDebitoVenta(id)` | todos |
| `cotizacion` | Facturación | `cotizaciones` | `rutaCotizacion(id)` | todos |
| `remision` | Facturación | `remisiones` | `rutaConduce(id)` | todos |
| `factura_recurrente` | Facturación | `facturas_recurrentes` | `rutaFacturaRecurrente(id)` | todos |
| `pago_recibido` | Facturación | `pagos_recibidos` | `rutaPagoRecibido(id)` | todos |
| `factura_proveedor` | Compras | `facturas_proveedor` | `rutaCompra(id)` | todos |
| `nota_credito_compra` | Compras | `notas_credito_compra` | `rutaNotaCreditoCompra(id)` | todos |
| `orden_compra` | Compras | `ordenes_compra` | `rutaOrdenCompra(id)` | todos |
| `pago_proveedor` | Compras | `pagos_proveedor` | `rutaPagoProveedor(id)` | todos |
| `gasto_menor` | Compras | `gastos_menores` | `rutaGasto(id)` | todos |
| `asiento` | Otros | `asientos` | `rutaAsiento(id)` | todos |
| `cuenta` | Otros | `cuentas` | `rutaCuenta(id)` | todos |
| `reporte` | Otros | catálogo TS | `ReporteCatalogo.href` | todos |
| `navegacion` | Otros | `sidebar-items.ts` | `item.url` | según rol |

`documento` (contratos/adjuntos) entra en la fase 4 con el grupo **Documentos**.

**Regla de oro de rutas:** la RPC devuelve `entidad` + `id`; **el SQL nunca devuelve URLs**. La traducción a ruta vive en `src/lib/busqueda/rutas.ts`, que reutiliza `src/lib/enlaces.ts`. Así una ruta nueva se arregla en un solo lugar y el candado de la sección 5.1 detecta entidades sin ruta.

### 2.2 Campos que se buscan por entidad

| Entidad | identificador exacto | texto contiene | relación | fecha | monto |
| --- | --- | --- | --- | --- | --- |
| contacto | `rnc_cedula` (9 u 11 dígitos), `telefono` (dígitos) | `nombre`, `correo`, `municipio_provincia` | — | `creado_en::date` | — |
| producto | `referencia` exacta | `nombre`, `descripcion`, `referencia` | — | `creado_en::date` | `precio` |
| factura | `ncf`, `numero` | `notas`, `terminos`, `pie` | `contacto_id` → nombre/RNC | `fecha` | `total` |
| nota_credito_venta / nota_debito_venta | `ncf`, `numero` | `notas` | `contacto_id`; `factura_id` → NCF | `fecha` | `total` |
| cotizacion / remision / orden_compra | `numero` | `notas`, `terminos` | `contacto_id` | `fecha` | `total` |
| factura_recurrente | `numero` | `notas`, `terminos` | `contacto_id` | `fecha_inicio` | — (no hay `total`; sale de las líneas) |
| pago_recibido | `numero` | `notas` | `contacto_id`; `factura_id` → NCF | `fecha` | `monto` |
| factura_proveedor | `ncf`, `numero` | `notas` | `contacto_id` | `fecha` | `total` |
| nota_credito_compra | `ncf`, `numero` | `notas` | `contacto_id` | `fecha` | `total` |
| pago_proveedor | `numero` | `notas` | `contacto_id`; `factura_proveedor_id` | `fecha` | `monto` |
| gasto_menor | `numero`, `ncf` (B13) | `descripcion` | `contacto_id` | `fecha` | `total` |
| asiento | `numero` | `descripcion` | `asiento_lineas.contacto_id` | `fecha` | `total` |
| cuenta | `codigo` exacto o prefijo | `nombre` | — | — | — |
| reporte / navegación | — | nombre del reporte/módulo | — | — | — |

Notas de diseño:

- **Contacto por nombre en un documento**: hoy `coincidencias.ts` lo resuelve con dos viajes (ids de contactos y luego `in (...)`). En SQL es un `join` y desaparece el límite de 200 ids.
- **NCF vs número vs RNC**: el parser decide antes de consultar (sección 4.3). El SQL recibe el campo ya resuelto (`p.ncf`, `p.numero`, `p.identificacion`) y no adivina.
- **Teléfono**: se buscan solo dígitos (`regexp_replace(telefono,'\D','','g')`). "809-555-1234" y "8095551234" dan lo mismo.
- **`numero` es `int`**: nunca `ilike`. Si el término es `#1258`, se busca `numero = 1258` exacto (ya lo hace `numeroBuscado`).
- **Anulados**: se incluyen y se pintan con pill `peligro` "Anulada". No se esconden: Waldy busca justamente para revisar.

### 2.3 Metadata y acciones por tarjeta

| Entidad | Título | Subtítulo | Fila inferior | `⋯` (acciones) |
| --- | --- | --- | --- | --- |
| contacto | Nombre | RNC/cédula | Pill "Cliente/Proveedor/Ambos" + teléfono | Abrir ficha · Estado de cuenta · Copiar RNC · Llamar · Escribir correo |
| producto | Nombre | Referencia | Pill "Producto/Servicio" + "ITBIS 18 %" | Abrir ficha · Kárdex · Copiar referencia |
| factura | NCF | Cliente · fecha | Pill estado + tipo de comprobante | Abrir · Registrar pago · Copiar NCF · Ver asiento |
| nota (venta/compra) | NCF | Cliente · fecha | Pill estado + "Nota de crédito/débito" | Abrir · Copiar NCF |
| cotización / conduce / orden | `N.º 1258` | Cliente · fecha | Pill estado | Abrir · Copiar número |
| pago recibido / proveedor | `N.º 66` | Contacto · fecha | Pill estado + método | Abrir · Copiar número |
| gasto menor | `B1300000001` | Descripción · fecha | Pill estado | Abrir · Copiar NCF |
| asiento | `N.º 4210` | Descripción · fecha | Pill "Manual/Automático" | Abrir · Ver documento origen |
| cuenta | `1103` | Nombre de la cuenta | Pill tipo | Abrir · Movimientos por cuenta |
| reporte | Nombre | Categoría | — | Abrir |
| navegación | Módulo | "Ir a" | — | Abrir |

Reglas:

- Las acciones que **escriben** (registrar pago) solo aparecen para `admin`/`contador` y abren el formulario con el documento precargado **si la ruta ya lo soporta**; si no, se abre el formulario vacío y se anota como TODO backend.
- `Copiar …` usa `navigator.clipboard` y muestra un toast de 2 s ("NCF copiado").
- `Llamar` / `Escribir correo` son `tel:` y `mailto:`; solo si el dato existe.

### 2.4 Ranking

Cada fila trae un `rango` (1 = mejor) calculado en SQL:

| rango | Condición | Ejemplo |
| --- | --- | --- |
| 1 | Identificador exacto: `ncf`, `numero`, `rnc_cedula`, `referencia`, `codigo` | `B0100000123`, `1258`, `101123456` |
| 2 | El nombre **empieza** por el término (`normalizar(nombre)` con prefijo) | "ped" → Pedro Pérez |
| 3 | El nombre **contiene** el término | "dro" → Pedro Pérez |
| 4 | Otro campo contiene (teléfono, correo, descripción, notas) | "809555" |
| 5 | Coincide solo por relación (el nombre del cliente dentro de una factura) | "pedro" → factura de Pedro |

Desempates, en orden:

1. `rango` ascendente.
2. Si el usuario dio **mes/rango de fechas** (`desde`/`hasta`): las filas dentro del rango van primero (`en_rango desc`).
3. Si el usuario dio **monto**: `abs(total − monto)` ascendente; luego fecha.
4. `fecha desc nulls last` (lo más reciente primero) y `numero desc`.
5. `id` ascendente, para que el orden sea determinista y la paginación no repita filas.

Ejemplo con «factura de Pedro, creo que fue en octubre»:

| # | Resultado | rango | Por qué |
| --- | --- | --- | --- |
| 1 | B0100000123 · 12/10 | 5 | Cliente "Pedro Pérez", dentro de octubre |
| 2 | B0100000118 · 03/10 | 5 | Dentro de octubre |
| 3 | B0100000090 · 28/09 | 5 | Fuera de octubre, pero el nombre coincide |
| 4 | B0100000077 · 15/01 | 5 | Fuera de rango |

Las filas fuera del mes **no se esconden**: se muestran después, porque el usuario dijo "creo que". Eso es una decisión de producto (D8).

**Nunca** se ordena por cantidad de coincidencias dentro del texto: hace que los resultados salten entre pulsaciones.

### 2.5 Recientes

- Se conserva la clave `medoxigas.busqueda.recientes` y el formato `{titulo, url}`; se **extiende** a `{titulo, url, entidad, id, vistoEn}`. Los registros viejos se leen igual (si no hay `entidad`, se tratan como `navegacion`), así que no hay migración de datos ni errores en el primer arranque.
- Máximo **8** (hoy 5). Motivo: caben en dos filas de 4 tarjetas compactas sin scroll.
- Dedupe por `(entidad, id)` o por `url`.
- Se guarda al **abrir** un resultado (Enter o clic), nunca al pasar el ratón.
- "Recientes" con texto escrito muestra solo los recientes que coinciden (búsqueda local, `normalizar`).
- Fase 2 (opcional): tabla `busquedas_recientes` por usuario, para que no se pierdan al cambiar de equipo. Requiere decisión (D6).

### 2.6 Vacío

- Sin texto: Recientes + Acciones rápidas + Sugerencias (sección 1.8). **Nunca** un panel en blanco.
- Primer uso: una línea explicando que las búsquedas aparecerán ahí, más los 3 chips de ejemplo.
- Con texto y sin resultados: mensaje claro + dos ayudas + `Quitar filtro` si hay categoría fijada.

### 2.7 Duplicados y agrupación

- Dedupe por `(entidad, id)`. Una misma factura no puede aparecer dos veces aunque coincida por NCF y por cliente.
- Un **pago** que coincide porque su factura coincide con el cliente se queda (es otra acción: "abrir pago"), pero su subtítulo dice "Pago de B01…" para que no parezca ruido.
- Una **nota** y su factura son entidades distintas y se muestran las dos, cada una con su NCF.
- El mismo nombre puede salir como cliente y como proveedor si hay dos contactos: son dos filas, con su pill distinta.

---

## 3. Backend

### 3.1 Decisión: una RPC, no 18 consultas

| | N consultas PostgREST en paralelo | **RPC única (`buscar_global`)** |
| --- | --- | --- |
| Viajes a la base | 10-18 por pulsación | 1 |
| Ranking entre entidades | Imposible (cada una ordena sola) | Central y consistente |
| Conteos por categoría | 18 `count` extra | Los mismos CTE |
| Búsqueda por nombre de cliente dentro de un documento | 2 viajes + tope de 200 ids | `join` |
| Índices | `ilike` sin trigrama | Índices GIN de trigrama |
| Costo de mantener | Bajo al empezar, alto al crecer | Un archivo SQL y un tipo |

Se elige la **RPC única**. El precio es una migración y un tipo a mano; a cambio, la ventana hace **una** llamada por pulsación y el ranking es el mismo para todas las entidades.

### 3.2 Contrato

```ts
// src/lib/busqueda/tipos.ts
export type EntidadBusqueda =
  | "contacto" | "producto"
  | "factura" | "nota_credito_venta" | "nota_debito_venta" | "cotizacion"
  | "remision" | "factura_recurrente" | "pago_recibido"
  | "factura_proveedor" | "nota_credito_compra" | "orden_compra"
  | "pago_proveedor" | "gasto_menor"
  | "asiento" | "cuenta" | "reporte" | "navegacion" | "documento";

export type GrupoBusqueda = "clientes" | "productos" | "facturacion" | "compras" | "documentos" | "otros";

export interface ResultadoBusqueda {
  entidad: EntidadBusqueda;
  id: string;
  titulo: string;
  subtitulo: string;
  /** Datos ya formateados para la fila inferior: "Cobrada", "01 · Crédito fiscal". */
  etiquetas: string[];
  estado: { texto: string; tono: "exito" | "pendiente" | "peligro" | "neutro" | "info" } | null;
  /** ISO date (YYYY-MM-DD) o null. Se formatea en el cliente. */
  fecha: string | null;
  /** Texto ya formateado por el SQL (numeric → text). Nunca float. */
  monto: string | null;
  rango: number;
}

export interface RespuestaBusqueda {
  grupos: { grupo: GrupoBusqueda; entidad: EntidadBusqueda; total: number; resultados: ResultadoBusqueda[] }[];
  total: number;
  /** Solo en modo categoría. */
  hayMas: boolean;
  ms: number;
}
```

**Por qué `monto` es `text`:** el repo prohíbe `number` flotante para dinero. Al pasar por `jsonb`, un `numeric` se convierte en número JSON; para no depender de eso, el SQL lo entrega como texto (`total::text`) y el cliente lo formatea con `formatoMoneda`. Cero riesgo de `4500.000000001`.

**Firma SQL**

```sql
create or replace function public.buscar_global(p jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ ... $$;

revoke all on function public.buscar_global(jsonb) from public, anon;
grant execute on function public.buscar_global(jsonb) to authenticated;
```

Claves de `p` (todas opcionales salvo `texto`):

| Clave | Tipo | Uso |
| --- | --- | --- |
| `texto` | text | Término ya normalizado (mín. 2 caracteres) |
| `entidad` | text | Si viene, modo categoría (solo esa entidad) |
| `limite` | int | 4 en modo todos, 20 en modo categoría; tope duro 200 |
| `desplazamiento` | int | Solo en modo categoría |
| `numero` | int | Número de documento exacto |
| `ncf` | text | NCF exacto (normalizado a mayúsculas) |
| `identificacion` | text | RNC/cédula exactos (solo dígitos) |
| `desde` / `hasta` | date | Rango de fechas |
| `monto` | numeric | Monto buscado (para desempate) |
| `incluir_anulados` | bool | Default `true` |

La respuesta se valida en el borde con **zod** antes de llegar a la UI (`RespuestaBusquedaSchema`). Motivo: `supabase.rpc` devuelve `Json`; si el SQL cambia, queremos un error claro y no un `undefined` silencioso en pantalla.

### 3.3 Migración: extensiones, normalización e índices

Archivo propuesto: `supabase/migrations/20261118100000_busqueda_global.sql` (aditiva; no toca datos ni políticas existentes).

```sql
-- Boceto, no código final.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() es STABLE; para indexar hace falta una versión IMMUTABLE.
create or replace function public.normalizar(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_texto, '')))
$$;
```

Advertencia: si algún día cambia el diccionario de `unaccent`, hay que **reconstruir** los índices (`reindex`). Se anota en el encabezado de la migración.

**Índices de la fase 1** (medir y podar después con `pg_stat_user_indexes`):

| # | Tabla | Índice | Para qué |
| --- | --- | --- | --- |
| 1 | `contactos` | `gin (public.normalizar(nombre) gin_trgm_ops)` | Nombre, con acentos y ñ |
| 2 | `contactos` | `gin (public.normalizar(coalesce(correo,'')) gin_trgm_ops)` | Correo |
| 3 | `contactos` | `btree ((regexp_replace(telefono,'\D','','g')))` | Teléfono por dígitos |
| 4 | `productos` | `gin (public.normalizar(nombre) gin_trgm_ops)` | Nombre |
| 5 | `productos` | `gin (public.normalizar(coalesce(referencia,'')) gin_trgm_ops)` | Referencia |
| 6 | `facturas` | `gin (public.normalizar(ncf) gin_trgm_ops)` | NCF (además del `unique` btree) |
| 7 | `facturas_proveedor` | `gin (public.normalizar(coalesce(ncf,'')) gin_trgm_ops)` | NCF del proveedor |
| 8 | `notas_credito_venta` | `gin (public.normalizar(ncf) gin_trgm_ops)` | NCF |
| 9 | `notas_debito_venta` | `gin (public.normalizar(ncf) gin_trgm_ops)` | NCF |
| 10 | `gastos_menores` | `gin (public.normalizar(descripcion) gin_trgm_ops)` | Descripción del gasto |
| 11 | `asientos` | `gin (public.normalizar(descripcion) gin_trgm_ops)` | Descripción del asiento |
| 12 | `cuentas` | `gin (public.normalizar(nombre) gin_trgm_ops)` | Nombre de cuenta |

No se indexa por trigrama `numero` (es `int`, se busca con btree), ni `notas`/`terminos`/`pie` (poco valor, mucho costo de escritura). Si Waldy pide buscar en notas, se agrega después.

**Costo:** 12 índices GIN. Las tablas de documentos son de escritura baja (decenas al día), así que el costo de inserción es despreciable; el espacio en disco crece (GIN de trigramas ~2-4× el texto indexado). Con ~32k documentos es del orden de decenas de MB. Aceptable en el plan gratis.

### 3.4 Forma de la consulta (boceto)

```sql
with coincidencias as (
  -- contacto
  select 'contacto'::text as entidad, c.id, c.nombre as titulo, ...
  from public.contactos c
  where (p->>'texto') is not null
    and (public.normalizar(c.nombre) like '%' || public.normalizar(p->>'texto') || '%'
      or public.normalizar(coalesce(c.correo,'')) like '%' || ... )
  union all
  -- factura (con join a contactos para buscar por nombre del cliente)
  select 'factura', f.id, f.ncf as titulo, ...
  from public.facturas f
  join public.contactos c on c.id = f.contacto_id
  where ... (ncf, numero, not contact name)
  union all
  -- ... las demás siguen el mismo molde
),
conteos as (select entidad, count(*) as total from coincidencias group by entidad),
filas as (
  select *, row_number() over (partition by entidad order by rango, fecha desc nulls last, id) as rn
  from coincidencias
)
select jsonb_build_object(
  'grupos', (select jsonb_agg(...) from filas where rn <= (p->>'limite')::int),
  'total', (select coalesce(sum(total),0) from conteos)
);
```

Reglas de la consulta:

- `p.entidad` limita el `union all` a una rama: no se pagan las 16.
- `p.numero`, `p.ncf`, `p.identificacion` son **exactos** (`=`), nunca `ilike`.
- `p.desde`/`p.hasta` filtran documentos y contactos; en modo "todos" **no** excluyen: solo empujan (`en_rango desc`), para respetar el "creo que fue en octubre".
- Montos: `abs(total - p.monto)` como criterio de orden, no como filtro.
- Nada de `select *`: se listan columnas y se arma el `jsonb` explícito. Un cambio de esquema no debe romper la ventana en silencio.

### 3.5 Top N, paginación y conteos

| Modo | Filas | Conteo | Paginación |
| --- | --- | --- | --- |
| Todos (sin categoría) | 4 por entidad | Exacto por entidad | `Ver todos →` fija la categoría |
| Categoría fijada | 20 | Exacto | `Ver más` (+20, `desplazamiento`) |
| Tope duro | 200 | — | Se ignora lo que pida el cliente por encima |

- **Mínimo 2 caracteres.** Con 1 carácter no se consulta: solo sugerencias. Evita contar 19,000 facturas por una letra.
- Los conteos son exactos (`count(*)` sobre la unión). Si en la medición real el p95 pasa de 300 ms, el plan B está documentado: limitar cada rama a 201 filas y mostrar "200+" en el rail.

### 3.6 Debounce, cancelación y caché en el cliente

- **Debounce de 250 ms** (los selectores del repo usan 350; la ventana es más ágil y no dispara escrituras).
- **`AbortController`** por petición: al cambiar el texto se cancela la anterior. Además, un contador de secuencia descarta respuestas viejas que lleguen tarde.
- **Caché en memoria (LRU de 10, 60 s)** por `texto + categoría + filtros`. Volver a escribir lo mismo es instantáneo. No se cachea en `localStorage`.
- **`useDeferredValue`** para el resaltado, para que escribir no se sienta pesado con 40 tarjetas.
- **Sin caché de servidor** en la fase 1: la RPC es barata y los datos cambian. Nada de `unstable_cache` (mostraría una factura recién creada como inexistente).
- La acción es un **server action** (`"use server"`), como el resto del repo (`src/lib/contactos/busqueda.ts`), y llama `supabase.rpc("buscar_global", { p })` **directo** (lo exige `rpc-sin-extraer.test.ts`).
- Al abrir la ventana se precargan **solo** los recientes (localStorage) y el catálogo de reportes/menú: no se consulta la base hasta que hay 2 caracteres.

### 3.7 RLS y permisos

- La función es `security definer` (convención del repo) y **debe** empezar con:
  `if (select public.rol_actual()) is null then raise exception 'sin permiso' using errcode = '42501'; end if;`
  Sin ese guard, `security definer` salta RLS y cualquiera con la anon key leería todo.
- No se acepta ningún `p_usuario` ni `p_rol` desde el cliente: el rol sale de `auth.uid()`.
- `revoke all ... from public, anon` + `grant execute ... to authenticated`, igual que las RPC del motor.
- Las tres roles leen lo mismo (así está hoy en RLS). `lector` no ve acciones de creación porque la UI las oculta, no porque el SQL las filtre.
- Prueba obligatoria: llamar la RPC como `anon` debe fallar con `42501` y no devolver filas.

### 3.8 Presupuesto de rendimiento

| Medida | Objetivo |
| --- | --- |
| RPC (servidor) p95 | ≤ 250 ms |
| Pulsación → tarjetas pintadas | ≤ 500 ms (incluye 250 de debounce) |
| Payload | < 12 KB por respuesta |
| Plan esperado | `Bitmap Index Scan` por rama; **ningún** `Seq Scan` en `facturas` |

Verificación obligatoria con `EXPLAIN (ANALYZE, BUFFERS)` contra la base real (solo lectura) antes de dar por buena la migración. Si `facturas` sale con `Seq Scan`, falta el índice de trigrama o la comparación no es la misma expresión (`public.normalizar(...)`), que es el error clásico.

### 3.9 Qué falta exactamente

| # | Pieza | Archivo | Nota |
| --- | --- | --- | --- |
| 1 | Extensiones + `normalizar` + 12 índices | `supabase/migrations/20261118100000_busqueda_global.sql` | Aditiva |
| 2 | RPC `buscar_global` | mismo archivo | 16 ramas + conteos |
| 3 | Tipos de la RPC | `src/lib/supabase/types.ts` | `pnpm db:types` después de aplicar; el CI verifica que estén al día |
| 4 | Contrato y parser | `src/lib/busqueda/{tipos,interpretar,rutas}.ts` | Puros, con Vitest |
| 5 | Acción de servidor | `src/lib/busqueda/consultas.ts` | `"use server"`, zod en el borde |
| 6 | Ventana | `src/app/(main)/dashboard/_components/busqueda/*` | Ver sección 5.2 |
| 7 | Integración del disparador | `busqueda-global.tsx` + `layout.tsx` | Ver 5.3 |
| 8 | Recientes extendidos | `src/lib/busqueda/recientes.ts` | Compatible con lo guardado hoy |
| 9 | pgTAP | `supabase/tests/busqueda_global_test.sql` | Rol, permisos, exactos, límites |
| 10 | e2e | `tests/e2e/busqueda-global.spec.ts` | Se salta sin `E2E_EMAIL`/`E2E_PASSWORD` |
| 11 | Candado de catálogo | `src/lib/busqueda/catalogo.test.ts` | Toda entidad tiene grupo, etiqueta y ruta |

### 3.10 Pruebas

**pgTAP** (`supabase/tests/busqueda_global_test.sql`):

1. `anon` recibe `42501`; `authenticated` con rol recibe JSON.
2. Encuentra una factura por NCF exacto y por número exacto.
3. Encuentra una factura por el **nombre del cliente** (el `join`).
4. `#1258` busca número; `B0100000123` busca NCF; `101123456` busca RNC (no se cruzan).
5. `desde`/`hasta` de octubre ponen primero las de octubre y no esconden las demás.
6. `monto` ordena por cercanía.
7. "Peña" encuentra "PENA" y "peña" (unaccent).
8. `limite = 4` respeta el tope; `desplazamiento` no repite filas.
9. Un término de 1 carácter devuelve vacío.
10. Ninguna fila se repite (`entidad, id` único).
11. Una factura anulada aparece con su estado.

**Vitest:**

- `interpretar.test.ts`: 20+ casos (meses, "el mes pasado", montos con y sin separadores, NCF, RNC, cédula, `#numero`, stopwords, frase larga, sin coincidencias).
- `rutas.test.ts`: cada entidad devuelve una ruta; ninguna devuelve `null`.
- `agrupar.test.ts`: orden de grupos, máximo 4, dedupe, "Ver todos".
- `resaltar.test.ts`: resalta sin romper acentos ni mayúsculas.

---

## 4. IA

### 4.1 Principio

**La IA traduce la frase a una intención estructurada. No escribe SQL, no lee la base y no decide permisos.**

```
frase del usuario
      │
      ├─► parser determinista (TS, puro, con tests)  ──► IntencionBusqueda
      │        │ confianza alta y hay resultados
      │        └─► se usa tal cual (la IA no se llama)
      │
      └─► (si hace falta) LLM ──► JSON validado con zod ──► IntencionBusqueda
                                                              │
                                                     misma RPC buscar_global
```

Sin IA, la búsqueda funciona igual; solo entiende peor las frases largas.

### 4.2 Fases

| Fase | Qué hace | Cuándo | Costo | Riesgo |
| --- | --- | --- | --- | --- |
| **0. Determinista** | Parser TS: nombres, NCF, número, RNC/cédula, teléfono, correo, monto, meses y rangos | Siempre, primera | 0 | Ninguno |
| **1. Interpretación NL** | LLM convierte "la factura de Pedro, creo que fue en octubre" en `{texto:"pedro", entidad:"factura", desde:"2026-10-01", hasta:"2026-10-31"}` | Solo si el determinista falla o la frase es larga | ~$0.001 por llamada | Latencia, costo, alucinación de fechas |
| **2. Híbrida** | `pg_trgm` + recientes + frecuencia de uso + sinónimos ("plata", "cobro", "factura" = factura) | Cuando haya datos de uso | 0 | Sesgo hacia lo usado |
| **3. Documentos** | Embeddings (`pgvector`) + OCR de contratos y adjuntos | Fase 4, con tabla nueva | Embeddings baratos; OCR por página | Privacidad, calidad del OCR |

### 4.3 Parser determinista

Vive en `src/lib/busqueda/interpretar.ts`, es puro y tiene tests. Reutiliza `src/lib/fechas/rangos.ts` y `hoyEnRd()`.

| Señal | Regla | Ejemplo |
| --- | --- | --- |
| NCF | `^B\d{10}$` (B + 10 dígitos, 11 en total) | `B0100000123` |
| Número | `^#?\d{1,6}$` | `#1258`, `66` |
| RNC / cédula | 9 u 11 dígitos exactos | `101123456`, `00112345678` |
| Monto | Lleva `RD$`, `$`, o separador de miles/decimales; o ≥ 4 dígitos con `.`/`,` | `RD$4,500`, `1,250.00` |
| Mes | Nombre en español, con o sin año | `octubre`, `oct 2025`, `octubre del año pasado` |
| Rango relativo | "esta semana", "el mes pasado", "ayer", "este año" | reutiliza `rangos.ts` |
| Entidad | Palabras clave: factura, compra, pago, cliente, producto, nota, cotización, conduce, asiento, cuenta, reporte | "la factura de…" → `factura` |
| Texto | Lo que queda tras quitar stopwords (`de`, `del`, `la`, `el`, `que`, `creo`, `fue`, `en`, `busca`, `busco`, `por`) | `pedro` |

Ejemplos que deben pasar el test:

| Frase | Intención |
| --- | --- |
| `factura de Pedro, creo que fue en octubre` | `{texto:"pedro", entidad:"factura", desde:"2026-10-01", hasta:"2026-10-31", confianza:0.9}` |
| `B0100000123` | `{ncf:"B0100000123", confianza:1}` |
| `#1258` | `{numero:1258, confianza:1}` |
| `101123456` | `{identificacion:"101123456", confianza:1}` |
| `pago de 4,500 a Pedro` | `{texto:"pedro", entidad:"pago_recibido", monto:4500, confianza:0.8}` |
| `compras de la semana pasada` | `{entidad:"factura_proveedor", desde:…, hasta:…, confianza:0.85}` |
| `lo de Peña` | `{texto:"peña", confianza:0.6}` → el SQL lo encuentra con unaccent |

`confianza` es una heurística: baja si hay muchas stopwords, si el texto quedó vacío o si hay dos señales numéricas contradictorias.

### 4.4 Parser con LLM

**Contrato (el mismo `IntencionBusqueda`):**

```ts
{
  texto: string;                    // 1..80 caracteres, sin stopwords
  entidades: EntidadBusqueda[];     // vacío = todas
  desde?: string;                   // YYYY-MM-DD
  hasta?: string;
  monto?: number;
  numero?: number;
  ncf?: string;
  identificacion?: string;
  confianza: number;                // 0..1
  aclaracion?: string;              // "No estoy seguro del mes"
}
```

**Reglas del prompt (fijas):**

- Responde **solo** JSON válido, sin markdown.
- Hoy es `{{fecha_rd}}` (America/Santo_Domingo). Los meses sin año son del año en curso; si la fecha ya pasó hace más de 6 meses, usa el año anterior.
- No inventes ids, NCF ni montos que no estén en la frase.
- `entidades` solo puede contener nombres del catálogo (se le pasa la lista de 19).
- Si no entiendes, `confianza < 0.4` y `aclaracion` explicando qué falta.
- Temperatura 0, máximo 200 tokens de salida.

**Validación:** zod (`IntencionBusquedaSchema`) + lista blanca de entidades + fechas válidas + `texto` recortado a 80. Si falla, se descarta y se usa el determinista. **Nunca** se ejecuta SQL generado por el modelo.

### 4.5 Cuándo se llama (y cómo no llamar en cada tecla)

Se llama solo si **todas** se cumplen:

1. La IA está habilitada (`BUSQUEDA_IA_HABILITADA`).
2. Hay **≥ 4 palabras** o una señal de frase ("creo", "fue", "el mes", "del año", "acuérdate").
3. El parser determinista tiene `confianza < 0.6` **o** devolvió 0 resultados.
4. Pasaron **600 ms** desde la última tecla (además del debounce de 250).
5. No es un código puro (todo dígitos, NCF) — esos ya los resuelve el determinista.
6. No se llamó ya para esa misma consulta normalizada (caché LRU de 200 en el servidor).
7. No se superó el límite: 1 llamada cada 2 s por sesión y 20/hora por usuario.

Y hay un corte seco: **si el determinista ya trajo resultados, la IA no se llama**. La IA es un plan B, no un adorno.

En la UI, mientras la IA piensa, los resultados deterministas ya están en pantalla. Cuando llega, aparece un chip bajo el input:

```
✨ Interpreté: «facturas de Pedro en octubre»   [Quitar]
```

`Quitar` vuelve a la consulta cruda. Si la IA falla o tarda más de 2.5 s, el chip no aparece y **no** se muestra error.

### 4.6 Proveedor, claves y costos

- **Interfaz única:** `src/lib/busqueda/ia/proveedor.ts` con `interpretar(texto, contexto, señal): Promise<IntencionBusqueda | null>`. Cambiar de proveedor no toca la ventana ni la RPC.
- **Proveedores candidatos** (elegir uno; ver D7): OpenAI (`gpt-5-mini` o similar), Anthropic (`claude-haiku`), Google (`gemini-2.5-flash`). Cualquiera sirve para extraer JSON; se elige por costo y por la cuenta que Waldy ya tenga.
- **Claves:** solo en el servidor.

  | Variable | Dónde | Nunca |
  | --- | --- | --- |
  | `BUSQUEDA_IA_API_KEY` | Vercel → Environment Variables (Production/Preview/Development) | En el cliente, en `NEXT_PUBLIC_*`, en el repo |
  | `BUSQUEDA_IA_MODELO` | Vercel | — |
  | `BUSQUEDA_IA_HABILITADA` | Vercel (`true`/`false`) | — |
  | `BUSQUEDA_IA_TOPE_MENSUAL_USD` | Vercel | — |

- **Costo (orden de magnitud, verificar tarifa vigente):** ~700 tokens por llamada (400 de entrada con el catálogo + 150 de salida) → del orden de **$0.001 por llamada** con un modelo mini. Con 300 búsquedas/día y 20 % en lenguaje natural: **60 llamadas/día ≈ $0.06/día ≈ $2/mes**. El tope mensual corta en seco y la ventana sigue funcionando sin IA.
- **Latencia:** 600-1500 ms típicos; *timebox* de 2.5 s. Nunca bloquea la lista.
- **Auditoría (fase 2, opcional):** tabla `busquedas_ia` (`usuario_id`, `texto`, `intencion jsonb`, `modelo`, `ms`, `creado_en`), retención 90 días, lectura solo `admin`. Sirve para medir aciertos y bajar costos.

### 4.7 Embeddings, pgvector y OCR (fase 4)

Solo para **Documentos** (contratos, adjuntos, escaneos). No se mezcla con la búsqueda de documentos contables: esos ya tienen NCF y número.

**Esquema propuesto (no se crea en esta fase):**

```
documentos
  id, tipo ('contrato'|'otro'), titulo, contacto_id, fecha, archivo_path,
  mime, tamano, texto_extraido, estado ('pendiente'|'procesando'|'listo'|'error'),
  creado_por, creado_en

documento_fragmentos
  id, documento_id, orden, contenido, embedding vector(1536)
```

- `create extension vector with schema extensions;`
- Índice `hnsw (embedding vector_cosine_ops) with (m=16, ef_construction=64)`.
- Troceado: 800 tokens con 100 de solape; se guarda el número de orden para citar el fragmento.
- OCR: primero se intenta la capa de texto del PDF; si viene vacía (escaneo), OCR. `estado = 'error'` visible para el usuario, nunca silencioso.
- Búsqueda: `match_documentos(p_embedding vector, p_limite int)` `security definer` con el mismo guard de rol y join a `documentos` (RLS de la tabla). Devuelve `documento_id`, `fragmento`, `similitud`.
- Bucket privado `documentos` (como `logos` en `20261114600100_configuracion_logos_storage.sql`), con URLs firmadas de 60 s.
- **Privacidad:** los contratos pueden tener datos personales. Antes de mandar texto a un proveedor de embeddings u OCR, Waldy tiene que dar el OK (D11). Se documenta qué sale del servidor y qué se guarda.

### 4.8 Cómo se ve la IA en la ventana

- Chip de 32 px bajo el input, `bg-primary/10 text-primary`, icono `Sparkles`, texto de 12 px, botón `Quitar`.
- Si la interpretación **cambia** la consulta, se muestra la traducción ("facturas de Pedro en octubre") para que el usuario vea qué entendió. Transparencia antes que magia.
- Si el modelo devuelve `aclaracion`, se muestra como segunda línea en `text-muted-foreground` ("No estoy seguro del mes").
- Nunca un modal dentro del modal, nunca un toast de error de IA, nunca bloquear el input.

### 4.9 Privacidad y límites

- Fase 1: solo sale del servidor **el texto de la consulta** (sin datos de la empresa, sin filas).
- Fase 4: solo fragmentos de documentos que el usuario ya puede leer (RLS), nunca de otro contacto si no tiene permiso.
- No se entrena con los datos: se usa la API en modo estándar; anotar la política del proveedor elegido.
- Nada de IA para decidir permisos, montos ni asientos. La IA **sugiere una consulta**, no un resultado.

---

## 5. Plan por agentes

### 5.1 Contrato primero (bloqueante, 1 PR chico)

**Agente 0 · contrato y parser** — sin UI y sin base.

| Archivo | Qué |
| --- | --- |
| `src/lib/busqueda/tipos.ts` | `EntidadBusqueda`, `GrupoBusqueda`, `ResultadoBusqueda`, `RespuestaBusqueda`, `GRUPOS`, `ETIQUETAS` |
| `src/lib/busqueda/rutas.ts` | `rutaDeResultado(resultado)` usando `src/lib/enlaces.ts` |
| `src/lib/busqueda/interpretar.ts` | Parser determinista |
| `src/lib/busqueda/resaltar.ts` | Resaltado con acentos, sin regex del usuario |
| `src/lib/busqueda/catalogo.test.ts` | **Candado:** toda entidad tiene grupo, etiqueta y ruta; ninguna ruta es null |
| `src/lib/busqueda/interpretar.test.ts` | 20+ casos |
| `src/lib/busqueda/resaltar.test.ts` | Acentos, mayúsculas, `<script>` escapado |

Aceptación: `pnpm typecheck`, `pnpm check`, `pnpm test` en verde; sin tocar la UI. Es la dependencia de A y B.

### 5.2 Agente A · ventana flotante

**Rama:** `feat/busqueda-global-ventana`.

| Archivo | Qué |
| --- | --- |
| `src/app/(main)/dashboard/_components/busqueda/ventana-busqueda.tsx` | `Dialog` + `DialogContent` con las medidas; cabecera, cuerpo, pie |
| `.../cabecera-busqueda.tsx` | InputGroup, chip IA, `Esc` |
| `.../rail-categorias.tsx` | 7 categorías, conteos, teclado |
| `.../grupo-resultados.tsx` | Cabecera sticky, `Ver todos`, grid de 2 columnas |
| `.../tarjeta-resultado.tsx` | `<a>` + metadata + `⋯` + `PillEstado` |
| `.../acciones-rapidas.tsx` | 8 acciones filtradas por rol |
| `.../sugerencias.tsx` | Chips + recientes compactos |
| `.../estados-busqueda.tsx` | Esqueletos, vacío, sin resultados, error |
| `.../pie-atajos.tsx` | 5 atajos en 40 px |
| `.../use-busqueda.ts` | Debounce, aborto, LRU, secuencia |
| `src/lib/busqueda/recientes.ts` | Leer/escribir recientes compatibles |
| `globals.css` (opcional) | Sombra del backdrop si no se toca `components/ui` (ver D3) |

Pasos:

1. Maqueta con datos falsos (10 resultados por grupo) para clavar medidas y dark mode.
2. Conecta `use-busqueda` a un adaptador que, si la RPC no existe, devuelve solo recientes + menú + reportes (fallback).
3. Teclado, foco y `aria`.
4. Estados y responsive (sheet).

Aceptación:

- 870 × 690 exactos a 1440 × 900; sin scroll del panel.
- Rail 190, tarjetas 313 × 76, pie 40, cabecera 64.
- Claro y oscuro sin hex sueltos.
- Móvil: sheet al 92 %, chips, 1 columna.
- `⌘K`, `Esc`, `↑↓`, `↵`, `Tab`, `⌘↵` funcionan.
- Con la migración sin aplicar: recientes + ir a + reportes, sin errores en consola.
- Ningún archivo de `src/components/ui` modificado.

Pruebas: `tests/e2e/busqueda-global.spec.ts` (abre, escribe, navega, cierra, foco vuelve), más un test de medidas (como `tablas.spec.ts`). Si el diff pasa de 400 líneas, se parte en A1 (cáscara + estados) y A2 (tarjetas + rail).

### 5.3 Agente B · backend de búsqueda

**Rama:** `feat/busqueda-global-backend`.

| Archivo | Qué |
| --- | --- |
| `supabase/migrations/20261118100000_busqueda_global.sql` | Extensiones, `normalizar`, 12 índices, RPC |
| `supabase/tests/busqueda_global_test.sql` | 11 asserts de la sección 3.10 |
| `src/lib/busqueda/consultas.ts` | `"use server"`, zod, `supabase.rpc("buscar_global", { p })` directo |
| `src/lib/busqueda/esquema.ts` | `RespuestaBusquedaSchema` |
| `src/lib/busqueda/consultas.test.ts` | Mock de Supabase, errores en español |
| `src/lib/supabase/types.ts` | Regenerado con `pnpm db:types` **después** de aplicar |

Pasos:

1. Migración (Coder la aplica; el agente no toca el remoto).
2. pgTAP en local (`supabase start` + `supabase test db`). Si no hay Docker, se entrega escrito y se avisa.
3. Tipos y acción.
4. Medición con `EXPLAIN (ANALYZE, BUFFERS)` (solo lectura) y números en el PR.

Aceptación: p95 ≤ 250 ms en la RPC; contratos de la sección 3.2 respetados; `anon` rechazado; ninguna lista existente cambia de comportamiento.

### 5.4 Agente C · integración topbar y `⌘K`

**Rama:** `feat/busqueda-global-integracion`.

| Archivo | Qué |
| --- | --- |
| `src/app/(main)/dashboard/_components/header/busqueda-global.tsx` | Pasa a ser **solo el disparador** (barra e icono) + el atajo |
| `src/app/(main)/dashboard/_components/busqueda/proveedor-busqueda.tsx` | Contexto (`abierto`, `abrir`, `cerrar`, `textoInicial`) |
| `src/app/(main)/dashboard/layout.tsx` | Envuelve el layout con el proveedor y monta la ventana una sola vez |
| `src/app/(main)/dashboard/_components/busqueda/navegacion.ts` | Mueve `enlacesDeNavegacion` y `ENLACES_REPORTES` aquí, sin cambiar comportamiento |
| `src/app/(main)/dashboard/contactos/_components/contactos-cliente.tsx` | Lee `?nuevo=1` (opcional, para "Nuevo contacto") |
| `src/app/(main)/dashboard/productos/_components/productos-cliente.tsx` | Igual |

Reglas:

- El atajo sigue en `document`, con `preventDefault`, `!altKey`, `!defaultPrevented`, y ahora hace **toggle**.
- Al cerrar se devuelve el foco al disparador (lo hace `Dialog` de Base UI; verificar).
- Los recientes siguen en la misma clave de localStorage.
- `command.tsx` **no se borra** en este PR; se deja de usar y se decide después (D4).
- Nada de `router.push` para abrir la ventana: es estado local, no URL.

Aceptación: la barra del topbar se ve igual (36 px, `max-w-xl`, `Kbd`), el icono móvil sigue, `⌘K` abre y cierra desde cualquier pantalla, y el foco vuelve al disparador.

### 5.5 Agente D · contratos y documentos (fase 4)

**Rama:** `feat/documentos-contratos`.

Orden obligatorio: **primero** `docs/dominio-documentos.md` (qué es un contrato, quién lo sube, qué se indexa, retención), luego migración + RLS + pgTAP, luego pantalla.

| Pieza | Detalle |
| --- | --- |
| Tabla `documentos` | Ver 4.7; RLS de lectura para `authenticated` con rol; escritura por RPC |
| Tabla `documento_fragmentos` | `vector(1536)`, HNSW |
| Bucket `documentos` | Privado, límite 20 MB, PDF/JPG/PNG |
| `match_documentos` | `security definer` + guard + join a `documentos` |
| OCR + embeddings | Proceso en un route handler o cron; `estado` visible |
| UI | Pestaña "Documentos" en la ficha del contacto + el grupo del rail |

No se empieza hasta que A, B y C estén en `prueba` y Waldy haya aprobado el gasto de IA (D11).

### 5.6 Orden, dependencias y presupuesto de diff

```
0 contrato ──► A ventana (con fallback) ──► C integración ──► e2e/pulido
      └──────► B backend (migración + RPC) ──┘
                                                    └──► D documentos (fase 4)
```

| PR | Contenido | Depende de | Diff estimado |
| --- | --- | --- | --- |
| 1 | Contrato + parser + candado | — | ~350 líneas |
| 2 | Ventana con datos falsos y fallback | 1 | ~500 (partir en 2) |
| 3 | Migración + RPC + pgTAP + acción | 1 | ~450 (SQL cuenta aparte) |
| 4 | Integración topbar/`⌘K`/proveedor | 2 | ~250 |
| 5 | e2e, dark, móvil, medición | 3, 4 | ~200 |
| 6 | `docs/dominio-documentos.md` + migración | 5 | fase 4 |

Cada PR: `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build`, y actualizar `HANDOFF.md`. Nada de push a `prueba` ni a `main`: Coder fusiona.

### 5.7 Rollout

1. **PR 1** sin efecto visible (solo tipos y parser).
2. **PR 2** reemplaza el diálogo por la ventana, pero como la RPC no existe, se comporta como hoy + el diseño nuevo. Se puede revisar en `prueba` sin migración.
3. **PR 3** aplica la migración y enciende los resultados reales. Si algo falla, se apaga volviendo a la rama anterior: la ventana sigue funcionando con el fallback.
4. **PR 4** limpia el disparador y consolida `⌘K`.
5. **PR 5** mide en `prueba` con volumen real y capturas claro/oscuro/móvil.
6. **Documentos** cuando Waldy lo pida.

Sin feature flag de UI: el "flag" es la existencia de la RPC (el fallback es el comportamiento de hoy). Menos piezas, menos riesgo.

### 5.8 Pruebas por agente (resumen)

| Agente | Unitarias | Integración | Navegador |
| --- | --- | --- | --- |
| 0 | `interpretar`, `resaltar`, `rutas`, `catalogo` | — | — |
| A | `agrupar`, `recientes` | — | abre/cierra, medidas, teclado, móvil, dark |
| B | `consultas` (mock) | pgTAP (11) | — |
| C | — | — | `⌘K`, foco, toggle, ruta `?nuevo=1` |
| D | — | pgTAP de documentos | subida + búsqueda |

---

## 6. Riesgos y decisiones pendientes

### 6.1 Riesgos

| # | Riesgo | Impacto | Mitigación |
| --- | --- | --- | --- |
| R1 | `ilike '%x%'` sin trigrama | Seq scan en 19k facturas por pulsación | Índices GIN de la sección 3.3; mínimo 2 caracteres; `EXPLAIN` obligatorio |
| R2 | `security definer` sin guard | Fuga de datos con la anon key | Guard de `rol_actual()` + pgTAP de `anon` |
| R3 | Acentos y ñ ("Peña" ≠ "pena") | Resultados perdidos en silencio | `unaccent` + `normalizar` inmutable + índice; test |
| R4 | Ambigüedad NCF / número / RNC | Buscar "101123456" como número | Reglas de precedencia en el parser, con tests |
| R5 | Duplicados factura/pago | Ruido visual | Dedupe por `(entidad,id)` + subtítulo "Pago de B01…" |
| R6 | IA en cada tecla | Costo y latencia | 7 condiciones de la sección 4.5 + caché + tope mensual |
| R7 | El LLM inventa meses o montos | Búsqueda equivocada | zod + "no inventes" + confianza + chip "Interpreté" con `Quitar` |
| R8 | Backdrop demasiado oscuro | El sidebar desaparece y Waldy lo quiere ver | 40 % claro / 55 % oscuro, verificar con captura |
| R9 | Header sticky `z-50` | La ventana queda detrás | `z-[60]` en la ventana; prueba con `data-navbar-style=sticky` |
| R10 | `components/ui` intocable | No se puede oscurecer el overlay | CSS acotado en `globals.css` o prop aditiva (D3) |
| R11 | Migración de índices vieja sin aplicar | Planes peores de lo esperado | Aplicar `20261115900000` junto con la nueva |
| R12 | 870 × 690 en portátiles 1366 × 768 | No cabe | Breakpoint 780 de alto → 660 × 620 |
| R13 | Recientes solo en localStorage | Se pierden al cambiar de equipo | Fase 2 con tabla (D6) |
| R14 | Búsqueda expone notas internas | Información sensible a `lector` | Hoy `lector` ya lee todo por RLS; si Waldy quiere, se restringe en una tarea aparte |
| R15 | Contratos con datos personales a un proveedor | Privacidad | Fase 4 con OK explícito; bucket privado; URL firmada |
| R16 | `formatoMoneda` duplicado | Tercera copia en la ventana | Usar la de `compras` o mover una sola a `src/lib/formato.ts` (fuera del alcance) |

### 6.2 Decisiones pendientes

| # | Pregunta | Opciones | Recomendación | Decide |
| --- | --- | --- | --- | --- |
| D1 | ¿La categoría se llama "Clientes" o "Contactos"? | Clientes / Contactos | **Clientes** (como lo pediste), mostrando clientes y proveedores; la pill aclara cuál es | Waldy |
| D2 | ¿Hay un "Todo" al inicio del rail? | Sí / No | **No**: sin categoría fijada ya se ven todos los grupos | Waldy |
| D3 | ¿Cómo se oscurece el backdrop? | Prop `overlayClassName` en `components/ui/dialog.tsx` / regla en `globals.css` / dejarlo en `black/10` | **Regla acotada en `globals.css`** (no se toca `components/ui`) | Coder |
| D4 | ¿Se retira `cmdk` de la ventana? | Sí, lista propia / mantener `cmdk` | **Lista propia**: el rail y las tarjetas no encajan en un command list | Coder |
| D5 | ¿Los anulados aparecen? | Sí / No | **Sí**, con pill roja | Waldy |
| D6 | ¿Recientes por usuario en base? | Fase 2 / nunca | **Fase 2**, si molesta perderlos | Waldy |
| D7 | ¿Qué proveedor de IA? | OpenAI / Anthropic / Google | El que ya tenga cuenta Waldy; los tres sirven para extraer JSON | Waldy |
| D8 | ¿La fecha de la frase filtra o solo ordena? | Filtra / ordena | **Ordena** ("creo que fue en octubre"); filtro duro solo si la frase dice "solo" | Waldy |
| D9 | ¿"Nuevo contacto" abre el diálogo con `?nuevo=1`? | Sí / ir a la lista | **Sí**, son ~6 líneas por pantalla | Coder |
| D10 | ¿Se busca en notas y términos de documentos? | Sí / No | **No en fase 1** (costo de índice alto, valor bajo); revisar después | Waldy |
| D11 | ¿Se indexan contratos con datos personales? | Sí / No / solo local | **Sí, con OK explícito** y bucket privado; nada de OCR en la fase 1 | Waldy |
| D12 | ¿La ventana muestra el saldo de la factura? | Sí / No | **Sí** cuando el dato ya viene (no se recalcula en la ventana) | Waldy |

### 6.3 Lo que este documento no decide

- No se elige el diseño visual final (colores exactos de pills, iconos definitivos): eso se pinta y se revisa con capturas.
- No se implementa nada: ni migración, ni componentes, ni claves.
- No se toca `src/components/ui`, `src/lib`, `supabase/` ni `package.json` en esta rama.
- No se asume que la migración de índices vieja esté aplicada: hay que confirmarlo antes de medir.
