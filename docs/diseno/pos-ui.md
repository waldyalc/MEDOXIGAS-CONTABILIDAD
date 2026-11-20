# POS — Especificación de UI (`/pos`)

**Estado:** especificación cerrada para 2D. Solo documentación: no implementa rutas, componentes ni estilos.
**Base:** `docs/dominio-pos.md` (contrato de datos, RPC, impresión y errores), `docs/PLAN-FASE-2-ORQUESTADOR.md` (FASE 2, 2D), `docs/alegra/pos/**` (inspiración funcional, nunca copia) y `docs/plantilla-diseno.md` (tokens Medoxigas).
**Rama:** `t3/diseno-ui-pos`, desde `origin/main`.
**Archivo que posee esta tarea:** `docs/diseno/pos-ui.md`.

> **Reglas duras (no negociables).**
> 1. El POS es **la misma contabilidad**: cada venta crea una factura real, descarga inventario y asienta. La UI no inventa totales ni impuestos.
> 2. Solo tokens de `docs/plantilla-diseno.md` (`--primary` azul, `--background`, `--card`, `--destructive`…). **Nunca** el teal `#00b19d` de Alegra ni hex sueltos en la UI. La única excepción de color es el CSS de impresión del ticket, que fuerza blanco y negro.
> 3. Sin multi-empresa ni marca hardcodeada: se usa `empresa.nombre`, `empresa.rnc`, etc. Si un dato de la empresa falta, la línea se omite.
> 4. El POS solo tiene **Vender**, **Turnos**, **Historial de ventas del POS** y **Devoluciones**. Inventario y Configuración viven en Contabilidad.
> 5. No se copia código, HTML, CSS, textos ni diseño exacto de Alegra. Este documento traduce el flujo, no la piel.
> 6. No se agregan dependencias. Se usan los componentes de `src/components/ui/` tal cual y los componentes de negocio existentes que se nombran aquí.
> 7. Ninguna escritura se hace desde el navegador: la capa 2B expone server actions y estas llaman `supabase.rpc("nombre", args)` directo. La UI no usa `service_role`, no desactiva RLS y no envía `ncf_manual`.

## 0. Cómo leer este documento

- **Debe** = requisito de 2D. **No debe** = prohibición. **Puede** = margen permitido, sin cambiar el resultado.
- `[E]` = componente existente que se reutiliza, con su archivo real.
- `[N]` = componente nuevo de 2D, con la ruta exacta donde vive.
- Las decisiones de UX que `docs/dominio-pos.md` deja abiertas se fijan aquí. Ninguna cambia el contrato de datos ni las RPC.
- No hay código de implementación. El bloque CSS de la sección 8 es la única excepción, porque el contrato de impresión es parte de esta especificación.

## 1. Decisiones cerradas

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Shell | Ruta `src/app/(pos)/pos/` en el route group `(pos)`. **No** hereda el layout de `(main)/dashboard`, por lo tanto no muestra el sidebar de Contabilidad. El layout raíz (`src/app/layout.tsx`) sí aporta `Toaster`, `TooltipProvider` y `lang="es-DO"`. |
| 2 | Header | Barra propia de 56 px (`h-14`), sticky, con empresa, selector de terminal, navegación, estado del turno, usuario y salida. Detalle en §3. |
| 3 | Navegación | Cuatro destinos: Vender (`/pos`), Turnos (`/pos/turnos`), Historial (`/pos/historial`), Devoluciones (`/pos/devoluciones`). Sin submenús. |
| 4 | Terminal activa | Vive en la cookie `pos_terminal_id` (no en query param ni `localStorage`), para que el layout y las páginas lean la misma terminal. El selector la cambia con una server action. |
| 5 | Cambio de terminal | Si hay carrito, pide confirmación y **vacía todas las pestañas** antes de cambiar: cambian almacén, numeración, lista y cuentas. |
| 6 | Turno | Vender permite armar el carrito sin turno, pero **Cobrar** y **Devolver** quedan bloqueados hasta abrir uno. Guardar cotización no exige turno. |
| 7 | Carrito | Estado del cliente en un provider montado en el layout del POS (`carrito-pos-provider.tsx`), para que sobreviva a la navegación entre Vender, Turnos, Historial y Devoluciones. Sin persistencia, sin offline, sin `localStorage`. Al recargar o salir se pierde; `beforeunload` avisa si hay líneas. |
| 8 | Pestañas paralelas | Máximo **8** ventas abiertas, todas dentro del provider. Cada una tiene carrito, cliente, lista, numeración, vendedor y cotización cargada independientes. El catálogo y la búsqueda se comparten. |
| 9 | Búsqueda | Debounce **250 ms**, mínimo 2 caracteres; 50 productos por lote y botón «Ver más». La pistola de código de barra va por `pos_buscar_por_codigo_barra` y no espera el debounce. |
| 10 | Foco | El buscador conserva el foco. F2 lo recupera; después de agregar un producto, el foco vuelve ahí. Los diálogos atrapan el foco y lo devuelven al cerrar. |
| 11 | Checkout | Un solo `Dialog` sobre la venta; nunca se abandona la pantalla. Modos: efectivo, tarjeta débito, tarjeta crédito, transferencia, combinado y crédito. |
| 12 | Pago parcial | No es un botón aparte: es el estado de cualquier cobro cuya suma aplicada es menor al total. La UI lo hace explícito con el bloque «Queda a crédito». |
| 13 | Cambio | Solo sobre efectivo. En efectivo simple, el cajero escribe lo recibido; la UI aplica `min(recibido, total)` y muestra el cambio si sobra. Si falta, el resto queda a crédito. |
| 14 | Cotización | «Guardar cotización» es de un clic, con fecha de hoy y vencimiento a 30 días. «Cargar cotización» convierte el carrito en una cotización existente y lo deja **solo lectura** hasta cobrarla o quitarla. |
| 15 | Historial | `TablaLista` paginada. El detalle se abre en un `Sheet` lateral, sin salir del POS. Reimprimir usa el estado actual de la factura (crédito aplicado, «Anulada» si aplica). |
| 16 | Devoluciones | Lista + wizard de 3 pasos en un `Dialog` ancho: **Factura y tipo → Productos y cliente → Detalle del reembolso**. El paso 1 incluye el tipo para que el wizard tenga 3 pasos y el paso 3 permite cambiarlo. |
| 17 | Impresión | Un solo `TicketPos` y un solo `ImpresionPos`. Portal a `document.body`, `window.print()`, sin iframe ni ventana con HTML concatenado. Un solo modo de impresión montado a la vez. |
| 18 | PDF Carta | Se reutiliza `DocumentoPapel` y `plantillas_impresion`. Solo para factura y cotización; la devolución y el cierre se imprimen en ticket térmico. |
| 19 | Roles | `admin` y `contador` operan. `lector` entra directo a Historial/Devoluciones/Turnos en modo lectura; Vender le muestra un aviso y no permite cobrar. Las RPC igual rechazan escrituras. |
| 20 | Responsive | ≥1024 px: catálogo + panel de factura fijo. 768–1023 px: una columna y el panel se abre en `Sheet`. <768 px: una columna, barra inferior con total y `Sheet`. |
| 21 | Dinero y fechas | Montos `numeric(14,2)` en servidor; la UI previsualiza en centavos y muestra `es-DO` con `RD$`. Fechas y horas en `America/Santo_Domingo`. |
| 22 | Stock | La UI **no** bloquea agregar por stock ni reimplementa `vende_negativo`. Muestra la existencia y deja que el motor rechace; el error se explica en el checkout. |
| 23 | Crédito | La UI deshabilita el crédito cuando el cliente es el contacto por defecto de la terminal y avisa. El límite real lo valida el servidor y su mensaje se muestra tal cual. |
| 24 | Red lenta | Nunca se reintenta automáticamente una venta, devolución, movimiento o cierre. Si la respuesta se pierde, se muestra un estado de incertidumbre y se manda al Historial/Turnos antes de repetir. |
| 25 | Alcance | No se edita ni anula una venta desde el POS. No se anula una NC. No se borra un turno, movimiento o terminal. Esas acciones viven en Contabilidad o no existen. |

## 2. Mapa de rutas y archivos

### 2.1 Rutas

| Ruta | Archivo | Pantalla |
| --- | --- | --- |
| `/pos` | `src/app/(pos)/pos/page.tsx` | Vender: catálogo + carrito + checkout + cotización. |
| `/pos/turnos` | `src/app/(pos)/pos/turnos/page.tsx` | Turno actual, movimientos, cierre e historial de cierres. |
| `/pos/historial` | `src/app/(pos)/pos/historial/page.tsx` | Facturas con `origen = 'pos'`, filtros y detalle. |
| `/pos/devoluciones` | `src/app/(pos)/pos/devoluciones/page.tsx` | Notas de crédito del POS y wizard de devolución. |

El layout `src/app/(pos)/pos/layout.tsx` es el único punto que:
- valida sesión y perfil;
- detecta si el POS está instalado;
- carga empresa, terminales activas y turno abierto de la terminal;
- renderiza header + navegación + children.

### 2.2 Archivos nuevos de 2D

| Archivo | Responsabilidad |
| --- | --- |
| `src/app/(pos)/pos/layout.tsx` | Shell, guardas, datos del header. |
| `src/app/(pos)/pos/page.tsx` | Datos iniciales de Vender (catálogo, terminal, turno, catálogos). |
| `src/app/(pos)/pos/turnos/page.tsx` | Datos iniciales de Turnos. |
| `src/app/(pos)/pos/historial/page.tsx` | Lista paginada por `searchParams`. |
| `src/app/(pos)/pos/devoluciones/page.tsx` | Lista paginada de NC del POS. |
| `_components/carrito-pos-provider.tsx` | Estado de las pestañas/carritos, totales y `beforeunload`; montado en el layout. |
| `_components/encabezado-pos.tsx` | Header del POS. |
| `_components/navegacion-pos.tsx` | Tabs de navegación con estado activo. |
| `_components/selector-terminal.tsx` | Selector y cambio de terminal. |
| `_components/estado-turno-pos.tsx` | Badge de turno (abierto/cerrado/sin turno). |
| `_components/usuario-pos.tsx` | Avatar, nombre y «Cerrar sesión». |
| `_components/salir-pos.tsx` | Botón «Salir» con confirmación si hay carrito. |
| `_components/vender/vender-pos.tsx` | Pantalla Vender: catálogo, panel, checkout y diálogos; consume el provider. |
| `_components/vender/catalogo-pos.tsx` | Grilla, filtros y carga por lotes. |
| `_components/vender/buscador-catalogo-pos.tsx` | Búsqueda con foco permanente, debounce y pistola. |
| `_components/vender/tarjeta-producto-pos.tsx` | Tarjeta de producto. |
| `_components/vender/panel-factura.tsx` | Panel derecho: cliente, listas, líneas y totales. |
| `_components/vender/linea-carrito-pos.tsx` | Línea colapsada/expandida. |
| `_components/vender/pestanas-venta-pos.tsx` | Pestañas de ventas paralelas. |
| `_components/vender/dialogo-venta-simple.tsx` | Venta libre (F4). |
| `_components/vender/dialogo-cargar-cotizacion.tsx` | Buscar y cargar cotización abierta. |
| `_components/vender/checkout-pos.tsx` | Cobro simple/combinado/parcial/crédito. |
| `_components/vender/confirmacion-venta.tsx` | Confirmación + impresión. |
| `_components/turnos/turnos-pos.tsx` | Estado raíz de Turnos. |
| `_components/turnos/resumen-turno.tsx` | Tarjetas, fórmula y desglose. |
| `_components/turnos/dialogo-abrir-turno.tsx` | Base inicial. |
| `_components/turnos/dialogo-movimiento.tsx` | Ingreso/retiro con motivo y cuenta. |
| `_components/turnos/dialogo-cerrar-turno.tsx` | Efectivo real, diferencia y asiento. |
| `_components/turnos/tabla-movimientos-turno.tsx` | Movimientos del turno. |
| `_components/turnos/tabla-cierres.tsx` | Historial de cierres. |
| `_components/historial/historial-pos.tsx` | Lista + Sheet de detalle. |
| `_components/historial/filtros-historial.tsx` | Búsqueda, fechas, estado y terminal. |
| `_components/historial/tabla-ventas-pos.tsx` | `TablaLista` de facturas POS. |
| `_components/historial/detalle-venta-pos.tsx` | Detalle en `Sheet`. |
| `_components/devoluciones/devoluciones-pos.tsx` | Lista + wizard. |
| `_components/devoluciones/tabla-devoluciones.tsx` | `TablaLista` de NC del POS. |
| `_components/devoluciones/wizard-devolucion.tsx` | Máquina de los 3 pasos. |
| `_components/devoluciones/paso-factura.tsx` | Factura y tipo. |
| `_components/devoluciones/paso-lineas.tsx` | Líneas y cantidades. |
| `_components/devoluciones/paso-reembolso.tsx` | Efectivo/crédito/combinado. |
| `_components/devoluciones/buscador-factura-pos.tsx` | Buscar factura por NCF, número o cliente. |
| `_components/devoluciones/confirmacion-devolucion.tsx` | Confirmación de la NC + impresión. |
| `src/components/pos/ticket-pos.tsx` | Ticket térmico presentacional (factura, cotización, cierre, devolución, recibo). |
| `src/components/pos/impresion-pos.tsx` | Portal de impresión, título de archivo y `window.print()`. |

### 2.3 Componentes existentes que se reutilizan

| Componente | Archivo | Uso en el POS |
| --- | --- | --- |
| `Button` | `src/components/ui/button.tsx` | Todas las acciones. |
| `Input`, `InputGroup`, `Textarea`, `Label` | `src/components/ui/` | Búsqueda, montos, observaciones, base y conteo. |
| `Select`, `SelectItem` | `src/components/ui/select.tsx` | Terminal, lista, numeración, vendedor, motivo, estado, cuentas cortas. |
| `SelectCampo` | `src/components/select-campo.tsx` | Cuentas contables y catálogos largos con búsqueda. |
| `Combobox` | `src/components/ui/combobox.tsx` | Búsqueda de facturas y resultados del wizard. |
| `SelectorContacto` | `src/components/contactos/selector-contacto.tsx` | Cliente y «Crear nuevo cliente» sin salir del POS. |
| `DatePicker`, `DatePickerCampo` | `src/components/date-picker.tsx` | Rango de fechas del historial y vencimiento si se muestra. |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `src/components/ui/tabs.tsx` | Turno actual/Cierres, Ingreso/Retiro y pestañas de venta. |
| `Dialog` | `src/components/ui/dialog.tsx` | Checkout, venta simple, cargar cotización, abrir/mover/cerrar turno, wizard. |
| `AlertDialog` | `src/components/ui/alert-dialog.tsx` | Cancelar venta, eliminar pestaña, salir con carrito. |
| `Sheet` | `src/components/ui/sheet.tsx` | Panel de factura en tablet/móvil, detalle del historial y detalle de NC. |
| `Alert`, `AlertDescription` | `src/components/ui/alert.tsx` | Errores de servidor y avisos de crédito/turno. |
| `Badge` | `src/components/ui/badge.tsx` | Terminal, tipo de reembolso, «Combo», «Servicio». |
| `Card`, `CardContent` | `src/components/ui/card.tsx` | Tarjetas KPI y contenedores. |
| `Switch` | `src/components/ui/switch.tsx` | Registrar diferencia. |
| `RadioGroup` | `src/components/ui/radio-group.tsx` | Tipo de reembolso. |
| `Table` y familia | `src/components/ui/table.tsx` | Tablas dentro de Sheet y del ticket en pantalla. |
| `TablaLista`, `TarjetaLista`, `BarraLista`, `PillEstado` | `src/components/listas/tabla-lista.tsx` | Historial, devoluciones, movimientos y cierres. |
| `BuscadorLista` | `src/components/listas/buscador-lista.tsx` | Búsqueda de listas del historial/devoluciones. |
| `PaginadorLista` | `src/components/listas/paginador-lista.tsx` | Paginación 25/50/100. |
| `EsqueletoTabla`, `EsqueletoTarjetas`, `EsqueletoFiltros` | `src/components/carga/esqueletos.tsx` | Carga de listas y turnos. |
| `EncabezadoPagina` | `src/components/pagina/encabezado-pagina.tsx` | Títulos de Turnos, Historial y Devoluciones. |
| `ContenedorLista` | `src/components/pagina/contenedor-pagina.tsx` | Ancho de las páginas de lista. |
| `FormField`, `FormSectionTitle` | `src/components/formularios/formulario.tsx` | Campos de diálogos. |
| `CampoFormulario` | `src/components/formularios/campo-formulario.tsx` | Campos con error inline. |
| `Kbd`, `KbdGroup` | `src/components/ui/kbd.tsx` | Atajos F2/F4/F8/Esc. |
| `Empty` y familia | `src/components/ui/empty.tsx` | Estados vacíos ricos, si no se usa el vacío de `TablaLista`. |
| `Skeleton` | `src/components/ui/skeleton.tsx` | Carga del catálogo. |
| `Spinner` | `src/components/ui/spinner.tsx` | Carga dentro de botones. |
| `toast` / `toaster` | `src/components/ui/toast.tsx` | Confirmaciones breves; el diálogo sigue siendo la confirmación principal. |
| `AvatarInicial` | `src/components/avatar-inicial.tsx` | Usuario del header. |
| `DocumentoPapel` | `src/components/documento-venta/documento-papel.tsx` | PDF Carta de factura y cotización. |
| `nombreArchivoPapel`, `formatearMontoPapel` | `src/components/documento-venta/papel.ts` | Nombre y formato del PDF Carta. |
| `formatoMoneda`, `formatoCantidad` | `src/lib/facturacion/formato.ts` | Montos y cantidades. |
| `formatoDia`, `formatoFechaHora` | `src/lib/formato.ts` | Fechas y horas. |
| `tituloTipoComprobante` | `src/lib/facturacion/comprobantes.ts` | Título del comprobante en el ticket. |
| `salir` | `src/app/login/actions.ts` | Cerrar sesión desde el menú de usuario. |

