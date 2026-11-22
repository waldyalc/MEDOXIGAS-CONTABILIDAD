# Alegra POS — Punto de Venta (estudio de flujo)

> **Reglas Medoxigas (anti-confusión):** Este documento es un ESTUDIO de Alegra. (1) **El punto de venta copia el diseño de Alegra exactamente** (decisión de Waldy, 22-11-2026), incluido el teal `#00b19d`, a través de los tokens `--pos-*` de `src/app/globals.css`; el resto del sistema usa los tokens de `docs/plantilla-diseno.md` (`--primary` azul). Sigue prohibido copiar código fuente de Alegra: nada de su HTML, CSS, selectores, textos largos ni logos. (2) Alcance del POS: solo Vender (facturas y cotizaciones rápidas), Turnos (entradas/salidas de efectivo), Historial de ventas del POS y Devoluciones; Inventario y Configuración viven en Contabilidad. (3) Sin multi-empresa; usa siempre empresa.nombre / empresa.rnc, sin textos hardcodeados de Medoxigas.

Cómo funciona **pos.alegra.com**, documentado en vivo con la cuenta de prueba "Fiel Ferreteria" (Plan Demo). Referencia exacta del diseño del POS; su código nunca se copia: ver `../README.md`.

Capturas: `capturas/22-*.png`. Guía de diseño y copias locales: `design-alegra-pos.md` y `css-pos/`.

**Datos creados en la sesión:** producto `PRUEBA-POS Destornillador Phillips` (cant. 25, costo 4.00, precio base 100.00), contacto `PRUEBA-POS Cliente Mostrador` (RNC 132456780), venta RD$241.60 en efectivo (B0100000005), venta a crédito RD$100 (B0100000006), devolución combinada (B0400000004), ingreso de caja RD$100 (recibo 10), retiro de caja RD$80 (recibo 8), cierres "Cierre No 1" y "Cierre No 2".

## Mapa del menú lateral

El rail izquierdo (~56px, iconos) expande un panel al hacer hover. Captura: `capturas/22-menu-lateral.png`.

| Pantalla | URL | Qué tiene |
|---|---|---|
| Activar factura electrónica | `/electronic-invoicing-activation` | Asistente para habilitar e-CF (estado: Desactivada) |
| Facturar (home) | `/#/` | Pantalla de venta: buscador, catálogo, factura a la derecha |
| Ingresos → Historial de ventas | `/invoices` | Facturas emitidas + detalle |
| Ingresos → Registro de pagos | `/payment-records` | Ingresos/Egresos, detalle del pago a la derecha |
| Turnos → Historial de turnos | `/shifts` | Turno en curso + cierres |
| Turnos → Reportes de turnos | `/statistics` | Gráficas por período |
| Devoluciones | `/refunds` | Notas de crédito / devoluciones |
| Contactos | `/contacts` | Lista + Nuevo contacto + ficha |
| Inventario → Productos y servicios | `/inventory/items` | Lista de productos + Nuevo producto |
| Inventario → más | — | Promociones, Ajustes, Almacenes, Listas de precios, Gestión |
| Configuraciones | `/settings` | Hub de 7 tarjetas |

Pie del menú: Mi suscripción (Plan Demo), Atajos del teclado, Portal de clientes, "Última sincronización".

Atajos (`capturas/22-atajos-teclado.png`): `alt+H` atajos, `alt+M` vender, `F4` venta simple, `alt+P` pagos, `alt+I` crear producto, `alt+C` crear cliente, `alt+R` devoluciones, `alt+V` facturar, `alt+S` turnos, `alt+B` buscar productos, `alt+N` código de barras.

## Barra superior (todas las pantallas)

