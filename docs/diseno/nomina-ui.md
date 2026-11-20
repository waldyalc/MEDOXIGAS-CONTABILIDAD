# Nómina RD — especificación de UI

**Estado:** especificación de diseño. **No implementa código, no toca SQL y no aplica migraciones.**
**Rama:** `t3/diseno-ui-nomina-rd`, desde `origin/main` (`0a751ec`, merge del PR 69).
**Alcance:** pantallas de **Nómina RD** dentro de Contabilidad y su configuración dentro de `/dashboard/configuracion`. La fuente funcional es `docs/dominio-nomina.md` (contrato de dominio) y `docs/PLAN-FASE-2-ORQUESTADOR.md` (FASE 3, 3D y 3E). La fuente visual es `docs/plantilla-diseno.md` y el estudio `docs/alegra/nomina/**`, usado como inspiración, nunca como copia.
**Regla de marca:** solo tokens de Medoxigas (`--primary` azul, shadcn/Base UI). **Nunca** el teal `#00b19d` de Alegra, ni sus textos, selectores, logos o HTML.
**Regla de oro del dinero:** la UI **no calcula** salarios, tasas, ISR, totales de recibo ni asientos. Muestra lo que devuelven las RPC. Se permite la aritmética presentacional (sumar filas ya calculadas para un pie de reporte, un porcentaje informativo o los días entre dos fechas) y el cálculo de configuración de la escala de ISR, que el RPC valida. Los formularios solo capturan datos.

---

## 0. Mapa de pantallas, rutas y decisión de navegación

`docs/dominio-nomina.md` §1.1 proponía `/dashboard/contabilidad/nomina` como lista de periodos. Esta spec **fija** la navegación final: la raíz es el **Inicio** y los periodos viven en `/periodos`. El resto del contrato no cambia.

| # | Pantalla | Ruta | Contenedor | Tipo | RPC de escritura |
| --- | --- | --- | --- | --- | --- |
| 1 | Inicio Nómina | `/dashboard/contabilidad/nomina` | `ContenedorLista` | Panel | — |
| 2 | Empleados | `/dashboard/contabilidad/nomina/empleados` | `ContenedorLista` | Lista | — |
| 3 | Nuevo empleado | `/dashboard/contabilidad/nomina/empleados/nuevo` | `ContenedorFormulario` | Wizard 3 pasos | `nomina_crear_empleado` |
| 4 | Editar empleado | `/dashboard/contabilidad/nomina/empleados/[id]/editar` | `ContenedorFormulario` | Wizard 3 pasos | `nomina_actualizar_empleado` |
| 5 | Ficha de empleado | `/dashboard/contabilidad/nomina/empleados/[id]` | `ContenedorDetalle` | Ficha con tabs | `nomina_cambiar_estado_empleado`, `nomina_guardar_novedad_recurrente`, `nomina_eliminar_novedad_recurrente` |
| 6 | Importar empleados (fase 1.5) | `/dashboard/contabilidad/nomina/empleados/importar` | `ContenedorFormulario` | Asistente | `nomina_crear_empleado` por fila |
| 7 | Periodos y cálculo | `/dashboard/contabilidad/nomina/periodos` | `ContenedorLista` | Lista | `nomina_crear_periodo` |
| 8 | Detalle del periodo | `/dashboard/contabilidad/nomina/periodos/[id]` | `ContenedorLista` | Detalle operativo | `nomina_agregar_empleados`, `nomina_calcular_periodo`, `nomina_contabilizar_periodo`, `nomina_pagar_periodo` |
| 9 | Recibo de pago | `/dashboard/contabilidad/nomina/recibos/[id]` | `ContenedorDetalle` | Documento operativo | `nomina_guardar_novedad_recibo`, `nomina_eliminar_novedad_recibo`, `nomina_calcular_recibo`, `nomina_contabilizar_recibo`, `nomina_pagar_recibo`, `nomina_anular_pago_recibo`, `nomina_anular_recibo` |
| 10 | Colilla imprimible | `/dashboard/contabilidad/nomina/recibos/[id]/colilla` | Papel carta | Impresión | — |
| 11 | Pagos de nómina | `/dashboard/contabilidad/nomina/pagos` | `ContenedorLista` | Lista | — |
| 12 | Detalle de pagos del periodo | `/dashboard/contabilidad/nomina/pagos/[periodoId]` | `ContenedorLista` | Detalle de lote | `nomina_pagar_periodo`, `nomina_pagar_recibo`, `nomina_anular_pago_recibo` |
| 13 | Envíos de colillas | `/dashboard/contabilidad/nomina/envios` | `ContenedorLista` | Lista + diálogo | `nomina_registrar_envio_colillas` |
| 14 | Reporte TSS | `/dashboard/contabilidad/nomina/reportes` | `ContenedorLista` | Reporte | — |
| 15 | Config · Datos laborales | `/dashboard/configuracion/nomina/laboral` | `ContenedorFormulario` | Formulario | `nomina_guardar_config_empresa` |
| 16 | Config · Mapeo contable | `/dashboard/configuracion/nomina/mapeo` | `ContenedorFormulario` | Tabla editable | `nomina_guardar_mapeo_contable` |
| 17 | Config · Conceptos | `/dashboard/configuracion/nomina/conceptos` | `ContenedorLista` | Lista + diálogo | `nomina_crear_concepto`, `nomina_actualizar_concepto` |
| 18 | Config · Parámetros legales RD | `/dashboard/configuracion/nomina/parametros` | `ContenedorFormulario` | Formulario | `nomina_guardar_parametros_rd` |

- `/dashboard/configuracion/nomina` **redirige** a `/laboral`; el índice real es la sección de tarjetas del hub de Configuración.
- **No hay pestaña nueva, ni módulo de primer nivel, ni app aparte.** Nómina es un subgrupo desplegable dentro de Contabilidad.
- **No hay** Suscripciones, Bandeja, onboarding ni “Elegir plan”.
- **No hay** `/dashboard/nomina` ni duplicación de Configuración.
- Las rutas de detalle usan `id` UUID; los enlaces se construyen con helpers en `src/lib/enlaces.ts` (ver §13).

### 0.1 Fuera de alcance (lo dice el contrato)

e-CF/DGII de nómina, 606/607, IR-3 en XML oficial, portal del empleado, solicitudes de vacaciones, dispersión bancaria TXT, liquidaciones/finiquitos como documento, multiempresa/multimoneda y firma electrónica de colillas. La importación de empleados está fuera de la fase 1 según `docs/dominio-nomina.md` §12.4: se especifica en §5.4 como **fase 1.5 sujeta a aprobación**, y el botón permanece oculto hasta que Waldy la apruebe.

---

## 1. Sistema visual y reglas comunes

### 1.1 Tokens y tipografía

- Solo tokens del preset Medoxigas: `--primary` (azul), `--primary-foreground`, `--background`, `--card`, `--border`, `--muted`, `--muted-foreground`, `--destructive`, `--ring`, `--chart-1..5`, `--sidebar-*`. **Cero hex/rgb/oklch sueltos** fuera de `src/components/ui` y del papel de impresión.
- Tipografía Inter (la del layout). Títulos:
  - Página: `EncabezadoPagina` → `text-xl font-semibold tracking-tight` (20 px/600).
  - Sección de tarjeta: 16 px/600 (`FormSectionTitle`).
  - Cuerpo: 14 px/400; secundario 14 px `text-muted-foreground`.
  - Tabla: cabecera 12 px/500; celda 14 px/400 (compacta 13 px).
  - KPI: valor 20–24 px/600 con `tabular-nums`; etiqueta 12 px/500 gris.
- Nada de `text-3xl` ni `text-2xl` en el marco de una página (lo prohíbe `src/lib/diseno-paginas.test.ts`).

### 1.2 Contenedores y ritmo

| Tipo de pantalla | Componente | Ancho |
| --- | --- | --- |
| Lista, panel, reporte, detalle de periodo | `ContenedorLista` | 1289 px |
| Formulario, wizard, configuración, recibo | `ContenedorFormulario` / `ContenedorDetalle` | 1040 px |
| Papel de colilla | `DocumentoPapel` | Carta (8.5 × 11 in), medidas en `pt` |

- No se elige el ancho con `max-w-*` en `page.tsx` (candado de `diseno-paginas.test.ts`).
- Separación vertical entre bloques: 24 px (`gap-6`) en formularios y 16 px (`gap-4`) en detalles; dentro de tarjetas, 16 px.
- Radios: tarjetas 16–18 (`rounded-2xl`), tarjeta de formulario 12 (`rounded-xl`), inputs/botones 10–12, pills 6.
- Sin sombras pesadas; borde `border-border`. El modo oscuro se hereda de tokens y se prueba siempre.

### 1.3 Componentes reales que se usan (no se reinventan)

| Necesidad | Componente real | Nota |
| --- | --- | --- |
| Encabezado con migas y acciones | `src/components/pagina/encabezado-pagina.tsx` → `EncabezadoPagina` | Título 20 px/600. Migas obligatorias en toda pantalla. |
| Lista/tabla | `src/components/listas/tabla-lista.tsx` → `TablaLista`, `TarjetaLista`, `BarraLista`, `ContenedorLista`, `PillEstado` | Columnas con `alineacion: "derecha"` para todo monto. |
| Buscador de lista | `src/components/listas/buscador-lista.tsx` → `BuscadorLista` | Fuera del `Suspense`; 267 px en listas. |
| Paginación | `src/components/listas/paginador-lista.tsx` → `PaginadorLista` | Denominación `TAMANOS_PAGINA` (25/50/100). |
| Paginación local de ficha | `src/components/listas/paginador-local.tsx` | Recibos del empleado. |
| Estado vacío de tarjeta | `EstadoVacioLista` | Ícono 40, título 18/600, texto 14, CTA solo si el rol puede. |
| Carga | `src/components/carga/esqueletos.tsx` → `EsqueletoLista`, `EsqueletoTabla`, `EsqueletoDetalle`, `EsqueletoFormulario`, `EsqueletoReporte` | La cabecera 48 y la fila 56 se conservan. |
| Select simple / buscable | `src/components/select-campo.tsx` → `SelectCampo` | `buscable` para cuentas, contactos, conceptos, bancos. **Nunca `<select>`.** |
| Fecha | `src/components/date-picker.tsx` → `DatePicker`, `DatePickerCampo` | **Nunca `<input type="date">`.** |
| Campo con etiqueta y error | `CampoFormulario` + `FORM_INPUT`, `FORM_SELECT`, `FORM_COMBO`, `FORM_TEXTAREA`, `FORM_INPUT_GROUP` | 40 px, radio 10, asterisco primario, error inline. |
| Validación de formulario | `useValidacionFormulario` + `requerido` | Toast “Revise los campos obligatorios” y foco al primer campo. |
| Tarjeta de formulario | `FormCard`, `FormGrid`, `FormSectionTitle`, `FormDivider`, `FormTotal`, `FormActions` | No mezclar con `max-w` de página. |
| Diálogo | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` | Confirmaciones destructivas con `AlertDialog`. |
| Pestañas | `Tabs` (`variant="line"`) | Segmentos, clases de concepto, estados de la ficha. |
| Interruptor | `Switch` | `aplica_infotep`, `registrar_provisiones`, `activo`, “Mostrar anulados” si aplica. |
| Aviso | `Alert` / `AlertDescription` / `AlertTitle` | Error de carga o de RPC; nunca un `console`. |
| Toast | `toast.add({ type, title, description })` | Éxito de acciones y errores transitorios. |
| Impresión | `BotonImprimir`, `DocumentoPapel`, patrón `PortalImpresion` de la vista de factura | Solo el papel se imprime; la app lleva `print:hidden`. |
| Tarjeta KPI | `Card`, `CardHeader`, `CardContent` | Valor 20–24 px, `tabular-nums`. |
| Gráfica (solo si se aprueba) | `chart.tsx` de shadcn + Recharts | Colores `--chart-*`; no es requisito de fase 1. |

### 1.4 Dinero, fechas y números

- Montos: `formatoMoneda` de `src/lib/facturacion/formato.ts` → `RD$ 1,250.00`; siempre dos decimales y `tabular-nums`.
- Cantidades: `formatoCantidad` (máx. 2 decimales) para horas; **días trabajados** usan un formateador local de 3 decimales (`11.915`, `23.83`) porque `formatoCantidad` corta en 2.
- Porcentajes/tasas: formateador local de 2–3 decimales + `%` (`3.04 %`, `1.10 %`, `23.83`). No reutilizar `formatoPct` si pierde el tercer decimal.
- Fechas: `formatoDia` → `dd/mm/aaaa`. Encabezados de periodo: `16–30 de noviembre de 2026`; en tablas: `16–30 nov 2026`. Zona `America/Santo_Domingo`; “hoy” con `hoyRD()`.
- Código de periodo (`2026-11-Q2`, `2026-11-M`) en `font-mono text-xs text-muted-foreground`.
- Código de comprobante (`NO-3`) en `font-mono`.
- Cédula/RNC en `tabular-nums`; clave TSS en `font-mono`.
- **Alineación:** todo monto y toda cifra a la **derecha**; textos, fechas, estados y acciones a la izquierda/centro según la tabla. Nunca un monto a la izquierda.
- **Negativos:** neto nunca es negativo (el RPC lo impide); si una cifra llega negativa por error, se pinta en `text-destructive` y se muestra el mensaje del servidor; no se “corrige” en pantalla.

### 1.5 Tablas: reglas fijas

1. Toda lista usa `TarjetaLista` + `BarraLista` + `TablaLista` + `PaginadorLista` (o `PaginadorLocal` en fichas). No se escribe una tabla a mano.
2. La cabecera mide 48 px (`h-12`) y la fila 56 px (`h-14`); la densidad compacta (líneas de recibo) usa 44 px (`h-11`). No se cambian esas clases.
3. `PillEstado` con el tono del **estado de dominio**, no del texto:
   - `exito`: pagado, activo, enviado completo.
   - `pendiente`: calculado, por pagar, parcial, suspendido.
   - `info`: contabilizado, ingreso.
   - `neutro`: borrador, inactivo, sistema, sin estado.
   - `peligro`: anulado, error de pago, vencido.
4. La fila entera abre el detalle con `filaHref`; las acciones de fila van en la columna final de 88 px con `Button variant="ghost" size="icon-sm"` y `aria-label`.
5. No se agregan checkbox, “Filtrar” ni acciones que la RPC no soporte. Los filtros que existan se conectan a `searchParams` y se reflejan en la URL.
6. El vacío calcula su `colSpan` con `columnas.length + (seleccion ? 1 : 0) + (acciones ? 1 : 0)`; no se hardcodea.
7. El pie (`pie`) solo existe si hay totales reales; no se inventan totales de columnas que no aplican (p. ej., días).
8. En móvil: scroll horizontal y `className: "hidden md:table-cell"`/`hidden xl:table-cell` en columnas secundarias. **Nunca se ocultan montos, estado ni la acción principal.**

### 1.6 Formularios y validación

- Todos los formularios llevan `noValidate`, validación por campo con `useValidacionFormulario` y mensajes en español debajo del control (`CampoFormulario`).
- Los campos obligatorios llevan asterisco primario; el mensaje dice qué falta y cómo arreglarlo.
- Los errores del servidor se muestran en un `Alert variant="destructive"` dentro del formulario/diálogo; si el mensaje nombra un campo identificable, se pinta también inline. No se traduce el mensaje a un texto genérico si el RPC ya es claro.
- El botón de guardar se deshabilita mientras hay una transición (`useTransition`) y muestra `Loader2` + texto “Guardando…”. Nunca se envía dos veces.
- Si hay cambios sin guardar y el usuario intenta salir, se muestra un `AlertDialog` “Tienes cambios sin guardar” con “Seguir editando” / “Salir sin guardar”.
- Los formularios largos (config, wizard) usan `FormCard` por sección y una barra de acciones al final (`FormActions`); el botón primario va a la derecha.
- Los campos de dinero usan `InputGroup` con addon `RD$`; los porcentajes, addon `%`. Se escribe con `inputMode="decimal"`; el valor se envía como número de 2 decimales (o 3 en tasas/días/horas, según el contrato).

### 1.7 Estados de pantalla (patrón común)

| Estado | Cómo se ve |
| --- | --- |
| **Cargando** | `loading.tsx` con el esqueleto del tipo de pantalla. La lista conserva toolbar/cabecera/pie; el detalle conserva el resumen + tablas; el formulario conserva tarjetas y rejilla. Sin saltos de layout. |
| **Vacío real** | `EstadoVacioLista` o `ContenidoVacio` dentro de la tarjeta: ícono 40, título 18/600, descripción 14, CTA primario **solo si el rol puede escribir**. |
| **Vacío por filtro/búsqueda** | Título “Sin resultados”, texto “La búsqueda no arrojó …” y **sin CTA**. El pie de paginación se conserva si la lista lo tenía. |
| **Error de carga** | `Alert variant="destructive"` con título “No se pudo cargar …”, el mensaje y un botón “Reintentar” (`router.refresh()`), dentro del marco de la página. No se muestra una tabla vacía como si no hubiera datos. |
| **Sin permiso** | Tarjeta centrada con `ShieldAlert`, título “Solo lectura” o “No tienes permiso”, texto y enlace “Volver a …”. No se enseña un formulario que el RPC va a rechazar. |
| **Error de acción** | `Alert` dentro del diálogo, con el mensaje del RPC; el diálogo permanece abierto para corregir. Si el error es de estado (p. ej. “El recibo no está contabilizado”), se cierra y se muestra un toast de error + se refresca la pantalla. |
| **Éxito** | Toast con el resultado concreto (“Nómina calculada: 2 recibos.”) y refresco de la vista. No un toast genérico “Guardado”. |

### 1.8 Permisos (regla general)

- `admin` y `contador` pueden ejecutar todas las RPC de escritura de nómina; `lector` solo lee y exporta. La UI **oculta o deshabilita** las acciones de escritura para `lector`; no depende del error `42501`.
- `admin` puede además todo lo de Configuración → Empresa (fuera de nómina) y Usuarios.
- La configuración de nómina (4 subpáginas) es editable por `admin` y `contador`. Si Waldy decide que “Datos laborales” sea solo `admin`, se cambia una condición en la tarjeta y en la página; no se cambia la RPC.
- Toda pantalla valida el rol en el servidor (`getRol`) y redirige a `/unauthorized` si no hay perfil.

### 1.9 Accesibilidad, móvil e impresión

- Todo control tiene `label` o `aria-label`; los botones-ícono también.
- Foco visible (`ring` primario), navegación por teclado en tabs, diálogos y wizard; `Esc` cierra; el foco vuelve al disparador.
- Los totales que cambian tras una acción se anuncian en una región `aria-live="polite"`.
- Contraste AA en claro y oscuro; los pills no dependen solo del color (llevan texto).
- Móvil (390 px): una columna, KPI en 2 columnas, wizard de 1 columna, tablas con scroll y columnas secundarias ocultas, diálogos con `max-h` y scroll interno, barra de acciones sticky al fondo si el formulario es largo.
- Impresión: la colilla y el reporte TSS se imprimen solos (`print:hidden` en la app); fondo blanco, texto oscuro, sin sidebar. El PDF se obtiene con el diálogo de impresión del navegador (“Guardar como PDF”), igual que las facturas.

### 1.10 Lo que no se hace

- No se copia el teal, los textos ni el layout exacto de Alegra; se copia el **comportamiento** (orden, candados, prorrata visible, estados).
- No se calcula dinero de nómina en el cliente, ni se muestran cifras “definitivas” antes de que las devuelva el RPC. Las sumas de pie de reporte y los porcentajes informativos son presentacionales; la escala de ISR es configuración y la valida el servidor.
- No se usa `<select>`, `<input type="date">`, `NativeSelect` fuera de `components/ui`, `any`, `!`, `console` (salvo `error`/`warn`), `@ts-ignore` ni `--no-verify`.
- No se agregan columnas que el RPC no devuelve. Si falta un dato, se marca `TODO backend` y se avisa; no se inventa.
- No se borran empleados, periodos, recibos ni asientos. Se anulan o se cambian de estado.
- No se crea un módulo de Configuración paralelo ni una pestaña de Nómina.

---

## 2. Navegación

### 2.1 Grupo desplegable “Nómina” dentro de Contabilidad

En `src/navigation/sidebar/sidebar-items.ts`, Contabilidad hoy tiene 5 subítems. Se agrega **Nómina** como subítem padre con 6 hijos. El menú actual solo tiene dos niveles; para el tercero se extiende `NavSubItem` con `subItems?` (tipo `NavSubSubItem`, mismo shape: `id`, `title`, `url`, `roles?`) y se renderiza un `Collapsible` anidado dentro del submenú de Contabilidad. **No se crea una pestaña nueva** (`newTab` ausente/false) y **no se crea un módulo de primer nivel**.

```
Contabilidad
  Catálogo de cuentas
  Asientos
  Numeraciones
  Activos fijos
  Periodos
  ─────────────────────────
  Nómina                      ▾   ← toggle, no navega
      Inicio
      Empleados
      Periodos y cálculo
      Pagos
      Envíos
      Reporte TSS