## 3. Shell del POS

### 3.1 Sin sidebar de Contabilidad

- `/pos` vive en `src/app/(pos)/pos/`. El layout del POS es `src/app/(pos)/pos/layout.tsx`; **no** se crea un `src/app/(pos)/layout.tsx` con `SidebarProvider`. El layout del dashboard (`src/app/(main)/dashboard/layout.tsx`) no aplica a esta ruta.
- Prohibido renderizar `AppSidebar` (`src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx`) o el header del dashboard dentro del POS.
- El fondo del shell es `bg-background`; el header `bg-card` con `border-b border-border`.
- El ancho es fluido: el POS está pensado para 1280×800 o más, pero debe funcionar a 1024 px y 768 px sin scroll horizontal de página.

### 3.2 Header (56 px)

Estructura de izquierda a derecha, en una sola fila:

1. **Marca**: logo de `empresa.logo_url` a 28×28 px (si existe) o icono `Store` de lucide. Texto `empresa.nombre` en `text-sm font-semibold`, truncado a 220 px con `title` completo. Si `empresa.nombre` está vacío, el texto es «Punto de venta». En `<768 px` se oculta el nombre y queda solo el logo/icono.
2. **Separador** vertical `Separator orientation="vertical"` de 24 px.
3. **Selector de terminal**: `[N] selector-terminal.tsx`; `Select` de 40 px (`h-10`), ancho 190 px, con icono `Store` a la izquierda. Solo terminales `activa = true`. Si solo hay una, se muestra como texto con badge «Terminal» y no como selector.
4. **Navegación**: `[N] navegacion-pos.tsx`; cuatro enlaces de 40 px (`h-10`), `text-sm`, separados por 4 px. Activo: `bg-primary/10 text-primary font-medium`; inactivo: `text-muted-foreground hover:text-foreground hover:bg-muted`. La ruta activa se calcula con `usePathname()`; `/pos` solo coincide exacto, no con `/pos/turnos`. En `<1024 px` los cuatro enlaces se colapsan en un `DropdownMenu` «Menú» con el destino activo como etiqueta; el header no se parte en dos filas.
5. **Zona derecha**, alineada al final:
   - `[N] estado-turno-pos.tsx`: pill clicable que lleva a `/pos/turnos`. `Abierto` = `bg-primary/10 text-primary`; `Cerrado` = `bg-destructive/10 text-destructive`; `Sin turno` = `bg-muted text-muted-foreground`. Texto: `Turno No 4 · Abierto`, `Turno No 4 · Cerrado`, `Sin turno`. En `<1280 px` se muestra solo el número y el punto de color.
   - `[N] usuario-pos.tsx`: `AvatarInicial` de 32 px + nombre en `text-sm` (oculto <1280 px). `DropdownMenu` con «Cerrar sesión» (llama a `salir`, deshabilitado mientras cierra). No repite «Volver a Contabilidad»: esa salida es el botón «Salir».
   - `[N] salir-pos.tsx`: botón `variant="outline"` de 40 px con icono `ArrowLeft` y texto «Salir» (en `<1280 px` solo icono, `aria-label="Volver a Contabilidad"`). Consulta el provider del carrito: si hay líneas, abre `AlertDialog`; si no, navega a `/dashboard`.
   - `ThemeSwitcher` del dashboard **no** se muestra: el POS usa el tema global y no se cambia desde aquí.

Alto total: 56 px. `position: sticky; top: 0; z-index: 40`. El header lleva `print:hidden`, igual que el header del dashboard: al imprimir solo queda el portal del ticket o del PDF.

### 3.3 Navegación y títulos de página

| Destino | Ruta | Título de la página | Subtítulo |
| --- | --- | --- | --- |
| Vender | `/pos` | No lleva `EncabezadoPagina`; el panel de factura es el título visual. | — |
| Turnos | `/pos/turnos` | `Turnos` | `Abre, opera y cierra la caja de esta terminal.` |
| Historial | `/pos/historial` | `Historial de ventas del POS` | `Facturas cobradas desde el punto de venta.` |
| Devoluciones | `/pos/devoluciones` | `Devoluciones` | `Notas de crédito creadas desde el punto de venta.` |

- Turnos, Historial y Devoluciones usan `EncabezadoPagina` (`src/components/pagina/encabezado-pagina.tsx`) **sin migas**: el contexto lo da la navegación del POS. El `h1` es el de 20 px del componente.
- Las acciones primarias van a la derecha del `EncabezadoPagina`: «Abrir turno», «Registrar movimiento», «Cerrar turno», «Nueva devolución».
- Vender no tiene `h1`; el espacio vertical se reserva para el catálogo.

### 3.4 Terminal activa y cambio de terminal

- Cookie: `pos_terminal_id`, `httpOnly`, `sameSite=lax`, `path=/pos`, `maxAge` 1 año. La setea la server action `seleccionarTerminalPos` de 2B; el layout solo la lee.
- Si la cookie no existe, es inválida o la terminal está inactiva, el layout usa la primera terminal activa por `nombre` (no escribe cookie). Si no hay ninguna, se muestra el estado «Sin terminales» (§9.1).
- El selector muestra `nombre` y, si hay más de una, un check en la activa. Al cambiar:
  - si el carrito está vacío: cambia la cookie y hace `router.refresh()`;
  - si hay líneas: `AlertDialog` «¿Cambiar de terminal?» con «El carrito se vaciará porque cambian el almacén, la numeración y las cuentas.» → «Cancelar» / «Cambiar y vaciar carrito»;
  - si hay una venta en curso: el selector se deshabilita.
- El `carrito-pos-provider.tsx` se monta con `key={terminal.id}`: al cambiar de terminal se reinician las pestañas y los defaults (contacto, lista, numeración) sin arrastrar un carrito de otra caja.
- La terminal no se cambia desde el ticket ni desde el historial. El historial puede filtrar por terminal, pero eso no cambia la terminal activa.
- Dos pestañas del mismo navegador comparten la cookie y, por lo tanto, la terminal. El POS asume **una caja física por dispositivo/navegador**; para dos cajas se usan dos dispositivos o dos perfiles de navegador.
- El POS no crea ni edita terminales. El estado «Sin terminales» enlaza a `/dashboard/configuracion/pos` en una pestaña nueva.

### 3.5 Estado del turno

- El layout consulta el turno abierto de la terminal activa (`pos_turnos` con `estado = 'abierto'` y `terminal_id`). No llama `pos_resumen_turno` para el badge; el resumen completo se carga en Turnos.
- `Abierto` incluye `numero` y hora de apertura en el `title` (tooltip): `Turno No 4 · Abierto desde 08:15 a. m.`.
- Un turno cerrado no se muestra como abierto aunque la terminal tenga movimientos. Si no hay turno, `Sin turno`.
- Al abrir o cerrar un turno, la página llama `router.refresh()` para que el layout actualice el badge. El estado local de Turnos también se actualiza con el payload devuelto por la RPC (no se espera al refresh).

### 3.6 Guardas, roles e instalación

- `layout.tsx`:
  - sin sesión → `redirect("/login")`;
  - perfil con `rol = null` → `redirect("/unauthorized")`;
  - `lector` puede ver el shell, pero Vender muestra el aviso de solo lectura y Turnos/Devoluciones ocultan las acciones de escritura.
- Detección de instalación: una consulta a `pos_terminales` con `select("id").limit(1)`. Si la tabla no existe (`42P01`), se renderiza `<PosNoInstalado />`. Si la tabla existe pero una RPC de lectura falta (`42883`), la primera lectura muestra el mismo estado. No se usa variable de entorno ni feature flag.
- La UI no es la frontera de seguridad: las RPC vuelven a validar el rol. Si una acción devuelve `42501`, se muestra «Sin permiso.» y se recarga la pantalla.
- Si la terminal activa se desactiva mientras la pestaña está abierta, la siguiente acción devuelve el error de terminal inactiva; la UI muestra el aviso y ofrece «Elegir otra terminal».

### 3.7 Medidas y responsive

| Elemento | Medida |
| --- | --- |
| Header | 56 px |
| Padding del shell | 16 px (`p-4`); 24 px en ≥1440 px |
| Altura de Vender | `calc(100dvh - 56px)` con scroll interno por columna |
| Panel de factura | 400 px (1024–1279), 420 px (≥1280) |
| Catálogo | fluido; `gap-3` entre tarjetas |
| Tarjeta de producto | mínimo 148 px de alto |
| Buscador | 44 px (`h-11`) |
| CTA Vender | 48 px (`h-12`) |
| Controles y botones | mínimo 40 px; iconos 40×40 |
| Radios | 12 px tarjetas, 10 px inputs, 8 px badges |
| Tabla de historial | `TablaLista` normal (cabecera 48, fila 56) |
| Tabla de movimientos | `TablaLista` compacta (fila 44) |

- ≥1024 px: `grid grid-cols-[minmax(0,1fr)_400px]` (o 420 px en ≥1280).
- 768–1023 px: una columna; el panel de factura no se renderiza inline; una barra inferior de 64 px muestra `N artículos`, total y «Ver factura»; abre el panel en `Sheet side="right"` de 420 px.
- <768 px: igual que tablet, pero el `Sheet` ocupa `w-full` y el checkout/wizard pasan a `Dialog` casi pantalla completa (`max-h-[92dvh] overflow-y-auto`).
- El catálogo nunca hace scroll horizontal de página. Las categorías y los atajos pueden tener scroll horizontal propio.
- En <1024 px, las tablas de Turnos, Historial y Devoluciones se envuelven en un contenedor `overflow-x-auto`; no se ocultan las columnas críticas (NCF, total, estado) y la página no se desplaza en horizontal.

## 4. Vender (`/pos`)

### 4.1 Composición

```
┌ header 56 ──────────────────────────────────────────────────────────────┐
│ empresa · terminal · Vender/Turnos/Historial/Devoluciones · turno · user│
├───────────────────────────────────────────────┬─────────────────────────┤
│ Catálogo                                      │ Factura de venta        │
│  buscador + pistola + favoritos + categorías  │  lista / numeración     │
│  grilla de productos                          │  cliente                │
│  «Cargar más»                                 │  líneas (scroll)        │
│                                               │  totales + Vender       │
│                                               │  pestañas de venta      │
└───────────────────────────────────────────────┴─────────────────────────┘
```

- `page.tsx` es Server Component: carga en paralelo empresa, terminal activa, turno, catálogo inicial (50), categorías, impuestos, numeraciones, listas, vendedores y la plantilla de impresión. Pasa todo a `[N] vender-pos.tsx` (client), que consume el estado de `[N] carrito-pos-provider.tsx`.
- El provider se monta una sola vez en `layout.tsx`, por fuera de las páginas. Así el carrito sobrevive a ir a Turnos, Historial o Devoluciones y volver a Vender; no sobrevive a recargar ni a «Salir». La primera pestaña se crea con los defaults de la terminal cuando el provider recibe la terminal.
- La primera pintura ya trae catálogo y terminal; no hay spinner de página completa.
- El catálogo y el panel son independientes: el panel no hace scroll con el catálogo; cada uno tiene su propio `overflow-y-auto`.

### 4.2 Catálogo ultrarrápido

#### 4.2.1 Buscador y pistola

- `[N] buscador-catalogo-pos.tsx`: `InputGroup` de 44 px con icono `Search`, placeholder «Buscar producto, referencia o código…», `aria-label="Buscar productos"` y `Kbd` «F2» a la derecha.
- El input conserva el foco. `useEffect` lo enfoca al montar y después de agregar, quitar o cobrar. Si el foco se va a otro campo, F2 lo recupera.
- Debounce 250 ms; mínimo 2 caracteres. Mientras espera, muestra `Loader2` dentro del input y `aria-busy="true"`. Los resultados anteriores se mantienen hasta que llegan los nuevos (sin parpadeo).
- Cada búsqueda lleva un número de solicitud; si llega una respuesta vieja, se descarta. Una sola RPC por término: `pos_catalogo_productos`.
- **Pistola de código de barra:** un `keydown` global acumula caracteres imprimibles cuando el foco no está en un campo editable; al recibir `Enter`, llama `pos_buscar_por_codigo_barra` con el buffer (máximo 64 caracteres, timeout de 100 ms entre teclas). Si el foco está en el buscador, el texto entra normal y `Enter` también intenta código de barra antes de elegir el primer resultado.
  - 0 resultados: «No encontramos un producto con el código «{codigo}».» + se conserva el texto para corregir.
  - 1 resultado: se agrega y se limpia el buscador.
  - Error de red: «No se pudo leer el código de barra. Inténtalo de nuevo.»
- `Enter` sin código: si hay un resultado resaltado, lo agrega; si solo hay uno, lo agrega; si hay varios, mantiene la lista y anuncia «N resultados. Usa las flechas para elegir.».
- Flechas ↑/↓ mueven el resultado resaltado; el resaltado se pinta con `bg-primary/10` y `aria-selected="true"`.

#### 4.2.2 Favoritos y categorías

- Fila superior del catálogo:
  - botón «Favoritos» con estrella, `toggle` de 40 px con `aria-pressed`; activo `bg-primary/10 text-primary`;
  - `Select` de categoría, 40 px, opción inicial «Todas las categorías»;
  - contador discreto «N productos» a la derecha.
- Favoritos = `favorito_pos = true` vía `pos_catalogo_productos(p_solo_favoritos => true)`. Si no hay: estado «Aún no tienes productos favoritos.» y enlace «Marcar favoritos en Inventario» que abre `/dashboard/productos` en pestaña nueva.
- La lista de categorías viene de `listarCategorias()` (`src/lib/inventario/consultas.ts`) o de la consulta equivalente de 2B; se muestran solo activas y con nombre.
- Cambiar favoritos/categoría reinicia el offset a 0 y conserva el término de búsqueda.

#### 4.2.3 Tarjetas de producto

- `[N] tarjeta-producto-pos.tsx`. Es un `<button type="button">` completo, no un `div` con `onClick`; target mínimo 148×120 px.
- Contenido:
  - imagen 64×64 (`imagen_path`) o icono `Package` sobre `bg-muted`; `loading="lazy"`, `decoding="async"`;
  - nombre en 2 líneas (`line-clamp-2`), `text-sm font-medium`;
  - precio `formatoMoneda(precio)` en `text-base font-semibold tabular-nums`; debajo, unidad (`unidad_medida` o «Unidad») en `text-xs text-muted-foreground`;
  - existencia: `Existencia: 12` en `text-xs`; si `stock <= 0`, «Sin existencia» en `text-destructive`; para servicio, «Servicio»; para combo, «Combo» + `Disponible: N` si `disponible` no es null;
  - estrella de favorito (solo lectura) si `favorito_pos`;
  - badge circular con la cantidad ya agregada en la venta activa, en la esquina superior derecha.
- El botón **no se deshabilita** por stock. El motor decide si se puede vender en negativo. Si el producto no tiene stock y no permite negativo, el error aparece en el checkout.
- Click / `Enter`: agrega 1 unidad de la unidad base. Si ya existe una línea con el mismo producto, unidad, precio, descuento e ITBIS, incrementa la cantidad; si no, crea una línea. La línea nueva se resalta 600 ms con `bg-primary/10` (sin animación si `prefers-reduced-motion`).
- Al agregar: se anuncia en la región `aria-live` «{Producto} agregado. {N} artículos. Total {RD$ X}.», se limpia la búsqueda si vino de una búsqueda y el foco vuelve al buscador.

