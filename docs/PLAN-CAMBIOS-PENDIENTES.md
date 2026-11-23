# Plan de cambios pendientes — Medoxigas Contabilidad

> **Estado:** SOLO PLAN. No se implementa nada hasta que Waldy diga; hay trabajo
> de otra gente entrando a `main` y este documento se prepara primero para no
> chocar.
>
> **Cómo se usa:** Waldy dicta los cambios numerados; cada ítem queda aquí con
> su diagnóstico, diseño objetivo, archivos a tocar, candados y decisiones
> pendientes. Cuando Waldy apruebe un ítem se marca **[aprobado]** y se
> convierte en brief de subagente (o en fases si es grande).

| # | Cambio | Estado |
|---|--------|--------|
| 1 | Estado de resultados = diseño Alegra + cuentas en cero visibles | pendiente de decisiones |
| 2 | Menú lateral = diseño nuevo de Alegra (copia exacta, logo Medoxigas) | pendiente de decisiones |

**Referencia cruda de medición (NUNCA commitear, repo público):**
`/root/alegra-refs/estado-resultados-menu-alegra.html` — captura SingleFile de
`app.alegra.com/report/profit-and-loss` entregada por Waldy el 23-11-2026. Es la
regla de medición local (px, colores, espaciados) para los ítems 1 y 2.

**Regla actualizada (Waldy, 23-11-2026 — D0 RESUELTA):** se eliminó la
prohibición de copiar código de Alegra en `AGENTS.md` (líneas 13 y 15) y en la
skill `diseno-ui`. Ahora todo el sistema **copia el diseño de Alegra
exactamente**, pudiendo adaptar su HTML/CSS/estructura de las capturas al
código propio. Lo que sigue vetado: commitear los exports crudos al repo
(público y con datos de la cuenta → viven en `/root/alegra-refs/`) y usar el
logo/marca de Alegra (siempre Medoxigas).

---

## 1. Estado de resultados igual al de Alegra (diseño + cuentas en cero)

**Pedido de Waldy (23-11-2026):** el Estado de resultados tiene que ser igual al
de Alegra en diseño; en Alegra **una cuenta contable aparece aunque no tenga
movimientos** (ej. "Costo de los servicios vendidos RD$0.00").

**Referencias (fuente de la verdad):**

- `docs/alegra/reporte-estado-resultados/DESIGN-GUIDE.md` + `screenshot.png`
- `docs/alegra/capturas/08-notas-contables.md` §1 (columnas, filtros, exportar)
- `docs/alegra/ALEGRA.md` §8.1 fila "Estado de resultados"
- Captura nueva de Waldy (23-11): comparativo con "Gastos de venta" como grupo

### 1.1 Diagnóstico — por qué hoy no salen las cuentas en cero

- La RPC `reporte_estado_resultados_centro` (y la base
  `reporte_estado_resultados`) solo devuelve cuentas **con movimiento**:
  `having sum(l.debito) <> 0 or sum(l.credito) <> 0`.
- `unirCuentas()` en `src/lib/reportes/estados/resultados.ts` construye las
  filas **solo** a partir de lo que devolvió la RPC → cuenta sin movimiento en
  ambos períodos = invisible.
- El catálogo completo ya se lee (`consultarCuentas`) pero hoy solo se usa para
  `cuentasPorCodigo` (el enlace de la fila).

**Corrección (JS puro, sin migración ni cambio de RPC):**
`calcularEstadoResultadosComparativo` parte del catálogo — toda cuenta `tipo in
('ingreso','costo','gasto')`, `activa` y `acepta_movimientos` — con monto 0 por
defecto y encima pone los montos de la RPC. Pasar las `cuentas` completas por
`OpcionesReporte` (hoy solo va el mapa código→id).

- `consultarCuentas` debe seleccionar también `activa` (hoy no la trae) y
  añadirla a `CuentaEstado`.
- `resumido` sigue ocultando hojas; `busqueda` filtra igual sobre todas las
  hojas (incluidas las de cero).
- La RPC **no se toca**: Flujo de efectivo la usa igual y los cero salen del
  catálogo en TS.

### 1.2 Estructura del árbol — el punto grande

Alegra renderiza sección → **subgrupo expandible** → hojas sueltas:

