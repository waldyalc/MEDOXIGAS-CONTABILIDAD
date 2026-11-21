# Prompt y Plan Maestro — Fase 3 (Rediseño UI/UX estilo Alegra POS + Sidebar + Ticket + Cédula Nómina)

> **Cómo usar este archivo:** Abre una nueva sesión de Orquestador (o ejecútalo desde la sesión actual tras confirmar las 3 decisiones de §0) y dile:
> *"Lee `docs/PLAN-FASE-3-REDISENO-ALEGRA.md` y ejecútalo fase por fase como Orquestador, repartiendo los subagentes entre los VPS y la PC local."*

---

## 0. Prerrequisitos y decisiones antes de lanzar el primer subagente

### Decisiones de Waldy (confirmar en 30 segundos antes de arrancar)
1. **C6 (Registro de pagos `/pos/pagos`):** ¿v1 solo recibos del POS (`pos_turno_movimientos`, **recomendado**) o incluir también pagos de Contabilidad?
2. **C8 (Cédula en Nómina → Empleados):** ¿qué pasó exactamente al escribirla (se traba al borrar guion, salta el cursor, error al guardar, no avanza)?
3. **Color primario:** ¿mantener el **azul Medoxigas `#1e56c7`** (**recomendado** por `AGENTS.md`, copiando 100 % el resto del diseño de Alegra) o cambiar el token a teal?
4. **Alcance POS (C9):** ¿incluir también **S5 (Checkout + Confirmación + Calculadora Venta simple)** y **S9 (Turnos maestro-detalle + Historial + Devoluciones)** para que el **100 %** del POS sea estilo Alegra y no quede a medias? *(Recomendado: sí).*

### Prerrequisitos de infraestructura (antes de delegar a los VPS)
1. **Subir los planes a `origin/main`:** `docs/planes/rediseno-alegra/` (incluyendo `PLAN.md` y sus 7 capturas censuradas `img/01..07.png`) y este `docs/PLAN-FASE-3-REDISENO-ALEGRA.md` deben estar commiteados en `origin/main`, porque ambos VPS crean sus worktrees desde `origin/main` (`newWorktreesStartFromOrigin: true`).
2. **Estado real de tus máquinas (medido el 21 nov 2026):**

| Máquina | `environmentId` | `projectId` | Provider DeepSeek | Estado real | Tope recomendado |
| --- | --- | --- | --- | --- | --- |
| **VPS 1 (`srv1692753`)** | `379c49f5-400f-4114-bbab-272509098439` | `6c6df50a-1668-4947-beb1-69caaa749ef8` | `providerInstanceId: "opencode"` · `opencode-go/deepseek-v4.1-flash` (`variant: "max"`) | ✅ Listo (`canRunChildTask: true`) | **2–3 subagentes** (máx. 2 si corren Playwright a la vez) |
| **VPS 2 (`srv1694526`)** | `36336188-507b-4895-b848-f43df0908b58` | `7d280881-e8d2-4a13-8b93-7d59d2501fd8` | `providerInstanceId: "opencode"` | ❌ Bloqueado hoy: `ConfigInvalidError` en la config de OpenCode | **0 hoy → 2–3 al corregir su `opencode.json`** |
| **PC local (MSI)** | local (`ae4de5b1-78f9-4da4-8eab-7ba4b1ab038c`) | local | `providerInstanceId: "opencode_2"` · `opencode-go/deepseek-v4.1-flash` (`variant: "max"`) | ✅ Listo (i5-10500H 6C/12T, 15.8 GB RAM, solo ~2.5 GB libres) | **2 subagentes máximo** (para no hacer swapping ni frenar tu PC) |

> **Regla de trabajo con VPS:** todo subagente que corra en un VPS debe hacer `git push -u origin <su-rama>` al terminar (sin mergear a `main`), porque su worktree vive en Linux remoto y el Orquestador en Windows necesita `git fetch origin` para revisar el diff e integrarlo. Además, para prueba de velocidad, registra en el reporte el tiempo de ejecución de cada subagente (VPS vs PC local).

---

