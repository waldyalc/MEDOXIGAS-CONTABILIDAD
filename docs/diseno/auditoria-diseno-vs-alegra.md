# Auditoría de diseño: Medoxigas Contabilidad vs Alegra

**Fecha:** 17 nov 2026 · **Rama:** `docs/auditoria-diseno-orq` · **Base:** `prueba` @ `9ad5813`
**Alcance:** todo el frontend (`src/app`, `src/components`, `docs`). Solo lectura: no se tocó código, datos, `src/components/ui`, `supabase` ni `package.json`.
**Método:** se leyó el código real de cada ruta y se comparó con `docs/alegra/ALEGRA.md`, las capturas de `docs/alegra/capturas/` y las guías `css-*`, más `docs/diseno/tablas-unificadas.md` y `docs/plantilla-diseno.md`. No se levantó el servidor ni se tomaron capturas nuevas: el estado actual sale del código, no de una verificación visual. Las capturas comparativas quedan para Coder.

## Cómo leer este documento

- `D/…` = `src/app/(main)/dashboard/…`
- `C/…` = `src/components/…`
- **Distancia**:
  - **cerca**: misma estructura, orden y piezas; solo faltan tokens, medidas o pulido.
  - **medio**: mismos bloques funcionales, pero cambia la jerarquía, la composición o falta un bloque visible.
  - **lejos**: otro patrón (por ejemplo, tarjetas genéricas donde Alegra tiene una tarjeta-documento), o no existe el equivalente.
  - **no medido / sin referencia**: Alegra no tiene captura ni guía de esa pantalla; se juzga solo contra el patrón general.
- **Recomendación (igual a Alegra)**: `sí` = conviene copiar el patrón; `parcial` = copiar la estructura pero conservar decisiones propias; `no` = no perseguir a Alegra en eso.
- **Prioridad**: `P0` afecta todas las pantallas y debe ir primero; `P1` se nota en la demo; `P2` módulo por módulo; `P3` pulido.

## Resumen ejecutivo: las 10 brechas que más pesan

1. **Tres escalas de título conviven en la misma app.** Hay 30 archivos con `text-3xl` (30 px), 39 con `text-2xl font-semibold` (24 px), 14 con `text-2xl` normal y 3 con `text-xl` (20 px). Alegra usa **20 px / 600** en listas, fichas y formularios. Es la inconsistencia más visible y la más barata de arreglar.
2. **Las migas de pan existen pero solo se usan en una pantalla** (`D/reportes/compras`). El pedido reciente de Waldy queda a medias: listas, fichas, formularios y reportes siguen entrando por “← Volver” o sin contexto.
3. **El formulario de factura cambió la jerarquía de Alegra.** “Ajustes” mezcla el pago recibido y esconde vendedor, almacén, centro de costo y lista de precios en “Más opciones”; faltan las pestañas “Factura convencional / rápida” y el botón “Vista previa”; el padding es 20 px (Alegra 32) y los totales 400 px (Alegra 320).
4. **Los detalles que no son de venta usan un patrón genérico.** Compras, pagos, notas, asientos, activos, ajustes y transferencias se pintan con tarjetas “Datos / Líneas / Pagos” y una `dl`, no con la tarjeta-documento (logo, empresa, número, información en grid, tabla con borde y totales) que sí tienen factura, cotización y conduce.
5. **El modo oscuro está a medias.** Las tablas y los tokens responden, pero `FormCard`, los inputs y el `DatePicker` son blancos con texto slate fijo; en oscuro el formulario queda como una hoja blanca sobre fondo azul. Además, Inicio usa hex sueltos (`#22c55e`, `#ef4444`, `#3b5bdb`).
6. **El panel de Preferencias desapareció.** Solo queda el botón de tema en la cabecera (claro/oscuro/sistema). La plantilla Studio Admin pide conservar tema, fuente, layout y sidebar; el store existe, la pantalla no.
7. **Cada formulario elige su ancho.** Listas 1289 px, factura/pagos 1040, notas/asientos 896, activos 768, gastos 672; reportes y configuración solo quedan limitados por el layout (hasta 1536). Alegra usa 1040 para vista/formulario y 1289 para lista. El gasto menor y el activo quedan visiblemente más angostos que el resto.
8. **Los estados de carga no se parecen a la pantalla que cargan.** Los esqueletos usan títulos distintos (“Facturación” vs “Facturas de venta”), tarjeta con `ring` y `rounded-xl` donde la lista real usa borde y `rounded-2xl`, y no dibujan toolbar ni pie. El `loading.tsx` de Inicio usa 30 px y otra rejilla.
9. **Las fichas de contacto y producto tienen datos de ejemplo y huecos `TODO backend` a la vista.** “Personas” son cinco registros inventados; categoría, unidad de medida y estado del producto salen “—”; notas, órdenes y transferencias del producto están marcadas “pendiente backend”.
10. **Reportes y configuración no comparten barra de filtros ni encabezado.** Cada reporte arma su `h1` y sus filtros; solo Compras tiene migas; el hub muestra “Flujo de caja” como “Próximamente” aunque existe “Estado de flujo de efectivo” en Contables.

**Lo que ya está cerca y no hay que rehacer:** el patrón de tablas unificadas (42 archivos con `TablaLista`), los campos de formulario (40 px, radio 10, etiqueta 14/500, asterisco primario), el detalle de factura/cotización/conduce (resumen, tarjeta-documento, pestañas), el sidebar (271 px, ítems 32, barra activa de 3 px), los estados vacíos con CTA, el NCF previsualizado (215×56 con engranaje) y la validación por campo en 26 formularios.

---

## 0. Pedidos recientes de Waldy: en qué van

| Pedido | Estado real | Pantallas | Falta |
|---|---|---|---|
| Migas de pan | Implementado el componente `C/migas-de-pan.tsx`; usado **solo** en `D/reportes/compras` | Reportes > Compras | Llevarlo a listas, fichas, formularios y al resto de reportes |
| Tablas unificadas | `C/listas/tabla-lista.tsx` + `TarjetaLista`/`BarraLista`/`PaginadorLista` en **59 archivos**; 42 usan `TablaLista` | Facturas, compras, pagos, notas, contactos, productos, inventario, contabilidad, bancos, configuración | Reportes quedaron fuera a propósito; faltan checkbox/filtros donde no hay datos y ocultar columnas en móvil |
| NCF | Vista previa de 215×56 con engranaje fuera, NCF en listas y numeraciones por tipo | Factura, compras, notas, pagos, numeraciones | “Preferida” y “Desactivar” por fila en Numeraciones; NCF en `font-mono` solo en algunas listas |
| Validación de formularios | 26 formularios con `noValidate` y errores por campo; `useValidacionFormulario` | Factura, compras, pagos, notas, recurrentes, inventario, contabilidad, bancos, configuración | Contacto y Numeraciones aún usan validación nativa; 9 archivos usan `<input type="date">` en vez del calendario |
| Búsqueda flotante | `CommandDialog` con enlaces del menú, reportes y recientes (Ctrl/⌘ K) | Cabecera | Solo navegación y reportes: no busca contactos, productos ni facturas (`// TODO backend`) |

---

