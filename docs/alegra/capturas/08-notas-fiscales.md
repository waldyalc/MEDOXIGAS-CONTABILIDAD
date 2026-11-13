# Alegra — reportes Financieros y Fiscales

**Cuenta activa:** el selector de empresa mostraba `Fiel Fe...`, consistente con **Fiel Ferreteria**; no mostraba ninguna empresa Medoxigas. No se cambió de empresa. Se revisaron los reportes en el orden indicado en las categorías Financieros y Fiscales. Periodos seleccionados o predeterminados incluyen el 13/11/2026. No se pulsaron Descargar, Exportar, Compartir, Enviar, ni acciones de presentación ante la DGII; tampoco se abrió configuración DGII/e-CF, planes, POS, Nómina o Más soluciones.

**Incidente a tener en cuenta:** al explorar el asistente de `Reporte IT1`, seleccioné noviembre de 2026 y pulsé `Continuar` para avanzar al formulario; la aplicación creó automáticamente un reporte con título `Nuevo Reporte IT1 - Noviembre 2026` y mostró `Reporte editado con éxito`. No se pulsaron `Guardar como borrador`, `Finalizar`, `Editar` ni `Descargar`, y no se intentó borrar el registro. La creación automática no era la intención y contradice la restricción de no crear documentos; se informa expresamente aquí.

## 1. Financieros — Flujo de caja

- **Nombre exacto:** `Flujo de caja`.
- **URL:** https://app.alegra.com/report/cash-flow-financial
- **Filtros predeterminados:** periodo `Septiembre 2026 - Noviembre 2026` (incluye 13/11/2026); `Buscar cuenta contable` vacío. Vista de gráfico `Flujo` predeterminada; alternativa `Saldo`.
- **Columnas, en orden:** cuenta/etiqueta (sin encabezado), `Septiembre 2026`, `Octubre 2026`, `Noviembre 2026`.
- **Valores (RD$):** Saldo inicial en caja y bancos: 0.00 / 0.00 / 0.00; Entradas: 0.00 / 0.00 / 8,000.00; Cuentas por cobrar clientes: 0.00 / 0.00 / 8,000.00; Salidas: 0.00 / 0.00 / 47,070.00; Cuentas por pagar a proveedores nacionales: 0.00 / 0.00 / 46,020.00; Agua: 0.00 / 0.00 / 250.00; Papelería: 0.00 / 0.00 / 300.00; Combustibles y lubricantes: 0.00 / 0.00 / 500.00; Saldo del periodo: 0.00 / 0.00 / **-39,070.00**; Saldo final en caja y bancos: 0.00 / 0.00 / **-39,070.00**. El gráfico en la vista `Flujo` muestra entradas y salidas por mes; en `Saldo`, saldo final en caja y bancos.
- **Celdas/enlaces:** no se observaron celdas con enlaces ni enlaces de datos en la tabla. `Entradas` y `Salidas` tienen controles de expandir/contraer.
- **Controles visibles:** `Descargar` (no usado), `Actualizar`, pestañas `Flujo`/`Saldo`, búsqueda por cuenta contable y controles de expandir/contraer.
- **Capturas objetivo:** `08-reporte-flujo-de-caja.png`, `08-reporte-flujo-de-caja-saldo.png`.

## 2. Fiscales — Reporte 606

- **Nombre exacto:** `Reporte 606`.
- **URL de la vista/modal:** https://app.alegra.com/report/category/tax (modal; la URL no cambia al abrirlo desde la tarjeta fiscal).
- **Filtros/formulario predeterminado:** `Periodo*` = `01/11/2026 - 30/11/2026`; `Tipo de archivo` = `Archivo plano`.
- **Columnas/totales:** no hay vista previa ni tabla/columnas/totales en el formulario antes de exportar. No se exportó, por lo que no se generó el archivo DGII ni se mostró su estructura.
- **Enlaces:** texto con enlace `configuración del reporte` → https://app.alegra.com/report/edit-report-categories; no se abrió.
- **Controles visibles:** `Ayuda` (enlace), `Cancelar`, `Exportar` (no pulsado). La tarjeta de categoría llevaba insignia `Excel`.
- **Captura objetivo:** `08-reporte-reporte-606.png`.