- **Activa tu POS** (`capturas/22-activa-pos.png`): checklist de onboarding en panel lateral — 1. Vende por primera vez (completada), 2. Personaliza tu POS → Configura tus métodos de pago / Personaliza tus tickets / Activa la factura electrónica / Lleva tu contabilidad. "El progreso se guarda automáticamente."
- **Disponible** (`capturas/22-disponible.png`): popover "Punto de venta disponible — tienes conexión y todas las funciones están disponibles".
- **Sincronización** (`capturas/22-sincronizacion.png`): "Sincronización al día" con checks de Ventas / Productos / Clientes (POS offline-first).
- **Terminal** (`capturas/22-terminal-popover.png`): icono calendario → popover "Terminal 1 · Turno cerrado/abierto" con la config del punto: Banco débito/crédito/transferencias → Caja general, Numeración → Crédito fiscal (01), Almacén → Principal, Centro de costo → No seleccionado.
- **Ayuda** (`capturas/22-centro-ayuda.png`): "Centro de ayuda" con Asistente IA (beta) + Recursos, buscador y temas en tendencia.
- **Apps** (`capturas/22-menu-usuario.png` zona): "Mis soluciones" → POS (actual), Contabilidad; Descubre más → Nómina; Administrar soluciones.
- **Avatar** (`capturas/22-menu-usuario.png`): negocio + correo, Facturación electrónica (estado), Consumo del plan, Mi Perfil, Seguridad, Configuraciones, Cerrar sesión.
- Icono flotante de **calculadora** abajo a la derecha.

## Pantalla de venta (home)

`capturas/22-venta-item-agregado.png`, `capturas/22-carrito-2-productos.png`, `capturas/22-facturar-cerrado.png`, `capturas/22-venta-tabs.png`

- Izquierda: banner de plan, estado del turno ("Turno abierto desde 8:15 AM · Cerrar turno" / "Turno cerrado · Abrir turno"), buscador de productos + icono de código de barras, tarjeta **Venta simple** (F4) y grid de tarjetas de producto (ícono, stock `Inv. N`, nombre, precio, estrella de favorito).
- Derecha: panel "Factura de venta" fijo: Lista de precio (General), Numeración (Crédito fiscal 01), Cliente (default "Consumidor Final 22222222222") + botón Nuevo, e iconos de acción.
- Cada línea: nombre, precio unitario, stepper −/+, total. Abajo: Subtotal, ITBIS por tasa, botón grande teal **Vender RD$X** + "N Productos / Cancelar".
- Clic en tarjeta agrega 1 unidad; badge en la tarjeta muestra cantidad en carrito.
- **Pestañas de venta**: abajo hay "Venta principal" + botón `+` que crea ventas paralelas ("Venta 1", "Venta 2"…); el ⋮ de cada pestaña permite **Renombrar** y **Eliminar** (confirmación "¿Seguro que quieres eliminar la venta pendiente?").
- **Cancelar venta** pide confirmación: "Al cancelar la venta, eliminarás los productos que agregaste" → Volver / Sí, cancelar venta (`capturas/22-cancelar-venta.png`).
- El impuesto se calcula por ítem: Cemento 650 → ITBIS 18% = 117 → total 767; el Destornillador quedó sin impuesto por el quirk del multi-select (ver "Crear producto").

### Venta simple (F4)

`capturas/22-venta-simple.png` — modal con **calculadora**: "Nombre de la venta" (prefilled "Venta simple"), display RD$0, teclado numérico completo (ce, C, %, ÷, ×, −, +, =, punto, borrar) y botón "Aplicar a la venta". Sirve para cobrar un monto libre sin producto.

## Checkout (Pagar factura)

`capturas/22-checkout-metodos-pago.png`, `capturas/22-checkout-efectivo-cambio.png`, `capturas/22-venta-completada.png`, `capturas/22-pago-combinado.png`

- Modal con TOTAL grande y botones de método: **Efectivo, Tarjeta de crédito, Transferencia** arriba; "Otros métodos": **Tarjeta débito, Combinado, Otros métodos de pago** (este último abre Configuración → Métodos de pago en pestaña nueva, no es un método).
- Efectivo: "Valor del pago en efectivo*" + **opciones rápidas** (exacto, redondeos), Vendedor, Observaciones. **Cambio** calculado en vivo (241.60 pagado 250 → Cambio RD$8.40).
- **Combinado** (`capturas/22-pago-combinado.png`): pantalla TOTAL / "Total recibido" / **Por cobrar**; filas de Método de pago* | Valor del pago* | Banco* (Efectivo→"Efectivo POS - Terminal 1", Débito→Caja general prellenado), "+ Agregar método", Vendedor, Observaciones. **Si se cobra menos del total, el resto queda "Por cobrar" y la venta se guarda como Tipo de pago: Crédito** (verificado: RD$50 de 100 → factura pendiente B0100000006).
- Al confirmar: "Guardando venta" → toast "Sincronizando venta…" → modal "¡Muy bien! 🎉 Tu venta se guardó con éxito", Total + Cambio, **Compartir por** correo/WhatsApp/link, "Enviar factura" por email, **Imprimir**, **Nueva venta**.
- El carrito se limpia, el cliente vuelve a Consumidor Final y el stock baja en la tarjeta.
- La venta genera un **pago en Registro de pagos** numerado, asociado a "Efectivo POS - Terminal Terminal 1" (`capturas/22-registro-pagos-venta.png`).