## 1. Shell, navegación y sistema visual

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Menú lateral | `D/_components/sidebar/app-sidebar.tsx`, `nav-main.tsx`, `src/navigation/sidebar/sidebar-items.ts` | `GUIA-MENU.md`; `21-guia-menu-general.png` | 271 px, ítems de 32 px, ícono 20, texto 14/21, activo slate-200/45 + barra de 3×16; cabecera de 70 px con logo de 64 px | cerca | Medidas y estados coinciden; cambian la cabecera (Alegra 56, logo 120×40) y no existe el “+” de acción rápida al hover | parcial | P2 | Mantener base shadcn; decidir si el logo baja a 40 px o se queda la cabecera de 70 |
| Cabecera superior | `D/layout.tsx` | `GUIA-INICIO.md` §3 (56 px; buscador 427×32) | 70 px, buscador de 36 px centrado, botón de tema y avatar; sin ayuda “?” | medio | La altura y el buscador no son los de Alegra; el botón de tema es propio (Alegra no lo tiene) | parcial | P2 | El buscador global de Alegra no está documentado como paleta; conservar el nuestro |
| Migas de pan | `C/migas-de-pan.tsx`; solo `D/reportes/compras/page.tsx` | Sin captura de migas (Alegra usa “← Volver”, `GUIA-VISTA.md` §3.1) | Componente listo; 1 uso en todo el dashboard | lejos | El 95 % de las pantallas no dice dónde está el usuario; el pedido de Waldy no se completó | sí (pedido propio) | P0 | Formato propuesto: `Inicio / Módulo / Pantalla`; en fichas, `Contactos / Nombre` |
| Encabezado de página | Todas las `page.tsx` de `D/` | `GUIA-TABLAS.md` §3.1; `GUIA-VISTA.md` §3.2 (20 px / 600) | 30 px en 30 archivos, 24 px semibold en 39, 24 px normal en 14, 20 px en 3; subtítulos de 14 o 16 | lejos | No hay una escala única; la misma app se ve distinta según el módulo | sí | P0 | Crear `EncabezadoPagina` (título 20/600, subtítulo 14, acciones) y reemplazar los `h1` sueltos |
| Ancho del contenido | `C/listas/tabla-lista.tsx` (`ContenedorLista`), páginas de formulario | `GUIA-TABLAS.md` §2.1 (1289); `GUIA-VISTA.md` §2.1 y `GUIA-DISENO-FACTURA.md` §4.11 (1040) | Listas 1289; factura/pagos 1040; notas/asientos 896; activos 768; gastos 672; reportes/configuración limitados solo por el layout (hasta 1536) | medio | Un mismo formulario cambia de ancho según el módulo; los más angostos pierden la rejilla de 3 columnas | sí | P0 | Contenedor de lista 1289 y de formulario/detalle 1040; corregir el `max-w-2xl` de `gastos/nuevo` y el `max-w-3xl` de activos |
| Tablas unificadas | `C/listas/tabla-lista.tsx` y 42 usos | `GUIA-TABLAS.md`; `docs/diseno/tablas-unificadas.md` | Tarjeta con borde, radio 18 con el preset (la guía pide 16), toolbar 56, cabecera 48, filas 56, pie 56, pills 11, vacío con CTA, vencido en rojo | cerca | El patrón está; la diferencia es el “más aire” que pidió Waldy (Alegra 49/40/48/48) y 2 px de radio | sí (patrón) | P1 | No agregar checkbox/filtros/acciones a Facturas: decisión de Waldy; sí corregir el pie y el vacío |
| Formularios: campos y validación | `C/formularios/formulario.tsx`, `campo-formulario.tsx`, `validacion.ts` | `GUIA-FORMULARIOS.md`; `GUIA-DISENO-FACTURA.md` §6.1–6.4 | 40 px, radio 10, texto 16, etiqueta 14/500, asterisco primario, error inline; 26 formularios con `noValidate` | cerca | Las medidas base son las de Alegra y el error por campo es mejor que el “Requerido” de Alegra | sí | P1 | Falta unificar los 9 `<input type="date">` (gastos, asientos, compras, notas) al `DatePicker` |
| Comprobante / NCF | `C/documento-venta/documento-venta-form.tsx` (`NumeroComprobante`), `D/contabilidad/numeraciones` | `14-factura-tipos-ncf.png`; `19-pago-recibido-lapiz.png`; ALEGRA.md §14 | Caja de 215×56, NCF previsualizado sin consumirlo, engranaje a la derecha, tipos 01/02/03/04/13/14/15/16 | cerca | La pieza clave está; Numeraciones no marca “Preferida” ni permite “Desactivar” por fila como Alegra | sí | P2 | Formato mono del NCF: presente en notas/compras, ausente en Facturas |
| Botones | `C/ui/button.tsx` y usos | `GUIA-TABLAS.md` §3.1 (40/10); `GUIA-VISTA.md` §5.1 (36/40); `GUIA-DISENO-FACTURA.md` §6.5 (48) | Primario azul; alturas 36 (h-9), 44 (h-11) y 48 en pocos; radios variables | medio | No hay escala por contexto (lista 40, detalle 36, formulario 48); el color azul es correcto (marca) | parcial | P2 | Definir 3 tamaños y aplicarlos; no copiar el teal |
| Tarjetas y radios | `C/ui/card.tsx`, `FormCard`, `TarjetaLista`, fichas | `GUIA-INICIO.md` §5 (16); `GUIA-TABLAS.md` §4.4 (16); `GUIA-VISTA.md` §3.5 (12) | Listas 18 con borde; formularios 14 con borde; documento 12 con borde; Inicio 10 con ring; fichas 14 con ring | medio | Cuatro radios distintos para la misma jerarquía visual | sí | P1 | Unificar: lista 16, documento 12, tarjeta KPI 16; borde en vez de ring |
| Tipografía | `src/styles`, `layout.tsx`, clases sueltas | `GUIA-TABLAS.md` §4.2; `GUIA-INICIO.md` §2 | Inter; tabla 12/500 y 14/400 correctos; títulos 20/24/30; KPI 15/24 | medio | La tabla está bien; los títulos y los KPI no siguen una escala | sí | P1 | Escala propuesta: 20/600 página, 16/600 sección, 14/400 cuerpo, 12/500 cabecera |
| Colores y tokens | `src/styles/presets/medoxigas.css`; `D/_components/inicio/*` | `GUIA-DISENO-FACTURA.md` §7.2 (mapa teal → primario) | Tokens correctos; Inicio usa `#22c55e`, `#ef4444`, `#3b5bdb`, `#f4f5fb`, `#e2e8f0` en clases | medio | La marca vive en tokens, pero Inicio se salta el sistema | sí | P2 | Usar `--chart-*`, `--border`, `--background`; prohibir hex fuera de `src/components/ui` y papel |
| Panel de Preferencias | `src/stores/preferences`, `src/lib/preferences`; cabecera | No existe en Alegra; lo pide `docs/plantilla-diseno.md` | Store completo (tema, fuente, layout, sidebar); UI solo con el ciclo de tema | lejos | Se perdió una pantalla de la plantilla; el usuario no puede elegir fuente ni layout | parcial (reponer plantilla, no Alegra) | P2 | Un `Sheet` con tema, fuente, layout y sidebar; no hace falta copiar nada de Alegra |
| Búsqueda global | `D/_components/header/busqueda-global.tsx` | Sin captura (Alegra tiene buscador en la barra) | Paleta con enlaces del menú, reportes y recientes; sin contactos/productos/facturas | no medido / sin referencia | La interacción es buena; el alcance es solo navegación | parcial | P2 | `// TODO backend` ya marcado; cuando exista la consulta, agregar grupos |
| Modo oscuro | Tokens + clases `dark:` (77 usos) | Sin referencia (Alegra no documenta oscuro) | Tablas, menú y fichas responden; formularios, inputs y `DatePicker` quedan blancos | lejos | El formulario es la pantalla más usada y en oscuro se ve como una hoja blanca | parcial | P1 | Llevar `FormCard`, `FORM_*` y `DatePicker` a tokens (`bg-card`, `border-border`, `text-foreground`) |
| Móvil | Sidebar y layouts | `GUIA-MENU.md` §10; `GUIA-VISTA.md` §3.13; `18-guia-movil-600.png` | Cajón de 271 px, contenido a 1 columna, tablas con scroll horizontal; sin ocultar columnas | medio | El menú está bien; las listas de 9 columnas obligan a scroll largo y los formularios no tienen ajustes finos | parcial | P1 | Ocultar columnas secundarias con `hidden md:table-cell`; probar a 390 px |
| Estados vacíos | `C/listas/tabla-lista.tsx` (`ContenidoVacio`) | `GUIA-TABLAS.md` §3.10 | Ícono 40, título 18/600, texto 14, CTA si el rol puede; “Sin resultados” sin CTA | cerca | Es casi el de Alegra; solo cambia el tamaño del título | sí | P3 | Unificar el tono: “¡Aún no tienes…!” vs “Aún no hay…” |
| Estados de carga | `C/carga/esqueletos.tsx`, `loading.tsx` de cada módulo | `GUIA-INICIO.md` (skeleton); `01-catalogo-cuentas-cargando.png` | Esqueletos genéricos; tarjeta `rounded-xl` con `ring`; sin toolbar ni pie; títulos distintos a la página | medio | El salto de esqueleto a pantalla se nota; Inicio carga con 30 px y una rejilla que no es la final | sí | P1 | `EsqueletoLista` con toolbar/pie y `rounded-2xl`; `EsqueletoEncabezado` a 20 px; un esqueleto por tipo (lista, detalle, formulario) |

## 2. Login

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Login | `src/app/login/page.tsx`, `C/login-form.tsx` | Sin captura ni guía | Tarjeta de dos paneles, monograma “MC”, formulario correo/contraseña + Google, panel derecho `bg-muted` con nombre y bajada | no medido / sin referencia | Cumple la plantilla (dos paneles, monograma, español), pero no hay con qué compararlo con Alegra | no (conservar) | P3 | El panel derecho es gris neutro; si Waldy quiere marca, usar el azul y el logo, no una captura de Alegra |