## 3. Fiscales — Reporte 607

- **Nombre exacto:** `Reporte 607`.
- **URL de la vista/modal:** https://app.alegra.com/report/category/tax (modal; la URL no cambia al abrirlo desde la tarjeta fiscal).
- **Filtros/formulario predeterminado:** `Periodo*` = `01/11/2026 - 30/11/2026`; `Tipo de archivo` = `Archivo plano`.
- **Columnas/totales:** no hay vista previa ni tabla/columnas/totales en el formulario antes de exportar. No se exportó, por lo que no se generó el archivo DGII ni se mostró su estructura.
- **Enlaces:** `configuración del reporte` → https://app.alegra.com/report/edit-report-categories; no se abrió.
- **Controles visibles:** `Ayuda` (enlace), `Cancelar`, `Exportar` (no pulsado). La tarjeta de categoría llevaba insignia `Excel`.
- **Captura objetivo:** `08-reporte-reporte-607.png`.

## 4. Fiscales — Reporte 608

- **Nombre exacto:** `Reporte 608`.
- **URL de la vista/modal:** https://app.alegra.com/report/category/tax (modal; la URL no cambia al abrirlo desde la tarjeta fiscal).
- **Filtros/formulario predeterminado:** `Periodo*` = `01/11/2026 - 30/11/2026`; `Tipo de archivo` = `Archivo plano`.
- **Columnas/totales:** no hay vista previa ni tabla/columnas/totales en el formulario antes de exportar. No se exportó ni se generó archivo.
- **Enlaces:** no se observó enlace de configuración dentro del modal.
- **Controles visibles:** `Cerrar`, `Exportar` (no pulsado). La tarjeta de categoría llevaba insignia `Excel`.
- **Captura objetivo:** `08-reporte-reporte-608.png`.

## 5. Fiscales — Reporte IT1

- **Nombre exacto mostrado:** `Nuevo Reporte IT1 - Noviembre 2026` (las pestañas se llaman `Anexo A` y `IT-1`).
- **URL de la vista observada:** https://app.alegra.com/report/it1/view/942b2395-afa8-4040-b8d4-2aae1fcface2. Ruta de la categoría: https://app.alegra.com/report/it1.
- **Periodo:** se eligió Año `2026`, Mes `Noviembre`. El formulario general muestra `November/2026`, fecha límite `20/12/2026`, tipo de declaración `Normal`. RNC/CÉDULA y Nombre Comercial aparecían sin valor visible; se omiten otros datos de contacto.
- **Campos/tablas — Anexo A:**
  - I. Datos generales: RNC/CÉDULA; Nombre Comercial; Correo; Teléfono; Razón Social; Fecha límite; Periodo (Mes/Año); Tipo de declaración.
  - II. Operaciones reportadas en el 607, Libro de ventas y factura electrónica (E-NCF) por tipo de NCF — casilla 11, Total de operaciones: RD$18,500.00.
  - III. Operaciones reportadas en el 607, Libro de ventas y factura electrónica (E-NCF) por tipo de venta (monto total incluyendo impuestos) — casilla 19, Total de operaciones: RD$21,830.00.
  - IV. Operaciones reportadas en el 607, Libro de ventas y factura electrónica (E-NCF) por tipo de ingreso — casilla 26, Total de operaciones: RD$0.00.
  - V. Pagos computables por retenciones/percepción — casilla 33, total: RD$0.00.
  - VI. Operaciones de constructoras — casilla 38, operaciones no sujetas a ITBIS por servicios de construcción: RD$0.00.
  - VII. Operaciones de comisionistas, columnas `OPERACIONES`, `TOTAL FACTURADO`, `MONTO`: 39 Venta de bienes por comisión; 40 Venta de servicios en nombre de terceros; 41 Total de operaciones comisionistas (RD$0.00 / RD$0.00); 42 Operaciones no sujetas a ITBIS por comisiones (RD$0.00).
  - VIII. Datos informativos, columnas `OPERACIONES`, `MONTO`: 43 Total de notas de crédito emitidas con más de 30 días desde la facturación (Art. 338 CT), RD$0.00; 44 Total de facturas en comprobantes fiscales para regímenes especiales (proviene del formato 606), sin importe visible.
  - IX. ITBIS Pagado: casilla 48 Total ITBIS no deducibles; casilla 52 Total ITBIS deducible no sujeto a proporcionalidad; casilla 56 Total ITBIS deducible. Se mostraron cuatro importes RD$0.00 por cada casilla.