```

| Ítem | Ruta | Ícono (sugerido) | Rol | Estado activo |
| --- | --- | --- | --- | --- |
| Nómina (padre) | — (toggle) | — | `admin`, `contador`, `lector` | Se resalta si la ruta empieza por `/dashboard/contabilidad/nomina` |
| Inicio | `/dashboard/contabilidad/nomina` | `House` | todos | Ruta exacta |
| Empleados | `/dashboard/contabilidad/nomina/empleados` | `UsersRound` | todos | Prefijo de ruta (incluye ficha, nuevo, editar, importar) |
| Periodos y cálculo | `/dashboard/contabilidad/nomina/periodos` | `CalendarRange` | todos | Prefijo (incluye detalle del periodo) |
| Pagos | `/dashboard/contabilidad/nomina/pagos` | `Banknote` | todos | Prefijo (incluye detalle de lote) |
| Envíos | `/dashboard/contabilidad/nomina/envios` | `Send` | todos | Prefijo |
| Reporte TSS | `/dashboard/contabilidad/nomina/reportes` | `FileSpreadsheet` | todos | Prefijo |

**Comportamiento:**

- Clic en “Nómina” **solo expande/colapsa**; no navega. `aria-expanded` refleja el estado; el chevron rota 180°.
- Si la ruta activa es de Nómina, el grupo se abre automáticamente al cargar (mismo criterio que Contabilidad hoy: `defaultOpen` si hay un subítem activo).
- El subítem activo usa la barra primaria de 3 × 16 px y el fondo `sidebar-accent`; el padre activo usa el mismo tratamiento suave, sin doble barra.
- El tercer nivel se indenta 12 px adicionales dentro del submenú de Contabilidad (17 px actuales + 12 px); no se superan 3 niveles.
- En sidebar colapsado (solo desktop), Contabilidad abre su `DropdownMenu`; “Nómina” aparece como un grupo con los 6 destinos en un submenú (`DropdownMenuSub`) o, si Base UI no expone submenú, como un ítem “Nómina” que abre un segundo `DropdownMenu` con los 6. **No se pierde ningún destino.**
- En móvil, el mismo acordeón; sin hover; el cajón se cierra al navegar.
- No hay badge “new” ni “soon” en fase 1.
- `filtrarItemsPorRol` se extiende para filtrar también los subítems con `roles`; en nómina todos son `TODOS_LOS_ROLES`, así que no cambia lo visible hoy.
- La fila “Nómina” lleva un borde superior sutil (`border-t`, `mt-2`, `pt-2`) para separarla de los ítems contables puros. No se agrega un separador de 16 px como el de Inicio.

**Roles por ítem:** todos los ítems son visibles para `admin`, `contador` y `lector` porque el contrato permite lectura a cualquier perfil con RLS. Las acciones de escritura se gatean por pantalla (§12). Si Waldy prefiere ocultar “Pagos” o “Envíos” al `lector`, es un cambio de `roles` en ese ítem, no de RPC.

### 2.2 Sección “Nómina” en `/dashboard/configuracion`

En el hub de Configuración se agrega un grupo nuevo al final, **“Nómina”**, con 4 tarjetas (mismo patrón `Card` + `Link` que los grupos actuales, ícono a la derecha, título 16/600 y descripción 14):

| Tarjeta | Descripción | Ruta | Ícono |
| --- | --- | --- | --- |
| Datos laborales y riesgo SRL | “Riesgo, frecuencia, cuentas y contactos de ley.” | `/dashboard/configuracion/nomina/laboral` | `ShieldCheck` |
| Mapeo contable | “Cuentas de gasto y pasivo por segmento.” | `/dashboard/configuracion/nomina/mapeo` | `BookOpen` |
| Conceptos | “Ingresos, deducciones, aportes y provisiones.” | `/dashboard/configuracion/nomina/conceptos` | `ListTree` |
| Parámetros legales RD | “Tasas, topes y escala de ISR por año.” | `/dashboard/configuracion/nomina/parametros` | `Scale` |

- Las tarjetas se ven para todos los roles; el `lector` entra en modo lectura.
- No se agregan ítems de Nómina al sidebar de Configuración (Configuración sigue siendo un enlace único al hub).
- No se agrega “Numeraciones” a esta sección: la numeración `NO` ya vive en Contabilidad → Tipos de entrada de diario. En “Datos laborales” se muestra una línea informativa con enlace a `/dashboard/configuracion/tipos-entrada-diario` (“Comprobante de nómina: tipo NO”).

### 2.3 Migas de pan (obligatorias)

| Pantalla | Migas |
| --- | --- |
| Inicio | Inicio / Contabilidad / Nómina |
| Empleados | Inicio / Contabilidad / Nómina / Empleados |
| Nuevo/Editar empleado | … / Empleados / Nuevo empleado · Editar empleado |
| Ficha | … / Empleados / {Nombre} |
| Importar | … / Empleados / Importar empleados |
| Periodos | Inicio / Contabilidad / Nómina / Periodos y cálculo |
| Detalle del periodo | … / Periodos y cálculo / {16–30 nov 2026} |
| Recibo | … / Periodos y cálculo / {Periodo} / Recibo de {Nombre} |
| Colilla | … / Recibo de {Nombre} / Colilla de pago |
| Pagos | Inicio / Contabilidad / Nómina / Pagos |
| Detalle de pagos | … / Pagos / {16–30 nov 2026} |
| Envíos | Inicio / Contabilidad / Nómina / Envíos |
| Reporte TSS | Inicio / Contabilidad / Nómina / Reporte TSS |
| Config (4) | Inicio / Configuración / Nómina / {Página} |

La última miga se pinta como página actual, sin enlace (`MigasDePan` ya lo hace).

---

## 3. Configuración → Nómina

### 3.0 Marco compartido de las 4 subpáginas

- `ContenedorFormulario` (1040 px) o `ContenedorLista` (1289) según la tabla del §0.
- Encabezado: `EncabezadoPagina` (no `EncabezadoConfiguracion`, porque este último no admite el nivel “Nómina” en las migas) con:
  - Título de la página.
  - Subtítulo corto en gris.
  - Migas `Inicio / Configuración / Nómina / {Página}`.
  - Acciones a la derecha cuando aplique.
- Debajo del encabezado, **tabs de navegación** (`Tabs variant="line"`) con las 4 páginas como enlaces (no cambian de estado en cliente; son `Link`). La pestaña activa usa el subrayado primario. En móvil, scroll horizontal.
- Barra de guardado (solo si el rol puede escribir): al final de la tarjeta, `FormActions` con “Descartar” (ghost, solo si hay cambios) y “Guardar cambios” (primario). Si no hay cambios, “Guardar” deshabilitado. Un punto ámbar junto al título indica cambios sin guardar.
- `lector`: se ven los valores, los controles deshabilitados (`disabled`), sin barra de guardado; un texto gris al inicio “Solo lectura. Un administrador o contador puede editar esta configuración.”
- Errores de carga: `Alert` con “No se pudo cargar la configuración de nómina” + “Reintentar”.
- Cargando: `EsqueletoFormulario` (laboral/parámetros) o `EsqueletoTabla` (mapeo/conceptos).

### 3.1 Datos laborales y riesgo SRL

**Ruta:** `/dashboard/configuracion/nomina/laboral` · **RPC:** `nomina_guardar_config_empresa` · **Tabla:** `nomina_config_empresa` (fila 1) + `empresa` (solo lectura).

**Layout:** una sección “Empresa” de solo lectura; una tarjeta “Riesgo y aportes”; una tarjeta “Cuentas por defecto”; una tarjeta “Contactos de ley”; una tarjeta lateral/inferior “Así se arma el asiento” con resumen y enlaces.

**Campos:**

| Sección | Campo | Componente | Obligatorio | Validación / ayuda |
| --- | --- | --- | --- | --- |
| Empresa | Nombre, RNC, dirección, teléfono, correo | Texto de solo lectura (`dl`) | — | Se editan en Configuración → Empresa. Enlace “Editar datos de la empresa”. |
| Empresa | Numeración del comprobante | Texto + enlace | — | “Nómina (NO). Se administra en Contabilidad → Tipos de entrada de diario.” |
| Riesgo | `riesgo_laboral` | `SelectCampo` | Sí | Opciones: “Tipo I — 1.10 %”, “Tipo II — 1.15 %”, “Tipo III — 1.25 %”, “Tipo IV — 1.30 %”. Ayuda: “Determina la tasa del SRL. Confírmalo con tu asesor.” El resumen muestra la tasa elegida. |
| Riesgo | `categoria_empresa` | `SelectCampo` | Sí | Micro / Pequeña / Mediana / Grande. Ayuda: “Informativa en esta fase; no cambia la tasa de INFOTEP.” |
| Riesgo | `aplica_infotep` | `Switch` | — | Ayuda: “Si está apagado, no se genera la línea de INFOTEP (1.00 %).” |
| Riesgo | `registrar_provisiones` | `Switch` | — | Ayuda en ámbar al activarlo: “Genera provisiones de regalía, vacaciones y cesantía. En esta fase no se consumen al pagar; confírmalo con Contable.” |
| Riesgo | `frecuencia_defecto` | `SelectCampo` | Sí | Quincenal / Mensual. Ayuda: “Solo prellena el formulario de nuevo periodo.” |
| Cuentas | `cuenta_pago_defecto_id` | `SelectCampo` buscable | No | Solo cuentas `es_caja_banco = true` y activas; muestra `código — nombre`. Ayuda: “Se propone al pagar. Si falta, el pago pide elegir una cuenta.” |
| Cuentas | `cuenta_salarios_por_pagar_id` | `SelectCampo` buscable | Sí para contabilizar | Solo pasivos de detalle y activos; muestra `código — nombre`. Ayuda: “Es la contrapartida del neto en el comprobante NO. Sin esta cuenta no se puede contabilizar.” Si queda vacía, se permite guardar pero se muestra un `Alert` ámbar persistente. |
| Contactos | `contacto_tss_id` | `SelectCampo` buscable | No | Contactos tipo proveedor; muestra nombre + RNC/cédula si tiene. Ayuda: “Tercero de SFS/AFP/SRL en el asiento.” |
| Contactos | `contacto_infotep_id` | `SelectCampo` buscable | No | Ídem, para INFOTEP. |
| Contactos | `contacto_dgii_id` | `SelectCampo` buscable | No | Ídem, para ISR. |

**Validaciones de pantalla:**

- Enums válidos y cuentas con el tipo correcto; el RPC revalida. El mensaje del RPC se muestra inline si nombra la cuenta/contacto; si no, en el `Alert` superior.
- Si `cuenta_salarios_por_pagar_id` está vacía, el botón Guardar sigue activo, pero el resumen muestra “Contabilización bloqueada: falta la cuenta de salarios por pagar” con enlace a la misma página resaltada.
- No se permite elegir una cuenta de agrupación: el selector solo lista `acepta_movimientos = true`.
- No se edita el RNC ni el nombre de la empresa aquí (evita duplicar Configuración → Empresa).

**Resumen “Así se arma el asiento”:** lista corta con las cuentas elegidas: “Gastos por segmento (mapeo)”, “Retenciones SFS/AFP/ISR (2108/2109/2110)”, “Aportes SFS/AFP/SRL/INFOTEP (2111–2114)”, “Provisiones (2116–2118) si están activas”, “Salarios por pagar (2107)”. Enlace “Revisar mapeo contable”.

**Estados:** sin fila de configuración → se muestran los defaults del contrato y una nota “Se crearán al guardar.”; guardado → toast “Configuración de nómina guardada.”; error → `Alert` “No se pudo guardar la configuración” + mensaje.

**Permisos:** `admin`/`contador` editan; `lector` solo lee.

### 3.2 Mapeo contable por segmento

**Ruta:** `/dashboard/configuracion/nomina/mapeo` · **RPC:** `nomina_guardar_mapeo_contable` · **Tabla:** `nomina_mapeo_contable` (120 filas semilla).

**Layout:** `ContenedorFormulario`. Encabezado + tabs de segmento (`Administrativa`, `Operativa`, `Ventas`), con contador “40/40” por tab. Barra de herramientas con buscador de concepto, `SelectCampo` de clase (“Todas”, “Ingresos”, “Deducciones”, “Aportes patronales”, “Provisiones”) y `Switch` “Solo incompletos”. Botón “Copiar de…” (menú con los otros dos segmentos) que **solo prellena el formulario**; no guarda ni llama RPC.

**Tablas:** una `TablaLista` por clase, con título de sección arriba (“Ingresos (18)”, “Deducciones (15)”, “Aportes patronales (4)”, “Provisiones (3)”). No se usa una sola tabla con 40 filas sin agrupar.

| Columna | Contenido | Alineación | Ancho |
| --- | --- | --- | --- |
| Concepto | Nombre + código en mono gris | izquierda | 32 % |
| Clase | Pill o texto gris | izquierda | 12 % |
| Cuenta de gasto | `SelectCampo` buscable (solo cuentas de detalle tipo gasto/costo) o “— / no aplica” | izquierda | 28 % |
| Cuenta de pasivo | `SelectCampo` buscable (solo pasivos de detalle) o “— / no aplica” | izquierda | 28 % |

- En `ingreso`: gasto obligatorio, pasivo deshabilitado (“No aplica”).
- En `deduccion`: pasivo obligatorio, gasto deshabilitado.
- En `aporte_empleador` y `provision`: ambos obligatorios.
- Cada fila modificada lleva un punto ámbar y un `aria-label` “Cambio sin guardar”.
- El botón “Guardar cambios” muestra el número de filas cambiadas (“Guardar 3 cambios”); si no hay cambios, está deshabilitado.
- El guardado envía **solo las filas cambiadas** en `mapeos`; el RPC devuelve cuántas guardó. Toast “Mapeo guardado: 3 filas.” Si el RPC devuelve un número distinto, se muestra “Se guardaron N filas” y se refresca.
- Validación: si una fila queda incompleta, el borde del selector se pinta `destructive` y el mensaje dice “El concepto SALARIO necesita cuenta de gasto en el segmento Administrativa.” No se guarda hasta completar.
- Si faltan conceptos (no debería por la semilla), se muestra un `Alert variant="destructive"`: “Faltan los conceptos de nómina. Revísalos en Configuración → Nómina → Conceptos.” con enlace.

**Estados:** cargando → `EsqueletoTabla` con 10 filas y tabs; vacío por filtro → “No hay conceptos con ese filtro.” sin CTA; error de carga → `Alert` con “No se pudo cargar el mapeo contable” + Reintentar; sin permiso → selects deshabilitados y aviso de solo lectura.

**Permisos:** `admin`/`contador` editan; `lector` solo lee.

### 3.3 Conceptos

**Ruta:** `/dashboard/configuracion/nomina/conceptos` · **RPC:** `nomina_crear_concepto`, `nomina_actualizar_concepto` · **Tabla:** `nomina_conceptos` (40 semilla).

**Layout:** `ContenedorLista`. Encabezado con “Nuevo concepto” (primario, solo admin/contador). Tabs por clase (`Todos`, `Ingresos`, `Deducciones`, `Aportes`, `Provisiones`) + `BuscadorLista` (“Buscar por código o nombre…”). `TarjetaLista` + `TablaLista`.

| Columna | Contenido | Alineación |
| --- | --- | --- |
| Código | Mono, mayúsculas (`SALARIO`) | izquierda |
| Nombre | Texto | izquierda |
| Clase | “Ingreso”, “Deducción”, “Aporte patronal”, “Provisión” | izquierda |
| TSS | `Check` primario 16 px con `aria-label="Grava TSS"` o `Minus` gris | centro |
| ISR | Ídem | centro |
| INFOTEP | Ídem | centro |
| Origen | “Sistema” (neutro) / “Personalizado” (info) | izquierda |
| Orden | Número, `tabular-nums` | derecha |
| Estado | Pill activo/inactivo | izquierda |
| Acciones | Lápiz “Editar” | centro |

- El buscador usa `q`; las tabs usan `clase` en la URL. Paginación servidor (25/50/100). La lista de 40 entra en una página, pero se pagina igual para respetar el patrón.
- **Diálogo “Nuevo concepto” / “Editar concepto”:**
  - Código: `Input` mayúsculas, `maxLength 40`, regex `^[A-Z][A-Z0-9_]{2,39}$`, ayuda “Mayúsculas, sin espacios. No se puede cambiar después.” En edición, solo lectura.
  - Nombre: obligatorio, máx. 120.
  - Clase: `SelectCampo`; en edición, deshabilitado.
  - `grava_tss`, `grava_isr`, `grava_infotep`: `Switch`; solo habilitados si clase = ingreso; en conceptos del sistema, deshabilitados. Ayuda “Solo un ingreso puede entrar en las bases.”
  - `orden`: `Input` numérico, entero ≥ 0; por defecto 100.
  - `activo`: `Switch`; deshabilitado en conceptos del sistema. Los conceptos del sistema **no se desactivan ni se borran**.
  - Si el concepto es del sistema, banner informativo: “Concepto del sistema: solo puedes cambiar el nombre y el orden.”
- Guardar: `nomina_crear_concepto` / `nomina_actualizar_concepto`; error de código duplicado se pinta inline en Código (“Ya existe un concepto con ese código.”). Toast “Concepto creado/actualizado.”
- No hay acción de eliminar; para un personalizado se usa “Desactivar” (switch) con confirmación.

**Estados:** vacío por filtro/búsqueda “No hay conceptos que coincidan.”; sin conceptos personalizados “Aún no hay conceptos personalizados.” + CTA; error de carga `Alert` + Reintentar; `lector` sin “Nuevo” ni acciones.

**Permisos:** `admin`/`contador` escriben; `lector` lee.

### 3.4 Parámetros legales RD por año

**Ruta:** `/dashboard/configuracion/nomina/parametros` · **RPC:** `nomina_guardar_parametros_rd` · **Tabla:** `nomina_parametros_rd` (2026 sembrado).

**Layout:** `ContenedorFormulario`. Encabezado con selector de año: `SelectCampo` (2000–2100) o flechas `‹ 2026 ›` + botón “Año actual”; badge “Vigente” si es el año actual, “Sembrado” si es 2026. Cuatro fichas resumen arriba (Salario mínimo, Tope SFS, Tope AFP, Tope SRL). Luego tarjetas:

1. **Salario y topes** (`salario_minimo`, `tope_sfs_mensual`, `tope_afp_mensual`, `tope_srl_mensual`): `InputGroup` RD$, obligatorios, > 0. Ayuda “El tope SFS es 10 salarios mínimos; el AFP, 20; el SRL, 4. Puedes ajustarlo, pero el cálculo usa el valor guardado.”
2. **Tasas** (`tasa_sfs_empleado`, `tasa_sfs_empleador`, `tasa_afp_empleado`, `tasa_afp_empleador`, `tasa_srl_tipo_1..4`, `tasa_infotep`): `InputGroup` %, 0–100, hasta 3 decimales. Se muestran agrupadas SFS / AFP / SRL / INFOTEP. La tasa SRL activa (la del riesgo configurado) se resalta con un chip “En uso”.
3. **Jornada** (`dias_mes_laboral`, `horas_dia_laboral`): numéricos > 0, 3 decimales. Ayuda “Se usan para el valor de la hora extra y las provisiones.”
4. **Escala de ISR anual**: 4 filas (`desde`, `hasta`, `tasa`, `monto_fijo`). `desde` de la primera fila = 0 y de las demás se calcula con el `hasta` anterior (solo lectura); `hasta` editable salvo la última (“En adelante”); `tasa` %; `monto_fijo` solo lectura y calculado como acumulado. “Agregar tramo” no está en fase 1: la escala es de 4 tramos. Validación: tramos ordenados, sin huecos ni solapes, último `hasta` nulo, `monto_fijo` acumulado correcto. El RPC es la última palabra. **Nota:** el cálculo de `monto_fijo` es de configuración tributaria, no de un recibo; la UI no usa ese valor para calcular nómina ni asientos.
5. **Nota de vigencia:** “Los recibos ya calculados no cambian si editas las tasas: el cálculo guarda sus bases y montos. Los periodos nuevos usan estos parámetros.”

**Año sin fila:** se muestra una tarjeta “Sin parámetros para 2027” con dos acciones: “Crear año a partir de {año anterior}” (prellena el formulario con la fila anterior; no guarda hasta confirmar) y “Cancelar”. Si el usuario intenta crear un periodo de ese año, el diálogo lo bloquea con “No hay parámetros legales para 2027. Créalos antes de calcular.” + enlace a esta página. El RPC también falla con “No hay parámetros de nómina para el año 2027.”

**Validaciones de pantalla:** todas las claves obligatorias; topes > 0; tasas 0–100; escala válida. Si el RPC devuelve error, se muestra en `Alert` y se enfoca la sección correspondiente (`id` de la tarjeta). Toast “Parámetros de 2027 guardados.”

**Estados:** cargando `EsqueletoFormulario`; año sin fila (vacío) con CTA; error de carga con Reintentar; `lector` solo lectura.

**Permisos:** `admin`/`contador` escriben; `lector` lee.

---

## 4. Inicio de Nómina

**Ruta:** `/dashboard/contabilidad/nomina` · **Lectura:** tablas `empleados`, `nomina_periodos`, `nomina_recibos`, `nomina_parametros_rd` (RLS) · **RPC:** ninguna de escritura (los CTA abren otras pantallas/diálogos).

**Layout:** `ContenedorLista`.
1. `EncabezadoPagina`: título “Nómina”, subtítulo “Empleados, periodos y aportes de ley en un solo lugar.”, migas. Acciones: “Crear periodo” (primario, admin/contador) y “Ver reporte TSS” (`outline`).
2. Fila de 4 tarjetas KPI (`grid gap-4 sm:grid-cols-2 xl:grid-cols-4`).
3. Grilla de 12 columnas: izquierda 7 (“Periodo a calcular” + “Últimos periodos”); derecha 5 (“Indicadores RD {año}” + “Estado de la nómina”).
4. Sin gráfica en fase 1. Si Waldy la pide, va debajo de los KPI: barras “Costo de nómina vs. pago” de los últimos 6 periodos, colores `--chart-1`/`--chart-2`, sin ejes decorativos.

**KPIs:**

| KPI | Valor | Contexto | Vacío |
| --- | --- | --- | --- |
| Empleados activos | `count(empleados.estado = 'activo')` | “N suspendidos” | “0 activos” |
| Total a pagar | `total_neto` del último periodo no anulado | “{Periodo}” o “Sin calcular” si está en borrador | “— · Sin periodos” |
| Costo de la empresa | `total_costo_empresa` del mismo periodo | “{porcentaje} % sobre el pago” si el neto es > 0; si no, “Ingresos + aportes + provisiones” | “— · Sin periodos” |
| Colillas enviadas | `x / y` del último periodo | “{Periodo}” | “— · Sin envíos” |

- Los KPIs no son clickables salvo el de colillas (lleva a Envíos del periodo) y el de empleados (lleva a Empleados).
- “Periodo a calcular”: tarjeta con el periodo sugerido según `frecuencia_defecto` y la fecha de hoy (quincena en curso o mes en curso). Muestra rango, frecuencia, cantidad de empleados elegibles y un botón “Crear periodo”. Si ya existe un periodo no anulado que se cruza, muestra “Ya existe {Periodo}” + “Ver periodo”. Si no hay parámetros para el año, muestra un `Alert` ámbar “No hay parámetros legales para {año}” + “Configurar parámetros”. Si no hay empleados activos de esa frecuencia: “No hay empleados activos en la frecuencia quincenal.” + “Ir a Empleados”.
- “Últimos periodos”: `TablaLista` compacta con 5 filas (Periodo, Rango, Empleados, Total a pagar, Estado) y enlace “Ver todos” arriba a la derecha. Sin paginación (son 5); si hay más, el enlace lleva a la lista.
- “Indicadores RD {año}”: tarjeta con lista de definición (`dl`) y valores a la derecha:
  - Salario mínimo: `RD$ 23,223.00`.
  - Tope SFS (10 salarios): `RD$ 232,230.00`.
  - Tope AFP (20 salarios): `RD$ 464,460.00`.
  - Tope SRL (4 salarios): `RD$ 92,892.00`.
  - SFS: `3.04 %` empleado / `7.09 %` empleador.
  - AFP: `2.87 %` empleado / `7.10 %` empleador.
  - SRL: `1.10 %` (Tipo I) — muestra el tipo configurado.
  - INFOTEP: `1.00 %` (o “No aplica”).
  - Enlace “Ver parámetros legales” (visible para todos) y “Ver escala de ISR” (ancla a la página de parámetros). Los valores de ejemplo son los de 2026; la tarjeta lee los del año mostrado.
  - Si no hay fila para el año: “Sin parámetros para {año}” + “Configurar” (admin/contador).
- “Estado de la nómina”: contadores por estado de periodo (`borrador`, `calculado`, `contabilizado`, `pagado`, `anulado`) con `PillEstado` y enlace a la lista filtrada. Si no hay periodos: “Todavía no hay periodos.”

**Estados:**

- Cargando: `loading.tsx` con encabezado `EsqueletoEncabezado`, 4 tarjetas `EsqueletoTarjetas` y dos bloques `Card` con `Skeleton`.
- Vacío: KPIs en “—”, tarjeta “Periodo a calcular” con CTA, “Últimos periodos” con `EstadoVacioLista` (“Todavía no hay periodos. Crea el primero para empezar.”).
- Error: `Alert` “No se pudo cargar el inicio de nómina” + “Reintentar”; los KPIs no muestran `0` engañoso.
- Sin permiso de escritura: “Crear periodo” oculto; el resto visible.
- Año sin parámetros: `Alert` ámbar persistente arriba de las tarjetas.

**Copy:** “Periodo a calcular”, “Ya existe {Periodo}”, “No hay parámetros legales para {año}”, “Configurar parámetros”, “Ver todos los periodos”, “Indicadores RD {año}”, “Sin periodos todavía”.

---

## 5. Empleados

### 5.1 Lista de empleados

**Ruta:** `/dashboard/contabilidad/nomina/empleados` · **Lectura:** `empleados` + `contactos` (RLS) · **Escritura:** ninguna en la lista.

**Layout:** `ContenedorLista`.
- `EncabezadoPagina`: título “Empleados”, subtítulo “Personas que reciben nómina en la empresa.”, migas. Acciones: “Nuevo empleado” (primario, admin/contador). “Importar” (`outline`, solo si la fase 1.5 está aprobada; oculto en fase 1).
- Tabs fuera de la tarjeta: **Activos**, **Suspendidos**, **Inactivos**, **Todos** (el número entre paréntesis). Se conectan a `?estado=`.
- `TarjetaLista` + `BarraLista`:
  - `BuscadorLista` “Buscar por nombre o identificación…” (267 px).
  - `SelectCampo` “Frecuencia: Todas / Quincenal / Mensual” (`?frecuencia=`).
  - `SelectCampo` “Segmento: Todos / Administrativa / Operativa / Ventas” (`?segmento=`).
  - Botón “Limpiar” (ghost) solo si hay filtros activos.
- `TablaLista` + `PaginadorLista`.

| Columna | Contenido | Alineación | Responsive |
| --- | --- | --- | --- |
| Empleado | `AvatarInicial` + nombre en 14/500; debajo, “Cédula 001-1234567-8” en 12 px gris | izquierda | siempre |
| Cargo | Texto o “—” | izquierda | `hidden md:table-cell` |
| Segmento | Texto (“Administrativa”) | izquierda | `hidden lg:table-cell` |
| Frecuencia | “Quincenal” / “Mensual” | izquierda | `hidden lg:table-cell` |
| Salario | `formatoMoneda(salario_mensual)` | **derecha** | siempre |
| Estado | `PillEstado`: Activo (exito), Suspendido (pendiente), Inactivo (neutro) | izquierda | siempre |
| Acciones | Lápiz “Editar” (88 px) | centro | siempre |

- `filaHref` → ficha del empleado. La acción “Editar” abre el wizard de edición.
- **No** se muestra la identificación como columna aparte: va en la celda del nombre para ahorrar ancho, como en Alegra.
- Orden por defecto: nombre ascendente. Búsqueda por nombre, apellidos e identificación; paginación por lotes (sin topes de 300/500/1 000).
- **Vacío real:** “¡Aún no tienes empleados!” / “Agrega tu primer empleado para empezar a calcular la nómina.” + CTA “Nuevo empleado” (solo si puede escribir).
- **Vacío por filtro/búsqueda:** “Sin resultados” / “La búsqueda no arrojó empleados.” Sin CTA; el pie se conserva.
- **Vacío de pestaña:** “No hay empleados suspendidos.” / “No hay empleados inactivos.” Sin CTA (la acción está arriba).
- **Cargando:** `EsqueletoLista` con tabs y 8 filas; toolbar visible.
- **Error:** `Alert` “No se pudo cargar la lista de empleados” + Reintentar.
- **Permisos:** `lector` ve la lista y la ficha; no ve “Nuevo empleado”, “Importar” ni el lápiz.
- **RPC:** ninguna; la lista se lee por consulta paginada.

### 5.2 Wizard de alta (3 pasos)

**Rutas:** `/empleados/nuevo` y `/empleados/[id]/editar` · **RPC:** `nomina_crear_empleado` / `nomina_actualizar_empleado`.

**Layout:** `ContenedorFormulario`.
1. `EncabezadoPagina`: “Nuevo empleado” / “Editar empleado”; subtítulo “Registra los datos personales, el contrato y la forma de pago.”; migas. Acción secundaria “Cancelar” (`outline`) a la derecha; el botón primario vive al final del paso.
2. **Stepper horizontal** en una tarjeta: 3 círculos + etiqueta “1. Datos personales”, “2. Contrato y salario”, “3. Banco y TSS”. El paso actual va en primario; los completados con `Check`; los pendientes en gris. Debajo, “Paso 1 de 3”. En móvil, stepper compacto (solo “Paso 1 de 3” + barra `Progress`).
3. Una `FormCard` por paso con `FormSectionTitle`, `FormGrid` de 2 columnas (1 en móvil) y `CampoFormulario`.
4. Barra inferior `FormActions`: “Atrás” (outline, oculto en paso 1), “Continuar” (primario, pasos 1–2), “Guardar empleado” (primario, paso 3) y “Guardar y crear otro” (outline, solo alta, paso 3). Mientras guarda: `Loader2` + “Guardando…”.

**Paso 1 — Datos personales**

| Campo | Componente | Obligatorio | Validación / ayuda |
| --- | --- | --- | --- |
| Tipo de identificación | `SelectCampo` | Sí | Cédula / Pasaporte / Residencia. |
| Número de identificación | `Input` | Sí | Cédula: 11 dígitos (se muestra con máscara `000-0000000-0`); el RPC valida el dígito verificador. Pasaporte/Residencia: texto no vacío. Ayuda “La cédula se valida con el dígito verificador.” |
| Primer nombre | `Input` | Sí | Máx. 80. |
| Segundo nombre | `Input` | No | Máx. 80. |
| Primer apellido | `Input` | Sí | Máx. 80. |
| Segundo apellido | `Input` | No | Máx. 80. |
| Municipio | `Input` | No | Texto libre, máx. 120 (el contrato lo permite nulo). |
| Dirección | `Input` | No | Máx. 300. |
| Teléfono | `Input` | No | `inputMode="tel"`, máx. 40. |
| Correo | `Input type="email"` | No | Formato `usuario@dominio.tld` si viene. Se usa para la colilla. |

- Nota fija debajo del paso: “También se crea o vincula el contacto en Contactos para que el empleado aparezca en el auxiliar por tercero.” (En edición: “Los cambios se sincronizan con el contacto vinculado.”)
- Validación del paso: requeridos + formato de cédula (11 dígitos) + correo. El dígito verificador se valida en el servidor al guardar; si falla, el error se pinta en “Número de identificación” con el mensaje exacto del RPC.

**Paso 2 — Contrato y salario**

| Campo | Componente | Obligatorio | Validación / ayuda |
| --- | --- | --- | --- |
| Tipo de contrato | `SelectCampo` | Sí | Indefinido / Definido. |
| Fecha de ingreso | `DatePicker` | Sí | Puede ser futura si el empleado aún no inicia; el periodo la usa para prorratear. |
| Fecha de fin | `DatePicker` | Sí si definido | Debe ser ≥ fecha de ingreso. Se oculta si es indefinido. |
| Frecuencia de pago | `SelectCampo` | Sí | Quincenal / Mensual. Ayuda “Un periodo solo incluye empleados de su frecuencia.” |
| Salario mensual | `InputGroup` RD$ | Sí | > 0, 2 decimales. Ayuda “Es el salario mensual del contrato; la quincena se calcula con la proporción exacta.” |
| Cargo | `Input` | No | Máx. 120. |
| Área | `Input` | No | Máx. 120. |
| Segmento contable | `SelectCampo` | Sí | Administrativa / Operativa / Ventas. Ayuda “Decide qué cuentas se usan en el asiento (mapeo contable).” |
| Centro de costo | `SelectCampo` buscable | No | Centros activos. Ayuda “Se copia a todas las líneas del asiento.” |

- El salario se muestra con la máscara `RD$`; al escribir se permiten separadores de miles y coma decimal, pero se envía un número con 2 decimales.
- Validación del paso: contrato, fecha de ingreso, frecuencia, salario, segmento; fecha de fin si definido; fecha de fin ≥ ingreso.

**Paso 3 — Banco y TSS**

| Campo | Componente | Obligatorio | Validación / ayuda |
| --- | --- | --- | --- |
| Método de pago | `SelectCampo` | Sí | Efectivo / Transferencia / Cheque. |
| Banco | `SelectCampo` buscable | Sí si transferencia | Lista de bancos RD + “Otra entidad” (revela un `Input`). Ayuda “Se usa para la colilla y el pago; no genera archivo bancario.” |
| Tipo de cuenta | `SelectCampo` | Sí si transferencia | Ahorros / Corriente. |
| Número de cuenta | `Input` | Sí si transferencia | Solo dígitos/guiones, máx. 40. |
| Clave TSS | `Input` | No | Exactamente 3 dígitos (`^[0-9]{3}$`). Ayuda “Clave de nómina del empleado ante la TSS.” |

- Si el método no es transferencia, los campos de banco se ocultan y se envían vacíos/nulos.
- Resumen lateral/inferior “Se guardará”: nombre completo, cédula, cargo, salario, frecuencia, segmento, método de pago. No muestra la cuenta completa (enmascara los últimos 4 dígitos: `•••• 6789`).
- Validación del paso: transferencia exige banco, tipo, número; clave TSS de 3 dígitos si viene. El RPC revalida.
- “Guardar y crear otro” limpia el formulario y vuelve al paso 1, conservando el foco en “Tipo de identificación”; toast “Empleado creado. Puedes registrar otro.”

**Estados y errores del wizard:**

- Cargando (edición): `EsqueletoFormulario` con el stepper.
- Error de guardado: `Alert variant="destructive"` arriba de la barra de acciones con el mensaje del RPC; si el error es de un campo, también inline. El wizard no se cierra.
- Cédula inválida: mensaje del RPC (“La comprobación del dígito verificador…”) en el campo; el paso 1 se marca en rojo en el stepper.
- Identificación duplicada: “Ya existe un empleado con esa identificación.” inline + `Alert`; no se pierde lo escrito.
- Transferencia incompleta: los tres campos en rojo con “Si el pago es por transferencia, indica el banco, el tipo y el número de cuenta.”
- Contrato definido sin fin: “El contrato definido necesita una fecha de fin.”
- `lector` que entra por URL directa: tarjeta “Solo lectura” con enlace a la ficha/lista; no se muestra el formulario.
- Salir con cambios: `AlertDialog` “Tienes cambios sin guardar” (“Seguir editando” / “Salir sin guardar”).
- Éxito: toast “Empleado creado.” / “Empleado actualizado.” y navegación a la ficha (o al paso 1 si “Guardar y crear otro”).

### 5.3 Ficha del empleado

**Ruta:** `/empleados/[id]` · **Lectura:** empleado + contacto + novedades + recibos · **RPC:** `nomina_cambiar_estado_empleado`, `nomina_guardar_novedad_recurrente`, `nomina_eliminar_novedad_recurrente`.

**Layout:** `ContenedorDetalle`.
1. Encabezado tipo ficha (no `EncabezadoPagina` genérico): avatar grande, nombre, `PillEstado` del estado, línea “{Cargo} · {Segmento} · Ingreso {dd/mm/aaaa}”. Acciones: “Nueva novedad” (primario, admin/contador), “Editar” (`outline`, abre el wizard), menú `⋮` con “Suspender”, “Marcar inactivo” (peligro) y “Reactivar” (si aplica).
2. Fila de 4 tarjetas KPI: Salario mensual (RD$), Frecuencia (“Quincenal”), Tiempo laborado (“1,026 días” — desde `fecha_ingreso` hasta hoy o hasta `fecha_fin` si el contrato terminó), Centro de costo / Segmento (“Administrativa · CC-01” o “Sin centro”).
3. `Tabs variant="line"` con **Datos**, **Novedades recurrentes**, **Recibos**.
4. Contenido de la tab en una tarjeta `bg-card border-border rounded-2xl`.

**Tab Datos:**
- Tres secciones con “Editar” cada una; el botón abre el wizard de edición completo (paso 1) con los datos precargados, y el usuario puede avanzar con “Continuar”. No hay edición en línea por sección en fase 1.
  - **Datos personales:** tipo y número de identificación, nombres, apellidos, municipio, dirección, teléfono, correo, enlace “Ver contacto”.
  - **Datos laborales:** tipo de contrato, fecha de ingreso, fecha de fin, frecuencia, salario, cargo, área, segmento, centro de costo, clave TSS.
  - **Pago:** método, banco, tipo de cuenta, número enmascarado, estado del contrato.
- Grid `dl` de 2–3 columnas; etiquetas 14/500, valores 14/400. Los vacíos muestran “—”.
- El contacto vinculado se muestra como enlace a `/dashboard/contactos/[id]`.
- No se muestran datos de ejemplo ni placeholders inventados.

**Tab Novedades recurrentes:**
- Cabecera: totales fijos por periodo (Σ ingresos recurrentes, Σ deducciones recurrentes) en dos chips; botones “Agregar ingreso” y “Agregar deducción” (uno primario, otro outline; admin/contador).
- `TablaLista` compacta: Concepto, Clase, Valor (montos a la derecha; porcentaje con `%`), Vigencia (“Desde 01/11/2026” / “Hasta 31/12/2026” / “Sin fin”), Estado (Activa/Inactiva), Acciones (lápiz “Editar”, “Apagar”).
- **Diálogo “Agregar/editar novedad recurrente”:**
  - Concepto: `SelectCampo` buscable, solo clase ingreso/deducción y conceptos activos; excluye `SALARIO`, `SFS`, `AFP`, `ISR` y las clases aporte/provisión. Muestra el nombre y el código.
  - Tipo de valor: `Tabs`/segmented “Monto” / “Porcentaje del salario”; exactamente uno.
  - Monto: `InputGroup` RD$, > 0. Porcentaje: `InputGroup` %, > 0 y ≤ 100.
  - `fecha_inicio`: `DatePicker` obligatoria; `fecha_fin`: `DatePicker` opcional, ≥ inicio.
  - `notas`: `Textarea` opcional.
  - `activa`: `Switch` (en edición).
  - Ayuda: “Se aplica una vez por periodo, sin prorrata. Si empieza a mitad de periodo, se paga completa.”
  - Guardar: `nomina_guardar_novedad_recurrente`; toast “Novedad agregada.” / “Novedad actualizada.”
- **Apagar:** `AlertDialog` “¿Apagar esta novedad?” / “No se borra: deja de aplicarse en los próximos periodos.” → `nomina_eliminar_novedad_recurrente`; toast “Novedad apagada.”
- Vacío: “No tiene novedades recurrentes.” / “Agrega un préstamo, un bono fijo o una pensión alimenticia.” + CTA.
- Error: `Alert` con el mensaje del RPC; si el concepto está inactivo, “El concepto está inactivo; actívalo en Configuración → Nómina → Conceptos.”

**Tab Recibos:**
- `TablaLista` compacta: Periodo (label + code), Días (right), Ingresos (right), Deducciones (right), Neto (right), Estado (pill), Asiento (`NO-3` link o “—”).
- Orden: periodo descendente. Paginación local si hay más de 10.
- Acción: fila abre el recibo; sin acciones extra.
- Vacío: “Todavía no tiene recibos.” / “Crea un periodo para calcular su nómina.” + enlace “Ir a Periodos”.
- **Cambios de estado (menú ⋮):**
  - “Suspender”: `AlertDialog` simple “¿Suspender a {Nombre}? No se incluirá en periodos nuevos.” → `nomina_cambiar_estado_empleado(estado = 'suspendido')`.
  - “Marcar inactivo”: `AlertDialog` con `DatePicker` opcional “Fecha de salida” (default hoy); el RPC usa hoy si no se indica. Texto “No se borra: deja de aparecer en periodos nuevos y su historial se conserva.”
  - “Reactivar”: si el contrato es indefinido, solo confirma; si es definido, pide `fecha_fin` futura con `DatePicker` y valida.
  - Toast “Empleado suspendido.” / “Empleado marcado inactivo.” / “Empleado reactivado.”; refresco.
- **Permisos:** `lector` no ve “Nueva novedad”, “Editar”, el menú ⋮ ni las acciones de la tabla de novedades; todo lo demás es lectura.

**Estados:** cargando `EsqueletoDetalle`; error `Alert` “No se pudo cargar la ficha” + Reintentar; empleado inexistente → `notFound()`.

### 5.4 Importación de empleados (fase 1.5, requiere aprobación)

> `docs/dominio-nomina.md` §12.4 deja la importación fuera de la fase 1. Esta sección define el diseño para cuando Waldy la apruebe. En fase 1 el botón “Importar” **no se muestra** y la ruta no existe en el menú. No se agrega una RPC masiva: cada fila usa `nomina_crear_empleado` y es su propia transacción.

**Ruta:** `/empleados/importar` · **RPC:** `nomina_crear_empleado` (una vez por fila).

**Layout:** `ContenedorFormulario`. Encabezado “Importar empleados” + migas. Tres pasos en una tarjeta:
1. **Archivo:** dropzone (`Input type="file"` estilizado) que acepta `.csv` UTF-8 (fase 1.5). Botón “Descargar plantilla” (genera el CSV con encabezados y una fila de ejemplo ficticia, sin datos reales). Límite: 100 filas y 5 MB. Ayuda “Una fila por empleado. Las columnas obligatorias están marcadas con *.” Si se quiere `.xlsx`, se necesita una dependencia de lectura; queda como decisión aparte.
2. **Revisión:** tabla de vista previa con las columnas clave (fila, nombre, identificación, cargo, salario, frecuencia, estado de la fila). Cada fila se marca:
   - `Listo` (exito), `Error` (peligro) con el motivo debajo, `Duplicado en el archivo` (peligro), `Ya existe` (pendiente, se detecta por identificación contra la base).
   - Validaciones de estructura: columnas obligatorias, cédula de 11 dígitos, correo con formato, salario > 0, fecha válida, transferencia con banco/tipo/cuenta, clave TSS de 3 dígitos, enums válidos. El **dígito verificador** de la cédula se confirma al importar con el RPC; la vista previa no lo replica.
   - Fila con error: no se puede seleccionar; checkbox deshabilitado.
   - Totales: “N listos, M con error”. Botón “Importar N empleados” (deshabilitado si no hay listos) y “Volver a cargar”.
3. **Resultado:** resumen “X empleados creados, Y con error.” Tabla de errores (fila, identificación, mensaje del RPC) + “Descargar errores (CSV)”. Si hubo creados, botón “Ver empleados”. La importación es **parcial**: las filas válidas se crean; las inválidas no. No hay rollback global porque no hay RPC masiva.

**Estados:** idle (dropzone), leyendo (spinner “Leyendo archivo…”), vista previa, importando (barra `Progress` “3 de 10”), terminado, error de archivo (“No se pudo leer el archivo. Verifica que sea CSV UTF-8 y que tenga los encabezados de la plantilla.”). Si el archivo supera 100 filas: “La plantilla admite hasta 100 empleados por archivo. Divide el archivo.” Si falta una columna obligatoria: “Falta la columna {nombre} en el archivo.”

**Permisos:** solo `admin`/`contador`; `lector` no ve la ruta. Si se entra por URL directa sin permiso, tarjeta “Solo lectura” o redirección a Empleados.

---

## 6. Periodos y cálculo

### 6.1 Lista de periodos

**Ruta:** `/periodos` · **Lectura:** `nomina_periodos` + conteo de recibos · **RPC:** `nomina_crear_periodo` (desde el diálogo).

**Layout:** `ContenedorLista`.
- `EncabezadoPagina`: “Periodos y cálculo”, subtítulo “Crea el periodo, revisa las novedades y calcula los recibos.”, migas. Acción “Crear periodo” (primario, admin/contador).
- `TarjetaLista` + `BarraLista`: `SelectCampo` “Año” (2024–2027 o el rango con datos), `SelectCampo` “Frecuencia” (Todas / Quincenal / Mensual) y `SelectCampo` “Estado” (Todos / Borrador / Calculado / Contabilizado / Pagado / Anulado). Sin buscador en fase 1 (la lista se filtra por año, frecuencia y estado). “Limpiar” si hay filtros.
- `TablaLista` + `PaginadorLista`.

| Columna | Contenido | Alineación | Responsive |
| --- | --- | --- | --- |
| Periodo | `16–30 nov 2026` en 14/500; debajo el código `2026-11-Q2` en mono 12 gris | izquierda | siempre |
| Frecuencia | “Quincenal” / “Mensual” | izquierda | `hidden lg:table-cell` |
| Empleados | Número de recibos no anulados | derecha | siempre |
| Salario | `total_salario` | **derecha** | `hidden md:table-cell` |
| Total a pagar | `total_neto` | **derecha** | siempre |
| Costo de la empresa | `total_costo_empresa` | **derecha** | `hidden xl:table-cell` |
| Estado | Pill: Borrador (neutro), Calculado (pendiente), Contabilizado (info), Pagado (exito), Anulado (peligro) | izquierda | siempre |
| Acciones | Ojo “Ver periodo” | centro | siempre |

- `filaHref` → detalle del periodo.
- Orden: `fecha_inicio` descendente.
- **Vacío real:** “Todavía no hay periodos de nómina.” / “Crea el primero para calcular los recibos del mes o de la quincena.” + CTA.
- **Vacío por filtro:** “Sin resultados” / “No hay periodos con ese año, frecuencia y estado.” (sin CTA).
- **Cargando:** `EsqueletoLista` con 6 filas y 3 filtros.
- **Error:** `Alert` + Reintentar.
- **Permisos:** `lector` ve la lista y el detalle; no ve “Crear periodo”.

**Diálogo “Crear periodo”:** `DialogContent sm:max-w-lg`.
- `frecuencia`: `SelectCampo` (Quincenal / Mensual), inicializado con `frecuencia_defecto`.
- `Año`: `SelectCampo` o `Input` numérico (2024–2027, según el selector de la lista).
- `Mes`: `SelectCampo` con los 12 meses en español.
- `Quincena`: `SelectCampo` solo si es quincenal: “Primera (1–15)”, “Segunda (16–fin de mes)”; si es mensual: “Mes completo (1–fin de mes)”.
- Vista previa calculada **solo de fechas** (no de dinero): “16–30 de noviembre de 2026 · código 2026-11-Q2” y “Se crearán recibos en borrador para los empleados activos de frecuencia quincenal, con sus novedades recurrentes vigentes como vista previa.”
- `fecha_pago`: `DatePicker` opcional; por defecto `fecha_fin`. Ayuda “Es la fecha prevista; el pago real puede usar otra.”
- `observaciones`: `Textarea` opcional.
- Si no hay parámetros legales para el año: `Alert` ámbar “No hay parámetros legales para {año}.” + enlace “Configurar parámetros”; el botón “Crear periodo” queda deshabilitado.
- Si ya existe un periodo no anulado de la misma frecuencia que se cruza: `Alert` “Ya existe un periodo de nómina que se cruza con estas fechas.” + enlace “Ver periodo”.
- Si no hay empleados elegibles: el RPC fallará; la UI muestra el mensaje “No hay empleados activos para esa frecuencia.” en el `Alert` (no se inventa una lista vacía).
- Botones: “Cancelar” / “Crear periodo”. Durante la transición, `Loader2` + “Creando…”. Éxito: toast “Periodo creado: 2 recibos en borrador.” y navegación al detalle.
- Errores del RPC (rango no estándar, cruce, duplicado, sin parámetros) se muestran en el `Alert` con el mensaje exacto.

### 6.2 Detalle del periodo

**Ruta:** `/periodos/[id]` · **Lectura:** `nomina_resumen_periodo` (incluye anulados) + periodo · **RPC:** `nomina_agregar_empleados`, `nomina_calcular_periodo`, `nomina_contabilizar_periodo`, `nomina_pagar_periodo`.

**Layout:** `ContenedorLista`.
1. `EncabezadoPagina`: título “Periodo 16–30 de noviembre de 2026” (o “Periodo {código}”), subtítulo “Quincenal · Código 2026-11-Q2 · Pago previsto 30/11/2026”, migas. `PillEstado` al lado del título (como badge). Acciones (orden):
   - “Agregar empleados” (`outline`, si `borrador`/`calculado`).
   - “Calcular nómina” (`outline` o primario si hay borradores; si no, deshabilitado).
   - “Contabilizar” (`outline`, solo si todos los no anulados están al menos calculados).
   - “Pagar” (`outline`, solo si todos los no anulados están contabilizados o pagados).
   - “Enviar recibos” (`outline`, si hay recibos calculados/contabilizados/pagados).
   - Menú `⋮` con “Ver pagos del periodo” y “Ver asientos”.
   - Los botones deshabilitados llevan `Tooltip` con el motivo (“Calcula la nómina antes de contabilizar”, “Todos los recibos deben estar contabilizados para pagar”).
   - **Regla de jerarquía:** el botón que corresponde al siguiente paso del ciclo es el **primario** (Calcular si hay borradores; Contabilizar si todo está calculado; Pagar si todo está contabilizado). Los demás son `outline`. Nunca hay dos primarios en la misma cabecera.
   - **Reglas de visibilidad:** “Calcular” solo si hay al menos un recibo en `borrador`/`calculado` y el periodo no está contabilizado, pagado ni anulado. “Contabilizar” solo si hay al menos un no anulado, el periodo no está anulado y todos los no anulados están al menos `calculado`. “Pagar” solo si hay al menos un `contabilizado` y todos los no anulados están `contabilizado`/`pagado`. “Enviar recibos” solo si hay al menos un recibo en `calculado`/`contabilizado`/`pagado`. Si no aplica, el botón se oculta (no se muestra deshabilitado sin motivo).
2. **Barras de progreso** en una tarjeta: “Cálculo {calculados}/{total}” y “Contabilización {contabilizados}/{total}”, con `Progress` primario y texto 12 px. Los anulados no cuentan. Si no hay recibos, “Sin recibos”.
3. **Tarjetas de resumen** (`grid sm:grid-cols-2 xl:grid-cols-5`): Empleados (count), Total ingresos (right), Total deducciones (right), Total a pagar (right, énfasis), Costo de la empresa (right). Valores con `formatoMoneda`; “—” si no hay cálculo.
4. **Banner de estado**:
   - `borrador`: `Alert` info “Los recibos están en borrador. Revisa las novedades y calcula la nómina; los montos aún no son definitivos.”
   - `calculado`: “Nómina calculada. Revisa los recibos y contabiliza cuando estén listos.”
   - `contabilizado`: “Comprobantes NO generados. El pago está habilitado.”
   - `pagado`: “Nómina pagada. Puedes enviar las colillas o consultar los asientos.”
   - `anulado`: `Alert` neutro “Todos los recibos están anulados.”
   - Si hay requisitos faltantes para contabilizar: `Alert` ámbar con checklist: “Falta la cuenta de salarios por pagar” (enlace a Config laboral), “Falta el mapeo del concepto {CÓDIGO} en {segmento}” (enlace a Mapeo), “No hay tipo de entrada NO activo” (enlace a Tipos de entrada). El botón Contabilizar se deshabilita con el motivo.
5. **Tabla de recibos** (`TablaLista` + `PaginadorLista` o paginación local si son pocos; usar la del patrón):

| Columna | Contenido | Alineación | Responsive |
| --- | --- | --- | --- |
| Empleado | Avatar + nombre 14/500; debajo cargo 12 gris | izquierda | siempre |
| Días | `dias_trabajados` con 3 decimales | derecha | `hidden md:table-cell` |
| Salario base | `salario_base` | **derecha** | `hidden lg:table-cell` |
| Ingresos | `total_ingresos` | **derecha** | siempre |
| Deducciones | `total_deducciones` | **derecha** | siempre |
| Neto | `neto_pagar` en 14/600 | **derecha** | siempre |
| Costo empresa | `costo_total_empresa` | **derecha** | `hidden xl:table-cell` |
| Estado | Pill del recibo | izquierda | siempre |
| Comprobante | `asiento_codigo` (`NO-3`) en mono + enlace; “—” si no | izquierda | `hidden md:table-cell` |
| Acciones | Ojo “Ver recibo” | centro | siempre |

- `filaHref` → recibo. Los recibos anulados se muestran con opacidad 60 %, pill “Anulado” y montos en gris; **no suman** en el pie. El pie muestra “Totales del periodo” con las sumas de ingresos, deducciones, neto y costo; salario y días no se suman (se muestra “—” o se omiten).
- **Vacío:** “Sin recibos en este periodo.” / “Agrega empleados activos de la frecuencia quincenal.” + CTA “Agregar empleados” (si puede escribir).
- **Cargando:** `EsqueletoDetalle` con 5 tarjetas + `EsqueletoTabla` de 6 filas.
- **Error:** `Alert` “No se pudo cargar el periodo” + Reintentar; si el periodo no existe, `notFound()`.
- **Permisos:** `lector` no ve los botones de acción; la tabla y el resumen son lectura.

**Diálogo “Agregar empleados”:**
- Lista de empleados activos de la frecuencia del periodo, con checkbox; busca por nombre. Muestra “Se agregará” / “Ya tiene recibo en {periodo}” (deshabilitado) / “Se reactivará” si el recibo está anulado (la RPC lo revive).
- Selección múltiple; contador “2 seleccionados”. Botón “Agregar 2 empleados” → `nomina_agregar_empleados`.
- Éxito: toast “2 empleados agregados al periodo.”; refresco. Si la RPC salta a alguien, el toast dice “Se agregaron 1; 1 ya tenía recibo en un periodo que se cruza.”
- Si no hay elegibles: “No hay empleados activos para agregar.” + enlace a Empleados.

**Diálogo “Calcular nómina”:**
- Título “Calcular la nómina del periodo”; texto “Se recalcularán N recibos en borrador o calculados. Las novedades manuales se conservan.” Si `registrar_provisiones` está activo, línea adicional “Se incluirán las provisiones de regalía, vacaciones y cesantía.”
- Botones “Cancelar” / “Calcular nómina”. Éxito: toast “Nómina calculada: N recibos · Neto RD$ X · Costo RD$ Y.” (los totales vienen de la respuesta del RPC) y refresco.
- Error: `Alert` con el mensaje del RPC (p. ej. “Las deducciones (RD$ X) superan los ingresos (RD$ Y) del recibo de {nombre}.”); el diálogo se queda abierto.

**Diálogo “Contabilizar”:**
- Título “Contabilizar la nómina”; texto “Se creará un comprobante NO por cada empleado con recibo calculado. Los ya contabilizados se omiten.” + lista corta de empleados y total estimado del asiento (suma de `costo_total_empresa` ya calculada; no se recalcula).
- Nota “El número NO se asigna al confirmar; se mostrará el código al terminar.”
- Botones “Cancelar” / “Contabilizar”. Éxito: toast “N comprobantes NO creados por RD$ X.” con acción “Ver asientos” (enlace a `/dashboard/contabilidad/asientos`, filtrado por origen si el listado lo permite; si no, al listado general). Refresco.
- Error de periodo cerrado: `Alert` con el mensaje del trigger + enlace “Ver periodos contables” (`/dashboard/contabilidad/periodos`). Error de mapeo: “Falta el mapeo del concepto {CÓDIGO} en el segmento {segmento}.” + enlace a Mapeo.
- No hay un botón “Anular periodo”; para corregir se anulan recibos uno por uno.

**Diálogo “Pagar” (periodo):**
- Título “Pagar la nómina del periodo”; texto “Se pagarán N recibos contabilizados. Total a pagar: RD$ X.”
- `fecha_pago`: `DatePicker` default hoy.
- `cuenta_pago_id`: `SelectCampo` buscable de cuentas caja/banco activas; default `cuenta_pago_defecto_id` si existe.
- Resumen del asiento: “Dr Salarios por pagar (2107) / Cr {cuenta} por RD$ X.” (una línea por recibo; no consolida).
- Botón “Pagar N recibos” deshabilitado si algún recibo no está contabilizado; el texto explica “Falta contabilizar {n} recibos.” con enlace al periodo.
- Éxito: toast “N recibos pagados por RD$ X.” + enlace “Ver pagos del periodo”.
- Si neto = 0 en un recibo, se indica “Sin asiento de pago (neto 0).”

### 6.3 Recibo de pago

**Ruta:** `/recibos/[id]` · **Lectura:** recibo + líneas + periodo + empleado + asientos · **RPC:** las de §0 fila 9.

**Layout:** `ContenedorDetalle`.
1. `EncabezadoPagina`: título “Recibo de {Nombre}”, subtítulo “{Periodo} · {Código} · {Cargo}”, migas. `PillEstado` al lado. Acciones según estado:
   - “Imprimir colilla” (`outline`, siempre; lleva a la colilla).
   - “Calcular” / “Recalcular” (primario si `borrador`; outline si `calculado`).
   - “Contabilizar” (`outline`, solo `calculado`).
   - “Pagar” (`outline`, solo `contabilizado` y con cuenta de pago disponible).
   - Menú `⋮`: “Anular pago” (solo `pagado`), “Anular recibo” (si no está `pagado`), “Ver asiento NO”, “Ver pago”.
   - Deshabilitados con `Tooltip` del motivo.
2. **Aviso de totales no definitivos:** si el estado es `borrador` y hay líneas, `Alert` ámbar “Hay cambios sin recalcular. Los totales no son definitivos.” con botón “Recalcular ahora”.
3. **Tarjetas de resumen** (`grid sm:grid-cols-2 xl:grid-cols-4`): Días trabajados (3 decimales), Total ingresos (right), Total deducciones (right), Neto a pagar (right, énfasis). Debajo, una tarjeta de ancho completo “Costo total de la empresa” con el monto a la derecha y la ayuda “Ingresos + aportes patronales + provisiones. No es el desembolso de caja: las retenciones del empleado se enteran a TSS/DGII o al empleado.”
4. **Dos columnas** (`grid gap-4 xl:grid-cols-2`): **Ingresos** y **Deducciones**. Cada una es una tarjeta con título, total a la derecha, botón “Agregar ingreso”/“Agregar deducción” (solo si el recibo es editable) y `TablaLista densidad="compacta"`.
5. **Aportes patronales** y **Provisiones** en otra fila de dos columnas, solo lectura. Si no hay, “Sin aportes patronales” / “Sin provisiones” (no una tabla vacía gigante).
6. **Bases de cálculo** en un `Collapsible` “Ver bases de cálculo”: `dl` con Base TSS, Base SFS, Base AFP, Base SRL, Base INFOTEP, Base ISR; valores a la derecha y ayuda “Son snapshots del cálculo; no se editan.”
7. Si el recibo está `anulado`: banner `Alert` neutro “Recibo anulado. Su asiento original se conserva como traza y la reversa está en el libro.” Se ocultan las acciones de escritura.

**Tabla de Ingresos** (compacta):

| Columna | Contenido | Alineación |
| --- | --- | --- |
| Concepto | Nombre + código en mono 12 gris; pill de origen (Sistema/Recurrente/Manual) | izquierda |
| Cantidad | Días u horas, 3 decimales; “—” si no aplica | derecha |
| Base / % | “—” o el porcentaje (135 %, 200 %) | derecha |
| Monto | `formatoMoneda` | **derecha** |
| Acciones | Lápiz “Editar” y papelera “Quitar” solo en líneas `manual`; en sistema/recurrente, “—” | centro |

**Tabla de Deducciones** (compacta): Concepto (nombre/código/origen), Porcentaje (right), Monto (right), Acciones (solo manual).

**Tabla de Aportes patronales** (compacta): Concepto, Base, Monto. Sin acciones.
**Tabla de Provisiones** (compacta): Concepto, Base, Monto. Sin acciones.

- Las líneas `sistema` y `recurrente` **no** se editan ni se borran desde la UI; se regeneran al calcular. La papelera solo aparece en `manual`, con tooltip “Quitar novedad del recibo”.
- Las líneas manuales de horas extra muestran `cantidad` (horas) y el monto; el porcentaje informativo 135/200 se ve en “Base / %”.
- El origen “Recurrente” en el borrador es un preview; al calcular se regenera desde la ficha. Una nota al pie de la tabla lo dice.

**Diálogo “Agregar/editar novedad del recibo”:**
- Concepto: `SelectCampo` buscable; solo ingresos/deducciones activos; los conceptos de sistema están excluidos **salvo** `HORAS_EXTRA_35` y `HORAS_EXTRA_100`. Si el recibo ya tiene una línea manual seleccionada, se precarga.
- Si el concepto es horas extra:
  - Campo “Horas” (`Input` decimal, 3 decimales, > 0).
  - Bloque de fórmula visible: “Salario mensual del contrato ÷ 23.83 ÷ 8 × 1.35 × horas” (o × 2.00). Se muestran los datos del contrato (salario mensual) y el porcentaje.
  - **No se muestra un monto calculado en el cliente.** Al pulsar “Agregar al recibo”, el RPC `nomina_guardar_novedad_recibo` devuelve `{ linea_id, monto }`; el monto devuelto se muestra en el toast (“Horas extra agregadas: RD$ 2,124.42”) y en la tabla. Así el cálculo visible es el del servidor.
- Si no es horas extra:
  - Tipo de valor: “Monto” / “Porcentaje del salario” (segmented).
  - Monto: `InputGroup` RD$; porcentaje: `InputGroup` % (0–100). Exactamente uno.
  - `notas`: opcional.
- Al guardar, si el recibo estaba `calculado`, el RPC lo devuelve a `borrador`; el diálogo lo advierte: “Al agregar una novedad, el recibo vuelve a borrador y debes recalcular para actualizar los totales.” El botón “Agregar” confirma. Después del éxito, se muestra el banner de totales no definitivos.
- Eliminar una línea manual: `AlertDialog` “¿Quitar esta novedad?” / “El recibo vuelve a borrador y debes recalcular.” → `nomina_eliminar_novedad_recibo`.
- Errores: “Las deducciones superan los ingresos…”, “El concepto está inactivo…”, “No puedes agregar el concepto SALARIO como novedad manual.” Se muestran en el `Alert` del diálogo.

**Acciones del recibo:**

- **Calcular/Recalcular:** confirmación simple “Se recalcularán los días, las bases y los totales. Las novedades manuales se conservan.”; `nomina_calcular_recibo`; toast “Recibo calculado.” y refresco. El RPC devuelve el id; los montos se leen de la vista ya recalculada, no se inventan en el toast.
- **Contabilizar:** `Dialog` de confirmación:
  - Título “Contabilizar el recibo de {Nombre}”.
  - Texto “Se creará un comprobante NO con fecha {fecha_fin del periodo}. El número se asigna al confirmar.”
  - Resumen del comprobante: empleado, periodo, cantidad de líneas del recibo con monto > 0, total de ingresos, aportes patronales, provisiones y **total del comprobante** (el `costo_total_empresa` ya calculado). No se replica línea por línea la lógica interna del asiento en el cliente; la fuente de verdad es el asiento que crea la RPC.
  - Si el mapeo o la cuenta de salarios por pagar están incompletos, se muestra el error antes de llamar, con enlace a Configuración → Nómina. Si el periodo contable está cerrado, el error del trigger se muestra completo y con enlace a Periodos contables.
  - Botones “Cancelar” / “Contabilizar”. Éxito: toast “Comprobante {NO-3} creado.” + enlace “Ver asiento”; refresco. El código NO viene del asiento devuelto, no se adivina.
  - Si el usuario quiere ver el detalle contable, el enlace “Ver asiento” abre el asiento real con todas sus líneas.
- **Pagar:** `Dialog` “Pagar el recibo de {Nombre}”:
  - `fecha_pago` (`DatePicker`, default hoy), `cuenta_pago_id` (`SelectCampo` de cuentas caja/banco activas, default config).
  - Resumen “Se debitará {cuenta_salarios_por_pagar del recibo} (2107) y se acreditará {cuenta} por RD$ {neto}.” Si `neto = 0`, “No se crea asiento de pago; el recibo queda pagado.”
  - Botón “Pagar” deshabilitado si el estado no es `contabilizado`, con texto “El recibo no está contabilizado; no se puede pagar.” (mismo mensaje del RPC).
  - Éxito: toast “Recibo pagado.” + enlace “Ver asiento de pago”.
- **Anular pago:** `AlertDialog` destructivo: “¿Anular el pago de {Nombre}? Se creará un asiento de anulación con fecha de hoy y el recibo volverá a Contabilizado.” → `nomina_anular_pago_recibo`.
- **Anular recibo:** `AlertDialog` destructivo: “¿Anular el recibo de {Nombre}? Se revertirá el comprobante {NO-N} si estaba contabilizado. Esta acción no se puede deshacer.” Si está `pagado`, el botón está deshabilitado y el texto dice “Anula primero el pago.” → `nomina_anular_recibo`.
- Toast de anulación con el código del asiento de reversa si el RPC lo devuelve; si no, “Recibo anulado.” y refresco.

**Estados:** cargando `EsqueletoDetalle` + 2 `EsqueletoTabla`; error `Alert` + Reintentar; no encontrado `notFound()`; `lector` sin acciones de escritura (solo “Imprimir colilla” y enlaces a asientos).

### 6.4 Reglas transversales del ciclo

- El periodo y el recibo muestran el estado **derivado**; no hay selector de estado. No se “marca pagado” a mano.
- Cualquier cambio en un recibo (novedad, cálculo, contabilización, pago, anulación) refresca el periodo y su estado; la UI no lo calcula.
- Un recibo `anulado` no se revive desde la ficha; solo `nomina_agregar_empleados` puede revivirlo. La UI lo dice en el diálogo.
- Si el periodo está `anulado`, no se agregan empleados, no se calcula, no se contabiliza y no se paga.
- La fecha del asiento de nómina es `periodo.fecha_fin`; la del pago la elige el usuario; la de anulación es hoy. La UI no permite cambiarlas fuera de esos campos.

---

## 7. Pagos de nómina

### 7.1 Lista de pagos

**Ruta:** `/pagos` · **Lectura:** periodos + recibos · **RPC:** ninguna en la lista (los pagos se ejecutan en el detalle).

**Layout:** `ContenedorLista`.
- `EncabezadoPagina`: “Pagos de nómina”, subtítulo “Registra la salida de caja o banco de los recibos contabilizados.”, migas. Sin acción primaria (el pago se hace en el detalle); botón “Ver periodos” (`outline`) a Periodos.
- `BarraLista`: `SelectCampo` “Año”; `SelectCampo` “Estado de pago” (Todos / Pendiente / Parcial / Pagado / No disponible). Sin buscador.
- `TablaLista` + `PaginadorLista`.

| Columna | Contenido | Alineación |
| --- | --- | --- |
| Periodo | `16–30 nov 2026` + código mono | izquierda |
| Empleados | Número de recibos no anulados | derecha |
| Total a pagar | `total_neto` | **derecha** |
| Costo de la empresa | `total_costo_empresa` | **derecha** (`hidden xl`) |
| Pagados | `x / y` | derecha |
| Estado de pago | Pill: Pendiente (neutro), Parcial (pendiente), Pagado (exito), No disponible (neutro) | izquierda |
| Fecha de pago | La última `fecha_pagado` si todos pagados; si no, “—” | izquierda (`hidden md`) |
| Acciones | Ojo “Ver pagos” | centro |

- El “Estado de pago” se deriva de los recibos no anulados: todos `pagado` → Pagado; algunos → Parcial; ninguno y el periodo no está contabilizado → No disponible; ninguno y está contabilizado → Pendiente.
- `filaHref` → detalle de pagos.
- **Vacío real:** “No hay pagos registrados.” / “Cuando contabilices un periodo podrás pagarlo desde aquí.” + enlace “Ir a Periodos”.
- **Vacío por filtro:** “Sin resultados” / “No hay periodos con ese estado.”
- **Cargando:** `EsqueletoLista` (6 filas, 2 filtros).
- **Error:** `Alert` + Reintentar.
- **Permisos:** `lector` ve la lista y el detalle; no ve “Pagar” ni “Anular pago”.

### 7.2 Detalle de pagos del periodo

**Ruta:** `/pagos/[periodoId]` · **RPC:** `nomina_pagar_periodo`, `nomina_pagar_recibo`, `nomina_anular_pago_recibo`.

**Layout:** `ContenedorLista`.
1. `EncabezadoPagina`: “Pagos del periodo 16–30 de noviembre de 2026” (o “Pagos de {código}”), subtítulo “{x} de {y} recibos pagados · Total pagado RD$ X.”, migas. Acciones: “Pagar todo” (primario, solo si hay al menos un recibo `contabilizado` y todos los no anulados están `contabilizado`; si hay pagados, “Pagar pendientes”) y “Volver al periodo” (`outline`). Si todos los no anulados ya están `pagado`, “Pagar todo” no se muestra.
2. Tarjeta de progreso “Pagos {pagados}/{total}” con `Progress`, y tres chips: Pendientes, Pagados, Anulados.
3. `TablaLista` con pie de total:

| Columna | Contenido | Alineación |
| --- | --- | --- |
| Empleado | Avatar + nombre; debajo cargo | izquierda |
| Neto | `neto_pagar` | **derecha** |
| Estado | Pill del recibo (contabilizado/pagado/anulado) | izquierda |
| Fecha de pago | `fecha_pagado` o “—” | izquierda |
| Asiento de pago | Enlace “Ver asiento” si `pago_asiento_id`; “Sin asiento (neto 0)” si pagado con neto 0; “—” si no | izquierda |
| Acciones | “Pagar” (`outline`, si `contabilizado`), “Anular pago” (ghost, si `pagado`) | centro |

- El pie suma el neto de los recibos no anulados (suma de valores ya calculados; no recalcula).
- Si hay recibos en `borrador`/`calculado`, se muestran con pill y el botón “Pagar todo” deshabilitado con tooltip “Contabiliza el periodo antes de pagar.” y un enlace “Ir al periodo”.
- **Pagar todo:** `Dialog` con fecha, cuenta y resumen “N recibos · Total RD$ X”. Texto “Se pagarán solo los recibos contabilizados; los ya pagados se omiten.” (la RPC exige que todos estén contabilizados/pagados). Éxito: toast “N recibos pagados por RD$ X.” y refresco.
- **Pagar individual:** mismo `Dialog` que en el recibo (componente compartido), con el neto y la cuenta de salarios del recibo.
- **Anular pago:** mismo `AlertDialog` que en el recibo; al terminar, el recibo vuelve a `contabilizado` y la fila se actualiza.
- **Vacío:** si el periodo no tiene recibos no anulados, “Sin recibos para pagar.” + enlace al periodo.
- **Cargando:** `EsqueletoDetalle` con progreso + `EsqueletoTabla`.
- **Error:** `Alert` + Reintentar.
- **Permisos:** `lector` solo lectura; no ve acciones.

---

## 8. Envíos y colilla imprimible

### 8.1 Envíos de colillas

**Ruta:** `/envios` · **Lectura:** recibos (`colilla_enviada_en`, `colilla_enviada_a`) + empleados · **RPC:** `nomina_registrar_envio_colillas`.

**Aviso de fase 1 (obligatorio):** el contrato dice que la RPC **no envía correo**, solo registra la constancia. La UI lo dice sin ambigüedad:
> “La constancia de envío se guarda en el sistema. El envío por correo se habilitará cuando se configure un proveedor; por ahora no sale ningún correo.”

Se muestra como `Alert` informativo en la parte superior de la pantalla (no se puede cerrar) y se repite en el diálogo de confirmación. El botón se llama **“Registrar envío”**, no “Enviar colillas”. Cuando 3E conecte el proveedor, el texto y el botón cambian a “Enviar colillas”; la estructura no cambia.

**Layout:** `ContenedorLista`.
- `EncabezadoPagina`: “Envíos de colillas”, subtítulo “Consulta y registra la entrega de las colillas de pago.”, migas. Acción “Ver periodos” (`outline`).
- `BarraLista`: `SelectCampo` “Año”; `SelectCampo` “Estado” (Todos / Pendiente / Parcial / Enviado). Sin buscador.
- `TablaLista` + `PaginadorLista`.

| Columna | Contenido | Alineación |
| --- | --- | --- |
| Periodo | `16–30 nov 2026` + código mono | izquierda |
| Empleados | Recibos enviables (calculado/contabilizado/pagado) | derecha |
| Colillas enviadas | `x / y` | derecha |
| Último envío | `formatoFechaHora(colilla_enviada_en)` más reciente o “—” | izquierda (`hidden md`) |
| Estado | Pill: Pendiente (neutro), Parcial (pendiente), Enviado (exito) | izquierda |
| Acciones | “Registrar envío” (`outline`, si hay pendientes) y ojo “Ver detalle” | centro |

- `filaHref` → abre el diálogo de detalle (no una página aparte).
- **Detalle del periodo (diálogo `sm:max-w-2xl`):**
  - Título “Colillas del periodo {Periodo}”.
  - Tabla con `seleccion` (checkbox): Empleado, Correo, Estado del recibo, Última colilla enviada. Los empleados sin correo se muestran con pill “Sin correo” y checkbox deshabilitado; tooltip “Agrega un correo en la ficha para poder registrar el envío.”
  - “Seleccionar todo” en la cabecera; contador “2 seleccionados”.
  - Campo “Registrar como enviado a” (`Input` email, opcional): si se llena, se usa ese destinatario para todos los seleccionados; si se deja vacío, se usa el correo de cada empleado. Si algún seleccionado no tiene correo y el campo está vacío, el botón se deshabilita con “Falta el correo de 1 empleado.”
  - Botón “Registrar envío” → segundo `AlertDialog` “Se registrará la constancia de envío de 2 colillas. Aún no se envía correo.” → RPC.
  - Éxito: toast “2 colillas registradas como enviadas.” y refresco del diálogo/lista.
- **Vacío:** “Todavía no se han enviado colillas.” / “Selecciona un periodo y registra el envío.” + CTA “Ver periodos” (si puede escribir).
- **Vacío por filtro:** “Sin resultados”.
- **Cargando:** `EsqueletoLista`.
- **Error:** `Alert` + Reintentar.
- **Permisos:** `lector` ve el historial y el detalle, pero no el checkbox ni “Registrar envío”.

### 8.2 Colilla imprimible (PDF con `DocumentoPapel`)

**Ruta:** `/recibos/[id]/colilla` · **Sin RPC** (usa el recibo ya calculado) · **Impresión:** `DocumentoPapel` + `window.print()`.

**Decisión de diseño:** la colilla es un documento **para el empleado**. Muestra ingresos, deducciones y neto; **no** muestra el costo de la empresa, las provisiones ni los aportes patronales (son información de la empresa y confundirían al empleado). Esos datos viven en el detalle del recibo. Si Waldy quiere una “colilla para la empresa”, se agrega una segunda variante; no se mezcla.

**Extensión de `DocumentoPapel`:** agregar `tipo: "colilla"` al union de props con `colilla: ColillaVista` y un `ContenidoColilla` dentro del mismo `<article>` de papel (mismas clases de hoja: `min-h-[10.98in]`, `px-[16pt]`, `pt-[28pt]`, `text-[10pt]`, `text-[#0a2352]`, Inter). El resto de las variantes no cambia. `ColillaVista` vive en `src/lib/nomina/tipos.ts` y se arma en el servidor con el recibo, el empleado, el periodo y la empresa.

**Contenido del papel (en este orden):**
1. Encabezado: logo de la empresa (si la plantilla lo permite), nombre, RNC, dirección/correo; a la derecha “Colilla de pago” y “Periodo 16–30 nov 2026”.
2. Bloque del empleado: nombre completo, cédula, cargo, clave TSS (si tiene), frecuencia, método de pago (sin número de cuenta completo; si se muestra, enmascarado).
3. Línea de datos: “Fecha de ingreso”, “Días trabajados” (3 decimales), “Fecha de pago” (si está pagado; si no, “Pendiente de pago”) y “Comprobante NO” (si está contabilizado).
4. Tabla **Ingresos**: Concepto, Cantidad, Monto (right). El salario muestra los días trabajados; las horas extra, las horas.
5. Tabla **Deducciones**: Concepto, Porcentaje/Base, Monto (right).
6. Resumen: “Total de ingresos”, “Total de deducciones”, “Neto a pagar” en una caja con el neto en 13 pt/600, alineado a la derecha.
7. Nota: “Se liquidan únicamente los días trabajados dentro del periodo. Las deducciones de SFS, AFP e ISR corresponden a los aportes de ley.” y “Documento informativo; no sustituye el comprobante fiscal.”
8. Pie: “Generado con Medoxigas Contabilidad” + “Página 1 de 1”. Sin NCF.

**Pantalla de la colilla:** `ContenedorDetalle` con `EncabezadoPagina` “Colilla de pago” + migas + acciones “Imprimir / Guardar PDF” (`BotonImprimir`) y “Volver al recibo” (`outline`). El papel se muestra centrado sobre fondo `bg-muted/40`, dentro de una tarjeta blanca, con ancho carta; en pantalla se puede escalar, pero la impresión usa `pt` y no se altera. `print:hidden` en el encabezado y en la app; solo el papel se imprime. Si el recibo está `borrador`, se muestra un `Alert` ámbar “El recibo no está calculado; la colilla puede estar incompleta.” y el botón de imprimir se habilita igual (decisión: permitir vista previa, pero no registrar envío hasta calculado).

**Estados:** cargando `EsqueletoDetalle`; recibo inexistente `notFound()`; error de datos `Alert` + Reintentar; `lector` puede imprimir.

---

## 9. Reporte TSS

**Ruta:** `/reportes` · **RPC de lectura:** `nomina_reporte_tss(p_anio, p_mes)` · **Permisos:** todos los perfiles (RLS); `lector` puede ver y exportar.

**Layout:** `ContenedorLista`.
1. `EncabezadoPagina`: “Reporte TSS”, subtítulo “Resumen mensual por empleado para SUIRPlus e IR-3. Solo incluye periodos contabilizados o pagados.”, migas. Acciones: “Exportar” (`outline`, menú) y `BotonImprimir`.
2. **Filtros** en una tarjeta (`BarraLista` o `Card`): `SelectCampo` “Año” (2024–2027), `SelectCampo` “Mes” (enero–diciembre) y botón “Consultar” (primario) cuando se cambie un filtro; también se puede navegar al cambiar (misma URL `?anio=&mes=`). El rango exacto se muestra en el subtítulo: “Noviembre de 2026”.
3. **Tarjetas resumen** (4): Empleados, Total salario base, Total retenciones (SFS+AFP+ISR), Total aportes patronales (SFS+AFP+SRL+INFOTEP). Valores a la derecha; “—” si no hay datos.
4. **Tabla principal** (`TablaLista` + `pie`): una fila por empleado, suma del mes.

| Columna | Contenido | Alineación | Responsive |
| --- | --- | --- | --- |
| Empleado | Nombre | izquierda | siempre |
| Identificación | Cédula/RNC | izquierda | `hidden md` |
| Clave TSS | 3 dígitos en mono o “—” | izquierda | `hidden lg` |
| Periodos | Cantidad | derecha | `hidden lg` |
| Días | Suma de `dias_trabajados` (3 decimales) | derecha | `hidden xl` |
| Salario base | Suma | **derecha** | siempre |
| SFS empleado | Monto | **derecha** | siempre |
| AFP empleado | Monto | **derecha** | siempre |
| ISR | Monto | **derecha** | siempre |
| Deducciones | Suma de `total_deducciones` | **derecha** | `hidden lg` |
| Neto | Suma de `neto_pagar` | **derecha** | siempre |

5. **Tabla secundaria** en un `Collapsible` “Bases y aportes patronales” (abierta por defecto en desktop, cerrada en móvil): otra `TablaLista` compacta con Empleado, Base SFS, Base AFP, Base SRL, Base INFOTEP, Base ISR, SFS empleador, AFP empleador, SRL, INFOTEP. Todos los montos a la derecha. Es la que se usa para SUIRPlus.
6. **Pie de totales** en ambas tablas: suma de las columnas numéricas ya devueltas. No se recalcula ningún impuesto.
7. **Exportación:** menú “Exportar” con dos opciones:
   - “SUIRPlus (CSV)”: todas las columnas de bases/aportes, una fila por empleado, encabezados en español, UTF-8 con BOM, separador `;` (formato que Excel RD abre bien), decimales con punto. Nombre `TSS-2026-11.csv`.
   - “IR-3 (CSV)”: identificación, nombre, salario base, ISR retenido, neto; nombre `IR3-2026-11.csv`.
   - Diálogo de exportación: periodo de solo lectura, tipo de archivo (`SelectCampo`), nota “El archivo se genera con los datos que estás viendo; para otro mes cambia el filtro.” y “Descargar”. Si el mes no tiene filas, “No hay datos para exportar en noviembre de 2026.” y el botón deshabilitado.
   - **Nota de contrato:** el XML oficial de IR-3 y la plantilla exacta de SUIRPlus están fuera de alcance; el CSV es la base para Contable. Se valida el formato con Contable antes de producción.
8. **Impresión:** `@media print` oculta filtros y acciones, muestra el encabezado de empresa/RNC/periodo y ambas tablas. El pie dice “Generado con Medoxigas Contabilidad”.

**Estados:**
- **Vacío:** “No hay nómina contabilizada o pagada en noviembre de 2026.” / “Solo se incluyen periodos contabilizados o pagados. Si ya calculaste la nómina, contabilízala para verla aquí.” (sin CTA de creación; enlace a Periodos).
- **Vacío por filtro:** igual, con el mes/año elegido.
- **Sin parámetros del año:** `Alert` ámbar “No hay parámetros legales para 2026.” + enlace a Configuración (solo si el RPC falla por eso; el reporte puede no necesitar parámetros, pero se muestra el aviso si aparece).
- **Cargando:** `EsqueletoReporte` con 4 tarjetas y 10 filas; filtros visibles.
- **Error:** `Alert` “No se pudo generar el reporte TSS” + mensaje + Reintentar.
- **Permisos:** `lector` ve y exporta; no hay acciones de escritura.

---

## 10. Mapa RPC → acción de UI

Todas las RPC de escritura exigen `admin`/`contador` (el `lector` recibe `42501`; la UI ni siquiera muestra el botón). Las lecturas son `stable`/`security invoker` y respetan RLS.

| RPC | Acción de UI | Pantalla | Habilitada cuando | Respuesta / feedback |
| --- | --- | --- | --- | --- |
| `nomina_guardar_config_empresa` | “Guardar cambios” | Config · Datos laborales | Rol editor; formulario válido | Toast “Configuración de nómina guardada.” |
| `nomina_guardar_mapeo_contable` | “Guardar N cambios” | Config · Mapeo | Hay filas cambiadas y válidas | Toast “Mapeo guardado: N filas.” |
| `nomina_crear_concepto` | “Guardar” del diálogo Nuevo | Config · Conceptos | Rol editor; código/nombre válidos | Toast “Concepto creado.”; cierra diálogo |
| `nomina_actualizar_concepto` | “Guardar” del diálogo Editar | Config · Conceptos | Rol editor; fila seleccionada | Toast “Concepto actualizado.”; refresca |
| `nomina_guardar_parametros_rd` | “Guardar parámetros” | Config · Parámetros | Rol editor; año y escala válidos | Toast “Parámetros de {año} guardados.” |
| `nomina_crear_empleado` | “Guardar empleado” / cada fila de importación | Wizard / Importar | Rol editor; pasos válidos | Toast “Empleado creado.”; navega a ficha |
| `nomina_actualizar_empleado` | “Guardar empleado” | Wizard edición | Rol editor; pasos válidos | Toast “Empleado actualizado.”; vuelve a ficha |
| `nomina_cambiar_estado_empleado` | “Suspender” / “Marcar inactivo” / “Reactivar” | Ficha | Rol editor; confirmación | Toast con el estado nuevo |
| `nomina_guardar_novedad_recurrente` | “Agregar/Guardar novedad” | Ficha · Novedades | Rol editor; concepto/monto válidos | Toast “Novedad agregada/actualizada.” |
| `nomina_eliminar_novedad_recurrente` | “Apagar” | Ficha · Novedades | Rol editor; confirmación | Toast “Novedad apagada.”; no borra |
| `nomina_crear_periodo` | “Crear periodo” | Lista de periodos | Rol editor; rango estándar; params del año | Toast “Periodo creado: N recibos.”; navega al detalle |
| `nomina_agregar_empleados` | “Agregar N empleados” | Detalle del periodo | Periodo `borrador`/`calculado`; rol editor | Toast “N empleados agregados.”; refresca |
| `nomina_guardar_novedad_recibo` | “Agregar/Guardar novedad” | Recibo | Recibo `borrador`/`calculado`; rol editor | Devuelve `{linea_id, monto}`; toast con el monto; si estaba calculado, pasa a borrador |
| `nomina_eliminar_novedad_recibo` | Papelera “Quitar” | Recibo | Línea `manual`; recibo `borrador`/`calculado` | Toast “Novedad quitada.”; si estaba calculado, pasa a borrador |
| `nomina_calcular_recibo` | “Calcular” / “Recalcular” | Recibo | Recibo `borrador`/`calculado`; rol editor | Toast “Recibo calculado.”; refresca |
| `nomina_calcular_periodo` | “Calcular nómina” | Detalle del periodo | Periodo no contabilizado/pagado/anulado; rol editor | Devuelve `{recibos, total_neto, total_costo_empresa}`; toast con totales |
| `nomina_contabilizar_recibo` | “Contabilizar” | Recibo | Recibo `calculado`; config y mapeo completos | Toast “Comprobante {NO-N} creado.”; enlace al asiento |
| `nomina_contabilizar_periodo` | “Contabilizar” | Detalle del periodo | Todos los no anulados ≥ `calculado`; rol editor | Devuelve `{asientos, total}`; toast “N comprobantes NO creados” |
| `nomina_pagar_recibo` | “Pagar” | Recibo / Pagos | Recibo `contabilizado`; cuenta válida | Toast “Recibo pagado.”; enlace al asiento de pago |
| `nomina_pagar_periodo` | “Pagar todo” / “Pagar pendientes” | Pagos | Todos los no anulados `contabilizado`/`pagado`; cuenta válida | Devuelve `{recibos, asientos, total_pagado}`; toast |
| `nomina_registrar_envio_colillas` | “Registrar envío” | Envíos | Recibos calculados/contabilizados/pagados; correo disponible | Devuelve cuántos selló; toast “N colillas registradas.” (no envía correo) |
| `nomina_anular_pago_recibo` | “Anular pago” | Recibo / Pagos | Recibo `pagado`; confirmación | Devuelve el asiento de reversa; toast |
| `nomina_anular_recibo` | “Anular recibo” | Recibo | Recibo no `pagado`; confirmación | Devuelve la reversa (o null); toast “Recibo anulado.” |
| `nomina_resumen_periodo` | Tabla del periodo y del recibo | Detalle del periodo | Lectura | Una fila por recibo, incluidos anulados; `asiento_codigo`, `fecha_pagado`, `colilla_enviada_en` |
| `nomina_reporte_tss` | Tabla y exportación | Reporte TSS | Lectura | Una fila por empleado/mes; solo contabilizado/pagado |

**Lecturas que no son RPC:** lista de empleados, ficha, novedades recurrentes, conceptos, parámetros, mapeo y configuración se leen con consultas directas a las tablas (RLS). No se inventan RPC de lectura que el contrato no define.

---

## 11. Copy, mensajes y formatos

### 11.1 Títulos y botones

| Pantalla | Título | Botón primario | Botón secundario |
| --- | --- | --- | --- |
| Inicio | Nómina | Crear periodo | Ver reporte TSS |
| Empleados | Empleados | Nuevo empleado | Importar (fase 1.5) |
| Nuevo/editar | Nuevo empleado / Editar empleado | Continuar / Guardar empleado | Atrás / Cancelar |
| Ficha | {Nombre} | Nueva novedad | Editar |
| Periodos | Periodos y cálculo | Crear periodo | — |
| Detalle del periodo | Periodo {rango} | Calcular nómina | Contabilizar / Pagar / Enviar recibos / Agregar empleados |
| Recibo | Recibo de {Nombre} | Calcular / Contabilizar / Pagar | Imprimir colilla / Anular (menú) |
| Pagos | Pagos de nómina | Pagar todo | Volver al periodo |
| Envíos | Envíos de colillas | Registrar envío | Ver periodos |
| Reporte TSS | Reporte TSS | Exportar | Imprimir |
| Config · Laboral | Datos laborales y riesgo SRL | Guardar cambios | — |
| Config · Mapeo | Mapeo contable | Guardar N cambios | Copiar de… |
| Config · Conceptos | Conceptos | Nuevo concepto | — |
| Config · Parámetros | Parámetros legales RD | Guardar parámetros | Crear año |

### 11.2 Estados vacíos (texto exacto)

- Empleados: “¡Aún no tienes empleados!” / “Agrega tu primer empleado para empezar a calcular la nómina.”
- Ficha · novedades: “No tiene novedades recurrentes.” / “Agrega un préstamo, un bono fijo o una pensión alimenticia.”
- Ficha · recibos: “Todavía no tiene recibos.” / “Crea un periodo para calcular su nómina.”
- Periodos: “Todavía no hay periodos de nómina.” / “Crea el primero para calcular los recibos del mes o de la quincena.”
- Detalle del periodo: “Sin recibos en este periodo.” / “Agrega empleados activos de la frecuencia quincenal.”
- Pagos: “No hay pagos registrados.” / “Cuando contabilices un periodo podrás pagarlo desde aquí.”
- Pagos del periodo: “Sin recibos para pagar.” / “Este periodo no tiene recibos no anulados.”
- Envíos: “Todavía no se han enviado colillas.” / “Selecciona un periodo y registra el envío.”
- Reporte TSS: “No hay nómina contabilizada o pagada en {mes} de {año}.” / “Solo se incluyen periodos contabilizados o pagados.”
- Búsqueda/filtro: “Sin resultados” / “La búsqueda no arrojó {empleados|periodos|conceptos}.”

### 11.3 Confirmaciones (texto exacto)

- Crear periodo: “Se crearán los recibos en borrador de los empleados activos de la frecuencia {quincenal|mensual}, con sus novedades recurrentes vigentes como vista previa.”
- Calcular periodo: “Se recalcularán {n} recibos. Las novedades manuales se conservan.”
- Contabilizar periodo: “Se creará un comprobante NO por cada empleado con recibo calculado. Esta acción no se puede deshacer sin anular los recibos.”
- Pagar periodo: “Se pagarán {n} recibos por un total de {monto}. Se debitará Salarios por pagar y se acreditará {cuenta}.”
- Anular pago: “Se creará un asiento de anulación con fecha de hoy y el recibo volverá a Contabilizado.”
- Anular recibo: “Se revertirá el comprobante {NO-N} si estaba contabilizado. Esta acción no se puede deshacer.”
- Envío: “Se registrará la constancia de envío de {n} colillas. Aún no se envía correo.”
- Apagar novedad: “No se borra: deja de aplicarse en los próximos periodos.”
- Salir con cambios: “Tienes cambios sin guardar.” / “Seguir editando” / “Salir sin guardar”.

### 11.4 Errores (los del contrato, tal cual)

La UI muestra el mensaje del RPC sin reescribirlo. Los principales:

- “La cédula debe tener 11 dígitos.”
- “La comprobación del dígito verificador de la identificación: {X} fue errónea.”
- “El contrato definido necesita una fecha de fin.”
- “La fecha de fin no puede ser anterior a la fecha de ingreso.”
- “Si el pago es por transferencia, indica el banco, el tipo y el número de cuenta.”
- “La clave TSS debe tener 3 dígitos.”
- “Indica un monto o un porcentaje, no ambos.”
- “El porcentaje debe ser mayor que 0 y menor o igual a 100.”
- “No hay parámetros de nómina para el año {año}.”
- “Ya existe un periodo de nómina con ese código.”
- “No hay empleados elegibles para este periodo.”
- “El recibo no está contabilizado; no se puede pagar.”
- “Las deducciones (RD$ {X}) superan los ingresos (RD$ {Y}) del recibo de {nombre}.”
- “El recibo está pagado; anula el pago antes de anular el recibo.”
- “Falta el concepto de nómina {CÓDIGO}.”
- “No hay un tipo de entrada de diario activo con prefijo NO.”
- “El periodo contable está cerrado…” (mensaje del trigger; se muestra completo y se enlaza a Periodos contables).
- “sin permiso” (42501) → se reemplaza por la pantalla de solo lectura; no se muestra el código crudo.

### 11.5 Formatos

- Periodo: `16–30 nov 2026` en tablas; `16–30 de noviembre de 2026` en encabezados.
- Código: `2026-11-Q2`, `2026-11-M`.
- Moneda: `RD$ 1,250.00`.
- Días: `11.915`, `23.83` (hasta 3 decimales, sin ceros de relleno).
- Horas: `5`, `5.5`, `5.25` (hasta 3 decimales).
- Porcentaje: `3.04 %`, `1.10 %`, `135 %`, `200 %`.
- Fecha: `30/11/2026`.
- Fecha y hora (envíos): `20/11/2026, 3:42 p. m.` (formato `es-DO`).

---

## 12. Permisos por pantalla

| Pantalla | admin | contador | lector |
| --- | --- | --- | --- |
| Inicio | ver + crear periodo | ver + crear periodo | ver |
| Empleados (lista/ficha) | ver + crear/editar/estado | ver + crear/editar/estado | ver |
| Wizard/Importar | sí | sí | no (solo lectura) |
| Periodos | ver + crear/calcular/contabilizar/pagar/agregar | ídem | ver |
| Recibo | ver + editar novedades/calcular/contabilizar/pagar/anular | ídem | ver + imprimir colilla |
| Pagos | ver + pagar/anular | ídem | ver |
| Envíos | ver + registrar | ídem | ver |
| Reporte TSS | ver + exportar | ídem | ver + exportar |
| Config · Laboral/Mapeo/Conceptos/Parámetros | ver + editar | ver + editar | ver |
| Config · Empresa (fuera de nómina) | ver + editar | ver | ver |

- El `lector` no ve botones de escritura ni formularios de alta; en las páginas de configuración los controles están `disabled`.
- Si un `lector` entra por URL directa a un wizard/importar, se muestra una tarjeta “Solo lectura” con enlace a la lista; el servidor igual valida el rol antes de renderizar.
- Las RPC de escritura rechazan al `lector` con `42501`; la UI no depende de eso, pero lo maneja mostrando el mensaje “sin permiso” en un toast y refrescando.

---

## 13. Integraciones con la UI existente

Estos cambios son de **frontend** y deben entrar en el mismo PR de UI (3D/3E) o en uno coordinado; no cambian el backend.

1. **`src/navigation/sidebar/sidebar-items.ts`:** agregar el subítem padre “Nómina” con sus 6 hijos y extender el tipo con tercer nivel; `filtrarItemsPorRol` filtra subítems por rol.
2. **`src/app/(main)/dashboard/_components/sidebar/nav-main.tsx`:** renderizar el `Collapsible` anidado y el submenú del sidebar colapsado; ampliar `urlsSubitems` para incluir las URLs del tercer nivel y mantener la ruta activa más específica (`rutaMasEspecifica`) para que `/nomina/periodos/123` active “Periodos y cálculo”.
3. **`src/app/(main)/dashboard/configuracion/page.tsx`:** nuevo grupo “Nómina” con 4 tarjetas.
4. **`src/lib/enlaces.ts`:** nuevas rutas:
   - `rutaPeriodoNomina(id)` → `/dashboard/contabilidad/nomina/periodos/{id}`
   - `rutaReciboNomina(id)` → `/dashboard/contabilidad/nomina/recibos/{id}`
   - `rutaColillaNomina(id)` → `/dashboard/contabilidad/nomina/recibos/{id}/colilla`
   - `rutaPagosNomina(periodoId)` → `/dashboard/contabilidad/nomina/pagos/{periodoId}`
   - En `RUTAS_DOCUMENTO_ORIGEN`, agregar `nomina` y `pago_nomina` → `rutaReciboNomina`.
5. **`src/app/(main)/dashboard/contabilidad/asientos/page.tsx`:** agregar al mapa `ORIGENES` las etiquetas “Nómina” y “Pago de nómina”. El enlace de origen ya se resuelve por `rutaOrigenAsiento` con los nuevos valores. No se toca el resto de la lista.
6. **`src/components/documento-venta/documento-papel.tsx`:** agregar la variante `colilla` y `ContenidoColilla`; no modificar las variantes existentes.
7. **`src/lib/tablas-listas.test.ts`:** agregar cada nuevo componente de lista a `LISTAS_MIGRADAS` (empleados, periodos, recibos, pagos, envíos, reporte TSS, conceptos). El candado exige `TablaLista` e `PillEstado` compartidos.
8. **`src/lib/diseno-paginas.test.ts`:** agregar las páginas nuevas a `PAGINAS_MIGRADAS` cuando usen `EncabezadoPagina` con migas, o al menos verificar que no tengan `h1` suelto ni `text-3xl`.
9. **`loading.tsx`** por ruta nueva, con el esqueleto que corresponde (lista, detalle, formulario, reporte).
10. **`docs/diseno/guia-estilo.md`:** no se toca en esta tarea; el patrón de tablas sigue siendo `tabla-lista.tsx` (la guía vieja menciona `dashboardblocks/data-table`, que no se usa).
11. **Numeraciones:** no se duplica la pantalla. En Config · Laboral se enlaza a `/dashboard/configuracion/tipos-entrada-diario` para el tipo `NO`. El prefijo/siguiente se administra allí, no en nómina.

---

## 14. Mapa de archivos propuesto (para 3D/3E)

Solo orientativo: los nombres exactos pueden cambiar, pero **las rutas y la UX de esta spec mandan**.

```
src/app/(main)/dashboard/contabilidad/nomina/
  page.tsx                         Inicio
  _components/
    tarjetas-kpi.tsx
    periodo-a-calcular.tsx
    indicadores-rd.tsx
    ultimos-periodos.tsx
  empleados/
    page.tsx
    nuevo/page.tsx
    [id]/page.tsx
    [id]/editar/page.tsx
    importar/page.tsx
    _components/
      wizard-empleado.tsx
      paso-datos.tsx
      paso-contrato.tsx
      paso-pago.tsx
      tabla-empleados.tsx
      ficha-empleado.tsx
      tab-datos.tsx
      tab-novedades.tsx
      tab-recibos.tsx
      dialogo-novedad-recurrente.tsx
  periodos/
    page.tsx
    [id]/page.tsx
    _components/
      tabla-periodos.tsx
      dialogo-crear-periodo.tsx
      resumen-periodo.tsx
      tabla-recibos.tsx
      dialogo-agregar-empleados.tsx
      dialogo-calcular.tsx
      dialogo-contabilizar.tsx
      dialogo-pagar-periodo.tsx
  recibos/
    [id]/page.tsx
    [id]/colilla/page.tsx
    _components/
      resumen-recibo.tsx
      tablas-recibo.tsx
      dialogo-novedad-recibo.tsx
      dialogo-pagar-recibo.tsx
      dialogo-anular.tsx
  pagos/
    page.tsx
    [periodoId]/page.tsx
    _components/
      tabla-pagos.tsx
      tabla-recibos-pago.tsx
  envios/
    page.tsx
    _components/
      tabla-envios.tsx
      dialogo-enviar.tsx
  reportes/
    page.tsx
    _components/
      filtros-tss.tsx
      tablas-tss.tsx
      dialogo-exportar-tss.tsx

src/app/(main)/dashboard/configuracion/nomina/
  page.tsx                         redirección a /laboral
  laboral/page.tsx
  mapeo/page.tsx
  conceptos/page.tsx
  parametros/page.tsx
  _components/
    encabezado-nomina-config.tsx
    tabs-nomina.tsx
    form-laboral.tsx
    tabla-mapeo.tsx
    tabla-conceptos.tsx
    dialogo-concepto.tsx
    form-parametros.tsx
    escala-isr.tsx
    guardar-barra.tsx

src/lib/nomina/
  tipos.ts          ColillaVista, filas de tablas, estados
  consultas.ts      listas paginadas y lecturas
  acciones.ts       server actions (supabase.rpc directo)
  validacion.ts     Zod / reglas de formulario
  formato.ts        días, tasas, periodo, moneda
  tss.ts            armado del CSV SUIRPlus / IR-3
```

- `page.tsx` es Server Component; lo interactivo vive en `_components` con `"use client"`.
- No se toca `src/components/ui/*` (regla del repo). Se personaliza donde se usa.
- No se agregan dependencias para el CSV: se genera con `Blob` y `URL.createObjectURL`, como `ModalExportar`.
- El XLSX de importación (fase 1.5) requiere una dependencia de lectura; no se incluye sin aprobación explícita.

---

## 15. Criterios de aceptación y candados

### 15.1 Para esta tarea (solo documentación)

- [x] `docs/diseno/nomina-ui.md` existe y cubre las 18 pantallas del §0.
- [x] No contradice `docs/dominio-nomina.md` (estados, RPC, candado de pago, pgTAP, fase 1 sin importación).
- [x] Define layout, componentes reales, columnas, alineación (montos a la derecha), estados vacío/cargando/error, copy, permisos y mapa RPC → UI para cada pantalla.
- [x] Fija la consistencia `EncabezadoPagina` + migas, `TablaLista`, `DatePicker`, `SelectCampo`, sin `<select>`.
- [x] `pnpm typecheck` en verde (verificado el 20/11/2026).
- [x] `pnpm check` en verde (0 errores; quedan advertencias previas de Biome en archivos que no se tocaron).
- [x] `pnpm test` en verde (verificado el 20/11/2026).

### 15.2 Para 3D/3E (implementación)

- [ ] Toda pantalla nueva usa `EncabezadoPagina` con migas y `ContenedorLista`/`ContenedorFormulario`/`ContenedorDetalle`; sin `h1` suelto ni `text-3xl` (candado `diseno-paginas.test.ts`).
- [ ] Toda lista usa `TablaLista` + `PillEstado` + `EsqueletoTabla`; las nuevas listas están en `LISTAS_MIGRADAS` (candado `tablas-listas.test.ts`).
- [ ] Ningún `<select>`, `NativeSelect` fuera de `components/ui` o `<input type="date">` (candados `selects-nativos.test.ts` y `fechas-nativas.test.ts`).
- [ ] `supabase.rpc("nombre", args)` directo, sin variables ni `as` (candado `rpc-sin-extraer.test.ts`).
- [ ] Listas y reportes paginan por lotes (`paginarConsulta`/`consultarEnLotes`), sin topes 300/500/1 000 (candado `paginacion.test.ts`).
- [ ] Dinero en `numeric(14,2)`; la UI no calcula tasas, ISR, totales ni asientos; solo muestra lo que devuelve el servidor.
- [ ] Permisos: `lector` sin acciones de escritura; `admin`/`contador` con las RPC; `42501` manejado.
- [ ] Capturas claras y oscuras (y móvil en las pantallas clave) del resultado real, con datos de prueba, para que Waldy las verifique. Sin capturas, la tarea de UI no está terminada.
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` en verde.
- [ ] `HANDOFF.md` actualizado por el Orquestador, no por el subagente.

---

## 16. Decisiones abiertas (para Waldy / Contable)

1. **Importación de empleados:** el contrato la deja fuera de fase 1. Esta spec la describe como fase 1.5; si se aprueba, definir CSV (sin dependencia) o XLSX (con dependencia) y si se acepta importación parcial.
2. **Correo de colillas:** falta proveedor. En fase 1 se registra la constancia y se dice claramente que no sale correo. 3E decide Resend/SMTP y cambia el copy/botón.
3. **Formato SUIRPlus/IR-3:** el CSV es la base; validar con Contable el separador, los encabezados y si SUIRPlus exige Excel/plantilla oficial. El XML de IR-3 sigue fuera de alcance.
4. **Quién edita Config · Laboral:** la spec permite `admin` y `contador` porque las RPC lo permiten. Si Waldy quiere que solo `admin` toque riesgo/cuentas/contactos, se cambia la condición de la tarjeta y de la página.
5. **Colilla y costo de empresa:** la colilla del empleado no muestra aportes patronales, provisiones ni costo total. Si se quiere una “colilla empresa”, se agrega una variante; no se mezcla en la del empleado.
6. **Gráfica en Inicio:** no es requisito de fase 1. Si se pide, se hace con `chart.tsx` y los últimos 6 periodos.
7. **Anulación de periodo:** el contrato no tiene `nomina_anular_periodo`; se anulan recibos. La UI no ofrece “Anular periodo”. Si Waldy lo quiere, es una RPC nueva y una confirmación nueva.
8. **Mostrar anulados:** el detalle del periodo los muestra con opacidad y sin sumarlos. Si se prefiere ocultarlos por defecto, se agrega un `Switch` “Mostrar anulados”; no cambia los totales.

---

## Apéndice A. Resumen de una pantalla en 10 líneas

Para revisar cualquier pantalla nueva contra esta spec:

1. ¿Tiene `EncabezadoPagina` con migas y título de 20 px?
2. ¿Usa el contenedor correcto (1289 lista / 1040 formulario-detalle)?
3. ¿La tabla es `TarjetaLista` + `TablaLista` + `PillEstado` (o la excepción de reporte justificada)?
4. ¿Los montos van a la derecha y con `tabular-nums`?
5. ¿Los filtros y la paginación están en la URL y no inventan datos?
6. ¿Los estados vacío/cargando/error/sin permiso están definidos y son honestos?
7. ¿Los campos usan `SelectCampo`/`DatePicker`/`CampoFormulario` y nunca `<select>`/`<input type="date">`?
8. ¿La acción llama `supabase.rpc("nombre", args)` directo y muestra el mensaje del servidor?
9. ¿El rol `lector` no ve acciones de escritura y el servidor también las bloquea?
10. ¿La pantalla se entiende en español RD, en claro, en oscuro y en 390 px?