## 3. Inicio

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Inicio: cartera y KPIs | `D/page.tsx`, `_components/inicio/bloques.tsx`, `tarjetas.tsx` | `12-inicio-arriba.png`, `12-inicio-medio.png`, `20-guia-inicio-kpis.png`, `GUIA-INICIO.md` §5 | 2 tarjetas grandes (CxC/CxP) con barra verde/roja y 4 pequeñas (impuestos, productos, devoluciones, clientes); selector “Mes actual” | cerca | El orden y los datos son los de Alegra; cambian radio (10 vs 16), valor (24 vs 20), título (15 vs 14) y hay hex sueltos | parcial | P1 | Ajustar tokens y tamaños; no copiar “Funciones sugeridas” |
| Inicio: gráfica | `_components/inicio/grafico-ventas-resumen.tsx` | `12-inicio-grafico-tooltip.png`, `12-inicio-grafico-expandido.png`, `GUIA-INICIO.md` §6–7 | Una gráfica de ventas (línea diaria / barras mensual), tooltip, comparación con año anterior; sin expandir ni eliminar | medio | La gráfica cumple; faltan las acciones flotantes (expandir, quitar) y el botón “Agregar gráfica” | parcial | P2 | Recharts en vez de ApexCharts: no cambiar la librería solo por esto |
| Inicio: funciones sugeridas / agregar gráfica | `D/page.tsx` | `12-inicio-sugeridas-facturacion.png`, `12-inicio-agregar-grafica-abierto.png` | No existen | lejos | Alegra tiene un bloque de onboarding y 4 gráficas opcionales; hoy no aportan al uso diario | no | P3 | No copiar: es onboarding de Alegra, no del negocio |

## 4. Facturación

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Lista de facturas | `D/facturacion/page.tsx`, `_components/facturas-tabla.tsx` | `01-facturas-venta-lista.png`, `21-tabla-facturas.png`, `GUIA-TABLAS.md` | Tarjeta única, buscador 32, tabla NCF/Tipo/Cliente/Fecha/Vencimiento/Total/Por cobrar/Estado, pills, vencido en rojo, paginación 25/50/100, vacío con CTA | cerca | Es el patrón canónico y ya está al 90 %; difieren el header 30, el alto de fila 56 (decisión) y la paginación | sí (patrón) | P0 | No agregar checkbox, “Filtrar” ni acciones de fila: decisión de Waldy; sí unificar título y pie |
| Nueva factura | `D/facturacion/nueva/page.tsx`, `C/documento-venta/documento-venta-form.tsx` | `01-factura-nueva-vacia.png`, `14-factura-tipos-ncf.png`, `18-factura-original.png`, `GUIA-DISENO-FACTURA.md` | Encabezado logo/empresa/NCF, tipo de comprobante, “Ajustes” (moneda, pago, cuenta, método, monto), cliente/fechas, líneas en grid, totales, “Más opciones”, Cancelar + Guardar | medio | La pieza visual está, pero la jerarquía no: el pago vive en “Ajustes”; vendedor, almacén, centro y lista están escondidos; faltan “Factura rápida” y “Vista previa”; padding 20 vs 32 y totales 400 vs 320 | parcial | P1 | Reordenar “Ajustes” a Moneda/Vendedor/Almacén/Centro/Lista y bajar el pago a su bloque; botones 48 |
| Detalle de factura | `D/facturacion/[id]/page.tsx`, `C/documento-venta/vista-documento-venta.tsx` | `19-vista-factura.png`, `GUIA-VISTA.md` | “← Volver”, título con NCF, etiqueta de estado, resumen de 4 montos + “Ver más”, tarjeta-documento, pestañas Pagos/Notas/Contabilidad; acciones ⋮/compartir/imprimir/+ pago | cerca | Es la pantalla más fiel; sobran “Clonar” como botón de texto y faltan las tarjetas de abajo (lista de precios, archivos) y comentarios | parcial | P1 | Mover Clonar al menú ⋮; “Comentarios” es opcional (GUIA-VISTA §3.12) |
| Cotizaciones: lista | `D/cotizaciones/page.tsx`, `_components/documentos-tabla.tsx` | Sin captura de lista; formulario en `07-cotizacion-vacia.png` | Tarjeta única, buscador, Número/Cliente/Creación/Estado/Total, pills, vacío | no medido (solo formulario) | Alegra no documenta la lista; se juzga contra el patrón de tablas | sí (patrón) | P2 | Comparte tabla con Conduces |
| Nueva cotización | `D/cotizaciones/nueva/page.tsx` | `07-cotizacion-vacia.png`, `GUIA-DISENO-FACTURA.md` §7.4 | Mismo `DocumentoVentaForm` sin comprobante, 2 columnas de información, “Más opciones” | cerca | La estructura es la de Alegra; hereda el problema de “Ajustes” de la factura | sí | P2 | Al corregir la factura, la cotización mejora sola |
| Detalle de cotización | `D/cotizaciones/[id]/page.tsx`, `C/documento-venta/vista-documento-venta.tsx` | `19-vista-cotizacion.png`, `GUIA-VISTA.md` §6 | Sin resumen, tarjeta-documento, pestañas Facturas/Conduces, Editar/Convertir, ⋮/compartir/imprimir | cerca | Igual a Alegra salvo “Clonar” suelto y las tarjetas de abajo | sí | P2 | Convertir ya es un menú con “en factura” y “en conduce” |
| Conduces: lista | `D/conduces/page.tsx` | Sin captura de lista; formulario en `07-remision-vacia.png` | Misma tabla de documentos | no medido (solo formulario) | Alegra no documenta la lista; se juzga contra el patrón de tablas | sí (patrón) | P2 | — |
| Nuevo conduce | `D/conduces/nueva/page.tsx` | `07-remision-vacia.png` | Mismo formulario, sin comprobante, 2 columnas, sin aviso de inventario en el formulario | cerca | La estructura es la de Alegra; el aviso de que no mueve inventario solo está en la descripción de la lista, no en el formulario | sí | P2 | Si Waldy quiere el aviso, que sea texto gris chico y no una barra |
| Detalle de conduce | `D/conduces/[id]/page.tsx` | `19-vista-conduce.png`, `GUIA-VISTA.md` §6 | Tarjeta-documento, pestañas Facturas/Cotización, Convertir | cerca | Igual salvo acciones | sí | P2 | — |
| Notas de crédito: lista | `D/notas-credito/page.tsx`, `_components/notas-credito-tabla.tsx` | `13-nc-venta-lista.png` | # / NCF / Factura / Cliente / Fecha / Total / Estado; buscador, paginación, vacío | cerca | Columnas y patrón correctos; NCF en mono (bien) | sí | P2 | — |
| Notas de débito: lista | `D/notas-debito/page.tsx`, `_components/notas-debito-tabla.tsx` | Sin captura de lista; formulario en `13-nd-venta-vacio.png` | # / NCF / Factura / Cliente / Fecha / Tipo / Total / Estado; buscador y paginación | no medido (solo formulario) | Alegra no documenta la lista; se juzga contra el patrón de tablas | sí (patrón) | P2 | — |
| Pagos recibidos: lista | `D/pagos-recibidos/page.tsx`, `_components/pagos-tabla.tsx` | Sin captura de lista; formulario en `04-pago-recibido-vacio.png` y `19-pago-recibido-*` | # / Fecha / Cliente / Factura / Método / Monto / Estado; buscador y paginación | no medido (solo formulario) | Alegra no documenta la lista; se juzga contra el patrón de tablas | sí (patrón) | P2 | — |
| Nuevo pago recibido | `D/pagos-recibidos/nuevo/page.tsx`, `C/pagos/pago-form.tsx` | `19-pago-recibido-vacio-arriba.png`, `19-pago-recibido-facturas.png`, `GUIA-FORMULARIOS.md` | Encabezado empresa/número, rejilla de 3, pestañas “Pago a factura de cliente”/“Otros ingresos”, tabla de facturas, total; página 1040 | cerca | Es el diseño nuevo de Alegra (una tarjeta, pestañas, 3 columnas); faltan probar estados de error y 640 px | sí | P1 | Comparte `PagoForm` con pago a proveedor |
| Detalle de pago recibido | `D/pagos-recibidos/[id]/page.tsx` | `04-pago-recibido-asiento.png` (asiento); sin captura del detalle | Tarjetas “Datos” y “Facturas aplicadas”; Ver asiento/Anular | medio | Genérico y sin imprimir; Alegra lo muestra como documento | parcial | P2 | Mismo shell de la fase 3 |
| Detalle de notas de crédito/débito | `D/notas-credito/[id]/page.tsx`, `D/notas-debito/[id]/page.tsx` | `13-nc-venta-detalle.png`, `13-nd-venta-detalle.png` | Tarjetas Datos/Líneas/Asiento; Ver asiento/Ver factura | medio | La información está; falta el patrón documento y el botón Imprimir | parcial | P2 | Mismo shell de la fase 3 |
| Nueva nota de crédito | `D/notas-credito/nueva/page.tsx`, `_components/nota-credito-form.tsx` | `13-nc-venta-vacio.png`, `16-nc-devolucion-lleno.png` | Obliga a entrar desde una factura; muestra líneas a acreditar, cantidad a devolver, notas | medio | Alegra deja elegir contacto y motivo DGII (“Anula el NCF”, “Corrige texto”, “Corrige monto”); aquí no hay selector de tipo | parcial | P2 | Agregar “Tipo de nota de crédito” si el backend lo soporta; si no, `// TODO backend` |
| Nueva nota de débito | `D/notas-debito/nueva/page.tsx`, `_components/nota-debito-form.tsx` | `13-nd-venta-vacio.png` | Cliente, tipo de nota, factura asociada, líneas, totales | cerca | Tiene el tipo que falta en la nota de crédito | parcial | P2 | Revisar el orden de campos contra el formulario de Alegra |
| Facturas recurrentes | `D/facturas-recurrentes/page.tsx`, `_components/facturas-recurrentes-tabla.tsx`, `nueva` | `17-factura-recurrente-vacia.png` | Lista con Cliente/Frecuencia/Inicio/Hasta/Última/Facturas; formulario con generación como borrador | no medido (solo formulario) | Alegra no tiene captura de la lista; el formulario sí está documentado | parcial | P3 | No hay acciones por fila más allá de entrar |