## 1. Rol del Orquestador y reglas duras

1. Lee `AGENTS.md`, `docs/ORQUESTADOR.md`, `HANDOFF.md`, `docs/planes/rediseno-alegra/PLAN.md` y `docs/alegra/pos/design-alegra-pos.md`.
2. **Límite estricto:** **máximo 10 subagentes en todo el plan** (este plan usa exactamente **9 obligatorios + 1 opcional de cierre = 10**, con pico máximo de **5 en paralelo** en Fase 1 y **4 en paralelo** en Fase 2).
3. **Copia total del diseño visual de Alegra POS** (layout, medidas, proporciones, densidad, rail izquierdo 56→271 px, tarjetas ~140 px, carrito fijo 400 px pegado al borde derecho con botón «Vender RD$ X», pestañas abajo, checkout 3+3 con pills de efectivo rápido, calculadora Venta simple, Registro de pagos maestro-detalle, ticket térmico 80/57 mm con logo) usando **código propio shadcn/Base UI** y los **tokens de marca** aprobados por Waldy. **Nunca** copiar HTML/CSS crudo, logos ni textos literales de Alegra.
4. **Sin tocar backend contable ni migraciones:** cero cambios en `supabase/migrations/` ni en la lógica de impuestos, inventario o asientos (salvo nuevas lecturas paginadas en `src/lib/pos/consultas.ts` para C6).
5. **No tocar PDF Carta** (`src/components/documento-venta/documento-papel.tsx` ni `src/components/pos/documento-carta-pos.tsx`) en C7.
6. **Capturas obligatorias (regla de Waldy):** cada subagente de UI entrega PNGs (claro, oscuro y móvil cuando aplica) tomados contra el dev server de su worktree con Playwright, usando credenciales por archivo temporal fuera del repo. Si un VPS no tiene `.env.local` o Chromium instalado todavía, el subagente lo reporta de inmediato en el primer minuto (o se ejecutan las capturas en el entorno que sí tenga Playwright/env listo antes de mostrarlas a Waldy).
7. **Verificación antes de cada merge a `main`:** `pnpm typecheck`, `pnpm check` (0 errores), `pnpm test` y `pnpm build` en verde + checks reales de CI (`ci`, `scan`, `e2e`) sobre el `headSha` del PR + visto bueno visual de Waldy.

---

## 2. Arquitectura de fases y reparto de subagentes (máximo 10, archivos 100 % disjuntos)

### Resumen rápido de capacidad

| Fase | Subagentes en paralelo | Total acumulado | Reparto sugerido (si solo VPS 1 + PC) | Reparto sugerido (si arreglas VPS 2) |
| --- | --- | --- | --- | --- |
| **Fase 0** (Orquestador) | 0 (directo) | 0 | Commitear `docs/planes/rediseno-alegra/` + este plan en `main` | Igual |
| **Fase 1** (Base + independientes) | **5 en paralelo** (`S1`, `S2`, `S3`, `S4`, `S5`) | 5 | VPS 1: `S1`, `S3`, `S4` · PC: `S2`, `S5` | VPS 1: `S1`, `S4` · VPS 2: `S3`, `S5` · PC: `S2` |
| **Fase 2** (Sobre el shell de S1) | **4 en paralelo** (`S6`, `S7`, `S8`, `S9`) | 9 | VPS 1: `S6`, `S7` · PC: `S8`, `S9` | VPS 1: `S6`, `S7` · VPS 2: `S8`, `S9` · PC: libre |
| **Fase 3** (Cierre + deuda `HANDOFF`) | **1** (`S10`) | **10 máx.** | VPS 1 o PC (`S10`) | VPS 1 (`S10`) |

> **Por qué este orden evita el 100 % de los conflictos:** `S1` reescribe el shell (`layout.tsx`, rail lateral `menu-pos.tsx` y columnas `h-dvh` de `vender-pos.tsx`). Una vez `S1` se integra a `main`, las 4 tareas de Fase 2 (`S6` carrito, `S7` catálogo, `S8` Registro de pagos + Turnos, `S9` Historial + Devoluciones + subcomponentes de Turnos) trabajan sobre archivos **100 % disjuntos**.