#### 4.2.4 Carga por lotes

- Primer lote: 50 (`p_limit = 50`). Si la RPC devuelve 50, aparece «Ver más productos» al final de la grilla, de 40 px.
- Click: pide el siguiente lote con `p_offset` y lo agrega al final; el botón muestra `Loader2` y «Cargando…». No hay scroll infinito para no perder el foco de la pistola.
- La RPC acota `p_limit` a 200; la UI nunca pide más de 50.
- Cambiar búsqueda, favoritos o categoría descarta los lotes anteriores.

#### 4.2.5 Carga, vacío y error

- Carga inicial: 8 tarjetas `Skeleton` con la misma altura; el buscador y los filtros ya están visibles y usables. El contenedor lleva `aria-busy="true"` y un texto `sr-only` «Cargando productos…».
- Carga de un lote: el botón «Ver más» se convierte en spinner; no se tapa la grilla.
- Vacío sin filtros: «No hay productos en esta terminal.» / «Configura el catálogo en Inventario o cambia de terminal.»
- Vacío con búsqueda: «No encontramos productos para «{q}».» / «Revisa el nombre o escanea el código de barra.»
- Error: `Alert variant="destructive"` «No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.» + botón «Reintentar».

### 4.3 Panel de factura

- `[N] panel-factura.tsx`. En desktop es una columna fija de 400/420 px; en tablet/móvil va dentro de un `Sheet`. Lee y escribe la pestaña activa del `carrito-pos-provider.tsx`.
- El panel tiene tres zonas: cabecera de datos, líneas con scroll y pie fijo con totales/acciones. El pie nunca se va con el scroll.
- Cabecera:
  1. Título «Factura de venta» + nombre de la pestaña activa (ej. «Venta 1»).
  2. `Select` «Lista de precios» (40 px). Opciones: listas activas + «Precio base» (valor nulo). Default: `terminal.lista_precio_defecto_id` o «Precio base».
  3. `Select` «Numeración» (40 px). Opciones: numeraciones activas de tipo `01/02/14/15/16`. Default: `terminal.numeracion_defecto_id`. Si la terminal no tiene una válida, el select muestra «Sin numeración» y el CTA se deshabilita con el aviso «La terminal no tiene una numeración de venta activa.»
  4. `SelectorContacto` (`src/components/contactos/selector-contacto.tsx`) con `tipoInicial="cliente"`, `showClear={false}`, default `terminal.contacto_defecto_id`. El componente ya incluye «Crear nuevo cliente» sin salir del POS. Ancho completo.
  5. `Select` «Vendedor» opcional, solo si hay vendedores activos. Default vacío («Sin vendedor»). No es obligatorio.
  6. Si hay una cotización cargada: badge «Cotización No 12» + botón «Quitar cotización». Cliente, lista y vendedor se deshabilitan; numeración sigue editable (es la factura que se va a emitir). Un texto pequeño: «Las líneas vienen de la cotización y no se editan aquí.»
- Los controles de la cabecera son de 40 px y tienen etiquetas visibles (no solo placeholder). En el `Sheet` móvil se apilan.

#### 4.3.1 Líneas del carrito

Cada línea (`[N] linea-carrito-pos.tsx`) tiene dos estados.

**Colapsada (siempre visible), 56–64 px:**

- Nombre del producto o descripción libre, una línea con truncado y `title`.
- Debajo, en `text-xs text-muted-foreground`:
  - `2 × RD$ 100.00`;
  - unidad si no es la base (`Caja 50 lb`). En el carrito la unidad se muestra siempre, aunque `mostrar_unidad` sea false en el ticket;
  - `Desc. 5%` si `descuento_pct > 0`;
  - `ITBIS 18%` o `Exento`.
- A la derecha, total de la línea **con ITBIS** (`subtotal − descuento + ITBIS`) en `font-semibold tabular-nums`.
- Stepper de cantidad `− 2 +` con botones de 40×40 e input de 40 px de ancho. El input acepta hasta 2 decimales. Si se escribe 0 y se sale del campo, vuelve a 1 y muestra «La cantidad debe ser mayor a cero.»
- Botón de papelera de 40×40, `aria-label="Quitar {producto}"`. Quita la línea sin confirmación (se puede volver a agregar); anuncia «{Producto} quitado.» en `aria-live`.
- Click en el nombre o en el lápiz expande el editor.

**Expandida (solo una a la vez), 120–160 px:**

- Campo «Descripción» (solo línea libre; en producto se muestra el nombre y no se edita).
- `Select` «Unidad»: unidades activas del producto devueltas por el catálogo (`unidades`); la base siempre está. Cambiar unidad recalcula el precio de la unidad (precio manual se descarta) y la cantidad se conserva.
- `InputGroup` «Precio» con prefijo `RD$`; 2 decimales; permite 0.
- `InputGroup` «Descuento» con sufijo `%`; 0–100; 2 decimales.
- `Select` «ITBIS»: «Exento (0%)» + impuestos activos (`getImpuestosActivos()` / 2B). Default: `itbis_tasa` del producto; en línea libre, 0.
- Botón «Listo» de 40 px para colapsar.
- Los totales de la línea se recalculan en el cliente con centavos para la previsualización; el servidor manda al cobrar.

Reglas:

- Los importes se alinean a la derecha y usan `tabular-nums`.
- El descuento es porcentual por línea, no global. No hay descuento a nivel de factura en el POS.
- No hay propina, otros impuestos ni retenciones en el POS.
- Una línea libre (venta simple o línea agregada a mano) siempre tiene `producto_id = null`; su descripción es obligatoria.
- No se permite cantidad negativa ni precio negativo. El input corrige al perder el foco y muestra el error inline.
- Al cambiar la lista de precios:
  - las líneas con `precioManual = false` toman el precio de la nueva lista para su producto/unidad;
  - las líneas con `precioManual = true` conservan el precio que escribió el cajero;
  - las líneas libres no cambian;
  - se vuelve a pedir el catálogo para que las tarjetas muestren la nueva lista.
- Al enviar la venta se envía `precio` resuelto en **todas** las líneas (producto y libres) para que el servidor cobre exactamente lo que vio el cajero. El precio de unidad se resuelve con la lista y el factor, como en `docs/dominio-pos.md` §3.6.2.

#### 4.3.2 Totales y acciones

Pie fijo del panel:

| Fila | Contenido |
| --- | --- |
| Subtotal | Suma de líneas antes de impuestos y descuento. |
| Descuento | Solo si > 0; en `text-muted-foreground`. |
| ITBIS | Una fila por tasa (`ITBIS 18%`, `ITBIS 16%`, `CDT 2%`…); si hay una sola, «ITBIS 18%». |
| Total | `text-2xl font-semibold tabular-nums`, separador superior. |
| Artículos | `N artículos` en `text-xs text-muted-foreground`. |

- CTA principal: `Vender RD$ 236.00`, `h-12`, ancho completo. Abre el checkout (F8). Deshabilitado si:
  - no hay líneas;
  - no hay turno abierto (con aviso arriba);
  - no hay numeración válida.
- Debajo, en una fila de 40 px: «Guardar cotización» (`outline`, icono `FileText`) y «Cargar cotización» (`ghost`, icono `FolderOpen`). «Cancelar venta» va como enlace de texto `text-destructive` debajo, alineado a la izquierda.
- «Cancelar venta»: `AlertDialog` «¿Cancelar la venta?» / «Se eliminarán los productos del carrito.» → «Volver» / «Sí, cancelar venta». Al confirmar, deja la pestaña vacía y el foco en el buscador.
- El CTA muestra el total **dentro** del botón, no solo arriba. Durante el envío: `Loader2` + «Procesando venta…», `disabled`, y no se permite doble submit.

### 4.4 Venta simple (F4)

- `[N] dialogo-venta-simple.tsx`, `Dialog` de 480 px.
- Campos:
  - «Descripción» obligatoria, `Input`, máximo 200 caracteres, placeholder «Ej. Servicio de instalación».
  - «Monto» obligatorio, `InputGroup` con `RD$`, mayor a 0, 2 decimales.
  - «ITBIS» `Select`: «Exento (0%)» + impuestos activos. Default «Exento (0%)» (el dominio usa 0 por defecto en venta simple).
  - Vista previa: «Total: RD$ X» (monto + ITBIS) en una caja `bg-muted/40`.
- «Aplicar a la venta» (primario, 48 px) crea una línea libre `cantidad = 1`, `precio = monto`, `descuento_pct = 0`, `itbis_tasa` elegida. Si el carrito tiene una cotización cargada, la acción está deshabilitada con «Quita la cotización para agregar una venta simple.»
- «Cancelar» cierra sin cambios. Esc cierra.
- No hay calculadora de operadores (la de Alegra no se copia): es un formulario directo, más rápido de operar con teclado.

### 4.5 Pestañas de ventas paralelas

- `[N] pestanas-venta-pos.tsx` al pie del panel. Es una tira de pestañas de 40 px, con scroll horizontal si hay muchas.
- Pestaña: nombre (`Venta 1`, `Venta 2`…) + total de su carrito en `text-xs tabular-nums`. Activa: `border-b-2 border-primary text-foreground`; inactiva: `text-muted-foreground`. La tira usa `role="tablist"`, cada pestaña `role="tab"` con `aria-selected`, y el panel `role="tabpanel"` con `aria-labelledby`.
- `+` al final, 40×40, `aria-label="Nueva venta"`. Crea una pestaña con defaults (cliente de la terminal, lista y numeración por defecto) y foco en el buscador. Deshabilitado a las 8 con tooltip «Máximo 8 ventas abiertas.».
- Menú `⋮` por pestaña (`DropdownMenu`): «Renombrar» y «Eliminar».
  - Renombrar: input inline en la pestaña, máximo 30 caracteres; `Enter` guarda, Esc cancela; vacío vuelve a `Venta N`.
  - Eliminar: `AlertDialog` «¿Eliminar «Venta 2»?» / «Se perderán sus productos.» → «Cancelar» / «Eliminar». Si es la activa, se activa la anterior; si era la última, se crea una nueva vacía.
- Las pestañas viven en `carrito-pos-provider.tsx`, no en `vender-pos.tsx`. Al cambiar de pestaña se conserva todo su estado (carrito, cliente, lista, numeración, vendedor, cotización, venta simple). El catálogo y la búsqueda son compartidos; no se vuelve a consultar el catálogo al cambiar de pestaña.
- Las pestañas no se persisten: recargar la página deja una sola «Venta 1».

### 4.6 Atajos de teclado

| Tecla | Acción | Condición |
| --- | --- | --- |
| `F2` | Enfoca el buscador y selecciona su texto. | Siempre, salvo diálogo modal abierto. |
| `F4` | Abre «Venta simple». | Vender, sin cotización cargada, sin modal. |
| `F8` | Abre el checkout. | Hay líneas, turno abierto y numeración válida; sin modal. |
| `Esc` | Cierra el diálogo superior; si no hay diálogo, limpia la búsqueda; si no hay búsqueda, enfoca el buscador. | No cierra la confirmación de venta. |
| `Enter` | En el buscador: código de barra o primer resultado. En formularios: envía el formulario. | — |
| `↑` / `↓` | Mueve el resultado resaltado del buscador. | Buscador con resultados. |
| `+` / `−` | Aumenta/disminuye la cantidad de la línea enfocada. | Foco en el stepper o en la línea. |

- Los atajos no se disparan mientras el foco está en un `input`, `textarea`, `select` o `contenteditable`, salvo F2/F8/Esc y los de la propia línea.
- `F4` y `F8` se anuncian en tooltips y en `Kbd` junto al botón; no se muestran en un modal de ayuda (no hay centro de ayuda en el POS).
- `Ctrl/Cmd + Enter` no se usa para evitar conflictos con el navegador.

### 4.7 Salida y protección del carrito

- `beforeunload` cuando alguna pestaña tiene líneas: el navegador muestra su aviso genérico. No se intenta personalizar el texto (los navegadores lo ignoran). El listener vive en `carrito-pos-provider.tsx`.
- La navegación interna (Vender ↔ Turnos ↔ Historial ↔ Devoluciones) **no** pierde el carrito: el provider está en el layout. «Salir» y «Volver a Contabilidad» sí lo pierden, por eso confirman si hay líneas.
- «Salir» del header con carrito: `AlertDialog` «¿Salir del punto de venta?» / «Las ventas que no hayas cobrado se perderán.» → «Seguir vendiendo» / «Salir».
- El botón «Salir» es la única salida a Contabilidad; su `title` y `aria-label` dicen «Volver a Contabilidad».
- Cerrar sesión no pide confirmación de carrito: `salir` cierra la sesión y redirige a `/login`; el carrito se pierde. El ítem del menú dice «Cerrar sesión» y es destructivo.

### 4.8 Cotizaciones rápidas

#### 4.8.1 Guardar

- `pos_crear_cotizacion` no exige turno abierto. El botón se habilita con al menos una línea.
- Un clic guarda con:
  - `terminal_id`, `contacto_id` (el del panel), `lista_precio_id`, `vendedor_id`;
  - `fecha = hoyRD()`, `vencimiento = hoy + 30 días`;
  - `lineas` resueltas (con `precio`); la venta simple es una línea libre `producto_id = null`; si hay una cotización cargada, el botón se oculta (no se cotiza una cotización).
- Si no hay turno, `pos_crear_cotizacion` la crea con `turno_id = null`; si hay, la liga al turno abierto. La UI no envía `turno_id`.
- Éxito: `[N] confirmacion-venta.tsx` en modo cotización: «Cotización guardada», `Cotización No 12`, total, cliente, y botones «Imprimir ticket», «PDF Carta», «Nueva venta», «Cerrar». No se limpia el carrito hasta «Nueva venta» o «Cerrar» (si el cajero quiere convertirla, puede hacerlo desde el mismo carrito).
- Error: `Alert` en el panel con el mensaje del servidor capitalizado; el carrito no se toca. Si la respuesta se pierde por red, no se reintenta sola: revisa Cotizaciones antes de volver a guardar, para no duplicar.
- La cotización aparece en Ingresos → Cotizaciones (Contabilidad). El toast ofrece «Ver en Contabilidad» como enlace en pestaña nueva a `/dashboard/cotizaciones` (no se navega fuera del POS).

#### 4.8.2 Cargar

- `[N] dialogo-cargar-cotizacion.tsx`, `Dialog` de 640 px.
- Buscador con debounce 300 ms por número o cliente. Lista de cotizaciones `abierta`, ordenadas por fecha descendente, con: número, cliente, fecha, vencimiento, total. Paginación 25 con «Ver más».
- Si no hay: «No hay cotizaciones abiertas.» / «Guarda una cotización desde el carrito para verla aquí.»
- Al elegir:
  - si el carrito actual tiene líneas, `AlertDialog` «¿Reemplazar el carrito?» / «Se quitarán los productos actuales y se cargará la cotización No 12.»;
  - al confirmar, se cargan las líneas de la cotización en modo lectura, se fija el cliente de la cotización y se muestra el badge «Cotización No 12»;
  - la lista de precios se deshabilita (los precios vienen de la cotización);
  - el vendedor y el centro de costo los resuelve el servidor; la UI no los envía;
  - el panel muestra «Las líneas vienen de la cotización y no se editan aquí. Quítala para armar una venta nueva.»
- Checkout con cotización: se envía `cotizacion_id` y **se omite `contacto_id`** (el dominio rechaza un contacto distinto). No se envían `lineas` (la cotización es la fuente exclusiva). `numeracion_id` sí se envía si el cajero la cambió.
- «Quitar cotización» vuelve a un carrito normal con las mismas líneas, ya editables y sin vínculo. Esas líneas quedan con `precioManual = true` y conservan el precio de la cotización; la lista de precios se habilita pero no las repisa. Se muestra el aviso «Los precios se conservan de la cotización.» Si se cobra después, se crea una venta nueva, no se convierte la cotización; el aviso lo dice: «Si quitas la cotización, se cobrará como una venta nueva y la cotización seguirá abierta.»
- Convertir dos veces la misma cotización no puede pasar desde la UI porque al cobrar se cierra la confirmación y la cotización deja de estar `abierta`; si el servidor devuelve «La cotización no existe o no está abierta.», se muestra tal cual y se recarga la lista.

### 4.9 Checkout

`[N] checkout-pos.tsx`, `Dialog` de 720 px (`sm:max-w-[720px]`), `max-h-[92dvh] overflow-y-auto`; en móvil ocupa el ancho disponible. Se abre desde «Vender» o F8.