## 5. Compras

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Lista de compras | `D/compras/page.tsx` | `01-facturas-proveedor-lista.png`, `GUIA-TABLAS.md` | Número/NCF/Proveedor/Fecha/Vencimiento/Total/Pagado/Por pagar/Estado; buscador y paginación | cerca | Patrón correcto; título 24 (Alegra 20) | sí | P1 | Hermano directo de Facturas |
| Nueva factura de proveedor | `D/compras/nueva/page.tsx`, `_components/formulario-factura.tsx` | `06-compra-vacia.png`, `06-compra-llena.png` | `FormCard` “Datos de la factura”: proveedor, fechas, NCF, “Más opciones”, líneas en tarjetas, totales | medio | No hay encabezado de documento (empresa/logo/número); las líneas no son tabla; falta “Asignar NCF comprobante de compra” | parcial | P1 | En la captura de Alegra no se ve logo en el formulario de compra, pero sí una tabla de líneas |
| Detalle de compra | `D/compras/[id]/page.tsx` | `09-factura-proveedor-enlaces.png`, `09-factura-proveedor-pagos.png`, `06-compra-guardada.png` | Tarjetas “Datos”, “Líneas”, “Pagos asociados”, “Asiento contable”; incluye asiento (mejor que Alegra) | medio | La información está, pero el patrón es genérico y no la tarjeta-documento; el asiento está a la vista en vez de pestaña | parcial | P1 | Usar el shell de detalle de la fase 3 |
| Pagos a proveedores: lista | `D/compras/pagos/page.tsx` | Sin captura de lista; formulario en `06-pago-proveedor-vacio.png` y ALEGRA.md §6 | Número/Proveedor/Factura/Fecha/Método/Cuenta/Monto/Estado; buscador y paginación | no medido (solo formulario) | Alegra no documenta la lista; se juzga contra el patrón de tablas | sí (patrón) | P1 | — |
| Nuevo pago a proveedor | `D/compras/pagos/nuevo/page.tsx`, `C/pagos/pago-form.tsx` | `19-pago-proveedor-vacio.png`, `GUIA-FORMULARIOS.md` | Diseño nuevo: encabezado empresa/número, 3 columnas, pestañas facturas/otros egresos, tabla de facturas, total | cerca | Es mejor que el diseño viejo de Alegra; comparte el formulario con pago recibido | sí (diseño nuevo) | P1 | Alegra tiene dos diseños; conviene el nuevo |
| Detalle de pago a proveedor | `D/compras/pagos/[id]/page.tsx` | `06-pago-proveedor-asiento.png`, `09-pago-proveedor-enlaces.png` | Tarjetas “Datos” y “Facturas aplicadas”; acciones Ver asiento/Anular | medio | Falta imprimir y el patrón documento; Alegra muestra el pago como documento | parcial | P2 | — |
| Gastos menores: lista | `D/gastos/page.tsx`, `_components/gastos-tabla.tsx` | Sin captura de lista; formulario en `06-gasto-menor-vacio.png` | # / Comprobante / Fecha / Descripción / Proveedor / Cuenta / Pagado desde / Subtotal / ITBIS / Total / Estado | no medido (solo formulario) | Alegra no documenta la lista; se juzga contra el patrón de tablas | sí (patrón) | P2 | Muchas columnas |
| Nuevo gasto menor | `D/gastos/nuevo/page.tsx`, `_components/gasto-form.tsx` | `06-gasto-menor-vacio.png` | Formulario de una tarjeta, descripción/monto/fecha/cuenta/impuesto; fecha nativa; página `max-w-2xl` | medio | Se ve más angosto que el resto (672 px); Alegra lo presenta como un pago con encabezado | parcial | P1 | Corregir el ancho y usar `DatePicker`; el encabezado de empresa es opcional |
| Detalle de gasto menor | `D/gastos/[id]/page.tsx` | `06-gasto-menor-asiento.png` (asiento); sin captura del detalle | Tarjetas Datos/Líneas/Asiento; Anular | medio | Genérico y sin imprimir; Alegra lo trata como comprobante de egreso | parcial | P2 | Mismo shell de la fase 3 |
| Notas de crédito en compras: lista | `D/compras/notas-credito/page.tsx` | Sin captura de lista; formulario en `13-nc-compra-vacio.png` | Número/NCF/Factura/Proveedor/Fecha/Total/Estado | no medido (solo formulario) | Alegra no documenta la lista; se juzga contra el patrón de tablas | sí (patrón) | P2 | — |
| Nueva nota de crédito en compras | `D/compras/notas-credito/nueva/page.tsx` | `13-nc-compra-vacio.png` | Proveedor, NCF, fecha, líneas a acreditar, notas; página `max-w-4xl` | medio | Coincide en campos; el ancho es 896 y no 1040 | parcial | P2 | Alegra tampoco pide tipo de nota aquí |
| Detalle de nota de crédito de compra | `D/compras/notas-credito/[id]/page.tsx` | `13-nc-compra-detalle.png` | Tarjetas Datos/Líneas/Asiento; Anular | medio | Genérico y sin imprimir; Alegra la muestra como documento | parcial | P2 | Mismo shell de la fase 3 |
| Órdenes de compra: lista | `D/ordenes-compra/page.tsx` | Sin captura de lista (solo `17-orden-compra-vacia.png`) | Número/Proveedor/Fecha/Entrega/Total/Factura/Estado; buscador | no medido | Solo se documentó el formulario | parcial | P3 | — |
| Nueva orden de compra | `D/ordenes-compra/nueva/page.tsx` | `17-orden-compra-vacia.png` | Proveedor, fecha, entrega, almacén, líneas producto/gasto, totales | medio | La estructura es cercana; no hay encabezado de documento ni moneda | parcial | P3 | — |
| Pagos recurrentes | `D/pagos-recurrentes/page.tsx`, `nueva` | `17-pago-recurrente-vacio.png` | Tabla con Nombre/Contacto/Cuenta/Frecuencia/Próximo/Monto/Estado + “Generar” | no medido (solo formulario) | Sin captura de lista; el formulario tiene los campos de Alegra | parcial | P3 | — |