---

### FASE 0 — Publicar el plan y capturas en `origin/main` (Orquestador, ~2 min)

- Verificar que `docs/planes/rediseno-alegra/img/01..07.png` están censuradas (sin datos personales reales).
- Commitear `docs/planes/rediseno-alegra/` y `docs/PLAN-FASE-3-REDISENO-ALEGRA.md` en un PR chico de docs (o push limpio tras confirmar con Waldy) para que `srv1692753` y `srv1694526` puedan leerlos desde `origin/main`.
- *(Prueba VPS):* lanzar un chequeo rápido o el primer subagente en `srv1692753` verificando que tiene `pnpm`, `node 22`, Playwright/Chromium y `.env.local` si va a sacar capturas.

---

### FASE 1 — 5 subagentes en paralelo (archivos 100 % disjuntos)

#### `S1` — C1 + C3: Shell POS `h-dvh`, panel pegado al borde derecho y menú lateral Alegra (P0)
- **Referencia:** `PLAN.md` (C1 y C3), `img/01-pos-actual-borde-derecho.png`, `img/03-alegra-pos-menu.png`, `docs/alegra/pos/capturas/22-menu-lateral.png`, `docs/alegra/pos/design-alegra-pos.md`.
- **Archivos que posee:**
  - `src/app/(pos)/pos/layout.tsx`
  - `src/app/(pos)/pos/_components/encabezado-pos.tsx` (eliminar o reemplazar)
  - `src/app/(pos)/pos/_components/navegacion-pos.tsx` / nuevo `src/app/(pos)/pos/_components/menu-pos.tsx`
  - `src/app/(pos)/pos/_components/selector-terminal.tsx`
  - `src/app/(pos)/pos/_components/estado-turno-pos.tsx`
  - `src/app/(pos)/pos/_components/usuario-pos.tsx`
  - `src/app/(pos)/pos/_components/salir-pos.tsx`
  - `src/app/(pos)/pos/_components/vender/vender-pos.tsx` *(solo marco de columnas `h-dvh`, `overflow-hidden`, sin franja muerta a la derecha)*
- **Qué entrega:**
  - Elimina la barra horizontal superior de tabs; monta rail vertical izquierdo de **~56 px** que expande a **271 px** al hover/foco (con pin opcional), barra activa primaria `3×16 px`, estructura exacta de Alegra (`Facturar`, acordeón `Ingresos → Historial de ventas / Registro de pagos`, acordeón `Turnos → Historial de turnos`, `Devoluciones`, separador, enlaces en pestaña nueva a `Contactos`, `Inventario` y `Configuraciones`, y pie con terminal, badge de turno, usuario y salir).
  - Corrige C1 de raíz: en 1024/1280/1440/1920 px, `panel.getBoundingClientRect().right === window.innerWidth` (±1 px) y `documentElement.scrollHeight === clientHeight` (solo scrollean catálogo y carrito).
  - Móvil `<1024 px`: cajón lateral 271 px + velo, manteniendo `Sheet` para el carrito.
  - Capturas claro/oscuro a 1280, 1440, 1920 y móvil 390 + medición exacta del borde derecho.

#### `S2` — C8: Corregir bug de cédula en Nómina → Empleados (P0)
- **Referencia:** `PLAN.md` (C8), `img/07-nomina-cedula.png`, `supabase/migrations/20261124120000_config_dgii_rnc.sql` (`_rnc_digito_valido`).
- **Archivos que posee:**
  - `src/lib/validacion/cedula.ts` (nuevo helper con el algoritmo exacto de `_rnc_digito_valido` + `src/lib/validacion/cedula.test.ts`)
  - `src/app/(main)/dashboard/contabilidad/nomina/empleados/_components/wizard-empleado.tsx`
  - `src/app/(main)/dashboard/contabilidad/nomina/empleados/_components/formato-nomina.ts`
  - `src/app/(main)/dashboard/contabilidad/nomina/empleados/_components/formato-nomina.test.ts`
  - `src/app/(main)/dashboard/contabilidad/nomina/empleados/_components/wizard-validacion.ts`
  - `src/lib/nomina/esquemas.ts`