- **Campos/tablas — IT-1:** encabezados de tabla `OPERACIONES`, `MONTO` (en IV Penalidades se ve también `%`).
  - I. Datos generales: RNC/CÉDULA; Nombre Comercial; Correo; Teléfono; Razón Social; Fecha límite; Periodo (Mes/Año); Tipo de declaración.
  - II. Ingreso por operaciones: 1 Total de operaciones del periodo (18,500); A) No gravadas: 2 Exportaciones de bienes (Art. 342 CT); 3 Exportaciones de servicios (Art. 344 CT y Art. 14 Reglamento 293-11); 4 Ventas locales de bienes/servicios exentos (Arts. 343/344 CT); 5 Ventas de bienes/servicios exentos por destino; 6 No sujetas a ITBIS por servicios de construcción (0); 7 No sujetas a ITBIS por comisiones (0); 8 Ventas locales de bienes exentos (Art. 343 CT); 9 Total de ingresos por operaciones no gravadas (0). B) Gravadas: 10 Total de ingresos por operaciones gravadas (18,500); 11 Operaciones gravadas al 18% (18,500); 12 al 16% (0); 13 al 9% (Ley 690-16) (0); 14 al 8% (Ley 690-16) (0); 15 Ventas de activos depreciables, categorías 2 y 3 (0).
  - III. Liquidación: 16 ITBIS cobrado 18% (3,330); 17 cobrado 16% (0); 18 cobrado 9% (0); 19 cobrado 8% (0); 20 cobrado por venta de activos depreciables (0); 21 Total de ITBIS cobrado (3,330); 22 ITBIS pagado en compras locales (0); 23 pagado por servicios deducibles (0); 24 pagado en importaciones (0); 25 Total ITBIS deducible (0); 26 Impuestos a pagar (3,330); 27 Saldo a favor (0); 28 Saldo compensables autorizados y/o reembolso (sin importe); 29 Saldo a favor anterior (sin importe); 30 Pagos computables por retenciones (0); 31 Pagos computables a cuenta (sin importe); 32 Compensaciones y/o reembolso autorizados (sin importe); 33 Diferencia a pagar (3,330); 34 Nuevo saldo a favor (0).
  - IV. Penalidades, columnas `OPERACIONES`, `%`, `MONTO`: 35 Recargos (0); 36 Intereses indemnizatorios (0); 37 Sanciones (sin importe).
  - V. Monto a pagar, columnas `OPERACIONES`, `MONTO`: 38 Total a pagar (3,330); A) ITBIS retenido/percibido: 39 servicios retenidos a persona física; 40 servicios a entidades no lucrativas (Norma 01-11); 41 total de esos servicios (0); 42 servicios retenidos a sociedades (Norma 07-09); 43 sociedades (Normas 02-05 y 07-07); 44 bienes/servicios RST al 18%; 45 bienes/servicios RST al 16%; 46 total RST (0); 47 comprobantes de compras al 18% (Normas 08-10 y 05-19); 48 comprobantes de compras al 16%; 49 total de bienes retenidos de comprobantes de compras (0); 50 ITBIS por servicios retenidos a personas físicas/no lucrativas (0); 51 servicios a sociedades Norma 07-09 (0); 52 servicios a sociedades Normas 02-05 y 07-07 (0); 53 ITBIS retenido RST 18% (0); 54 RST 16% (0); 55 total ITBIS retenido RST (0); 56 ITBIS de bienes retenidos de comprobantes de compra 18% (0); 57 al 16% (0); 58 total por bienes retenidos de comprobantes de compra (0); 59 total ITBIS percibido en venta (sin importe); 60 Impuesto a pagar (0); 61 Pagos computables a cuenta (sin importe); 62 Diferencia a pagar (0); 63 Nuevo saldo a favor (0). B) Penalidades: 64 Recargos (0); 65 Interés indemnizatorio (0); 66 Sanciones (sin importe). C) Monto a pagar: 67 Total monto a pagar (0).
  - VI. Total general: columnas `OPERACIONES`, `MONTO`; casilla 68 Total general: RD$3,330.00.