## 6. Contactos

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Lista de contactos | `D/contactos/page.tsx`, `_components/contactos-cliente.tsx` | `01-contactos-lista.png`, `GUIA-TABLAS.md` §5 | Tabs Todos/Clientes/Proveedores fuera de la tarjeta; buscador dentro; avatar + nombre, RNC, teléfono, tipo, lápiz; paginación | cerca | Muy cerca del patrón; faltan “Papelera”, “Ayuda” y el menú ⋮ (Alegra los tiene) | parcial | P1 | No agregar checkbox si no hay acciones masivas |
| Ficha de contacto | `D/contactos/[id]/page.tsx`, `_components/ficha-contacto.tsx`, `pestanas-documentos.tsx` | `09-ficha-cliente*.png`, `09-notas.md` | Panel con avatar, KPIs (CxC, anticipos, CxP, notas), tabs Resumen/Transacciones/Facturas/Cotizaciones/Conduces/Notas/Pagos/Compras/Asientos; “Personas” con 5 registros de ejemplo | medio | Es un diseño propio, más moderno, pero no el de Alegra; los datos de ejemplo y los `TODO backend` se ven | parcial | P1 | Quitar “Personas” hasta que exista tabla; alinear título 20 y radios; conservar KPIs |
| Estado de cuenta | `D/contactos/[id]/estado-cuenta/page.tsx` | `09-ficha-cliente-estado-de-cuenta.png`, `08-reporte-estado-de-cuenta-por-cliente.png` | Filtros corte/antigüedad, 3 KPIs (ventas, cobrado, por cobrar), tabla con antigüedad/días/estado/saldo, descargar e imprimir | medio | Tiene los datos de Alegra; agrega KPIs y no las pestañas de vencimiento | parcial | P2 | Revisar columnas “Retenido/Moneda” que Alegra sí muestra |

## 7. Productos

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Lista de productos | `D/productos/page.tsx`, `_components/productos-cliente.tsx` | `01-productos-lista.png`, `02-producto-guardado.png` | Nombre/Referencia/Precio/ITBIS/Existencia/Costo/Estado; buscador, selección múltiple, “Editar seleccionados”, importar, nuevo; sin selector de lista de precios | cerca | El patrón es el de Facturas + selección; Alegra tiene “Lista de precios” arriba y 4 acciones por fila | parcial | P1 | Título 30; no agregar filtro si la consulta no lo soporta |
| Ficha de producto | `D/productos/[id]/page.tsx`, `ficha-producto.tsx`, `informacion-general.tsx`, `tablas-producto.tsx` | `09-ficha-producto*.png`, `09-notas.md` | Panel con KPIs, tabs Información/Facturas venta/compra/Notas/Cotizaciones/Conduces/Órdenes/Transferencias/Kárdex; almacén, existencia y cuentas | medio | El diseño es propio y completo; hay huecos visibles: categoría, unidad y estado “—”, y 4 pestañas “pendiente backend” | parcial | P1 | Resolver datos o marcar “No disponible” sin prometer pestaña; alinear tokens |
| Modal nuevo/editar producto | `D/productos/_components/productos-cliente.tsx` (diálogo) | `02-producto-vacio.png`, `02-producto-lleno.png` | Diálogo con secciones, precios por lista, inventario, impuesto; `FormCard` interno | medio | Alegra usa un formulario de página completa, no un diálogo; el nuestro es más corto | parcial | P2 | Mantener diálogo por rapidez; cuidar el scroll en móvil |

## 8. Inventario

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Ajustes de inventario: lista | `D/inventario/ajustes`, `_components/ajustes-tabla.tsx` | Sin captura (ALEGRA.md §1) | Número/Fecha/Almacén/Total ajustado/Estado/Observaciones; vacío con CTA | no medido | Alegra solo documenta columnas, no diseño | sí (patrón) | P2 | — |
| Nuevo ajuste / detalle | `D/inventario/ajustes/nuevo`, `[id]` | Sin captura | `FormCard` con producto/tipo/cantidad/costo; detalle con tarjetas | no medido | Se juzga contra el patrón de formularios | parcial | P3 | — |
| Transferencias: lista | `D/inventario/transferencias`, `_components/transferencias-tabla.tsx` | Sin captura | Número/Fecha/Origen/Destino/Productos/Estado | no medido | Sin referencia de Alegra | sí (patrón) | P2 | — |
| Nueva transferencia / detalle | `D/inventario/transferencias/nueva`, `[id]` | Sin captura | Formulario con origen/destino/líneas; detalle genérico | no medido | Sin referencia | parcial | P3 | — |
| Almacenes | `D/inventario/almacenes` | Sin captura (ALEGRA.md §1) | Tabla Nombre/Principal/Estado + diálogo nuevo/editar | no medido | Sin referencia | sí (patrón) | P2 | — |
| Categorías | `D/inventario/categorias` | Sin captura | Tabla Nombre/Descripción/Estado + diálogo | no medido | Sin referencia | sí (patrón) | P2 | — |
| Listas de precios | `D/inventario/listas-precios` | ALEGRA.md §1 (Nombre, Principal, Tipo) | Tabla Nombre/Principal/Tipo/Estado + diálogo | no medido | Alegra no tiene captura; las columnas coinciden | sí (patrón) | P2 | — |

## 9. Contabilidad

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Catálogo de cuentas | `D/contabilidad/page.tsx`, `_components/catalogo-cuentas.tsx` | `11-catalogo-arbol.png`, `11-catalogo-cuenta-*.png`, `02-catalogo-cuentas.png` | Árbol con búsqueda, expansión, panel lateral de detalle, acciones crear subcuenta/editar/ver movimientos; tabla de configuración contable debajo | medio | El árbol y el panel cumplen; faltan “Personalizar vista”, “Saldos iniciales”, “Exportar”, “Cuentas eliminadas” y columnas de uso/naturaleza | parcial | P2 | El título 30 y el panel lateral no son de Alegra, pero funcionan |
| Detalle de cuenta | `D/contabilidad/cuentas/[id]/page.tsx` | `11-catalogo-cuenta-movimientos.png` | Encabezado, movimientos con saldo acumulado, enlaces a asiento | medio | Tiene los datos; el patrón es tabla simple, no el reporte “Movimientos por cuenta” de Alegra | parcial | P2 | — |
| Asientos: lista | `D/contabilidad/asientos/page.tsx` | `12-asientos-lista.png` | Número/Fecha/Descripción/Origen/Total; buscador, filtro de fechas, paginación | cerca | Patrón correcto | sí | P2 | — |
| Nuevo asiento | `D/contabilidad/asientos/nuevo` | `12-asiento-vacio.png`, `12-asiento-descuadrado.png`, `12-asiento-lleno.png` | Fecha, líneas cuenta/contacto/centro/débito/crédito, totales y diferencia; guarda bloqueado si descuadra | cerca | Coincide y mejora a Alegra (allí se podía guardar descuadrado) | sí | P2 | Página `max-w-4xl` (896) vs 1040 |
| Detalle de asiento | `D/contabilidad/asientos/[id]/page.tsx` | `12-asiento-detalle.png` | Tarjetas Datos/Líneas + estado cuadrado/descuadrado | medio | Genérico; Alegra muestra el asiento como documento con “Mostrar detalles” | parcial | P2 | — |
| Activos fijos: lista | `D/contabilidad/activos/page.tsx` | `12-activos-lista.png` | Activo/Adquisición/Monto/Depreciado/Valor actual/Estado | cerca | Patrón correcto | sí | P2 | — |
| Nuevo activo / detalle | `D/contabilidad/activos/nuevo`, `[id]` | `12-activo-vacio.png`, `12-activo-lleno.png`, `12-activo-avanzadas.png`, `12-activo-detalle.png` | Formulario en `max-w-3xl`; detalle con Datos/Depreciaciones; botón Depreciar | medio | Campos cercanos; el ancho es 768 y faltan las opciones avanzadas y la foto/adjuntos | parcial | P2 | Depreciar pide confirmación (mejor que Alegra) |
| Numeraciones | `D/contabilidad/numeraciones/page.tsx`, `_components/numeraciones-cliente.tsx` | `14-numeraciones-lista.png`, `02-numeraciones.png`, `14-numeracion-vacia.png` | Tabla plana con tipo/nombre/prefijo/siguiente/hasta/vence/activa; edición en diálogo | medio | Alegra agrupa por documento, marca “Preferida” y permite “Desactivar” por fila | parcial | P2 | Falta “Preferida”; el tipo 13 (gastos menores) ya está |
| Periodos contables | `D/contabilidad/periodos/page.tsx` | `17-cierre.png` | Rejilla de meses con estado y acciones cerrar/reabrir; selector de año | medio | Alegra tiene “Cerrar año” y no explica a qué cuenta cierra; el nuestro es por mes | parcial | P2 | Mantener el control por mes; no copiar el “Cerrar año” sin definición contable |