### Imprimir ticket

`capturas/22-ticket-imprimir.png` — diálogo de impresión del navegador con el comprobante en formato ticket: cabecera del negocio (nombre, sucursal, RNC, dirección, teléfono, correo, régimen), "Factura de Crédito Fiscal" + NCF, Tipo de pago, Vencimiento, cliente, tabla de ítems, subtotal/exento/gravado/total, "Total recibido", pie "Generado en Alegra POS".

## Historial de ventas

`capturas/22-ingresos-historial-ventas.png`, `capturas/22-venta-detalle.png`, `capturas/22-venta-pagos.png`

Lista a la izquierda (número, cliente, monto, check de estado) y detalle a la derecha:

- "Factura de venta B01000000NN", fecha de creación, iconos compartir e imprimir.
- **Datos generales**: Cliente, Identificación, Vencimiento, Estado (Cobrada/Pendiente), Moneda, Vendedor, **Número de turno** (la venta queda ligada al turno abierto).
- **Productos y servicios vendidos**: almacén + tabla Producto/Cantidad/Descuento/Impuesto/Total.
- Observaciones, Términos y condiciones, bloque de totales.
- **Pagos recibidos**: tabla Número/Fecha/Método/Total + Total recibido y Cambio. La factura a crédito mostró su pago parcial de 50 y luego quedó Cobrada al aplicarle el crédito de la devolución.

## Registro de pagos

`capturas/22-registro-pagos.png`, `capturas/22-pago-ingreso-detalle.png`, `capturas/22-pago-egreso-detalle.png`

- Tabs **Ingresos / Egresos**, buscador por número de recibo, Filtrar, botón "+ Nuevo pago" (el mismo modal de movimientos del turno).
- Detalle del recibo: Número, fecha, Monto, Cliente o Proveedor, **Cuenta bancaria** (Efectivo POS - Terminal 1), **Método de pago**, **Cuenta contable**, Observaciones; acciones: imprimir, editar, ver y eliminar.
- Todo movimiento de caja o cobro genera un recibo correlativo aquí.

## Turnos — el ciclo completo

`capturas/22-turnos-historial.png`, `capturas/22-turno-detalle.png`, `capturas/22-cerrar-turno-modal.png`, `capturas/22-cierre-detalle.png`, `capturas/22-cierre-imprimir.png`

1. **Turno en curso** (`/shifts`): badge ABIERTO, fecha/hora de inicio y panel "Detalles del turno en curso": Total de ventas, Base inicial, Ventas en efectivo / débito / crédito / transferencias, **Devolución de dinero** (rojo), **Ingresos en efectivo**, **Retiros en efectivo** (rojo), Total de movimientos del turno y **Dinero esperado en caja** = base + ventas efectivo + ingresos − devoluciones − retiros (con nota de la fórmula).
2. Banner amarillo global si el turno lleva abierto demasiado.
3. **Cerrar turno**: modal con el resumen completo, "Dinero esperado en caja", botones **Exportar** (descarga `reporte-turno-N.xlsx` con el detalle) y **Nuevo movimiento**, campo obligatorio **"Dinero real en caja"*** (el conteo físico; nota: si difiere, valida con un ingreso/retiro), Observaciones, Cancelar / Guardar.
4. **Movimientos de caja** ("Nuevo movimiento" → modal "Nuevo pago", `capturas/22-movimiento-nuevo.png`):
   - **Ingreso**: tabs "Pago a factura de cliente" (elige Cliente → trae sus facturas por cobrar, Método de pago*, Observaciones 0/300, Total pagado, "Registrar pago") y "Otros ingresos" (`capturas/22-movimiento-ingreso.png`: Cliente opcional, Método*, **Cuenta contable*** → catálogo contable agrupado: Ventas, Devoluciones en ventas, Ingresos por intereses, Otros ingresos diversos, Ganancia por diferencia en cambio, Ajustes por aproximaciones…, Monto*, Observaciones). Genera recibo de ingreso numerado.
   - **Egreso** (`capturas/22-movimiento-egreso.png`): tabs "Gastos generales" y "Pago a factura de proveedor"; Proveedor opcional, Método*, Cuenta contable* (catálogo de gastos: sueldos, comisiones, etc.), Total a pagar*, Observaciones. Genera recibo de egreso.
   - Ambos actualizan el modal de cierre al instante (líneas "Ingresos en efectivo" / "Retiros en efectivo" y el esperado).