- **Totales destacados:** Anexo A: RD$18,500.00 operaciones (cas. 11), RD$21,830.00 importe incl. impuestos (cas. 19), y ceros en los resúmenes citados. IT-1: total ingresos del periodo RD$18,500.00; ITBIS cobrado RD$3,330.00; impuestos a pagar/diferencia RD$3,330.00; total general RD$3,330.00.
- **Celdas/enlaces:** no se observaron enlaces de celda en las vistas Anexo A o IT-1.
- **Controles visibles en la vista creada:** `Volver a Reporte IT1`, `Descargar`, `Editar`, pestañas `Anexo A`/`IT-1`, `Cancelar`, `Guardar como borrador`, `Finalizar`. No se pulsaron estos controles.
- **Capturas objetivo:** `08-reporte-reporte-it1.png` (Anexo A), `08-reporte-reporte-it1-it1.png` (pestaña IT-1).

## 6. Fiscales — Reporte detallado de impuestos

- **Nombre exacto:** `Reporte detallado de impuestos`.
- **URL:** https://app.alegra.com/report/detailed-tax-report
- **Filtros predeterminados:** `Periodo*` = `01/11/2026 - 30/11/2026`; `Impuesto` = `Todos`.
- **Totales destacados:** Impuestos en ventas RD$3,330.00; Impuestos en compras RD$7,020.00; Devoluciones de ventas RD$0.00; Devoluciones de compras RD$0.00; Diferencia RD$3,690.00.
- **Tablas de resumen:** en las cuatro tablas (Impuestos en ventas con NCF, Impuestos en compras con NCF, Devoluciones en ventas, Devoluciones en compras) las columnas son `IMPUESTO`, `TOTAL BASE IMPONIBLE`, `TOTAL IMPUESTO`. Filas, en ese orden: ITBIS (18%), ITBIS (16%), ITBIS (0%), Exento (0%), Propina (10%), CDT (2%), total. Ventas: base/impuesto 18% RD$18,500.00/RD$3,330.00; demás tasas RD$0.00; total RD$18,500.00/RD$3,330.00. Compras: 18% RD$39,000.00/RD$7,020.00; demás tasas RD$0.00; total RD$39,000.00/RD$7,020.00. Ambas tablas de devoluciones tienen RD$0.00 en todas las tasas y total.
- **Detalle de transacciones, pestaña predeterminada `Impuestos en ventas`:** columnas `NCF/Número`, `Tipo de documento`, `Proveedor`, `Creación`, `Impuesto`, `Base imponible`, `Valor impuesto`. Filas: B0200000001, Venta, 13/11/2026, ITBIS (18%), RD$4,400.00, RD$792.00; B0100000001, Venta, 13/11/2026, ITBIS (18%), RD$14,100.00, RD$2,538.00. No se muestra una fila total; 2 filas. Las otras pestañas visibles son `Devoluciones de ventas`, `Impuestos en compras`, `Devoluciones de compras`.
- **Celdas/enlaces:** B0200000001 → https://app.alegra.com/invoice/view/id/2; B0100000001 → https://app.alegra.com/invoice/view/id/1. Solo se leyó el href; no se abrió.
- **Controles visibles:** `Generar Reporte`; tres iconos de acción (descarga, impresión y compartir); enlace `Ayuda`; búsqueda y paginación de tabla. No se pulsaron Generar, Descargar, Compartir ni imprimir.
- **Captura objetivo:** `08-reporte-reporte-detallado-de-impuestos.png`.