#### 4.9.1 Cabecera

- Título «Cobrar venta»; subtítulo «Caja 1 · Turno No 4».
- Cliente y total: «Consumidor Final» + `TOTAL RD$ 236.00` en `text-2xl font-semibold`.
- Si la venta viene de cotización: «Cotización No 12 · Cliente X».
- Botón de cerrar (X) de 40×40. Mientras la venta está en curso (request enviado), X y Esc están deshabilitados: no se puede cerrar hasta que el servidor responda o la UI muestre el estado de incertidumbre. Antes de enviar, cerrar pide confirmación («La venta no se ha cobrado. ¿Cerrar el cobro?»).

#### 4.9.2 Modos

Seis tiles seleccionables, en grilla 3×2 (2×3 en móvil), cada uno de 72 px de alto:

| Tile | Icono | Cuenta por defecto | Disponible si |
| --- | --- | --- | --- |
| Efectivo | `Banknote` | `terminal.cuenta_efectivo_id` | Siempre (la terminal la exige). |
| Tarjeta débito | `CreditCard` | `terminal.cuenta_tarjeta_debito_id` | La cuenta existe y está activa. |
| Tarjeta crédito | `CreditCard` | `terminal.cuenta_tarjeta_credito_id` | La cuenta existe y está activa. |
| Transferencia | `ArrowLeftRight` | `terminal.cuenta_transferencia_id` | La cuenta existe y está activa. |
| Combinado | `Split` | — | Al menos un método no efectivo disponible. |
| Crédito | `CalendarClock` | — | El cliente no es el contacto por defecto. |

- Tile deshabilitado: `opacity-50`, `cursor-not-allowed`, `title` con el motivo. Motivos exactos:
  - «La terminal no tiene una cuenta configurada para tarjeta débito.»
  - «La terminal no tiene una cuenta configurada para tarjeta crédito.»
  - «La terminal no tiene una cuenta configurada para transferencia.»
  - «No se puede vender a crédito al Consumidor Final.»
- El tile activo: `border-primary bg-primary/5 text-primary`.
- Cada tile muestra debajo la cuenta contable en `text-xs text-muted-foreground` (ej. «Caja general»), para que el cajero sepa dónde cae el dinero.

#### 4.9.3 Efectivo simple

- Un solo campo «Efectivo recibido» (`InputGroup` con `RD$`), default = total; `inputMode="decimal"`, 2 decimales.
- Pills rápidas debajo: «Exacto», y los siguientes múltiplos de 50, 100, 200, 500 y 1,000 que sean ≥ total, sin duplicados. Máximo 5 pills en total, contando «Exacto». Al elegir, se llena «Efectivo recibido».
- Cálculo en vivo:
  - `aplicado = min(recibido, total)`;
  - `cambio = max(0, recibido - total)`;
  - `credito = total - aplicado`.
- Se muestran dos filas: «Aplicado a la venta» y «Cambio». Si `credito > 0`, aparece el bloque «Queda a crédito» (ver §4.9.6).
- Si `recibido` está vacío o es 0: no se puede cobrar; «Escribe el efectivo recibido.»
- No hay campo separado de «monto aplicado»: el recibido manda. Esto evita que el cajero cobre de más y fíe al mismo tiempo.

#### 4.9.4 Otros métodos simples

- Campo «Monto aplicado» (`InputGroup` con `RD$`), default = total, editable. Si se baja, el resto queda a crédito; si se sube por encima del total, error inline «La suma de los pagos no puede exceder el total de la venta.»
- Sin campo de efectivo recibido ni cambio (solo el efectivo admite cambio).
- La cuenta se muestra read-only debajo; el cajero no la cambia en el POS. El payload no envía `cuenta_id`: la terminal la resuelve.
- Si la venta es parcial, el bloque de crédito explica el saldo.
- Vendedor y notas no se editan aquí; ya viven en el panel de factura.

#### 4.9.5 Combinado

- Tabla de filas, máximo 4, una por método. «Agregar método» abre un `Select` con los métodos disponibles que no estén ya en la tabla. No se repite un método para evitar dos cuentas iguales en la misma venta.
- Cada fila:
  - `Select` «Método» (efectivo, tarjeta débito, tarjeta crédito, transferencia);
  - `InputGroup` «Monto aplicado» (default: el saldo por aplicar; editable);
  - si es efectivo: `InputGroup` «Efectivo recibido» (default = monto aplicado) y el cambio calculado;
  - cuenta contable read-only;
  - botón de quitar fila de 40×40.
- Totales en vivo: «Total recibido» (suma aplicada), «Por cobrar» (total − suma aplicada) y «Cambio» (solo efectivo).
- Reglas:
  - suma aplicada ≤ total; si se pasa, error inline y CTA deshabilitado;
  - si `porCobrar > 0`, ningún efectivo puede tener `recibido > aplicado` («No se da cambio y se fía a la vez.»); el campo «Efectivo recibido» se bloquea al aplicado;
  - si `porCobrar = 0`, el cambio es `sum(recibido efectivo) − sum(aplicado efectivo)`, nunca negativo;
  - si `porCobrar > 0` y el cliente es Consumidor Final, se muestra el bloque de crédito bloqueado y no se puede cobrar.
- La fila de efectivo es opcional; una venta combinada de solo tarjeta y transferencia es válida (es un pago dividido, no un crédito).
- «Agregar método» se deshabilita si no quedan métodos o si ya hay 4 filas.

#### 4.9.6 Crédito y pago parcial

- El bloque «Queda a crédito» aparece siempre que `porCobrar > 0` (efectivo simple, otro método o combinado):
  - monto a crédito en `text-lg font-semibold`;
  - «La factura quedará por cobrar a nombre de {cliente}.»;
  - si el cliente es el contacto por defecto: `Alert variant="destructive"` «No se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total.» + un `SelectorContacto` compacto en el mismo bloque (label «Cliente para el crédito»). Al elegir, el bloque se reevalúa sin cerrar el checkout y el tile «Crédito» se habilita si corresponde.
  - con una cotización cargada, el cliente no se cambia (viene de la cotización): el bloque muestra el mismo aviso y «Quita la cotización para cambiar de cliente.» Sin `SelectorContacto`.
  - La UI no muestra el saldo actual ni el límite del contacto antes de cobrar; el servidor los valida y devuelve el mensaje completo.
- El tile «Crédito» es el atajo para `pagos = []`: no hay filas de pago, todo el total queda en CxC. El CTA dice «Vender a crédito RD$ 236.00».
- Si el cliente es Consumidor Final, el tile está deshabilitado y el bloque de crédito no permite continuar. El `SelectorContacto` del propio bloque permite cambiarlo sin cerrar el checkout; el tile se habilita al volver a evaluar.
- La venta a crédito **no** requiere un pago de 0: el payload simplemente omite `pagos`.

#### 4.9.7 Confirmar y errores

- CTA: «Cobrar RD$ 236.00» o «Vender a crédito RD$ 236.00» (llama `pos_completar_venta`). `h-12`, ancho completo en móvil. Durante el envío: `Loader2` + «Procesando venta…», `disabled`.
- El botón se deshabilita si:
  - la suma aplicada es 0 y el modo no es Crédito;
  - la suma aplicada excede el total;
  - hay crédito y el cliente es Consumidor Final;
  - falta efectivo recibido en una fila de efectivo;
  - hay una fila de combinado sin método o sin monto.
- Errores del servidor: `Alert variant="destructive"` en la parte superior del diálogo, con el mensaje capitalizado. El diálogo no se cierra y el carrito no se toca. Casos:
  - «No hay existencia suficiente del producto X.» → el cajero ajusta la cantidad; no se resalta una línea por nombre porque la descripción pudo editarse.
  - «No se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total.»
  - «La venta a crédito excede el límite del contacto (límite X, saldo actual Y, saldo nuevo Z).» + ayuda «Reduce el monto a crédito o selecciona otro cliente.»
  - «La suma de los pagos no puede exceder el total de la venta.»
  - «El monto recibido en efectivo no puede ser menor al monto del pago.»
  - «La terminal no tiene una cuenta configurada para tarjeta débito.» (si cambió la config)
  - «No hay un turno abierto en la terminal Caja 1.» → se cierra el checkout y se muestra el aviso de turno.
  - «La cotización pertenece a otro contacto.» / «La cotización no existe o no está abierta.»
  - «Sin permiso.»
- Error de red: ver §9.3. No se reintenta solo.

#### 4.9.8 Confirmación de venta

`[N] confirmacion-venta.tsx` reemplaza el contenido del diálogo tras el éxito.

- Icono `CircleCheck` en un círculo `bg-primary/10 text-primary` de 56 px.
- «Venta registrada» (`text-xl font-semibold`).
- `{NCF}` + «Factura No 15» y «Cliente».
- Total, «Recibido» y «Cambio» (solo si hubo efectivo); «Queda a crédito» si aplica.
- Al recibir el éxito, la pestaña activa se vacía de inmediato en el provider; la confirmación se renderiza con el payload de la RPC, no con el carrito. Si el cajero cierra la confirmación, la pestaña queda lista para la siguiente venta.
- Botones:
  - «Nueva venta» (primario, 48 px): cierra la confirmación, deja la pestaña vacía, vuelve al cliente/lista/numeración por defecto y enfoca el buscador.
  - «Imprimir ticket» (`outline`, icono `Printer`): imprime `TicketPos` con la plantilla de la terminal.
  - «PDF Carta» (`ghost`, icono `FileText`): imprime `DocumentoPapel` en Carta.
  - «Ver en el historial» (`ghost`): cierra y navega a `/pos/historial?q={ncf}`.
- El cierre (X) equivale a «Nueva venta» y se deshabilita mientras hay una impresión en curso. Esc no cierra la confirmación: la venta ya está hecha y la única salida es una de las acciones.
- La confirmación no se reemplaza por un toast: el diálogo es la confirmación. El toast «Venta registrada» es secundario y nunca sustituye al diálogo.

### 4.10 Datos y payload de la venta

La UI arma el payload de `pos_completar_venta` así:

| Clave | Origen UI |
| --- | --- |
| `terminal_id` | Terminal activa de la cookie, validada en servidor. |
| `contacto_id` | `SelectorContacto`; se omite si hay `cotizacion_id`. |
| `lista_precio_id` | Select del panel; `null` si «Precio base». Se omite si hay cotización. |
| `numeracion_id` | Select del panel; default de la terminal. |
| `fecha` | `hoyRD()`; no se muestra al cajero. |
| `vendedor_id` | Select opcional; `null` si vacío. Se omite si hay cotización (manda la cotización). |
| `lineas` | Carrito, con `producto_id`, `descripcion`, `cantidad`, `unidad_id`, `precio`, `descuento_pct`, `itbis_tasa`, `impuesto_id`. La venta simple es una línea con `producto_id = null`, `cantidad = 1` y `precio = monto`. |
| `cotizacion_id` | Si hay cotización cargada; excluye `lineas` y `contacto_id`. |
| `pagos` | Modo efectivo/tarjeta/transferencia/combinado. Cada fila: `metodo`, `monto`, `monto_recibido` (solo efectivo). Vacío en Crédito. |

- `metodo` usa exactamente `efectivo`, `tarjeta_debito`, `tarjeta_credito`, `transferencia`.
- La venta simple **no** se envía como `venta_simple`: se envía como una línea libre dentro de `lineas`. Así hay una sola ruta de líneas y la cotización/edición no cambia de forma.
- `monto_recibido` solo se envía en efectivo y siempre ≥ `monto`. Si la venta queda a crédito, `monto_recibido = monto` (sin cambio).
- No se envían `notas`, `terminos`, `pie`, `vencimiento`, `ncf_manual`, `cuenta_id` ni `almacen_id`: la UI no los expone y el servidor resuelve los defaults.
- La UI no calcula el total definitivo: muestra una previsualización y reemplaza los montos con los del payload de respuesta.

## 5. Turnos (`/pos/turnos`)

### 5.1 Composición

- `EncabezadoPagina` «Turnos» + acciones según estado.
- `Tabs variant="line"` con dos pestañas: «Turno actual» y «Cierres».
- «Turno actual»:
  - si no hay turno: estado vacío con «Abrir turno»;
  - si hay turno abierto: badge «Abierto», resumen, movimientos y acciones;
  - si el último turno está cerrado: badge «Cerrado», resumen congelado, movimientos y «Abrir turno»; no se puede mover ni cerrar de nuevo.
- «Cierres»: tabla paginada de cierres de la terminal (o de todas, ver §5.7).

### 5.2 Sin turno / abrir turno

- Estado vacío (no es error): icono `LockKeyhole` o `Clock`, título «No hay un turno abierto en Caja 1.», descripción «Abre un turno con la base inicial para empezar a vender.», CTA «Abrir turno» (48 px).
- `[N] dialogo-abrir-turno.tsx` (llama `pos_abrir_turno`):
  - título «Abrir turno»; subtítulo «Caja 1».
  - «Base inicial» `InputGroup` `RD$`, default `0.00`, ≥ 0, 2 decimales. Helper: «Es el efectivo que ya está en el cajón. No genera asiento contable.»
  - «Observaciones» opcional, máximo 500.
  - Aviso: «Un turno abierto por terminal. Si ya hay uno, ciérralo antes de abrir otro.»
  - «Abrir turno» primario; durante el envío «Abriendo turno…». Error del servidor en `Alert`.
  - Éxito: cierra el diálogo, actualiza el resumen con el payload, actualiza el badge del header (`router.refresh()`) y muestra toast «Turno abierto».
- No se puede abrir si la terminal está inactiva o si ya hay un turno abierto. El servidor lo valida; la UI deshabilita el CTA si el layout ya sabe que hay uno.
- **Reutilización desde Vender:** cuando el panel de factura muestra «No hay un turno abierto», el botón «Abrir turno» abre este mismo diálogo **en sitio**, sin navegar a Turnos, para no perder el carrito. Al éxito, el provider conserva las pestañas y el aviso desaparece; la página refresca el turno. Turnos usa el mismo diálogo con su propia recarga de resumen.

### 5.3 Resumen en vivo

Se alimenta de `pos_resumen_turno`. No se recalcula en el cliente.

**Tarjetas KPI (4):**

| Tarjeta | Valor |
| --- | --- |
| Ventas | `ventas.cantidad` ventas + `ventas.total` |
| Ventas en efectivo | `ventas.por_metodo.efectivo` |
| Otros métodos | `tarjeta + transferencia` |
| Efectivo esperado | `efectivo.efectivo_esperado` (grande, `tabular-nums`) |

**Detalle:**

- «Base inicial»: `efectivo.base_inicial`.
- «Ventas por método»: filas Efectivo, Tarjeta, Transferencia, Crédito, con montos. Si una es 0, se muestra en `text-muted-foreground` (no se oculta, para que el cierre sea completo).
- «Ingresos»: total + desglose por motivo (Fondo de caja, Cobro de factura, Otro ingreso).
- «Retiros»: total + desglose por motivo (Retiro de caja, Gasto menor, Depósito al banco, Otro retiro).
- «Devoluciones»: cantidad, total, efectivo y crédito. El efectivo se muestra en negativo (`−RD$ X`) y `text-destructive`; el crédito es informativo.
- «Fórmula»: `Efectivo esperado = base inicial + ventas en efectivo + ingresos − retiros − devoluciones en efectivo` en `text-xs text-muted-foreground`, con los valores de la fórmula visibles. No se esconde el cálculo.
- Si `efectivo.congelado = true` (turno cerrado): badge «Cerrado» y nota «El efectivo esperado quedó congelado al cerrar.»
- Si `efectivo_esperado < 0`: `Alert variant="destructive"` «El efectivo esperado es negativo; revisa los pagos y devoluciones del turno antes de cerrar.» y «Cerrar turno» deshabilitado.
- «Abierto desde» / «Cerrado»: `formatoFechaHora` en `America/Santo_Domingo`; «Abierto por» / «Cerrado por» con el nombre que devuelve 2B. Si no hay nombre, se muestra «—»; nunca se pinta el UUID.

### 5.4 Movimientos del turno

`[N] tabla-movimientos-turno.tsx` con `TablaLista` en densidad `compacta`.

| Columna | Contenido |
| --- | --- |
| Recibo | `#10` (mono, 12 px). |
| Hora | `formatoFechaHora` solo hora/minuto. |
| Tipo | «Ingreso» / «Retiro» con icono. |
| Motivo | Etiqueta del motivo. |
| Detalle | Factura (`NCF`), contacto o descripción del gasto. |
| Cuenta | `cuenta_nombre`. |
| Monto | `+RD$ X` / `−RD$ X`, derecha, `tabular-nums`; retiro en `text-destructive`; no vigente con `line-through` y `PillEstado` «No vigente». |
| Acciones | Ver/Imprimir recibo (40×40). |