- **Qué entrega:**
  - Reproduce primero los 5 casos del protocolo de C8 (tipeo, pegado con/sin guiones/espacios, Backspace sobre guion, edición en medio sin salto de cursor, dígito verificador inválido vs válido `402-3772118-4`).
  - Manejo correcto del cursor (`selectionStart`) al formatear/borrar guiones y sin truncar al pegar con espacios/guiones.
  - Validación del dígito verificador en cliente antes de avanzar de paso + mapeo del error del servidor al campo `identificacion`.
  - Tests unitarios completos + capturas con error inline y con éxito.

#### `S3` — C2: Menú lateral del dashboard `/dashboard` igual a `GUIA-MENU.md` (P1)
- **Referencia:** `PLAN.md` (C2), `docs/alegra/css-menu/GUIA-MENU.md`, `docs/alegra/capturas/21-guia-menu-*.png`.
- **Archivos que posee:**
  - `src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx`
  - `src/app/(main)/dashboard/_components/sidebar/nav-main.tsx`
  - `src/app/(main)/dashboard/layout.tsx`
  - *(NO editar `src/components/ui/sidebar.tsx` salvo aprobación explícita de Waldy).*
- **Qué entrega:**
  - Ancho 271 px expandido / 53 px colapsado, cabecera 56 px (logo máx. 40 px alto, botón colapsar 40×40 radio 8), ítems 32 px radio 6, íconos 20×20 px, estado activo con fondo `slate-200/45` + **barra primaria `3×16 px`** a la izquierda, acordeón con línea izquierda 1 px (`ml-[17px] pl-[10px]`), títulos de grupo 12 px/500, móvil drawer 271 px + velo.
  - Conserva todas las rutas, roles y el grupo desplegable de Nómina.
  - Medición Playwright a 1280×800 (`271 / 56 / 32 / 20 / 3×16`) + capturas claro/oscuro/móvil.

#### `S4` — C7: Ticket térmico POS 80 mm y 57 mm estilo Alegra + logo empresa (P1)
- **Referencia:** `PLAN.md` (C7), `img/06-ticket-actual.png`, `docs/alegra/pos/capturas/22-ticket-imprimir.png`.
- **Archivos que posee:**
  - `src/components/pos/ticket-pos.tsx`
  - `src/lib/pos/impresion.ts`
  - `src/lib/pos/impresion.test.ts` (y tests del ticket)
  - `src/app/(main)/dashboard/configuracion/pos/_components/editor-plantilla-ticket.tsx`
  - `src/app/(main)/dashboard/configuracion/pos/_components/ticket-pos-vista.tsx`
- **Qué entrega:**
  - Logo de `empresa.logo_url` en la cabecera de 80 mm y 57 mm (más pequeño en 57 mm; ocultable con `mostrar_logo = false`; degradación limpia si está vacío).
  - Jerarquía y proporciones de Alegra: Logo → Empresa/RNC/dirección/teléfono/correo → Título comprobante + NCF → Fecha/hora/terminal/turno/cajero → Cliente/RNC → Tabla ítems → Subtotal/exento/gravado/ITBIS/Total → Pagos/recibido/cambio → Pie propio.
  - Conserva intacto el PDF Carta (NO toca `documento-papel.tsx` ni `documento-carta-pos.tsx`).
  - Tests + capturas de 80 mm y 57 mm (con logo y sin logo).

#### `S5` — C9-A: Checkout, Confirmación y Calculadora «Venta simple» estilo Alegra (P1)
- **Referencia:** `docs/alegra/pos/design-alegra-pos.md` (§ Checkout, Confirmación y Calculadora), `docs/alegra/pos/capturas/22-venta-pagos.png`, `22-venta-completada.png`, `22-venta-simple.png`, `22-cancelar-venta.png`.
- **Archivos que posee:**
  - `src/app/(pos)/pos/_components/vender/checkout-pos.tsx`
  - `src/app/(pos)/pos/_components/vender/confirmacion-venta.tsx`
  - `src/app/(pos)/pos/_components/vender/dialogo-venta-simple.tsx`
  - `src/app/(pos)/pos/_components/vender/dialogo-cargar-cotizacion.tsx`