## 10. Bancos

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Bancos y caja: lista | `D/bancos/page.tsx`, `_components/panel-bancos.tsx` | `10-bancos-lista.png` | Tabla con cuenta/tipo/número/saldo/conciliación; “Transferir”, “Agregar banco”, depósito; saldo negativo en rojo | cerca | La lista y los saldos están; faltan las acciones del menú de Alegra (crear pago, conciliar, desactivar) | parcial | P2 | — |
| Detalle de cuenta | `D/bancos/[id]/page.tsx` | `10-bancos-cuenta-detalle.png`, `10-bancos-cuenta-asiento.png` | Encabezado con saldo, filtros de fecha, movimientos con totales, botón Conciliar | medio | Tiene lo esencial; no hay “Editar”, “Crear pago recibido”, “Crear pago”, “Transferir”, “Desactivar” | parcial | P2 | — |
| Transferencia | `D/bancos/_components/panel-bancos.tsx` (diálogo) | `10-bancos-transferencia-vacia.png`, `10-bancos-transferencia-llena.png` | Diálogo origen/destino/monto/fecha/descripción | cerca | Los campos coinciden; Alegra lo hace en página con numeraciones opcionales | parcial | P2 | — |
| Conciliaciones: lista | `D/bancos/conciliaciones/page.tsx` | `10-bancos-conciliacion-lista.png` | Cuenta/Período/Saldo del extracto/Estado/Asiento | cerca | Patrón correcto | sí | P2 | — |
| Nueva conciliación / detalle | `D/bancos/conciliaciones/nueva`, `[id]` | `10-bancos-conciliacion-vacia.png`, `10-bancos-conciliacion-movimientos.png`, `10-bancos-conciliacion-resultado.png` | Formulario con cuenta, rango, saldo, gastos/impuestos/entradas, resumen y movimientos seleccionables | cerca | La pieza funcional está; el diseño es más de app que el de Alegra, pero cumple | parcial | P2 | — |

## 11. Reportes

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Hub de reportes | `D/reportes/page.tsx`, `_components/reportes-explorador.tsx` | `08-reportes-inicio.png`, `01-reportes-inicio.png` | Tarjetas por categoría con ícono, conteo y búsqueda; “Próximamente” en Flujo de caja | medio | La navegación por tarjetas es clara; Alegra usa una lista lateral de categorías y favoritos | parcial | P2 | Corregir “Flujo de caja”: existe “Estado de flujo de efectivo” en Contables |
| Reportes de ventas | `D/reportes/ventas-generales`, `ventas-producto`, `ventas-cliente`, `rentabilidad-producto`, `ventas-vendedor`, `ventas-almacen` | `08-reporte-ventas-generales.png`, `08-reporte-ventas-por-*.png` | `EncabezadoReporte` (24 px) + filtros sueltos + tarjetas/gráfico/tabla; `SelectorRangoFechas` tipo pastilla | medio | Los datos y filtros están; falta una barra de filtros unificada y el título de 20 | parcial | P2 | Algunos usan “Aplicar”, otros navegan al cambiar |
| Cuentas por cobrar / pagar | `D/reportes/cxc`, `cxp` | `08-reporte-cuentas-por-cobrar*.png`, `08-reporte-cuentas-por-pagar*.png` | Header propio + filtros + pestañas de antigüedad + tarjeta de total + tabla + paginador | medio | Es uno de los reportes más completos; el header no usa `EncabezadoReporte` y no hay migas | parcial | P2 | Título 24; columnas y subtotales cerca de Alegra |
| Reportes contables | `D/reportes/libro-diario`, `balance-comprobacion`, `estado-resultados`, `situacion-financiera`, `flujo-efectivo`, `auxiliar-tercero`, `movimientos-cuenta*` | `08-reporte-libro-diario.png`, `08-reporte-balanza-de-comprobacion.png`, `08-reporte-estado-de-resultados.png`, etc. | Encabezado 24 + filtros + tabla (muchas con `Card`), algunas con gráfico; sin toolbar de lista | medio | La función está; el estilo no comparte tipografía/pie con las listas y los filtros cambian de forma | parcial | P2 | No migrar a `TablaLista` (decisión de tablas-unificadas), solo igualar cabecera/celdas |
| Reportes fiscales | `D/reportes/606`, `607`, `608`, `it1`, `impuestos-detallados`, `impuestos-retenciones`, `ir-17`, `cartas-retencion` | `08-reporte-reporte-606.png`, `607`, `608`, `it1`, `detallado-de-impuestos`, `ir-17`, `cartas-de-retencion` | Formato DGII, tablas propias, botones de exportar | medio | El diseño es secundario frente al formato; falta encabezado/migas común | parcial | P2 | No tocar columnas ni cálculos |
| Reporte anual | `D/reportes/reporte-anual` | `08-reporte-reporte-anual*.png` | Resumen, tarjetas con gráfico/tabla, rankings | medio | Cerca en contenido; el diseño usa tarjetas propias | parcial | P2 | — |
| Exportar para el contador | `D/reportes/exportar-contador` | `08-reporte-exportar-facturas.png`, `08-reporte-informe-contador.png` | Página con rango de fechas y exportación | medio | Alegra lo resuelve con un diálogo; el nuestro es una página | parcial | P3 | — |

## 12. Configuración y preferencias

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Hub de configuración | `D/configuracion/page.tsx` | `01-configuracion-inicio.png` | Grupos Empresa/Facturación/Impuestos/Contabilidad en tarjetas con ícono | medio | Alegra usa un menú lateral de configuración; el nuestro es un índice de tarjetas | parcial | P2 | Título 30; funciona bien como índice |
| Empresa | `D/configuracion/empresa` | `01-configuracion-inicio.png`, `05-logo-subir.png`, `05-logo-guardado.png` | Formulario 1040 con nombre/RNC/dirección/teléfono/correo/logo, vista previa y borrado | cerca | Campos y logo están; el logo de Alegra se recorta, el nuestro no (mejor) | sí | P2 | — |
| Impuestos | `D/configuracion/impuestos` | Sin captura (ALEGRA.md §1: /tax) | Tabla Grupo/Impuesto/Tasa/Cuenta por pagar/Estado | no medido | Sin referencia de diseño | sí (patrón) | P2 | — |
| Plantillas de impresión | `D/configuracion/plantillas-impresion` | `05-plantillas-impresion.png` | Tarjetas por tipo de documento con notas, términos y logo | medio | Alegra tiene editor de plantilla con estilos; el nuestro es más simple | parcial | P2 | No copiar el editor completo |
| Usuarios y roles | `D/configuracion/usuarios` | Sin captura (ALEGRA.md §1) | Tabla Nombre/Correo/Rol/Creado | no medido | Sin referencia | sí (patrón) | P3 | — |
| Vendedores, centros de costo, monedas, retenciones, términos | `D/configuracion/*` | Sin captura | Tablas + diálogos con el patrón unificado | no medido | Alegra no tiene capturas de estas pantallas | sí (patrón) | P3 | — |
| Preferencias | No hay ruta | No existe en Alegra | Solo el botón de tema en la cabecera | lejos (vs plantilla) | Falta el panel que pide `docs/plantilla-diseno.md` | parcial | P2 | Reponer con el store existente; no es fidelidad a Alegra |

## 13. Estados, móvil y modo oscuro

| Módulo/Pantalla | Ruta/Archivo | Referencia Alegra | Estado actual | Distancia | Por qué | Recomendación | Prioridad | Notas |
|---|---|---|---|---|---|---|---|---|
| Vacío de lista | `C/listas/tabla-lista.tsx` | `21-tabla-vacia.png`, `01-facturas-venta-lista.png` | Ícono 40 + título + texto + CTA; “Sin resultados” sin CTA; el pie se conserva | cerca | Es el patrón; solo el título es 18 vs 20 | sí | P3 | — |
| Vacío de ficha/reporte | Fichas y reportes | `09-ficha-*`, `08-reporte-*` | `Empty` de shadcn con ícono/título/texto; algunos usan `EstadoVacio` propio | medio | Tres implementaciones de vacío en la app | sí | P2 | Unificar en `EstadoVacioLista` o `Empty` |
| Carga de lista | `C/carga/esqueletos.tsx` | `GUIA-INICIO.md`; `01-catalogo-cuentas-cargando.png` | Esqueleto sin toolbar/pie; tarjeta `ring` y `rounded-xl` | medio | No coincide con la tarjeta real; el ojo ve un salto | sí | P1 | Igualar `TarjetaLista` y `BarraLista` |
| Carga de detalle/formulario | `EsqueletoDetalle`, `EsqueletoFormulario` | Sin captura específica | Tarjetas genéricas; no reproducen resumen + documento ni la tarjeta de formulario | medio | El detalle de factura carga con 4 KPI + lista, que no es su layout | sí | P1 | Esqueletos por tipo (documento, ficha, formulario) |
| Móvil: menú | `app-sidebar.tsx` | `21-guia-menu-movil.png`, `21-guia-menu-movil-cerrado.png`, `GUIA-MENU.md` §10 | Cajón de 271 px con velo; cierra al navegar | cerca | Coincide con Alegra; el ancho del cajón es 288 en shadcn | parcial | P2 | Medir 271 vs 288; no urgente |
| Móvil: listas | `TablaLista` | Sin captura (Alegra no documenta tablas móvil) | Scroll horizontal; sin columnas ocultas; toolbar y pie se apilan | no medido | Funciona, pero 9 columnas en 390 px es incómodo | parcial | P1 | Ocultar secundarias; nunca ocultar montos ni estado |
| Móvil: formularios/detalle | Formularios y `vista-documento-venta` | `18-guia-movil-600.png`, `GUIA-VISTA.md` §3.13 | Rejillas a 1 columna; encabezado en columna; totales a la izquierda | cerca | La factura sigue los breakpoints de Alegra; los formularios de compras/gastos no siempre | parcial | P2 | Revisar 390 px en cada fase |
| Modo oscuro: tablas/menú | Tokens + `dark:` | Sin referencia | Funciona; pills y hover tienen variante | cerca | Es lo más pulido del oscuro | sí | P2 | Mantener |
| Modo oscuro: formularios | `FormCard`, `FORM_*`, `DatePicker` | Sin referencia | Blancos con texto slate fijo; no cambian | lejos | Contraste y coherencia rotos en la pantalla más usada | parcial | P1 | Tokens semánticos; probar contraste AA |