- Vacío: «Este turno no tiene movimientos.» / «Las ventas, cobros y retiros aparecerán aquí.»
- No hay editar ni borrar. El detalle del recibo ofrece «Imprimir recibo». Solo para movimientos directos (`fondo_caja`, `retiro_caja`, `deposito_banco`, `otro`) ofrece «Registrar movimiento inverso»: abre el diálogo con tipo contrario, motivo `otro`, mismo monto y nota «Corrección del recibo No 10». Para `cobro_factura` y `gasto_menor` **no** hay inverso en el POS: el pago o el gasto se anula en Contabilidad y el movimiento se marca no vigente; el POS no crea un asiento inverso suelto.
- El recibo se arma con el `movimiento` del payload de `pos_resumen_turno` o del retorno de `pos_registrar_movimiento_turno`; no se hace otra consulta.

### 5.5 Registrar ingreso/retiro

`[N] dialogo-movimiento.tsx` (llama `pos_registrar_movimiento_turno`), `Dialog` de 640 px, `Tabs` «Ingreso» / «Retiro».

- Motivos por tipo:
  - Ingreso: «Fondo de caja» (`fondo_caja`), «Cobro de factura» (`cobro_factura`), «Otro ingreso» (`otro` con tipo ingreso).
  - Retiro: «Retiro de caja» (`retiro_caja`), «Gasto menor» (`gasto_menor`), «Depósito al banco» (`deposito_banco`), «Otro retiro» (`otro` con tipo retiro).
- Campos comunes: «Notas» opcional 500. El «Monto» (`RD$`, > 0, 2 decimales) existe en todas las ramas menos en Gasto menor, donde se calcula como total del gasto.
- Ramas:
  - **Fondo de caja / Retiro de caja / Otro:** «Cuenta de contrapartida» obligatoria, `SelectCampo` buscable con cuentas de detalle activas que aceptan movimientos y no son la cuenta de efectivo de la terminal. Para «Depósito al banco», solo cuentas `es_caja_banco`; si no hay, «Para depositar al banco, la cuenta de destino debe ser de caja o banco.»
  - **Cobro de factura:** `[N] buscador-factura-pos.tsx` (input + resultados) por NCF, número o cliente. Solo facturas no anuladas con saldo > 0. Al elegir, muestra cliente, NCF, total, pagado y saldo. «Monto del cobro» default = saldo, máximo = saldo. No hay cuenta de contrapartida: el servidor usa la CxC. Notas opcionales.
  - **Gasto menor:** «Descripción» obligatoria (1–200), «Cuenta de gasto» obligatoria (`SelectCampo` filtrado a cuentas `gasto`/`costo` activas), «Subtotal» (`RD$`), «ITBIS» (`%`, default 0), «Total» calculado y read-only = `subtotal + round(subtotal × tasa/100, 2)`. El monto que se envía es el total; si no cuadra, el servidor devuelve «El ITBIS del gasto no cuadra con el monto.» y la UI muestra el total calculado.
- Pie:
  - «Efectivo esperado después» = esperado actual + monto (ingreso) o − monto (retiro), en vivo.
  - Si un retiro deja la caja en negativo: `Alert variant="destructive"` «El retiro deja la caja en negativo.» y CTA deshabilitado.
  - CTA «Registrar ingreso» / «Registrar retiro» (48 px). Durante el envío: «Registrando…».
- Éxito: cierra el diálogo, actualiza el resumen con el payload, muestra toast «Movimiento registrado» y abre la confirmación del recibo con «Imprimir recibo». El recibo también queda en la tabla.
- Error de red: §9.3; no se reintenta solo.

### 5.6 Cerrar turno

`[N] dialogo-cerrar-turno.tsx` (llama `pos_cerrar_turno`), `Dialog` de 640 px.

- Cabecera: «Cerrar turno No 4» + «Caja 1».
- Resumen compacto con: base, ventas por método, ingresos, retiros, devoluciones, «Efectivo esperado en caja» (grande).
- «Efectivo real en caja» obligatorio, `InputGroup` `RD$`, ≥ 0, 2 decimales. Helper: «Cuenta el efectivo físico del cajón, no lo que dice el sistema.»
- Diferencia en vivo:
  - `real − esperado`; positivo: «Sobrante de RD$ X» en `text-foreground` (no verde);
  - negativo: «Faltante de RD$ X» en `text-destructive`;
  - cero: «La caja cuadra.»
- `Switch` «Registrar la diferencia en contabilidad», default `true`, visible solo si la diferencia ≠ 0. Helper: «Crea el asiento de sobrante o faltante. Si lo apagas, la diferencia queda documentada sin asiento.»
- «Observaciones» opcional, máximo 500.
- Aviso: «El turno se cerrará y no se puede reabrir.»
- Si `efectivo_esperado < 0`: `Alert variant="destructive"` con el mensaje del dominio y CTA deshabilitado.
- CTA «Cerrar turno» (48 px). Durante el envío: «Cerrando turno…».
- Errores:
  - «No hay una cuenta configurada para sobrante o faltante de caja.» → `Alert` + «Configura las cuentas de sobrante y faltante en Contabilidad.»
  - «El turno ya está cerrado.» → refresca la pantalla.
  - «El efectivo real es obligatorio.» / «El efectivo real no puede ser negativo.»
- Éxito: confirmación «Turno cerrado» con «Cierre No 4», esperado, real, diferencia, y botones «Imprimir cierre», «Abrir nuevo turno», «Cerrar». El resumen queda congelado y el header actualiza el badge.

### 5.7 Historial de cierres

- `[N] tabla-cierres.tsx` con `TablaLista` normal y `PaginadorLista` (25/50/100).
- Filtro de terminal: `Select` «Esta terminal» / «Todas las terminales». Default «Esta terminal». No es un cambio de terminal activa.
- Columnas:
  1. «Cierre No» (`#4`).
  2. «Terminal» (oculta si el filtro es «Esta terminal»; visible con «Todas»).
  3. «Abierto» (`formatoFechaHora`).
  4. «Cerrado» (`formatoFechaHora`).
  5. «Base» (derecha).
  6. «Esperado» (derecha).
  7. «Real» (derecha).
  8. «Diferencia»: «Sobrante RD$ X» / «Faltante RD$ X» / «Cuadra»; texto, no solo color.
  9. Acciones: «Ver» y «Imprimir» (40×40).
- Vacío: «No hay cierres de turno.» / «Los cierres aparecerán aquí cuando cierres un turno.»
- «Ver» abre un `Sheet` de 560 px con el resumen congelado y los movimientos; «Imprimir» monta `TicketPos` de cierre.
- No se reabre, no se edita y no se borra. No hay acción de anulación.

## 6. Historial de ventas del POS (`/pos/historial`)

### 6.1 Filtros y URL

- `BuscadorLista` para `q` (NCF, número de factura o cliente), placeholder «Buscar por NCF, número o cliente…».
- `DatePicker` «Desde» y «Hasta» (día, `America/Santo_Domingo`). Default: primer día del mes actual y hoy. Se puede limpiar; sin fechas no hay filtro.
- `Select` «Estado»: «Todas», «Cobradas», «Por cobrar», «Anuladas».
- `Select` «Terminal»: «Todas las terminales» (default) + terminales activas e inactivas que tengan ventas. Cambiar este filtro no cambia la terminal activa.
- Botón «Limpiar filtros» (ghost) que vuelve a los defaults.
- Parámetros URL: `q`, `desde`, `hasta`, `estado`, `terminal`, `pagina`, `tamano`. Se leen con `leerTexto`, `leerPagina`, `leerTamano` de `src/lib/listas/parametros.ts`; las fechas y el estado se validan a mano.
- Toda la lista se consulta en el servidor, con `origen = 'pos'`, paginada y sin topes fijos. La consulta de métodos se hace en un segundo lote por los ids de la página (no N+1).

### 6.2 Tabla

`[N] tabla-ventas-pos.tsx` con `TablaLista` normal, dentro de `TarjetaLista` + `BarraLista` (como Facturas) y `PaginadorLista`.

| Columna | Celda |
| --- | --- |
| NCF / No | Botón de texto `text-primary` que abre el detalle; `B0200000015` o `Factura No 15` si no hay NCF. |
| Fecha | `formatoDia(fecha)`. |
| Cliente | Nombre; sin enlace (el detalle tiene el enlace). |
| Terminal | `terminal.nombre`; oculta <1280 px. |
| Turno | `#4`; oculto <1280 px. |
| Métodos | Badges de los pagos activos: «Efectivo», «Tarjeta», «Transferencia». Si no hay ningún pago, «Crédito». El saldo pendiente no se muestra aquí, sino en la columna Saldo. |
| Total | Derecha, `formatoMoneda`. |
| Saldo | Derecha; `—` si ≤ 0 o anulada; en `text-destructive` si > 0. El detalle muestra «Saldo a favor» si es negativo. |
| Estado | `PillEstado`: Cobrada (exito), Por cobrar (pendiente), Anulada (peligro). |
| Acciones | «Ver detalle» (ojo) y «Reimprimir ticket» (impresora), 40×40. |

- La fila no es un enlace completo: el detalle se abre desde el NCF o el ojo. Así el botón de imprimir no queda dentro de un enlace.
- Orden: `facturas.fecha desc, numero desc`.
- Vacío sin filtros: «Aún no hay ventas del POS.» / «Las ventas que cobres en el punto de venta aparecerán aquí.» + «Ir a Vender».
- Vacío con filtros: `filtrada: true`, «Sin resultados.» / «No hay ventas que coincidan con los filtros.»

### 6.3 Detalle en `Sheet`

`[N] detalle-venta-pos.tsx`, `Sheet side="right"` de 560 px (`sm:max-w-[560px]`, `w-full` en móvil), con scroll interno y pie fijo.

- Cabecera: NCF + «Factura No 15», `PillEstado`, fecha/hora (`fecha` + `creado_en`), terminal, turno, cajero.
- Cliente: nombre, RNC, teléfono; enlace «Ver ficha» a `/dashboard/contactos/{id}` en pestaña nueva (no se pierde el POS).
- «Productos y servicios»: `Table` compacta con descripción, cantidad, unidad, precio, descuento, ITBIS, total. Si la factura tiene muchas líneas, scroll dentro del Sheet.
- Totales: subtotal, descuento, ITBIS por tasa, otros, propina, total; «Pagado», «Crédito», «Saldo», «Recibido», «Cambio» (si aplica).
- «Pagos»: `Table` con fecha, método («Efectivo», «Tarjeta» con débito/crédito si el detalle lo distingue por cuenta, «Transferencia»), cuenta, monto, estado. Si no hay: «Sin pagos registrados.»
- «Notas de crédito»: `Table` con NCF, fecha, total, reembolso, estado. Si no hay: «Sin notas de crédito.»
- Pie fijo:
  - «Imprimir ticket» (primario outline)
  - «PDF Carta» (ghost)
  - «Nueva devolución» (si la factura no está anulada): navega a `/pos/devoluciones?factura={id}`, cierra el Sheet.
  - «Ver en Contabilidad»: abre `/dashboard/facturacion/{id}` en pestaña nueva.
- Si la factura está anulada: badge «Anulada», no se ofrece devolución; sí se permite reimprimir y ver en Contabilidad. El ticket muestra «ANULADA».
- El detalle se consulta una vez al abrir; una sola llamada de 2B arma factura, líneas, pagos, NC, empresa, terminal, turno y plantilla. No se consulta por línea.

### 6.4 Reimprimir ticket

- Desde la fila o el detalle. Si el detalle no está cargado, se carga una vez y se abre el visor/impresión.
- La reimpresión usa el `plantilla_ticket` **actual** de la terminal (no se guardó una foto por venta). Si la plantilla cambió, el ticket sale con la nueva.
- Refleja el estado actual: `credito` aplicado, `saldo`, «ANULADA» si la factura fue anulada, pagos anulados marcados. No es una copia congelada de la venta original; el detalle lo aclara con «Este ticket se genera con los datos actuales de la factura.»
- El PDF Carta se genera con `plantillas_impresion` actuales (logo, notas, términos); tampoco es una copia congelada.
- Si la factura no trae `ncf` (no debería pasar en POS), el ticket omite la línea NCF; no inventa una serie.

### 6.5 Estados

- Carga de la lista: `EsqueletoTabla` (48/56) dentro de `TarjetaLista`, 8 filas.
- Carga del detalle: `Skeleton` de líneas y totales; el Sheet se abre de inmediato con el encabezado.
- Error de lista: `Alert variant="destructive"` «No se pudo cargar el historial. Revisa tu conexión e inténtalo de nuevo.» + «Reintentar».
- Error de detalle: dentro del Sheet, «No se pudo cargar la venta.» + «Reintentar» y «Cerrar».
- Sin permiso: si el layout no tiene perfil, ya redirige; si una consulta falla por RLS, se muestra el error genérico, nunca datos de otra empresa.

## 7. Devoluciones (`/pos/devoluciones`)

### 7.1 Lista

`EncabezadoPagina` «Devoluciones» + «Nueva devolución» (deshabilitado si no hay turno abierto; tooltip «Abre un turno para devolver.»).

- `[N] tabla-devoluciones.tsx` con `TablaLista` y `PaginadorLista` 25/50/100.
- Búsqueda `BuscadorLista` por NCF B04, factura origen o cliente; rango de fechas como el historial (default mes actual). Estado: «Todas», «Activas», «Anuladas». No hay filtro de terminal para no ocultar devoluciones de otras cajas.
- Columnas:

| Columna | Celda |
| --- | --- |
| NCF | `B0400000004` (botón que abre el detalle). |
| Fecha | `formatoDia`. |
| Factura origen | NCF de la factura. |
| Cliente | Nombre. |
| Total | Derecha. |
| Reembolso | «Efectivo RD$ X», «Crédito RD$ X» o «Combinado RD$ X + RD$ Y». |
| Estado | `PillEstado`: Activa (exito), Anulada (peligro). |
| Acciones | Ver detalle / Imprimir ticket. |

- Vacío: «Aún no hay devoluciones del POS.» / «Las notas de crédito creadas desde el punto de venta aparecerán aquí.» + «Nueva devolución».
- Detalle en `Sheet` de 560 px: NCF B04, factura origen, cliente, fecha, turno, líneas devueltas, totales, reembolso (efectivo/crédito/cuenta), notas; botones «Imprimir ticket» y «Ver en Contabilidad» (abre el detalle de la NC en pestaña nueva). No hay «Anular»: la app no anula NC de venta.
- La lista y el detalle se leen de 2B; no hay RPC de lectura nueva en el dominio para NC del POS.

### 7.2 Wizard: estructura

`[N] wizard-devolucion.tsx`, `Dialog` de 960 px (`sm:max-w-[960px]`), `max-h-[92dvh]`, contenido con scroll y pie fijo. En móvil, ancho completo y pasos apilados.

- Cabecera: «Nueva devolución» + «Caja 1 · Turno No 4».
- Stepper de 3 pasos, con números y `aria-current="step"`:
  1. «Factura y tipo»
  2. «Productos y cliente»
  3. «Detalle del reembolso»
- Pie: «Atrás» (ghost, deshabilitado en el paso 1), «Continuar» (primario) en pasos 1 y 2; «Crear devolución» en el paso 3.
- El wizard se puede cerrar con X/Esc; si hay datos, `AlertDialog` «¿Cerrar la devolución?» / «Se perderá lo que llevas.».
- Si no hay turno al abrir: no se puede abrir el wizard; el botón «Nueva devolución» está deshabilitado y hay un `Alert` en la página «No hay un turno abierto en Caja 1. Abre un turno para devolver.»
- Si el turno se cierra mientras el wizard está abierto, el submit devuelve el error de turno; se muestra arriba y el pie ofrece «Abrir turno» (cierra el wizard y navega a Turnos).

### 7.3 Paso 1 — Factura y tipo