5. **Cierre registrado**: toast "¡Turno cerrado! 💰" → "Cierre No N · CERRADO" con Fecha inicio–fin, todos los movimientos, Total de movimientos, "Dinero en efectivo del cierre" (con su definición), Observaciones, y botones **Exportar** (xlsx) e **Imprimir** → ticket "Cierre No N" por el diálogo de impresión/PDF (`capturas/22-cierre-turno-2.pdf` guardado).
6. Con el turno cerrado, la pantalla de venta muestra "Turno cerrado · Abrir turno" (pide Base inicial para abrir uno nuevo).

## Reportes de turnos

`capturas/22-reportes-turnos.png` — `/statistics`: selector de período (Semana / Mes / Trimestre / Personalizado con Desde–Hasta), tarjetas Ingresos / Gastos / Diferencia del período, gráfico de barras "Movimientos de Turnos" por cierre y pie "Tipos de pago" (Efectivo, Débito, Crédito, Transferencia, Ingreso, Egresos, Devoluciones).

## Devoluciones

`capturas/22-devoluciones.png`, `capturas/22-devolucion-forma.png`, `capturas/22-devolucion-detalle.png`

Wizard de 3 pasos (`+ Nueva devolución`):

1. **Tipo**: tarjetas "Devolución de dinero" y "Crédito a factura" (se puede elegir combinado).
2. **Productos y cliente**: lista de productos + selector de cliente + carrito.
3. **Detalle**: con el método combinado muestra **las dos columnas a la vez** — Devolución de dinero (Monto*, Cuenta bancaria* [Efectivo POS, bancos, cajas], Observaciones) y Crédito a factura (**Factura del cliente*** — solo lista facturas con saldo pendiente de ese cliente, Monto*, estado Pagado/Pendiente) + "CAMBIAR MÉTODO". **La combinada exige llenar ambas columnas** o Guardar queda deshabilitado.
   - Ejecutado: devolución B0400000004 de RD$50 en efectivo + RD$50 de crédito aplicado a la factura pendiente B0100000006 → su saldo pasó a 0.00 (quedó Cobrada).
- Detalle de la devolución: Cliente, Creación, Tipo de nota de crédito, Almacén, Centro de costo, **Número de turno** (se liga al turno abierto), tabla de productos, totales, tabla "Crédito a facturas" y tabla "Devoluciones".
- La devolución en efectivo **resta del dinero esperado en caja** del turno (línea roja "Devolución de dinero").

## Crear producto

`capturas/22-crear-producto-modal.png`, `capturas/22-producto-creado.png`

Modal "Nuevo producto" (desde la venta o Inventario): Tipo Producto/Servicio/Combo (permanente), Nombre*, Categoría, Unidad de medida*, Almacén*, Cantidad*, Costo inicial*, Precio base* + Impuestos (multi-select: Ninguno 0%, ITBIS 18%, ITBIS 16%, ITBIS 0%, Exento, Propina 10%, CDT 2%) → Precio final calculado, "Ir al formulario avanzado". Toast "¡Producto creado! 🎯".

Ojo (quirk real): al elegir ITBIS el Precio final se calculó (100 → 118) aunque el chip seguía "Ninguno", y el producto se cobró sin ITBIS. El cemento del catálogo sí cobró ITBIS 18%.

## Contactos

`capturas/22-contactos.png`, `capturas/22-nuevo-contacto.png`, `capturas/22-contacto-detalle.png`

- Lista con buscador y kebab por fila; "Nuevo contacto" abre drawer lateral: RNC o Cédula, Tipo de identificación (RNC / Cédula / Identificador extranjero), Nombre o Razón social*, Dirección, Correo, Teléfono + secciones "Información de venta" y "Configuración contable".
- **Ficha del contacto**: Datos principales (nombre, tipo y número de ID, municipio, dirección, correo, teléfono, celular), **Información comercial** (Límite de crédito, Tipo de NCF, Plazo de pago "De contado", Lista de precio, Vendedor), tarjeta con avatar/estado y "Enviar enlace del Portal Alegra", acciones Desactivar / Editar / ⋮.

## Inventario (cobertura mínima — va en otro módulo)