## 7. Fiscales — Impuestos y retenciones

- **Nombre exacto:** `Impuestos y retenciones`.
- **URL:** https://app.alegra.com/report/taxes-and-retentions
- **Filtros predeterminados:** periodo `01/11/2026 - 30/11/2026`; `Vista: Impuestos`; `Todos los impuestos`; `Más filtros` sin condiciones; búsqueda de impuesto vacía; `Ítems por página`: 10. Pestañas `Ventas` y `Compras`.
- **Columnas, en orden:** `Nombre`, `Tipo`, `Tarifa`, `Base gravable`, `Impuestos`, `Base devoluciones`, `Impuestos en devoluciones`, `Saldo`, columna de acción sin encabezado (`Ver detalles`).
- **Totales y filas:** Ventas — Total de impuestos en venta RD$3,330.00; devoluciones RD$0.00; saldo RD$3,330.00. Fila ITBIS / ITBIS Acreditable / 18% / RD$18,500.00 / RD$3,330.00 / RD$0.00 / RD$0.00 / RD$3,330.00. Compras — Total de impuestos en compras RD$7,020.00; devoluciones RD$0.00; saldo RD$7,020.00. Fila ITBIS / ITBIS Acreditable / 18% / RD$39,000.00 / RD$7,020.00 / RD$0.00 / RD$0.00 / RD$7,020.00.
- **Detalle alternativo de compras (se abrió desde `Ver detalles`):** columnas `Documento`, `Proveedor`, `Fecha`, `Concepto`, `Cantidad`, `Precio unitario`, `Subtotal`, `Descuento`, `Base gravable`, `Impuesto`; una fila B0100000050, 13/11/2026, Cemento gris 42.5kg, 100, RD$390.00, subtotal RD$0.00, descuento RD$0.00, base RD$39,000.00, impuesto RD$7,020.00. El modal de detalle tardó en mostrar la vista; al cierre estaba visible esta fila. No se observó href en celdas de esta vista.
- **Celdas/enlaces:** no se observaron celdas con href en esta tabla; `Ver detalles` abre un panel de detalle, no un enlace a URL.
- **Controles visibles:** `Descargar` (no usado), `Actualizar`, period picker, selectores de vista/impuesto, `Más filtros`, pestañas `Ventas`/`Compras`, búsqueda y paginación.
- **Capturas objetivo:** `08-reporte-impuestos-y-retenciones.png`, `08-reporte-impuestos-y-retenciones-compras.png`.

## 8. Fiscales — Reporte IR-17

- **Nombre exacto:** `Reporte IR-17`.
- **URL:** https://app.alegra.com/report/ir-17
- **Estado/filtros:** la página indica `Aún no tienes reportes creados`. No existe reporte que se pueda abrir con el periodo solicitado. No se abrió el asistente de nuevo reporte para evitar crear otro documento; por ello no hay filtros de periodo, formulario, tabla, columnas ni totales que documentar.
- **Celdas/enlaces:** no hay filas ni enlaces de datos.
- **Controles visibles:** enlace `Ayuda`, botones `Nuevo Reporte` y `Crea un nuevo reporte` (no pulsados).
- **Captura objetivo:** `08-reporte-reporte-ir-17.png`.

## 9. Fiscales — Cartas de retención