```
Ingresos de actividades ordinarias      (sección, chevron, bold)
  Ventas                                (subgrupo, chevron ›)
  Devoluciones en ventas                (hoja suelta, indent +2)
Costos de ventas y operación            (sección)
  Costos de la mercancía vendida        (subgrupo)
  Costo de los servicios vendidos       (hoja, RD$0.00)
Utilidad bruta                          (total, bold)
Gastos de venta                         (sección)
Gastos administrativos …                (sección)
Utilidad operativa · Otros ingresos/gastos · UAI · Impuestos · Utilidad neta
```

Nuestro catálogo es **plano**: todas las hojas cuelgan de las raíces `4/5/6`
(4101, 4102, 4103, 4104 bajo "4"; 5101, 5102 bajo "5"; ~19 cuentas 61xx bajo
"6"). No existen cuentas-grupo intermedias. Dos caminos:

- **Opción A (recomendada — la estructura real de Alegra):** migración que crea
  cuentas-grupo intermedias (`acepta_movimientos = false`) y re-padrea las
  hojas: "Ventas" (4101, 4102), hoja suelta 4104 Devoluciones; "Costos de la
  mercancía vendida" (5101, 5102); "Gastos de venta", "Gastos administrativos",
  "Gastos de nómina", "Gastos financieros"… (reparto de las 61xx **lo define
  Waldy**). El reporte se vuelve genérico: renderiza el árbol `padre_id` a
  cualquier profundidad. Requiere UPDATE de `padre_id` en producción → **OK
  explícito de Waldy** (es su catálogo; el cambio también se ve en el árbol del
  catálogo de cuentas y en selects de cuentas).
- **Opción B (sin tocar catálogo):** mapeo fijo por prefijo de código en
  `resultados.ts` (41*→Ventas, 51*→Costos mercancía, 61*→Gastos…). Cero riesgo
  en datos pero frágil: una cuenta nueva creada por Waldy cae en un saco fijo o
  en "Otros".

**Faseado propuesto:** Fase A = cuentas en cero + diseño visual (ya mejora
muchísimo y no toca datos). Fase B = subgrupos por la opción que elija Waldy.

Para la UI: `FilaReporte` necesita `nivel` (0 sección / 1 subgrupo / 2 hoja) y
`TablaComparativa` debe agrupar a dos niveles (hoy `agrupar()` solo maneja
grupo→detalle). Los otros dos reportes que usan la tabla (Situación financiera,
Flujo de efectivo) no usan `expandible` ni subgrupos → no se rompen, y heredan
el look nuevo gratis.

### 1.3 Deltas visuales (Medoxigas hoy → Alegra)

| Elemento | Hoy | Alegra | Acción |
|---|---|---|---|
| Cuentas en cero | no aparecen | aparecen con RD$0.00 | §1.1 |
| Subgrupos expandibles | no existen | sí (Ventas, Costos mercancía…) | §1.2 |
| Hojas muestran | `4101 Ventas de productos` | solo el nombre | **decisión** D2 |
| Negativos | texto plano (`-RD$5,000.00`) | **rojo** `#e11d48` | **decisión** D1 |
| `% de Ingresos` | con signo y 0–2 dec (`-1.7 %`) | **absoluto, 2 dec** (`0.12%`… `101.70%`); sin espacio | ajustar `formatoPct` para este reporte o variante propia |
| Filtros | campos con Label + botón outline | **pills** outlined con icono teal + caret: "Este mes", "Centro de costos", "Vista: Reporte detallado"; "Actualizar" link teal a la derecha | restyling de `FiltrosEstados` |
| Fecha | dos inputs desde/hasta | preset ("Este mes", mes anterior, este año, personalizado…) | componente nuevo; mantener `?desde&hasta` en la URL |
| Descargar | botón Excel + botón Imprimir | **pill teal "Descargar ▾"** → menú: Descargar Excel / Descargar PDF; sin botón "Imprimir" etiquetado | dropdown nuevo |
| Extra en header | — | icono sliders "Personalizar", link "Ayuda", card "Resumen Beta" (resumen con IA) | **decisiones** D3–D5 |
| Etiqueta de rango en la card | "Del 1 al 30 de noviembre: Comparativo 2026 - 2025" | igual en modo comparativo | ya coincide ✓ |
| Columnas comparativas | 7 col (cuenta, actual, %, anterior, %, Var.Abs, Var.Rel) | mismas 7 | ya coincide ✓ |
| Var. Relativa con base 0 | `0 %` | `0 %` | ya coincide ✓ |
| Chevron/expandir | chevron a la izquierda, bold en grupos | igual | ya coincide (falta nivel subgrupo) |
| Buscador dentro de la card | ya está | input + icono de orden al lado | añadir botón de orden (menor) |
| Migas | Inicio › Reportes › Estado de resultados | Reportes › Contables › Estado de resultados | menor |
| Subtítulo | describe el rango | frase fija propia de Alegra | reescribir con palabras nuestras (no copiar texto de Alegra) |