---

## 14. Brechas sistémicas (lo que se repite en todas las pantallas)

### 14.1 Encabezado y jerarquía
- No hay un componente único de encabezado. Conviven `h1` de 20, 24 y 30 px, con y sin subtítulo, con acciones a la derecha o debajo.
- Alegra usa 20/600 en lista, ficha y formulario. La plantilla Studio Admin sugiere 30. Hay que **elegir una** y aplicarla; hoy lo peor es que conviven.
- Las migas de pan son la excepción, no la regla. El usuario pierde el módulo al entrar a un detalle.

### 14.2 Anchos y rejilla
- 1289 (lista), 1040 (factura/pagos), 896 (notas/asientos), 768 (activos), 672 (gastos), hasta 1536 en reportes/configuración (solo el layout).
- Los formularios angostos pierden la rejilla de 3 columnas y se ven como una ficha, no como un documento.
- Las tarjetas KPI de Inicio usan 10 px de radio; las listas 18; los formularios 14; las fichas 14 con `ring`; el documento 12. No hay un sistema de radios.

### 14.3 Formularios
- La base (40 px, radio 10, etiqueta 14/500, asterisco primario, error inline) es correcta y consistente en 26 formularios.
- Falla la composición: “Ajustes” de la factura mezcla pago; los campos de venta están escondidos; los totales del formulario son 400 px y los del detalle 320; el padding es 20 y no 32.
- Fechas: 15 archivos usan `DatePicker`; 9 usan `<input type="date">` (compras, gastos, asientos, notas, numeraciones, cuentas, estado de cuenta). El calendario de Alegra está bien replicado en `DatePicker` y en el selector de reportes; falta usarlo siempre.
- Botones: no hay escala por contexto; “Cancelar” aparece en formularios donde Alegra solo tiene “Guardar” (pago recibido), y falta “Vista previa” en la factura.

### 14.4 Tablas
- El patrón unificado ganó: 42 archivos con `TablaLista`, 59 con los contenedores. Es el mayor logro de diseño del repo.
- Decisiones deliberadas: sin checkbox, sin “Filtrar” y sin acciones de fila en Facturas; filas de 56 en vez de 48; paginación 25/50/100 en vez de 10/20/30. Están documentadas en `tablas-unificadas.md`; no son un error.
- Lo que falta: ocultar columnas en móvil, unificar el pie (Alegra 48, el nuestro 56), y decidir si el NCF va en mono en todas las listas (hoy solo en notas/compras).

### 14.5 Tarjetas y detalle de documentos
- Factura, cotización y conduce usan la tarjeta-documento correcta (logo/empresa/número, información en grid, tabla con borde, totales 320).
- Compras, pagos, notas, asientos, activos, ajustes y transferencias usan `Card` + `dl` + `Table` genérica. La información está, pero el lenguaje visual cambia al cruzar de módulo.
- No hay un shell de detalle reutilizable. Cada detalle repite “← Volver + título + Badge + tarjetas”.

### 14.6 Estados
- Vacíos: bien en listas; tres variantes en fichas/reportes.
- Carga: esqueletos genéricos que no reproducen la pantalla; Inicio con título de 30 y rejilla distinta.
- Error: `AlertaError` común en reportes; en formularios, error inline + `Alert` general. Correcto.

### 14.7 Tokens y modo oscuro
- La marca vive en `src/styles/presets/medoxigas.css`; el azul `#1e56c7` es el correcto.
- Inicio rompe el sistema con hex sueltos y radios de 10.
- Los formularios no usan tokens: `bg-white` y `text-slate-700` fijos. En oscuro se ven blancos.
- No hay referencia de Alegra para oscuro; la meta es coherencia, no copia.

### 14.8 Navegación y búsqueda
- Sidebar muy cerca de Alegra; cabecera 70 vs 56; logo 64 vs 40; falta “+” al hover.
- Búsqueda global solo navega; no busca entidades. El `TODO backend` está marcado.
- Preferencias: store completo, UI ausente.

---

## 15. Plan priorizado de agentes (solo para lo que Waldy apruebe con “sí”)

> Regla: cada fase toca archivos disjuntos, o corre en secuencia respecto a la fase con la que comparte un archivo. Deja `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build` en verde, y agrega un candado (test o regla) para que la corrección no se pierda. Nada de `src/components/ui`, `supabase`, `src/lib` de datos ni migraciones.

### Fase 1 — Sistema de página (P0, bloqueante)
**Objetivo:** una sola escala de título, migas de pan y anchos.
**Archivos:** nuevo `C/pagina/encabezado-pagina.tsx` y `C/pagina/contenedor-pagina.tsx`; `C/migas-de-pan.tsx`; `C/listas/tabla-lista.tsx` (`ContenedorLista`); `C/carga/esqueletos.tsx`; después, las `page.tsx` de `D/` por módulos.
**Tareas:**
1. **1a (PR base):** crear `EncabezadoPagina` (título 20/600, subtítulo 14, acciones y migas opcionales) y `ContenedorFormulario`/`ContenedorDetalle` (1040); migrar Facturas, Compras y Nueva factura como piloto.
2. **1b (un PR por módulo):** reemplazar los 4 estilos de `h1` por el componente; añadir `MigasDePan` a listas, fichas, formularios y reportes (excepto Inicio).
3. Fijar `ContenedorLista` 1289 y usar los contenedores de 1040; corregir `gastos/nuevo` y `activos/nuevo`.
4. Igualar `EsqueletoEncabezado` a 20 px y `EsqueletoLista` a la tarjeta real.
**Candado:** `src/lib/diseno-paginas.test.ts` — ningún `page.tsx` de `D/` puede tener `h1.text-3xl` ni un `max-w-2xl/3xl/4xl` en el contenedor de formulario; las páginas de detalle deben importar `MigasDePan` (lista de excepciones explícita).
**Aceptación:** captura de Facturas, Compras, Ficha de contacto y Nueva factura en claro; títulos a 20 px; migas visibles.

### Fase 2 — Factura (P1)
**Objetivo:** devolver la jerarquía de Alegra sin perder lo ganado.
**Archivos:** `C/documento-venta/documento-venta-form.tsx`, `C/documento-venta/vista-documento-venta.tsx`.
**Tareas:**
1. “Ajustes” = Moneda, Vendedor, Almacén, Centro de costo, Lista de precios (5 columnas); mover el pago a un bloque debajo de totales con numeración/fecha/cuenta/método/valor.
2. Agregar “Vista previa” (48 px) junto a “Guardar”; conservar “Cancelar” solo si Waldy lo pide.
3. Padding 32 en `md`, 20 en `sm`, 12 en móvil; totales 320.
4. Mover “Clonar” al menú ⋮; dejar ⋮/compartir/imprimir/+ pago.
5. Evaluar pestañas “Factura convencional / rápida” (si el backend lo permite; si no, `// TODO backend`).
**Candado:** `src/lib/factura-form.test.ts` (estructura: “Ajustes” contiene vendedor/almacén/lista; el pago no está en “Ajustes”; el botón Vista previa existe) + e2e de NCF y guardado.
**Aceptación:** el formulario se ve como `18-factura-original.png` en claro y en oscuro; NCF sigue previsualizando.