- **Qué entrega:**
  - Modal «Pagar factura»: TOTAL centrado grande, **tiles 3+3** de métodos de pago con ícono y borde primario al seleccionar, efectivo con **pills de opciones rápidas** (exacto y redondeos) + campo **Cambio** destacado + vendedor/observaciones a la derecha, modo combinado y pago parcial/crédito intactos.
  - Modal Confirmación: círculo primario con check, «¡Venta completada!», chip Total + Cambio, acciones Imprimir Ticket / Imprimir PDF Carta / Nueva venta.
  - Modal «Venta simple» (F4): layout de **calculadora** estilo Alegra (input nombre, display grande a la derecha, grid de dígitos/operadores, CTA full-width «Aplicar a la venta»).
  - Capturas claro/oscuro de los 3 modales.

---

### FASE 2 — 4 subagentes en paralelo (arrancan tras integrar `S1` en `main`, archivos 100 % disjuntos)

#### `S6` — C4: Panel del carrito «Factura de venta» estilo Alegra (P0)
- **Referencia:** `PLAN.md` (C4), `img/02-alegra-pos-carrito.png`, `docs/alegra/pos/capturas/22-venta-tabs.png`, `22-venta-item-agregado.png`.
- **Archivos que posee:**
  - `src/app/(pos)/pos/_components/vender/panel-factura.tsx`
  - `src/app/(pos)/pos/_components/vender/linea-carrito-pos.tsx`
  - `src/app/(pos)/pos/_components/vender/pestanas-venta-pos.tsx`
- **Qué entrega:**
  - Panel fijo de **400 px**, fondo `bg-card`, pegado al borde derecho sin bordes redondeados externos.
  - Encabezado «Factura de venta», selects `Lista de precios` y `Numeración` lado a lado (40 px), selector Cliente + botón «Nuevo» (usa creación rápida si existe o abre `/dashboard/contactos/nuevo` en pestaña nueva).
  - Líneas con nombre + precio unitario chico | stepper `− N +` | total a la derecha (conservando edición/unidades/descuento expandible).
  - Totales con subtotal e ITBIS en gris, botón primario full-width **«Vender RD$ X»** (F8) con el total adentro, debajo «N artículos» y «Cancelar venta» en rojo; acciones secundarias (Guardar/Cargar cotización, Venta simple) discretas sin competir con Vender.
  - Pestañas de ventas paralelas al pie estilo navegador con borde inferior primario y botón `+`.
  - Capturas claro/oscuro + comparación lado a lado con `img/02`.

#### `S7` — C5: Catálogo de productos estilo Alegra (P0)
- **Referencia:** `PLAN.md` (C5), `img/02-alegra-pos-carrito.png`, `docs/alegra/pos/capturas/22-venta-item-agregado.png`.
- **Archivos que posee:**
  - `src/app/(pos)/pos/_components/vender/catalogo-pos.tsx`
  - `src/app/(pos)/pos/_components/vender/tarjeta-producto-pos.tsx`
  - `src/app/(pos)/pos/_components/vender/buscador-catalogo-pos.tsx`
- **Qué entrega:**
  - Barra superior: buscador ancho con lupa, icono/estado de escáner, filtro discreto de categoría/favoritos y botón «Nuevo producto» (`/dashboard/productos/nuevo` en pestaña nueva).
  - Tarjeta **«Venta simple» (F4)** al inicio del grid (ícono carrito+rayo).
  - Grid de **tarjetas cuadradas ~140 px** (5 cols en 1920, 4 en 1280): imagen/ícono centrado, `Inv. N` en `--primary` chico, nombre máx. 2 líneas, precio semibold, estrella de favorito arriba-derecha, badge circular con cantidad en carrito y borde `--primary` activo, badge «Agotado» si stock ≤ 0.
  - Conserva debounce 250 ms, pistola de código de barra, favoritos, categorías y «Ver más».
  - Capturas claro/oscuro/móvil + comparación lado a lado con `img/02`.