- `[N] paso-factura.tsx`.
- `[N] buscador-factura-pos.tsx`: input con debounce 300 ms por NCF, número o cliente. Resultados en una tabla compacta o tarjetas de 56 px: NCF, fecha, cliente, total, pagado, crédito y estado. Solo facturas no anuladas; se incluyen las de Contabilidad (badge «Contabilidad») porque el dominio lo permite. No se exige saldo > 0: una factura pagada se puede devolver a crédito.
- Al seleccionar una factura, se muestra una tarjeta resumen con cliente, fecha, total, pagado y NC previas. El disponible por línea se calcula y se muestra en el paso 2. El buscador se colapsa y aparece «Cambiar factura».
- Tipo de reembolso (se puede cambiar en el paso 3):
  - «Crédito a factura» (default): «No sale dinero de la caja. Reduce el saldo de la factura o deja saldo a favor.»
  - «Efectivo»: «Sale efectivo del cajón de esta terminal.»
  - «Combinado»: «Una parte en efectivo y otra a crédito. Ambas deben ser mayores a cero.»
  - Tarjetas seleccionables de 96 px, borde `border-primary` al elegir, icono + título + descripción. `RadioGroup` accesible.
- «Continuar» deshabilitado hasta elegir factura. El tipo no bloquea el paso 1; si elige Efectivo y luego el total no se puede cubrir, el paso 3 lo explica.
- Query param `?factura={id}`: carga la factura, salta al paso 2 y deja el tipo «Crédito a factura» por defecto.
- Si la factura no existe o está anulada: «La factura no existe o está anulada.» y se vuelve al buscador.

### 7.4 Paso 2 — Productos y cliente

- `[N] paso-lineas.tsx`.
- Cliente read-only (viene de la factura), con RNC. No se puede cambiar: la NC pertenece a esa factura.
- Tabla de líneas (`Table` con scroll, no `TablaLista`) con:
  - producto/descripción;
  - cantidad original;
  - cantidad ya devuelta (NC activas previas);
  - «Disponible» = original − devuelta;
  - «Cantidad a devolver»: `Input` numérico de 40 px, 2 decimales, default 0;
  - precio, ITBIS y total de la devolución de esa línea.
- Acciones:
  - «Devolver todo» por fila (llena el disponible);
  - «Devolver todo» global en la cabecera de la tabla.
- Solo se muestran líneas con `disponible > 0`. Si todas son 0: estado «Esta factura ya fue devuelta por completo.» y «Continuar» deshabilitado.
- Totales en vivo: Subtotal, ITBIS, Total de la devolución. Se calculan con los mismos criterios del servidor (precio, descuento e ITBIS de la línea original); la UI no permite cambiar precio, descuento ni impuesto.
- Validaciones visibles:
  - al menos una línea con cantidad > 0;
  - cantidad ≤ disponible;
  - cantidad > 0;
  - 2 decimales máximo.
- Si el usuario escribe una cantidad mayor, el campo se pinta en rojo y muestra «La cantidad no puede superar lo disponible por acreditar (N).»; «Continuar» deshabilitado.
- No se usa checkbox: la cantidad > 0 es la selección. Un solo estado por línea evita cantidades seleccionadas en 0 o 0 seleccionadas con cantidad.
- «Atrás» vuelve al paso 1 conservando la factura; «Continuar» pasa al 3 con el total calculado.

### 7.5 Paso 3 — Reembolso

- `[N] paso-reembolso.tsx`.
- Tipo de reembolso en `RadioGroup` (sincronizado con el paso 1; cambiarlo aquí es válido).
- **Crédito a factura:**
  - No hay campos de dinero. Se muestra «Se acreditarán RD$ X a la factura B0200000015.» y «El cliente quedará con saldo a favor si la factura ya estaba pagada.»
  - Cuenta: ninguna.
- **Efectivo:**
  - Monto read-only = total de la devolución.
  - Cuenta read-only = cuenta de efectivo de la terminal (`Caja general`).
  - Límites visibles:
    - «Máximo por lo pagado: RD$ X» (`factura.pagado − devuelto_efectivo_previo`);
    - «Máximo por la caja: RD$ X» (`efectivo_esperado` del turno).
  - Si el total supera cualquiera de los dos, el tipo Efectivo se deshabilita con el motivo exacto y se sugiere «Elige Combinado o Crédito a factura.»
  - El monto no se puede editar: el dominio exige que el efectivo sea igual al total.
- **Combinado:** dos columnas lado a lado (en móvil, apiladas):
  - Izquierda «Efectivo»: `InputGroup` `RD$`, obligatorio, > 0 y < total; cuenta read-only; límites visibles como en Efectivo.
  - Derecha «Crédito a factura»: monto calculado read-only = total − efectivo; factura origen; nota «Queda como saldo a favor en la cuenta por cobrar.»
  - Si el efectivo es 0 o igual al total, error inline «El reembolso combinado requiere efectivo y crédito mayores a cero.» y CTA deshabilitado.
  - Si el efectivo supera el máximo por pagado o por caja, error con el máximo y CTA deshabilitado.
- «Notas» opcional, máximo 500, `Textarea`.
- Resumen final en una caja `bg-muted/40`: Subtotal, ITBIS, Total; «Efectivo», «Crédito», «Cuenta». Es la última revisión antes de crear.
- CTA «Crear devolución» (48 px) llama `pos_crear_devolucion`. Durante el envío: «Creando devolución…». Errores del servidor arriba, capitalizados:
  - «El reembolso en efectivo debe ser igual al total de la devolución.»
  - «El reembolso combinado requiere efectivo y crédito mayores a cero.»
  - «El efectivo devuelto no puede exceder lo pagado en la factura.»
  - «El efectivo devuelto no puede exceder el efectivo disponible en la caja.»
  - «La cantidad excede lo disponible por acreditar en la línea.»
  - «No hay un turno abierto en la terminal Caja 1.»
  - «La cuenta de reembolso debe ser la cuenta de efectivo de la terminal.»
- Error de red o 5xx: §9.3; no se reintenta solo. Si la NC se creó pero la respuesta se perdió, se verá en la lista de devoluciones y en el turno.
- No se permite reembolso a tarjeta o banco desde el POS; el wizard no ofrece esas opciones. Un reembolso bancario se hace desde Contabilidad → Notas de crédito.
- El almacén de la devolución es el de la terminal; no se elige. La UI no envía `almacen_id`.

### 7.6 Confirmación de devolución

- `[N] confirmacion-devolucion.tsx`.
- «Devolución creada», NCF B04, factura origen, total, «Efectivo RD$ X» / «Crédito RD$ X», cliente.
- Botones: «Imprimir ticket» (ticket de NC), «Nueva devolución» (reinicia el wizard), «Cerrar». No hay «PDF Carta» en el POS para NC; se ofrece «Ver en Contabilidad» (pestaña nueva) para el documento formal.
- Al cerrar, la lista se refresca. El efectivo esperado del turno cambia por la parte en efectivo; se verá al entrar a Turnos. El header no cambia de estado; el turno sigue abierto.

### 7.7 Reglas de negocio visibles (resumen)

| Regla | Dónde se ve |
| --- | --- |
| Solo facturas no anuladas | Paso 1, búsqueda y tarjeta. |
| La devolución es una NC B04 real | Título y NCF en la confirmación y el ticket. |
| El inventario vuelve al costo promedio | No se muestra en el POS; lo explica el dominio, no la UI. |
| Crédito a factura = 0 efectivo | Paso 3, sin campo de efectivo. |
| Efectivo = total | Paso 3, monto read-only. |
| Combinado = ambos > 0 y suma total | Paso 3, dos columnas y error inline. |
| Efectivo ≤ pagado − devuelto previo | Límite visible. |
| Efectivo ≤ efectivo esperado de la caja | Límite visible. |
| Reembolso solo desde el cajón de la terminal | Cuenta read-only. |
| Turno abierto obligatorio | Botón «Nueva devolución» y submit. |
| No se anula una NC desde el POS | Sin acción de anular. |

## 8. Impresión

### 8.1 Dos formatos, un solo flujo

| Formato | Componente | Cuándo | Papel |
| --- | --- | --- | --- |
| Ticket térmico | `src/components/pos/ticket-pos.tsx` + `src/components/pos/impresion-pos.tsx` | Factura POS, cotización rápida, cierre de turno, devolución B04, recibo de movimiento. | 80 mm o 57 mm, según `plantilla_ticket.ancho_mm`. |
| PDF Carta | `src/components/documento-venta/documento-papel.tsx` dentro de `ImpresionPos`. | Confirmación de venta, detalle del historial, confirmación de cotización. | Carta (letter), márgenes de `@page documento-venta`. |

- El ticket **no** usa `DocumentoPapel`; el PDF **no** usa `TicketPos`. Son dos formatos distintos, con plantillas distintas, y pueden verse distintos.
- No se crea un segundo documento formal ni se duplica el HTML de `DocumentoPapel`.
- No se agrega librería de PDF. «PDF Carta» es el diálogo de impresión del navegador con el título de archivo correcto, igual que el flujo existente de la factura.

### 8.2 `TicketPos`: anatomía por documento

`TicketPos` es presentacional: recibe el payload ya armado, la plantilla y `vistaPrevia` (boolean). **No consulta datos, no imprime y no navega**. `ImpresionPos` es el que monta el portal y llama `window.print()`.

#### 8.2.1 Factura POS

- Cabecera:
  - logo si `mostrar_logo` y `empresa.logo_url`; si la imagen falla, se oculta (`onError`), no se muestra un icono roto;
  - `empresa.nombre`; si está vacío, se omite la línea (no se usa el fallback de `DocumentoPapel`);
  - `RNC: …`, dirección, teléfono, correo: cada uno solo si existe;
  - título según `tituloTipoComprobante(tipo_comprobante)` (Factura de Crédito Fiscal, Factura de Consumo, etc.);
  - `NCF B0200000015` (si `ncf` es null, se omite);
  - fecha y hora de la venta: `formatoDia(factura.fecha)` + la hora de `factura.creado_en` (columna existente de `facturas`) cuando el payload la trae; en la confirmación inmediata, si no viene, se usa la hora en que se recibió la respuesta. En el historial, 2B incluye `creado_en` en el detalle. No se inventa una fecha ni se usa la hora de la reimpresión.
  - `Terminal: Caja 1`, `Turno No 4`, `Cajero: …` (si viene);
  - `Cliente: …` y `RNC: …` (si existe); no se imprime la dirección del cliente;
  - `Vendedor: …` solo si `mostrar_vendedor` y el vendedor no es null;
  - `Vence NCF: …` si `ncf_vence` existe.
- Cuerpo: líneas con cantidad, unidad (si `mostrar_unidad`), descripción (si `mostrar_descripcion`), referencia (si `mostrar_referencia`), precio unitario (si `mostrar_precio_unitario`), descuento por línea y total.
- Pagos: método + monto aplicado; si hubo efectivo, «Recibido» y «Cambio». Si la venta quedó a crédito, «Pagado», «Crédito» y «Saldo».
- Totales: Subtotal, Descuento (si > 0), ITBIS por tasa, Otros impuestos (si > 0), Propina (si > 0), Total. El POS no genera otros impuestos ni propina; si el payload los trae, se muestran.
- Pie: `pie_ticket` si no es null. Si es null, no se imprime ningún pie inventado.
- Si `estado = 'anulada'`: marca «ANULADA» en la cabecera y en el cuerpo, sin cambiar montos.

#### 8.2.2 Cotización POS

- Cabecera: empresa, «Cotización No 12», fecha, «Vence: …», cliente, vendedor (toggle). **Sin NCF**.
- Cuerpo: líneas, igual que la factura, sin pagos.
- Totales: Subtotal, Descuento, ITBIS, Otros, Propina, Total.
- Nota fija: «No es una factura.» en `text-xs`, antes del pie.
- No se imprime «Pagado», «Saldo» ni «Cambio».

#### 8.2.3 Cierre de turno

- Cabecera: empresa, «Cierre No 4», terminal, abierto/cerrado (fecha y hora), cajero que abrió/cerró.
- Cuerpo:
  - Base inicial.
  - Ventas por método: Efectivo, Tarjeta, Transferencia, Crédito.
  - Ingresos por motivo.
  - Retiros por motivo.
  - Devoluciones: efectivo y crédito.
  - Lista de movimientos: recibo, hora, tipo/motivo, monto; los retiros con signo `−` y la etiqueta «Retiro»; las devoluciones con «Devolución»; los no vigentes con «No vigente» y sin sumar.
  - «Total de movimientos» (conteo).
- Totales: «Efectivo esperado en caja», «Efectivo real en caja», «Diferencia» («Sobrante RD$ X» / «Faltante RD$ X» / «Cuadra»).
- Observaciones, si existen.
- Pie: `pie_ticket`.

#### 8.2.4 Devolución B04

- Cabecera: empresa, «Nota de Crédito», `NCF B0400000004`, fecha, «Factura origen: B0200000015», cliente, turno.
- Cuerpo: líneas devueltas con cantidad, descripción, precio, ITBIS y total; no se listan las líneas no devueltas.
- Totales: Subtotal, ITBIS, Total.
- Reembolso: «Efectivo RD$ X», «Crédito a factura RD$ Y», cuenta de efectivo si aplica.
- Pie: `pie_ticket`.

#### 8.2.5 Recibo de movimiento

- Cabecera: empresa, «Recibo de ingreso No 10» o «Recibo de retiro No 8», fecha y hora, turno, cajero.
- Cuerpo: motivo, monto, cuenta de contrapartida, contacto/factura si aplica, notas.
- Total del recibo y «Efectivo esperado después» **solo en el recibo recién creado** (el retorno de la RPC trae el resumen posterior). Al reimprimir desde la tabla del turno se omite, porque el resumen es el actual y no el de ese momento.
- Pie: `pie_ticket`.

### 8.3 Estilos

| Estilo | Cabecera | Separadores | Líneas | Totales | Pie |
| --- | --- | --- | --- | --- | --- |
| `clasico` (default) | Centrada; logo arriba; empresa 11 pt; título 9.5 pt; NCF 10 pt. | Punteados (`1px dashed`) entre bloques. | Descripción; segunda línea con cantidad × precio, unidad y descuento; total a la derecha. | Caja con borde `1px solid`, total 11 pt. | Centrado. |
| `minimalista` | Alineada a la izquierda; logo alineado a la izquierda. | Sin separadores, salvo una línea sólida antes de totales. | Descripción; detalle en 8 pt; etiquetas en mayúscula pequeña (`letter-spacing: 0.08em`). | Sin caja; total 12 pt. | Izquierda. |
| `detallado` | Centrada como clásico. | Punteados. | Agrega referencia, unidad, precio unitario, descuento por línea y desglose de impuestos por tasa. | Caja con borde; incluye pagos detallados. | Centrado. |

- Los toggles **siempre mandan** sobre el estilo: si `mostrar_referencia = false`, «detallado» no inventa la referencia. «Detallado» agrega desgloses, no campos que el toggle apagó.
- El ticket impreso es siempre `background: white; color: black`; no usa tokens de tema. En pantalla, la vista previa puede usar `bg-card`, pero el contenedor de impresión fuerza blanco/negro.
- El logo se limita a 18 mm de alto y se aplica `filter: grayscale(1) contrast(1.1)` en impresión.
- No se imprimen URLs, botones, iconos de interfaz, el nombre del cajero si no viene, ni el sidebar.

### 8.4 Métricas y tipografía

| Parámetro | 80 mm | 57 mm |
| --- | --- | --- |
| Ancho del papel | 80 mm | 57 mm |
| Margen interno | 3 mm | 3 mm |
| Ancho útil presupuestado | 72 mm (74 mm reales menos tolerancia) | 48 mm (51 mm reales menos tolerancia) |
| Fuente base (`mediana`) | 9.5 pt | 7.5 pt |
| `pequena` | 9 pt | 7 pt |
| `grande` | 10 pt | 8 pt |
| Interlineado `compacto` | 1.15 | 1.15 |
| `normal` | 1.3 | 1.3 |
| `amplio` | 1.45 | 1.45 |
| Columnas | Descripción + detalle y total a la derecha, en dos filas. | Apilado: descripción; cantidad/unidad y total en una fila; descuento/precio en otra si aplica. |
| Totales | Etiqueta a la izquierda, monto a la derecha. | Igual, con etiquetas más cortas. |
| Logo | Máximo 18 mm de alto. | Máximo 14 mm de alto. |

- Familias:
  - `clasica`: `ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif`.
  - `moderna`: `"Geist", "Inter", ui-sans-serif, system-ui, sans-serif`.
  - `compacta`: `ui-sans-serif, system-ui, "Arial Narrow", sans-serif`, `letter-spacing: -0.01em`.
- Montos con `font-variant-numeric: tabular-nums`, alineados a la derecha y con 2 decimales (`formatoMoneda`).
- Cantidades con `formatoCantidad` (hasta 2 decimales, sin ceros de relleno).
- 57 mm: los importes nunca se cortan; si un total no cabe, se parte en dos líneas (etiqueta arriba, monto abajo) antes que reducir la fuente por debajo de 7 pt.