- **Promociones** (`capturas/22-promociones.png`): descuentos masivos o por producto; empty state "+ Crear promoción".
- **Ajustes de inventario** (`capturas/22-ajustes-inventario.png`): aumentos/disminuciones manuales; tabla Número/Fecha/Almacén/Total ajustado/Observaciones + "Nuevo ajuste".
- **Almacenes** (`capturas/22-almacenes.png`): tabla Nombre/Dirección/Observaciones/Centro de costo/Estado (uno "Principal") + "Nuevo almacén".
- **Listas de precios** (`capturas/22-listas-precios.png`): valor fijo o % descuento sobre precio base (lista "General" tipo Monto) + "Nueva lista".
- **Gestión de inventario** (`capturas/22-gestion-inventario.png`): tarjetas Variantes, Categorías y Campos adicionales.

## Configuraciones

`capturas/22-config-hub.png` — hub de 7 tarjetas:

- **Negocio** → Mi negocio.
- **Sucursal** → Sucursal actual, Gestionar sucursales.
- **Detalles en ventas** → Mis vendedores, **Métodos de pago** (`capturas/22-config-metodos-pago.png`: 5 métodos activos con toggle + "Nuevo método" → modal Nombre*, Indicaciones de pago* 0/150, Banco, QR opcional, icono — `capturas/22-metodo-pago-nuevo.png`), **Preferencias de venta** (`capturas/22-config-preferencias-venta.png`: solo toggle Propinas).
- **Facturas** → **Plantilla de impresión** (`capturas/22-plantilla-diseno.png`, `capturas/22-plantilla-letra.png`, `capturas/22-plantilla-contenido.png`: beta IA "Personaliza con una frase"; Diseño → Clásico/Minimalista/Detallado + Ancho 80mm/57mm + Interlineado; Letra → Clásica/Moderna/Compacta + Pequeña/Mediana/Grande; Contenido → toggles Logo, Vendedor, Descripción de productos, Referencia, Precio unitario, Unidad de medida, Precios con impuestos; vista previa del ticket en vivo + "Imprimir prueba"), **Numeraciones** e **Impuestos** (ambos ⓘ abren `app.alegra.com` en pestaña nueva: se gestionan desde la app contable, no desde el POS).
- **Administra tu cuenta** → Seguridad, Roles y usuarios, Soportes legales.
- **Dispositivos** → Balanza (báscula para productos por peso).
- **Más configuraciones** → Ir a Alegra Contabilidad, **Activar POS Restobar** (modo restaurante).

### Activar factura electrónica

`capturas/22-factura-electronica.png` — `/electronic-invoicing-activation`: tarjeta "Factura electrónica · Desactivada", "Es el documento que exige la DGII para tus ventas", botón "Habilitar facturación electrónica" (abre el asistente en pestaña nueva) y "Ver ayuda". "Vendes como siempre: la factura electrónica se genera automáticamente; solo las ventas con la numeración electrónica que configures se emiten como factura electrónica."

## Observaciones para Medoxigas POS

- La venta **vive en una sola pantalla**: catálogo + factura juntos; el checkout es solo elegir método y conteo. Las pestañas `+` permiten **varias ventas en paralelo** (renombrables).
- **Venta simple** = cobrar un monto libre con calculadora, sin producto.
- El turno es el ancla: banner global, esperado en caja siempre visible, **movimientos de ingreso/retiro dentro del mismo modal de cierre** (con cuenta contable), conteo real obligatorio, export a xlsx e impresión tipo ticket del cierre.
- **Combinado = pago dividido + crédito**: cobrar menos del total deja "Por cobrar" y la factura queda a crédito; ese saldo luego se cobra desde "Pago a factura de cliente" o se cancela con "Crédito a factura" de una devolución.
- Devolución combinada exige dinero + crédito a factura en el mismo documento.
- Cada venta alimenta en automático: registro de pagos (cuenta "Efectivo POS - Terminal N"), historial, turno e inventario.
- Consumidor Final por defecto; numeración fiscal (NCF/e-CF) se elige en la factura; numeraciones e impuestos se administran en la app contable, no en el POS.
- Todo es recibo correlativo: ventas, pagos, ingresos, egresos y devoluciones llevan número propio.
- Onboarding: checklist "Activa tu POS", centro de ayuda con IA, indicador de conexión "Disponible" y sincronización offline-first (Ventas/Productos/Clientes).