#### `S8` — C6: Mover «Registrar movimiento» fuera de Turnos y crear `/pos/pagos` («Registro de pagos») (P1)
- **Referencia:** `PLAN.md` (C6), `img/04-turnos-actual-boton.png`, `img/05-alegra-registro-pagos.png`, `docs/alegra/pos/capturas/22-registro-pagos-venta.png`.
- **Archivos que posee:**
  - `src/app/(pos)/pos/_components/turnos/turnos-pos.tsx` *(quitar botón «Registrar movimiento» y alinear layout maestro-detalle con Turnos)*
  - `src/app/(pos)/pos/pagos/page.tsx` (nuevo)
  - `src/app/(pos)/pos/_components/pagos/*` (nuevo: lista paginada, detalle, filtros Ingresos/Egresos)
  - `src/lib/pos/consultas.ts` (+ `src/lib/pos/consultas.test.ts` para listado paginado de `pos_turno_movimientos`)
  - `src/lib/pos/tipos.ts` (tipos del listado de pagos)
- **Qué entrega:**
  - `/pos/turnos` ya NO muestra «Registrar movimiento».
  - Nueva pantalla `/pos/pagos` con pills **Ingresos / Egresos**, buscador + filtro, botón primario «Nuevo pago» (reutiliza `DialogoMovimiento`; deshabilitado con aviso + link a Turnos si no hay turno abierto; oculto para `lector`), lista maestro-detalle paginada (10/25/50) y acciones reales (**Imprimir** y **Ver factura/gasto**, sin editar/eliminar muertos).
  - Capturas claro/oscuro/móvil + alta de movimiento.

#### `S9` — C9-B: Pulido visual Alegra de Turnos (subcomponentes), Historial y Devoluciones (P2)
- **Referencia:** `docs/alegra/pos/design-alegra-pos.md` (§ Turno y cierre, Wizard de devolución), `docs/alegra/pos/capturas/22-ingresos-historial-ventas.png`, `22-venta-detalle.png`.
- **Archivos que posee:**
  - `src/app/(pos)/pos/_components/turnos/resumen-turno.tsx`
  - `src/app/(pos)/pos/_components/turnos/tabla-movimientos-turno.tsx`
  - `src/app/(pos)/pos/_components/turnos/tabla-cierres.tsx`
  - `src/app/(pos)/pos/_components/turnos/dialogo-cerrar-turno.tsx`
  - `src/app/(pos)/pos/_components/historial/*`
  - `src/app/(pos)/pos/_components/devoluciones/*`
- **Qué entrega:**
  - Turnos: badge `ABIERTO`/`CERRADO` pill, movimientos negativos/devoluciones en rojo, caja destacada «Dinero esperado en caja» en fondo suave con monto grande a la derecha.
  - Historial y Devoluciones: tablas alineadas a `TablaLista` (48 px header), wizard de devoluciones con tarjetas seleccionables en Paso 1 y dos columnas claras en Paso 3.
  - Capturas claro/oscuro de Turnos, Historial y Devoluciones.

---

### FASE 3 — Cierre, documentación y deuda técnica de `HANDOFF.md` (1 subagente opcional `S10`)

- **Archivos que posee:**
  - `src/lib/nomina/acciones.ts` (exponer `nomina_agregar_empleados` para habilitar el botón pendiente de `HANDOFF.md`)
  - `src/lib/tablas-listas.test.ts` y `src/lib/diseno-paginas.test.ts` (sumar las nuevas listas/páginas a los candados)
  - `docs/dominio-pos.md` (actualizar §1.2 a 5 pantallas incluyendo `/pos/pagos` y el rail lateral de C3)
  - `AGENTS.md` y `HANDOFF.md` (actualizar módulos, candados y cierre de Fase 3)
- **Verificación final del Orquestador:** `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build`, CI verde en el último `headSha` y entrega de todas las capturas a Waldy para aprobación final.