### Fase 3 — Shell de detalle de documentos (P1)
**Objetivo:** que compras, pagos, notas, asientos, activos, ajustes y transferencias hablen el mismo idioma que la factura.
**Archivos:** nuevo `C/documento/documento-detalle.tsx`; `D/compras/[id]`, `D/compras/pagos/[id]`, `D/notas-credito/[id]`, `D/notas-debito/[id]`, `D/compras/notas-credito/[id]`, `D/gastos/[id]`, `D/contabilidad/asientos/[id]`, `D/contabilidad/activos/[id]`, `D/inventario/ajustes/[id]`, `D/inventario/transferencias/[id]`, `D/bancos/transferencias/[id]`.
**Tareas:**
1. Shell con “← Volver”, título 20 + estado, acciones, resumen opcional, tarjeta-documento, secciones/pestañas.
2. Migrar un módulo por PR para no romper `colSpan`, totales ni impresión.
3. Agregar “Imprimir” donde Alegra lo tiene (pago, nota, asiento).
**Candado:** `src/lib/detalles.test.ts` — las páginas migradas importan `DocumentoDetalle` y no definen su propio `h1`/`Card` de cabecera.
**Aceptación:** Compras, Pago y Nota de crédito se ven como hermanos de Factura; capturas claro/oscuro.

### Fase 4 — Fichas (P1/P2)
**Objetivo:** conservar el diseño propio, quitar la ficción.
**Archivos:** `D/contactos/[id]/_components/ficha-contacto.tsx`; `D/productos/[id]/_components/ficha-producto.tsx`, `informacion-general.tsx`, `tablas-producto.tsx`.
**Tareas:**
1. Eliminar `PERSONAS_EJEMPLO` o moverlo a un estado vacío “Sin personas registradas”.
2. Resolver categoría/unidad/estado del producto o mostrar “No disponible” sin prometer pestaña.
3. Reemplazar las 4 pestañas “pendiente backend” por una sola sección “Documentos pendientes de backend” o quitarlas.
4. Alinear título 20, radio 12/16 y tipografía de KPIs.
**Candado:** `src/lib/fichas.test.ts` — prohíbe `PERSONAS_EJEMPLO` y `TODO backend` visibles en fichas.
**Aceptación:** ficha de contacto y producto sin datos inventados; capturas.

### Fase 5 — Reportes y configuración (P2)
**Objetivo:** una barra de filtros y un encabezado común.
**Archivos:** `D/reportes/_components/encabezado-reporte.tsx`; `D/reportes/*/page.tsx`; `D/configuracion/_components/encabezado.tsx`.
**Tareas:**
1. `EncabezadoReporte` con migas, título 20, subtítulo, rango y acciones (descargar/imprimir).
2. Barra de filtros común (fechas, contacto, NCF, “Aplicar”) sin cambiar cálculos.
3. Corregir “Flujo de caja” del hub (enlazar a `flujo-efectivo` o quitarlo de “Próximamente”).
4. Encabezado de configuración a 20 y migas.
**Candado:** `src/lib/reportes-encabezado.test.ts` — todos los reportes usan `EncabezadoReporte`; no hay `h1` suelto.
**Aceptación:** Ventas generales, CxC y Compras con la misma barra; capturas.

### Fase 6 — Oscuro, móvil, carga y preferencias (P1/P2)
**Objetivo:** cerrar la deuda transversal.
**Archivos:** `C/formularios/formulario.tsx`, `C/date-picker.tsx`, `C/documento-venta/documento-venta-form.tsx`, `D/_components/inicio/*`, `C/carga/esqueletos.tsx`, `D/_components/header/*`, nuevo `C/preferencias/panel-preferencias.tsx`.
**Tareas:**
1. `FormCard`/`FORM_*`/`DatePicker` a tokens semánticos; corregir contraste en oscuro.
2. Sustituir hex de Inicio por `--chart-*`/`--border`/`--background`.
3. `hidden md:table-cell` en columnas secundarias de Facturas, Compras, Pagos, Productos y Contactos.
4. Reponer el panel de Preferencias (tema, fuente, layout, sidebar) con el store existente.
5. Esqueletos por tipo y con la tarjeta real.
**Candado:** `src/lib/tokens.test.ts` (sin hex fuera de `ui`/papel), e2e de 390 px sin overflow del `body`, captura oscura de Nueva factura.
**Aceptación:** formulario oscuro coherente; lista usable en 390 px; preferencias abre y guarda.

### Fase 7 — Pulido (P3)
- NCF en mono en todas las listas.
- Paginación: decidir 10/20/30 o 25/50/100 (recomendación: mantener 25/50/100).
- Cabecera 56 vs 70 y logo 40 vs 64 (solo si Waldy lo pide).
- “+” de acción rápida en el menú.
- Estados vacíos: unificar títulos y el componente.

### Paralelismo y orden
- **Fase 1a** bloquea: define el componente y el candado. **1b** se reparte por módulos.
- **Fases 2, 3, 4 y 5** pueden ir en paralelo (archivos disjuntos).
- **Fase 6** después de 1 y 2 (depende de los tokens del formulario).
- **Fase 7** al final.
- Un PR por fase o subfase; diff < 400 líneas sin contar generados; capturas claro/oscuro/móvil en cada uno.

---

## 16. Decisiones que necesita Waldy (marcar sí/no)

1. **Título de página:** ¿20 px como Alegra o 30 px como la plantilla? Recomendación: 20 px en listas, fichas, detalles y formularios; 20 en Inicio.
2. **Migas de pan:** ¿en todas las pantallas o solo en reportes? Recomendación: todas, con `Inicio / Módulo / Pantalla`.
3. **Factura:** ¿“Ajustes” vuelve a Moneda/Vendedor/Almacén/Centro/Lista y el pago baja a su bloque? Recomendación: sí.
4. **Factura:** ¿se agrega “Vista previa” y se quita “Cancelar”? Recomendación: sí a Vista previa; conservar Cancelar solo si se usa.
5. **Detalles no-venta:** ¿se migran al shell de documento? Recomendación: sí, por módulos.
6. **Modo oscuro:** ¿los formularios siguen el tema o se quedan claros como “papel”? Recomendación: seguir el tema.
7. **Preferencias:** ¿se repone el panel de la plantilla? Recomendación: sí, aunque Alegra no lo tenga.
8. **Fichas:** ¿se conserva el diseño con KPIs o se aplana al de Alegra? Recomendación: conservar, limpiando datos de ejemplo.
9. **Reportes:** ¿barra de filtros común y migas? Recomendación: sí, sin tocar cálculos.
10. **Tablas:** ¿se mantienen las decisiones de Waldy (sin checkbox/filtros/acciones en Facturas, 25/50/100)? Recomendación: sí.
11. **Comentarios/adjuntos en documentos:** ¿se agregan? Recomendación: no por ahora (guía §3.12 los llama opcionales).
12. **Paginación:** ¿10/20/30 de Alegra o 25/50/100 actual? Recomendación: 25/50/100.

---

## 17. Anexo: no medido / sin referencia

| Tema | Por qué no se midió |
|---|---|
| Login | Alegra no tiene captura ni guía del login; solo se comparó con la plantilla. |
| Ajustes de inventario, transferencias, almacenes, categorías, listas de precios | ALEGRA.md documenta el menú y las columnas, pero no hay capturas ni guía CSS. |
| Órdenes de compra: lista | Solo se capturó el formulario (`17-orden-compra-vacia.png`). |
| Pagos recurrentes: lista | Solo se capturó el formulario (`17-pago-recurrente-vacio.png`). |
| Facturas recurrentes: lista | Solo se capturó el formulario. |
| Configuración: impuestos, usuarios, vendedores, centros, monedas, retenciones, términos | Sin capturas; solo el menú de ALEGRA.md §1. |
| Modo oscuro | Alegra no documenta modo oscuro. |
| Tablas y formularios en móvil | Alegra solo documenta el menú móvil y la vista de factura a 600 px. |
| Estados de error de red/servidor | No hay captura de Alegra; se comparó el componente `AlertaError` del repo. |
| Comentarios/recordatorios y adjuntos | La guía los marca opcionales y no se midió su implementación. |

## 18. Cierre

- **Documento:** `docs/diseno/auditoria-diseno-vs-alegra.md`.
- **Rama:** `docs/auditoria-diseno-orq`, creada desde `prueba` @ `9ad5813`.
- **Cambios:** solo este documento; no se tocó código, datos, `src/components/ui`, `supabase` ni `package.json`.
- **Commit:** el commit de esta rama que agrega este documento (solo este archivo).
- **Siguiente paso:** Waldy marca sí/no en §16; Coder convierte los “sí” en las fases de §15 y abre un PR por fase.