### 8.5 Todos los toggles de `plantilla_ticket`

| Clave | Default | Efecto en el ticket |
| --- | --- | --- |
| `estilo` | `clasico` | Uno de `clasico`, `minimalista`, `detallado`; cambia la distribución, no los montos. |
| `ancho_mm` | `80` | `80` o `57`; cambia ancho, fuente base y apilado. |
| `fuente` | `clasica` | `clasica`, `moderna`, `compacta`. |
| `tamano_letra` | `mediana` | `pequena`, `mediana`, `grande`. |
| `interlineado` | `normal` | `compacto`, `normal`, `amplio`. |
| `mostrar_logo` | `true` | Si false o no hay `logo_url`, se omite el logo. Si la imagen falla, se oculta. |
| `mostrar_vendedor` | `true` | Si false o el vendedor es null, se omite la línea «Vendedor». |
| `mostrar_descripcion` | `true` | Si false, se muestra solo el nombre del producto o la descripción libre (nunca se deja la línea en blanco). |
| `mostrar_referencia` | `false` | Si true y hay `referencia`, se muestra debajo de la descripción. |
| `mostrar_precio_unitario` | `true` | Si false, se omite el precio unitario; queda cantidad y total de la línea. |
| `mostrar_unidad` | `true` | Si false, se omite la unidad; queda solo la cantidad. |
| `precios_con_impuestos` | `true` | Si true, el precio unitario mostrado incluye ITBIS (`round(precio × (1 + tasa/100), 2)`) y se imprime la nota «ITBIS incluido» (solo si se muestra el precio unitario). Si false, se muestra sin ITBIS y el impuesto va solo en totales. **No cambia los montos guardados.** |
| `pie_ticket` | `null` | Si es null o vacío, no se imprime pie. Máximo 500 caracteres; se respetan los saltos de línea. |

- Si el ticket de una venta antigua no trae plantilla, se usa el default exacto de `docs/dominio-pos.md` §2.2.1. La impresión nunca falla por una plantilla ausente.
- Las claves desconocidas se rechazan al guardar la terminal (`pos_crear_terminal`/`pos_actualizar_terminal`), no al imprimir.

### 8.6 CSS de impresión

Las reglas viven en `src/app/globals.css`, dentro del `@media print` existente, para no duplicar el mecanismo `data-print-root` / `data-print-paper`. Se agregan páginas nombradas; no se toca la página `letter` de los documentos actuales.

```css
@media print {
  @page pos-ticket-80 { size: 80mm auto; margin: 0; }
  @page pos-ticket-57 { size: 57mm auto; margin: 0; }

  [data-print-root][data-print-pos="ticket-80"],
  .ticket-pos-80 { page: pos-ticket-80; }

  [data-print-root][data-print-pos="ticket-57"],
  .ticket-pos-57 { page: pos-ticket-57; }

  [data-print-root] .ticket-pos {
    width: 80mm;
    margin: 0;
    padding: 3mm;
    background: #fff !important;
    color: #000 !important;
    box-shadow: none !important;
  }

  [data-print-root] .ticket-pos-57 {
    width: 57mm;
  }

  [data-print-root] .ticket-pos,
  [data-print-root] .ticket-pos * {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  [data-print-root] .ticket-pos .linea,
  [data-print-root] .ticket-pos .bloque-totales,
  [data-print-root] .ticket-pos .bloque-pago,
  [data-print-root] .ticket-pos tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  [data-print-root] .no-imprimir,
  .no-imprimir {
    display: none !important;
  }
}
```

- `80 mm` usa `width: 80mm`; la clase `ticket-pos-57` lo sobreescribe a `57mm`. El margen interno de 3 mm está en el `padding`, porque `@page margin: 0`.
- El ancho útil se presupuesta a 72 mm / 48 mm para tolerar el área no imprimible de la impresora térmica.
- `size: <ancho>mm auto` deja que el largo crezca con el contenido. Cada línea y cada bloque de totales evita el corte entre páginas.
- Cuando se imprime Carta, el ticket **no está montado**: `ImpresionPos` monta un solo modo (`ticket` o `carta`) a la vez. La regla existente de `.documento-papel { page: documento-venta; }` sigue vigente.
- El fondo blanco y el texto negro son los únicos colores literales permitidos, y solo dentro de `.ticket-pos`. No se usan tokens del tema en el print.
- La vista previa en pantalla se marca `no-imprimir` y vive fuera del portal; el portal es la única fuente de impresión.

### 8.7 PDF Carta con `DocumentoPapel`

- **Factura:** `DocumentoPapel` con `tipo="factura"`, `empresa`, `factura` (el objeto `factura` del payload), `lineas`, `contacto`, `ncfVence`, `impuestos` y `mostrarLogo`. `DocumentoPapel` ignora las claves extra del payload POS.
- **Cotización:** `DocumentoPapel` con `tipo="cotizacion"` y `vista: DocumentoVista` armada por 2B:
  - `documento`: `{ id, numero, contacto_id, fecha, vencimiento, total, estado: "abierta", factura_id: null, subtotal, descuento, itbis, otros_impuestos, propina, notas, terminos, vendedor_id, centro_costo_id }`;
  - `lineas`: líneas de la cotización;
  - `impuestos`, `contacto`, `empresa`;
  - `facturaRelacionada: null`, `cotizacionOrigen: null`, `remisionRelacionada: null`.
- `mostrarLogo` se lee **una vez** al entrar al POS: `getPlantillaImpresion("factura")` para facturas y `getPlantillaImpresion("cotizacion")` para cotizaciones. No se consulta al imprimir; el payload de la venta ya trae el resto. El POS pasa `mostrarLogo = plantilla.mostrarLogo && Boolean(empresa.logo_url)` para que `DocumentoPapel` no caiga al logo de la plantilla cuando la empresa no tiene logo.
- Si `empresa.nombre` está vacío, el botón «PDF Carta» se deshabilita con el tooltip «Falta el nombre de la empresa en Configuración.» No se usa el fallback «MEDOXIGAS ALC, SRL» de `DocumentoPapel` para inventar la marca.
- Para que el PDF use la plantilla de Contabilidad, `ImpresionPos` pasa a `DocumentoPapel` una copia de `factura` con `notas`, `terminos` y `pie` completados desde `getPlantillaImpresion("factura")` cuando el payload los trae null. No se guardan en la factura: son solo presentación. Para cotización, completa `documento.notas` y `documento.terminos` desde la plantilla de cotización si vienen null.
- `DocumentoPapel` conserva su formato de Contabilidad, incluida su columna «Unidad» genérica y su pie «Generado con Medoxigas Contabilidad». No se modifica el componente compartido.
- Título de archivo:
  - factura: `nombreArchivoPapel("factura", numero, ncf)` → `factura-B0200000015`;
  - cotización: `nombreArchivoPapel("cotizacion", numero)` → `cotizacion-12`.
  Se asigna a `document.title` antes de `window.print()` y se restaura después.
- El botón no obliga a salir del POS. Se imprime desde el mismo diálogo, con el portal de Carta.

### 8.8 Flujo de impresión y estados

1. El usuario pulsa «Imprimir ticket» o «PDF Carta».
2. El botón pasa a `Loader2` + «Preparando impresión…» y se deshabilita.
3. `ImpresionPos` monta **un solo** portal `[data-print-root]` con `data-print-paper`:
   - ticket: `data-print-pos="ticket-80"` o `data-print-pos="ticket-57"`, con la clase `ticket-pos-80` o `ticket-pos-57`;
   - carta: sin atributo de ticket; `DocumentoPapel` dentro.
4. Se espera un frame (`requestAnimationFrame`) para que fuentes/logo estén listos; el logo tiene `onError` para ocultarse.
5. Se asigna `document.title`, se llama `window.print()` y se restaura el título.
6. Al cerrar el diálogo de impresión (o tras 1 s), se desmonta el portal y el botón vuelve a su estado normal.
7. Si `window.print` falla: toast «No se pudo imprimir. Inténtalo de nuevo.» y se desmonta el portal.

- Doble clic no imprime dos veces: el botón se bloquea mientras `preparando` es true.
- No hay impresión automática al cobrar. El cajero decide.
- El ticket se puede imprimir desde la confirmación, el historial, el detalle de devolución, el cierre y el recibo de movimiento.
- La impresión no hace consultas al abrir el diálogo: usa el payload de la venta, el detalle ya cargado o el resumen del turno. Si el detalle no estaba cargado (reimprimir desde una fila), se carga una vez antes de imprimir.

### 8.9 Lo que nunca se imprime

- El header del POS, la navegación, los botones, los totales en pantalla, los diálogos, los toasts y el sidebar de Contabilidad.
- URLs, enlaces, correos de la app, marcas de terceros («Alegra») ni textos de relleno.
- Datos de la empresa que no existen: se omite la línea; no se inventa un RNC, una dirección ni un pie.
- El `pie_ticket` cuando es null; el pie de `plantillas_impresion` no se usa en el ticket.
- Las líneas no devueltas en una NC; solo lo que se devuelve.
- Los pagos anulados como si fueran vigentes; se marcan o se omiten según el estado actual.

## 9. Estados y copy

> En todos los textos, «Caja 1» es `terminal.nombre` y «Turno No 4» es `turno.numero`: se interpolan, nunca se escriben fijos. «Consumidor Final» es el nombre del contacto configurado, no un texto hardcodeado.

### 9.1 Estados globales

| Estado | Dónde | Copy exacto | Acción |
| --- | --- | --- | --- |
| POS no instalado | Layout, pantalla completa | «El punto de venta no está instalado en esta base de datos.» / «Aplica la migración del POS para habilitarlo.» | «Volver a Contabilidad» |
| Sin terminales | Layout, pantalla completa | «No hay terminales de punto de venta configuradas.» / «Configura la primera terminal con su almacén, cajón y numeración.» | «Configurar terminal» (pestaña nueva a `/dashboard/configuracion/pos`) |
| Terminal inactiva | Header y Vender | «La terminal Caja 1 está inactiva.» / «Actívala o elige otra terminal para vender.» | «Elegir otra terminal» |
| Sin caja / sin cuenta de efectivo | Vender/Turnos | «La terminal Caja 1 no tiene una cuenta de efectivo activa.» / «Corrige la configuración en Contabilidad.» | «Abrir configuración» (pestaña nueva a `/dashboard/configuracion/pos`) |
| Solo lectura | Vender | «Tu rol es de solo lectura. Puedes consultar el historial, pero no vender.» | «Ir al historial» |
| Sin permiso (RPC) | Cualquier acción | «Sin permiso.» | Se recarga la pantalla |
| Error de conexión | Cualquier pantalla | «No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.» | «Reintentar» |
| Sesión vencida | Cualquier acción | Redirige a `/login`; no se muestra un error crudo. | — |

### 9.2 Estados de Vender

| Estado | Copy exacto | Acción |
| --- | --- | --- |
| Sin turno | «No hay un turno abierto en Caja 1.» / «Abre un turno para cobrar; puedes seguir armando el carrito.» | «Abrir turno» (diálogo en sitio, sin perder el carrito) |
| Turno cerrado | «El turno No 4 está cerrado.» / «Abre un turno nuevo para cobrar.» | «Abrir turno» (diálogo en sitio) |
| Carrito vacío | «El carrito está vacío.» / «Busca un producto o escanea un código para empezar.» | Foco en el buscador |
| Sin resultados | «No encontramos productos para «{q}».» / «Revisa el nombre o escanea el código de barra.» | «Limpiar búsqueda» |
| Sin favoritos | «Aún no tienes productos favoritos.» / «Marca productos como favoritos en Inventario para verlos aquí.» | «Ir a Inventario» (pestaña nueva) |
| Catálogo cargando | 8 `Skeleton` de tarjetas; sin texto. | — |
| Catálogo con error | «No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.» | «Reintentar» |
| Sin numeración | «La terminal no tiene una numeración de venta activa.» / «Configúrala en Contabilidad → Configuración → Punto de venta.» | «Abrir configuración» |
| Cotización cargada | «Cotización No 12 cargada. Las líneas no se editan aquí.» | «Quitar cotización» |
| Sin cotizaciones | «No hay cotizaciones abiertas.» / «Guarda una cotización desde el carrito para verla aquí.» | «Cerrar» |
| Máximo de pestañas | «Máximo 8 ventas abiertas.» | «Cerrar una venta» |
| Salir con carrito | «¿Salir del punto de venta?» / «Las ventas que no hayas cobrado se perderán.» | «Seguir vendiendo» / «Salir» |

### 9.3 Checkout y red

| Estado | Copy exacto | Acción |
| --- | --- | --- |
| Efectivo vacío | «Escribe el efectivo recibido.» | Foco en el campo |
| Pago excedido | «La suma de los pagos no puede exceder el total de la venta.» | Corregir montos |
| Cambio en no efectivo | «Solo el efectivo admite monto recibido y cambio.» | No debería ocurrir; se corrige la fila |
| Crédito a Consumidor Final | «No se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total.» | `SelectorContacto` en el bloque de crédito |
| Límite excedido | Mensaje del servidor, capitalizado: «La venta a crédito excede el límite del contacto (límite X, saldo actual Y, saldo nuevo Z).» | «Elegir otro cliente» / reducir el crédito |
| Stock insuficiente | «No hay existencia suficiente del producto X.» | Ajustar cantidad o revisar Inventario |
| Red lenta (>8 s) | «La conexión está lenta. La venta sigue en curso; no cierres la pestaña.» | «Seguir esperando» |
| Respuesta perdida (>20 s o error de red) | «No sabemos si la venta se registró. Revisa el Historial antes de volver a cobrar.» | «Ver Historial» (no reintenta solo) |
| Error definitivo (RPC 22023/42501) | Mensaje del servidor capitalizado, en `Alert`. | Corregir y reintentar (la operación no se creó). |
| Error del servidor (5xx o desconocido) | «No sabemos si la venta se registró. Revisa el Historial antes de volver a cobrar.» | «Ver Historial»; no se reintenta solo. |

### 9.4 Estados de Turnos

| Estado | Copy exacto | Acción |
| --- | --- | --- |
| Sin turno | «No hay un turno abierto en Caja 1.» / «Abre un turno con la base inicial para empezar a vender.» | «Abrir turno» |
| Turno abierto | «Turno No 4 · Abierto desde 08:15 a. m.» | «Registrar movimiento» / «Cerrar turno» |
| Turno cerrado | «Turno No 4 · Cerrado.» / «El efectivo esperado quedó congelado al cerrar.» | «Abrir nuevo turno» / «Imprimir cierre» |
| Sin movimientos | «Este turno no tiene movimientos.» / «Las ventas, cobros y retiros aparecerán aquí.» | — |
| Retiro negativo | «El retiro deja la caja en negativo.» | Bajar el monto |
| Esperado negativo | «El efectivo esperado es negativo; revisa los pagos y devoluciones del turno antes de cerrar.» | Revisar movimientos; «Cerrar turno» deshabilitado |
| Diferencia | «Sobrante de RD$ X» / «Faltante de RD$ X» / «La caja cuadra.» | «Registrar la diferencia en contabilidad» |
| Sin cuentas de diferencia | «No hay una cuenta configurada para sobrante o faltante de caja.» | «Configurar en Contabilidad» (texto; sin ruta inventada) |
| Cierre ya cerrado | «El turno ya está cerrado.» | Refrescar |
| Efectivo real vacío | «El efectivo real es obligatorio.» | Foco en el campo |
| Efectivo real negativo | «El efectivo real no puede ser negativo.» | Corregir |
| Sin cierres | «No hay cierres de turno.» / «Los cierres aparecerán aquí cuando cierres un turno.» | — |

### 9.5 Estados de Historial y Devoluciones

| Estado | Copy exacto | Acción |
| --- | --- | --- |
| Historial vacío | «Aún no hay ventas del POS.» / «Las ventas que cobres en el punto de venta aparecerán aquí.» | «Ir a Vender» |
| Historial filtrado sin resultados | «Sin resultados.» / «No hay ventas que coincidan con los filtros.» | «Limpiar filtros» |
| Detalle no encontrado | «No se pudo cargar la venta.» | «Reintentar» / «Cerrar» |
| Devoluciones vacías | «Aún no hay devoluciones del POS.» / «Las notas de crédito creadas desde el punto de venta aparecerán aquí.» | «Nueva devolución» |
| Sin turno para devolver | «No hay un turno abierto en Caja 1.» / «Abre un turno para devolver.» | «Abrir turno» |
| Factura no encontrada | «La factura no existe o está anulada.» | Volver al buscador |
| Factura ya devuelta | «Esta factura ya fue devuelta por completo.» | «Cerrar» |
| Sin líneas | «Selecciona al menos un producto para devolver.» | Continuar deshabilitado |
| Cantidad excedida | «La cantidad no puede superar lo disponible por acreditar (N).» | Corregir |
| Combinado inválido | «El reembolso combinado requiere efectivo y crédito mayores a cero.» | Corregir |
| Efectivo sobre pagado | «El efectivo devuelto no puede exceder lo pagado en la factura.» | Bajar el efectivo / Combinado |
| Efectivo sobre caja | «El efectivo devuelto no puede exceder el efectivo disponible en la caja.» | Bajar el efectivo / Crédito |
| Devolución creada | «Devolución creada» + NCF B04 | «Imprimir ticket» / «Cerrar» |