- **Nombre exacto:** `Cartas de retención`.
- **URL:** https://app.alegra.com/report/withholding-certificates
- **Filtros predeterminados:** selector `Este mes`; el calendario abierto mostró `Noviembre 2026` e incluye 13/11/2026. Búsqueda `Buscar proveedor` vacía; `Ítems por página`: 10. Pestañas `Listos para enviar 0` (seleccionada) y `Por completar 0`.
- **Columnas/totales:** `No se encontraron proveedores`; el aviso dice que no se encontraron retenciones en el periodo. No hay filas, encabezados de columnas ni importes/totales.
- **Celdas/enlaces:** sin filas de datos. `Historial de envíos` → https://app.alegra.com/mailer/invoice-history; enlace leído, no abierto. Al cargar se mostró una sugerencia `Firma y sello digital` con botón `Configurar`; se cerró con `Cerrar`, sin entrar a configuración.
- **Controles visibles:** icono sin etiqueta, `Historial de envíos`, selector de periodo, pestañas de estado, búsqueda y paginación. No se envió ninguna carta.
- **Captura objetivo:** `08-reporte-cartas-de-retencion.png`.

## Capturas y limitación de almacenamiento

Las capturas se generaron como imágenes adjuntas de la ejecución. Intenté guardarlas directamente en `/workspace/contab-repo/docs/alegra/capturas/` mediante la ruta de captura del navegador, pero ese entorno devolvió `ENOENT` para esa ruta; no pude materializar los PNG con los nombres objetivo dentro de la carpeta. Los adjuntos internos disponibles se identifican así:

- `08-reporte-flujo-de-caja.png` — Flujo: `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/953aa7c82cce4d91b051f0e13daa7882f0a727f5facb98cb41ff4e0d2ff32ec9.png`
- `08-reporte-flujo-de-caja-saldo.png` — Saldo: `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/b66dc6ea9c0b4d935c32681104219d54cef31755a911b3ec92a25cae314e38c1.png`
- `08-reporte-reporte-606.png` — `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/5171bb4c3b5b3dab9e4a98aed8ad4260962b02d180089accbb61064e002a069d.png`
- `08-reporte-reporte-607.png` — `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/a90c6a66791004eec2a28257a4e3d3012fc42ec026a8eb9a554d1485bab17bb8.png`
- `08-reporte-reporte-608.png` — `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/cc7b42a9b265374bc2f1260e2753e737a186fc6024d3812c255190ab9e98dbc9.png`
- `08-reporte-reporte-it1.png` (Anexo A) — `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/e152843ed503e22c723a64cd6ca470af4949212e139e6f9f548240d4ecfe44f4.png`
- `08-reporte-reporte-it1-it1.png` — `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/b55185c337173f4d63f8057e1e5f89108a719e2b7b7bd5f55a138baa3b162e02.png`
- `08-reporte-reporte-detallado-de-impuestos.png` — `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/5b498b1005afe70f59c9a6c6f65381322635209b7611c4476a294e19696037ec.png`
- `08-reporte-impuestos-y-retenciones.png` — `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/f31699dfbec5db333949cda1d7b0a2434bc6c5403a3687f744b6e4ce5774c066.png`
- `08-reporte-impuestos-y-retenciones-compras.png` — `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/241f195cf4fa5bbfc05830d0fa50c4e3a5801a58feceb85c237dd7ac577e380a.png`
- `08-reporte-reporte-ir-17.png` — `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/ae91f1125d474845e2e8a9d197807e7cd04be50e8167823a1d83a693d02722ff.png`
- `08-reporte-cartas-de-retencion.png` — `file:///cursor/stores/user/grok-bot/agents/efe28607-8a6c-4d14-ae2e-e554eb2dcacd/assets/0d093946cb3874148f653602ed34a72787a5211206c403c54214b2f709dddeb0.png`

No report appeared plan-locked. No Descargar/Exportar/Compartir/Enviar control was activated.