### 1.4 Decisiones para Waldy (bloquean el brief)

- **D1 — Rojo en negativos.** Alegra pinta `-RD$2,600.00` en rojo `#e11d48`,
  pero el 20-11 Waldy había decidido montos sin color (comentario en
  `tabla-comparativa.tsx`: "el rojo/verde por signo se ve chillón"). La nueva
  orden "quiero el mismo diseño" sugiere activar el rojo **solo en este
  reporte** (o en los tres comparativos). Confirmar.
- **D2 — Código en las hojas.** Alegra no muestra código ("Ventas de
  productos"); nosotros sí (`4101 …`). ¿Lo quitamos para copiar el diseño o lo
  dejamos en gris por utilidad del contador? (La búsqueda por código sigue
  funcionando igual.)
- **D3 — Card "Resumen Beta".** Alegra genera un análisis con IA. No tenemos
  IA; opciones: omitirla (recomendado v1) o un resumen calculado con plantilla
  ("Ingresos RD$X, utilidad neta RD$Y, margen Z%").
- **D4 — "Personalizar" (sliders) y "Ayuda".** En Alegra abren panel de
  columnas y ayuda. Recomendado: omitir en v1 (no hay nada que personalizar ni
  destino de ayuda).
- **D5 — Imprimir.** Alegra solo tiene Descargar Excel/PDF. Nosotros tenemos
  `BotonImprimir`. Propuesta: menú "Descargar ▾" con Excel, PDF **e Imprimir**
  dentro (superconjunto, no perdemos la función).
- **D6 — "Otros ingresos/gastos" e "Impuestos" reales.** Hoy son filas fijas en
  0. Alegra las tiene como secciones vivas (ej. "Ingresos por intereses" iría
  en Otros ingresos). Nuestro catálogo no distingue operacional de "otros" →
  requiere marca en el catálogo o decisión de mapeo. Propuesta v1: dejarlas en
  0 como ahora y resolver con la Opción A de §1.2 si se elige.
- **D7 — Reparto de las 61xx** (solo si se elige Opción A): Waldy define qué
  gastos van a "Gastos de venta" vs "Gastos administrativos" vs nómina.

### 1.5 Archivos a tocar

| Archivo | Cambio |
|---|---|
| `src/lib/reportes/estados/consultas.ts` | `consultarCuentas` +`activa`; pasar `cuentas` completas a las opciones |
| `src/lib/reportes/estados/tipos.ts` | `CuentaEstado.activa`; `FilaReporte.nivel`; `OpcionesReporte.cuentas` |
| `src/lib/reportes/estados/resultados.ts` | partir del catálogo (cuentas en cero); emitir niveles/subgrupos (Fase B) |
| `src/lib/reportes/estados/resultados.test.ts` | casos nuevos: hoja sin movimiento aparece con 0/0; totales iguales |
| `src/app/(main)/dashboard/reportes/_components/estados/tabla-comparativa.tsx` | dos niveles de indent/chevron; rojo negativos (D1); % formato Alegra |
| `…/_components/estados/filtros-estados.tsx` | pills estilo Alegra + preset de fecha + "Actualizar" link |
| `…/_components/estados/encabezado-tabla-comparativa.tsx` | botón de orden junto al buscador (menor) |
| `…/reportes/estado-resultados/page.tsx` | cablear preset de fecha, menú Descargar, miga "Contables" |
| `…/reportes/estado-resultados/_components/exportar.ts` | mismo set de filas (hereda cuentas en cero y niveles) |
| `supabase/migrations/<nueva>.sql` | **solo Opción A**: cuentas-grupo + re-padreo — con OK de Waldy |

Componentes compartidos que cambian de look también en
`situacion-financiera` y `flujo-efectivo` (tabla y filtros): revisar sus
capturas al final; sus tests (`tabla-comparativa.test.tsx`,
`filtros-estados.test.tsx`, `encabezado-tabla-comparativa.test.tsx`) se
actualizan en la misma tarea.

### 1.6 Candados (regla de oro)

- Vitest `resultados.test.ts`: cuenta `gasto` sin movimientos aparece con
  `actual=0, anterior=0`; totales de sección idénticos con y sin la cuenta;
  `resumido` la oculta; `busqueda` la encuentra.
- Vitest `tabla-comparativa.test.tsx`: subgrupo colapsa solo sus hojas; hoja
  suelta se renderiza a nivel 2.
- Si D1=rojo: test que la celda de monto negativo lleva la clase/token
  acordado.
- pgTAP no aplica (la RPC no cambia). `pnpm test`, `pnpm typecheck`,
  `pnpm check` en verde.
- **Capturas obligatorias (regla Waldy):** claro/oscuro del reporte completo,
  expandiendo/colapsando un subgrupo, y móvil si aplica — contra el preview
  oficial, usuarios ZZTEST, para verificación visual de Waldy.

### 1.7 Reparto sugerido de subagentes (cuando se apruebe)

1. **Datos/motor:** `src/lib/reportes/estados/*` + tests (§1.1 + niveles).
2. **UI reportes:** `…/_components/estados/*`, `page.tsx`, `exportar.ts`,
   preset de fecha, menú Descargar (§1.3). Depende del contrato `nivel` del
   agente 1 → se pueden lanzar juntos con la forma de `FilaReporte` ya acordada.
3. **Catálogo (Opción A, condicionado):** migración de grupos + re-padreo; solo
   con OK de Waldy y mapeo de 61xx decidido (D7).

---

## 2. Menú lateral = diseño nuevo de Alegra (copia exacta del look)

**Pedido de Waldy (23-11-2026):** copiar el menú tal cual está en el HTML —
posición del logo (cambiado por el de Medoxigas), estructura y medidas.

**Lo que mide la captura** (`s-sidebar--new`, el sidebar nuevo de Alegra — no el
riel viejo que hoy imitamos):

### 2.1 Medidas exactas extraídas

| Pieza | Medida/color |
|---|---|
| Panel | `width: 272px`, fondo `#f1f5f9` (slate-100), borde derecho 1px `rgba(148,163,184,.2)`, radius izquierdo 16px, padding-y 10px, `flex-col gap-16px` |
| Colapso | `.collapsed` → `width: 0` (se esconde entero; **no hay riel de iconos**); toggle = icono `layout-sidebar` junto al logo y en la topbar |
| Fila logo | alto máx 56px, `px-4 py-2`, logo `h-40 max-w-150px` a la izquierda + botón colapsar a la derecha; borde-y `slate-200` |
| Ítem nivel 1 | `height: 32px`, `radius: 6px`, `pl-8`, font 14px `#334155`, icono Tabler 20px `#94a3b8`, gap 8px |
| Hover / activo(press) | `bg slate-200/45` / `slate-200/70`; focus: ring 2px teal |
| Ítem activo | texto `#0f172a` + `bg slate-200/45` + **pill teal** `::before` 3px × 12px (16px en ≥1024px), left 0, radius full, color `--sm-color-primary-600` |
| Acordeón | chevron-down 24px `#94a3b8` a la derecha; body `border-l slate-200 ml-[17px] pl-2.5`, transición altura 0.3s |
| Sub-ítem | `min-h-32`, font 14px `#0f172a`, `pl-8`, radius 6px; mismo hover/pill activo |
| Botón "+" por sub-ítem | oculto, aparece en hover → abre la ruta `/add` de ese documento |
| Badge | píldora numérica (ej. Bandeja de entrada: 4) |
| Pie | `mt-auto p-2`: en Alegra hay contador demo + botón "Elegir plan" (no aplica) |
| Lista | `px-3`, `gap-4px` entre ítems; scrollbar fino 4px slate-200 |
| Tipografía | Inter; labels `first-letter:capitalize` |

### 2.2 Estructura del menú en la captura (orden real)

1. **Inicio** · 2. **Bandeja de entrada** (badge 4) · 3. "Activar factura
   electrónica" (externo, Alegra-only)
4. **Ingresos** › Facturas de venta · Facturas de venta recurrentes · Pagos
   recibidos · Notas de crédito · Notas de débito · Cotizaciones · Conduces
   (cada uno con "+" de creación rápida)
5. **Compras** › Facturas de proveedores · Pagos / Gastos · Gastos menores ·
   Pagos recurrentes · Notas de crédito en compras · Órdenes de compra ·
   Recepción de comprobantes
6. **Contactos** (directo)
7. **Inventario** › Productos y servicios · Valor de inventario · Ajustes de
   inventario · Gestión de productos · Listas de precios · Almacenes ·
   Categorías · Atributos
8. **Bancos** › Bancos y cajas · Conciliaciones bancarias
9. **Contabilidad** › Catálogo de cuentas · Entrada de diario · Activos ·
   Libro diario · Complementos contables
10. **Reportes** (directo) · 11. **Mis tareas** · 12. **Configuración** ·
    13. Nómina · 14. POS · 15. Portal de clientes · 16. "Alegra Ventas"

**Topbar (va en el mismo saco visual):** fila de 56px — logo + toggle sidebar a
la izquierda; `Buscar…` con `Ctrl K` centrado; a la derecha botón "+" (crear
rápido con menú por tipo de doc), ayuda, eco-badge (Alegra-only), grid de apps,
**selector de empresa** (avatar+nombre+chevron) y avatar de usuario.

### 2.3 Diferencias vs nuestro sidebar hoy

- Hoy: riel colapsado de 53px que **flota** a 271px en hover (diseño viejo de
  Alegra). Alegra nuevo: panel **fijo 272px** que se esconde a 0 — decisión
  D8.
- Hoy los sub-ítems no tienen botón "+" de creación rápida ni la línea
  vertical `border-l`.
- Nuestra lista de módulos ya casi coincide; faltan/deciden: Bandeja de
  entrada, Mis tareas, Portal de clientes, "Alegra Ventas", Recepción de
  comprobantes (e-CF — aún no existe), "Activar factura electrónica".
- Pie: nosotros tenemos tarjeta de usuario abajo; Alegra la subió a la topbar
  (selector de empresa + avatar). D9.

### 2.4 Decisiones para Waldy

- **D8 — Comportamiento:** ¿panel fijo 272px con toggle a 0 (diseño nuevo de la
  captura) o mantener riel 53→271 con hover (diseño viejo)? La captura manda:
  fijo + toggle.
- **D9 — Ítems que no existen en Medoxigas:** Bandeja de entrada, Mis tareas,
  Portal de clientes, Alegra Ventas, Elegir plan → ¿omitir o placeholder
  "Próximamente"? "Activar factura electrónica" → enlazar al módulo e-CF/DGII
  cuando exista u omitir.
- **D10 — "+" de creación rápida:** implementar en los sub-ítems que tienen
  ruta "nueva" (facturas, pagos, cotizaciones…) — recomendado: sí, es la mitad
  del valor del menú de Alegra.
- **D11 — Selector de empresa en topbar:** Medoxigas/Oxymat son dos empresas
  lógicas; ¿copiamos el selector de Alegra (avatar+nombre+chevron) para
  cambiar de empresa, o dejamos el avatar de usuario actual?
- **D12 — Logo:** sustituir el SVG de Alegra por el logo Medoxigas existente
  (`max-w-150px h-40`), manteniendo la fila de 56px y el toggle.

### 2.5 Archivos a tocar

| Archivo | Cambio |
|---|---|
| `src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx` | shell: 272px fijo, colapso a 0, fila logo 56px + toggle, pie |
| `…/sidebar/nav-main.tsx` | ítem 32px/pill activo/acordeón con línea + botón "+" por sub-ítem |
| `src/navigation/sidebar/sidebar-items.ts` | reordenar/renombrar ítems al árbol de Alegra + flags `addUrl`, `badge` |
| `src/components/ui/sidebar.tsx` | tokens de ancho/fondo si el primitivo lo exige |
| header/topbar del dashboard | altura 56px, toggle, buscador centrado, selector empresa (D11) |
| `src/app/globals.css` | tokens del look (slate-100 panel, pill teal) si hacen falta |

**Candados:** `sidebar-items.test.ts` actualizado al árbol nuevo; capturas
claro/oscuro + móvil (cajón) + un acordeón abierto con "+" visible; el
comportamiento de colapso cubierto por test de componente si hay infra.

---

## Ítems siguientes

_Waldy va dictando; se agregan aquí como §3, §4… con el mismo formato._