### 9.6 Toasts

Los toasts son breves y secundarios: nunca reemplazan la confirmación del diálogo. Textos:

- «Venta registrada.»
- «Cotización guardada.»
- «Turno abierto.»
- «Turno cerrado.»
- «Movimiento registrado.»
- «Devolución creada.»
- «No se pudo imprimir. Inténtalo de nuevo.»

No hay toast para «Producto agregado»: esa confirmación es la región `aria-live` y el resaltado de la línea. No se usan emojis ni signos de exclamación múltiples. No se copia el tono de Alegra.

## 10. Mapa RPC → acción de UI

### 10.1 Escrituras

| Acción UI | RPC | Disparador | Payload que arma la UI | Resultado en pantalla |
| --- | --- | --- | --- | --- |
| Cobrar venta | `pos_completar_venta(p jsonb)` | CTA del checkout / F8 | `terminal_id`, `contacto_id`, `lista_precio_id`, `numeracion_id`, `fecha`, `vendedor_id`, `lineas` o `cotizacion_id`, `pagos` | Confirmación con factura, NCF, totales, cambio y botones de impresión. |
| Guardar cotización | `pos_crear_cotizacion(p jsonb)` | «Guardar cotización» | `terminal_id`, `contacto_id`, `lista_precio_id`, `fecha`, `vencimiento`, `vendedor_id`, `lineas` | Confirmación «Cotización guardada» + número. |
| Abrir turno | `pos_abrir_turno(p jsonb)` | «Abrir turno» | `terminal_id`, `base_inicial`, `observaciones` | Turno abierto, resumen en cero + base, badge actualizado. |
| Registrar movimiento | `pos_registrar_movimiento_turno(p jsonb)` | «Registrar movimiento» | `turno_id`, `tipo`, `motivo`, `monto`, `cuenta_contrapartida_id`, `contacto_id`, `factura_id`, `cuenta_gasto_id`, `subtotal`, `itbis_tasa`, `descripcion`, `notas` según rama | Recibo + resumen actualizado. |
| Cerrar turno | `pos_cerrar_turno(p jsonb)` | «Cerrar turno» | `turno_id`, `efectivo_real`, `observaciones`, `registrar_diferencia` | Cierre congelado + diferencia + ticket. |
| Crear devolución | `pos_crear_devolucion(p jsonb)` | «Crear devolución» | `terminal_id`, `factura_id`, `fecha`, `lineas: [{factura_linea_id, cantidad}]`, `tipo_reembolso`, `monto_reembolso_efectivo`, `cuenta_reembolso_id`, `notas` | NC B04 + reembolso + ticket. |
| Cambiar terminal | `seleccionarTerminalPos` (server action 2B, no RPC) | Selector del header | `terminal_id` | Cookie actualizada y layout refrescado. |

### 10.2 Lecturas

| Acción UI | RPC / consulta | Cuándo | Datos |
| --- | --- | --- | --- |
| Catálogo inicial y búsquedas | `pos_catalogo_productos(p_almacen_id, p_lista_precio_id, p_busqueda, p_categoria_id, p_solo_favoritos, p_limit, p_offset)` | Montaje y cada búsqueda/filtro | Productos, precio, ITBIS, stock, disponible, unidades, favorito. |
| Pistola de código de barra | `pos_buscar_por_codigo_barra(p_codigo, p_almacen_id, p_lista_precio_id)` | Enter con buffer de escáner | Una fila con producto/unidad/precio/stock. |
| Resumen del turno | `pos_resumen_turno(p_turno_id)` | Turnos, después de cada acción, al enfocar la pestaña | Ventas, ingresos, retiros, devoluciones, efectivo, movimientos. |
| Lista de cotizaciones abiertas | Consulta 2B (`cotizaciones`) | «Cargar cotización» | Número, cliente, fecha, vencimiento, total. |
| Detalle de cotización | Consulta 2B | Al cargar | Líneas y datos para el carrito. |
| Historial POS | Consulta 2B paginada de `facturas` con `origen = 'pos'` | Historial | Factura, cliente, terminal, turno, métodos, totales. |
| Detalle de venta POS | Consulta 2B por id | Abrir Sheet / reimprimir | Factura, líneas, pagos, NC, empresa, terminal, plantilla. |
| Devoluciones POS | Consulta 2B de `notas_credito_venta` con `turno_id not null` | Lista | NC, factura, cliente, reembolso, estado. |
| Detalle de NC | Consulta 2B por id | Abrir Sheet | Líneas, totales, reembolso, factura origen. |
| Factura para devolución | Consulta 2B por NCF/número/cliente | Paso 1 | Factura, líneas, cantidades ya devueltas, pagos, saldo. |
| Cuentas de movimiento | Consulta 2B de `cuentas` | Diálogo de movimiento | Cuentas de detalle activas, `es_caja_banco`, tipo. |
| Facturas con saldo | Consulta 2B de `facturas` | Cobro de factura | NCF, cliente, total, saldo. |
| Empresa / terminal / numeraciones / listas / vendedores / impuestos | Consultas existentes (`getEmpresa`, `getNumeraciones`, `getListasPrecios`, `getVendedoresActivos`, `getImpuestosActivos`, `listarCategorias`) | Layout y Vender | Catálogos del panel. |
| Plantilla de ticket | `pos_terminales.plantilla_ticket` | Layout / payload de venta | Toggles y ancho. |
| Plantilla Carta | `getPlantillaImpresion("factura")` y `("cotizacion")` | Layout | `mostrarLogo`, notas, términos. |

- Toda lectura respeta RLS; las RPC de lectura (`pos_resumen_turno`, `pos_catalogo_productos`, `pos_buscar_por_codigo_barra`) son `security invoker`. La UI nunca usa `service_role`.
- Las escrituras se hacen con `supabase.rpc("nombre", args)` directo en 2B. La UI no llama Supabase desde el navegador.
- No se usan RPC de fase 1 distintas de las dos lecturas del catálogo; el POS no las redefine.

### 10.3 Errores: origen y presentación

| Origen | Presentación |
| --- | --- |
| RPC `22023` | `Alert variant="destructive"` con el mensaje capitalizado; el formulario conserva los datos. |
| RPC `42501` | «Sin permiso.» + recarga; no se muestran datos. |
| `23505`/`23514` | Se muestran como error de validación; no se exponen detalles técnicos. |
| Red/timeout/5xx en venta, devolución, movimiento o cierre | Estado de incertidumbre (§9.3); no se reintenta solo. |
| Red/timeout en lecturas | «No se pudo conectar con el servidor…» + «Reintentar». |
| Tabla/función inexistente (`42P01`/`42883`) al entrar | «POS no instalado»; no se rompe Contabilidad. |

## 11. Accesibilidad

- **Foco:** el buscador de Vender se enfoca al montar y después de agregar/quitar/cobrar. F2 lo recupera. Los `Dialog`/`Sheet` de Base UI atrapan el foco; al cerrar, vuelve al botón que los abrió. Nunca se usa `autoFocus` en un campo destructivo.
- **Skip links:** «Ir al catálogo» y «Ir a la factura» al inicio de Vender, visibles solo con foco. En las páginas de lista, «Ir al contenido».
- **Teclado:** todos los controles son alcanzables con Tab; los atajos de §4.6 no son la única vía. Los tiles de método y tipo de reembolso son `RadioGroup` o botones con `aria-pressed`, no `div` clicables.
- **Nombres accesibles:** cada botón de icono tiene `aria-label` («Aumentar cantidad de Destornillador», «Quitar Destornillador», «Reimprimir ticket», «Cerrar cobro»). Los inputs tienen `Label` visible o `aria-label` si el diseño es compacto.
- **Anuncios:** una región `aria-live="polite"` en Vender anuncia el producto agregado, la cantidad de artículos y el total; no anuncia cada tecla. Los errores usan `role="alert"` (lo aporta `Alert`) y se enfocan al aparecer en el checkout. La carga usa `aria-busy`.
- **Formularios:** `aria-invalid` y `aria-describedby` en los campos con error; el mensaje está debajo del campo (`FormField`/`CampoFormulario`). Al enviar con errores, el foco va al primer campo inválido.
- **Tablas:** `Table`/`TablaLista` usan `scope="col"`; los montos no dependen del color. `PillEstado` siempre lleva texto («Cobrada», «Por cobrar», «Anulada»), no solo el color.
- **Contraste:** texto normal ≥ 4.5:1 y texto grande/UI ≥ 3:1 con los tokens del tema. No se usa `text-muted-foreground` para montos críticos; el total va en `text-foreground`. El foco tiene un ring visible (`focus-visible:ring-2`).
- **Targets:** mínimo 40×40 px para botones, iconos, steppers, tabs y tiles; el CTA principal 48 px. Los enlaces de texto dentro de párrafos no cuentan como target principal, pero los de acción sí se elevan a 40 px.
- **Zoom:** usable al 200% sin perder el CTA; el panel de factura y el catálogo tienen scroll interno, no `overflow: hidden` que corte contenido.
- **Movimiento:** `prefers-reduced-motion` desactiva el resaltado animado y las transiciones no esenciales. Los spinners son la única animación permanente.
- **Idioma:** todo el copy en español de RD; `lang="es-DO"` ya está en el layout raíz. Fechas y moneda con `Intl` y `America/Santo_Domingo`.
- **Impresión:** el botón de imprimir es accesible por teclado y anuncia «Preparando impresión…». El diálogo del navegador es del sistema.

## 12. Rendimiento

- **Una sola consulta de catálogo por interacción:** `pos_catalogo_productos` con 50 filas; sin consultas por tarjeta. La UI no pide stock por producto.
- **Búsqueda:** debounce 250 ms; descarte de respuestas viejas por número de solicitud; sin cancelar la RPC en el servidor (no hay soporte), pero la respuesta vieja no se pinta.
- **Carga por lotes:** 50 por página, `p_limit` máximo 200 en la RPC, botón «Ver más». No hay `offset` gigante ni scroll infinito.
- **Sin N+1:** historial y detalle usan consultas por lote (`consultarEnLotes`/`paginarConsulta` de 2B) para pagos, NC y líneas. El resumen del turno es una RPC con agregados.
- **Sin duplicar layout/page:** terminal, turno abierto y empresa se leen con funciones `cache()` de React, igual que `getEmpresa` (`src/lib/facturacion/consultas.ts`), para que el layout y la página compartan el resultado dentro de la misma petición.
- **Render del carrito:** totales en centavos con `useMemo`; claves estables por línea; solo la línea editada se vuelve a renderizar. No se virtualiza a 50 líneas (no hace falta); si un carrito supera 100 líneas, se advierte y se sugiere dividir la venta, pero no se bloquea.
- **Pestañas:** máximo 8 carritos; el catálogo se comparte, no se copia por pestaña. Cambiar de pestaña no vuelve a consultar el catálogo.
- **Imágenes:** `loading="lazy"`, `decoding="async"`, tamaño fijo para evitar layout shift. Si no hay imagen, icono `Package`, sin petición.
- **Impresión:** el portal se monta solo al imprimir y se desmonta después; no hay iframe oculto ni documento precargado. El logo se carga una vez y se cachea.
- **Resumen del turno:** se refresca después de cada acción con el payload devuelto y al recuperar el foco de la ventana; no hay polling cada segundo. No se consulta mientras un diálogo de cobro está en curso.
- **Bundle:** sin dependencias nuevas; iconos de lucide individuales; no se importa Recharts ni TanStack Table en el POS (la tabla es `TablaLista`/`Table`). `DocumentoPapel` se carga con `next/dynamic` al pulsar «PDF Carta», para que su HTML/estilos no pesen en la primera pintura de Vender.
- **Primera pintura:** el servidor entrega catálogo inicial, terminal, turno y catálogos; el cliente no arranca con pantalla vacía. El esqueleto solo cubre la carga de la grilla cuando se cambia de filtro.
- **Presupuesto de interacción:** agregar/quitar del carrito <100 ms (local); búsqueda típica <300 ms; el cobro depende del servidor y muestra feedback a los 150 ms. No se promete un tiempo de venta menor al round-trip real.

## 13. Checklist de aceptación de 2D

### 13.1 Estructura

- [ ] `/pos` abre en una pestaña nueva desde el sidebar (`newTab: true`) sin sidebar de Contabilidad.
- [ ] Header de 56 px con empresa, terminal, navegación, turno, usuario y «Salir».
- [ ] Rutas `/pos`, `/pos/turnos`, `/pos/historial`, `/pos/devoluciones` con el layout propio.
- [ ] `lector` no puede escribir; `admin`/`contador` sí.
- [ ] Estado «POS no instalado» y «Sin terminales» sin romper Contabilidad.

### 13.2 Vender

- [ ] Catálogo con favoritos, búsqueda 250 ms, pistola con foco permanente y carga por lotes.
- [ ] Carrito con unidad, cantidad, precio, descuento e ITBIS; totales por tasa.
- [ ] Pestañas paralelas (máx. 8), renombrar y eliminar con confirmación.
- [ ] Venta simple F4; guardar/cargar cotización; cotización cargada en solo lectura.
- [ ] Checkout efectivo, tarjeta débito/crédito, transferencia, combinado, parcial y crédito.
- [ ] Cambio solo sobre efectivo; Consumidor Final sin crédito; error de límite visible.
- [ ] Confirmación con «Imprimir ticket» y «PDF Carta».

### 13.3 Turnos

- [ ] Abrir con base inicial; sin asiento; un solo turno por terminal.
- [ ] Resumen con `pos_resumen_turno`, fórmula visible y desgloses.
- [ ] Ingresos/retiros con motivo y cuenta; cobro de factura; gasto menor con ITBIS.
- [ ] Cierre con efectivo real, diferencia, switch de asiento y bloqueo si el esperado es negativo.
- [ ] Historial de cierres con diferencia y reimpresión.

### 13.4 Historial y devoluciones

- [ ] `TablaLista` de facturas `origen='pos'` con filtros y paginación.
- [ ] Detalle en `Sheet` con líneas, pagos, NC y reimpresión.
- [ ] Wizard de devolución de 3 pasos, con factura, líneas/cantidades y reembolso.
- [ ] Validaciones visibles: disponible por línea, efectivo ≤ pagado y ≤ caja, combinado > 0.
- [ ] NC B04 real, ticket y el resumen del turno refleja la devolución al entrar a Turnos.

### 13.5 Impresión y calidad

- [ ] Ticket 80 mm y 57 mm con estilos clásico/minimalista/detallado y todos los toggles.
- [ ] Ticket blanco/negro, sin sidebar, sin URLs, sin marcas de terceros.
- [ ] PDF Carta con `DocumentoPapel` para factura y cotización.
- [ ] Capturas claro/oscuro y móvil de Vender, checkout, Turnos, Historial, Devoluciones y confirmación de venta.
- [ ] `pnpm typecheck`, `pnpm check` y `pnpm test` en verde.
- [ ] Sin dependencias nuevas, sin `service_role`, sin migraciones tocadas, sin `--no-verify`.

## 14. Lo que esta especificación no decide (y no debe inventarse en 2D)

- No define el SQL, las firmas de las RPC ni los tipos de 2B: eso vive en `docs/dominio-pos.md` y en `src/lib/pos/`.
- No define la pantalla de configuración de terminales (`/dashboard/configuracion/pos`): es 2C.
- No define el menú del sidebar: 2C agrega «Punto de venta» con `newTab: true`.
- No define la anulación de facturas, notas de crédito o pagos: vive en Contabilidad.
- No define e-CF/DGII, NCF manual, offline, multi-empresa, multi-sucursal, rol cajero, propinas, báscula, promociones ni puntos.
- No define impresión ESC/POS directa: se usa el diálogo del navegador con `@media print`.
- No define el contenido de `docs/alegra/pos/`: es inspiración funcional, no se copia.

Si una decisión de este documento choca con `docs/dominio-pos.md`, manda `docs/dominio-pos.md`. Si choca con la realidad del código, se corrige este documento en el mismo PR antes de implementar.
