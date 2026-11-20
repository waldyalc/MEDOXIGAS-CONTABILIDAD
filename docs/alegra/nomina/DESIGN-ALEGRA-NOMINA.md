# Alegra Nómina — Sistema de diseño (destilado)

Fuente: extracción `extract-design` sobre las 18 pantallas clave de `nomina.alegra.com` (20 nov 2026). Los HTML/CSS crudos viven en `design/` **solo en local** (regla AGENTS.md: nunca se commitean); aquí quedan las medidas, tokens y comportamientos destilados, más la captura renderizada de cada pantalla en `design/<nombre>/screenshot.png`.

Pantallas extraídas:

| Módulo | Carpeta `design/` |
|---|---|
| Inicio | `inicio` |
| Bandeja de entrada | `bandeja` |
| Lista de empleados | `empleados-lista` |
| Alta de empleado (wizard) | `empleado-nuevo` |
| Ficha de empleado | `empleado-ficha` |
| Cálculo de nómina (lista) | `calculo-nomina` |
| Periodo de nómina | `periodo` |
| Recibo de pago | `recibo` |
| Gestión de envíos | `gestion-envios` |
| Pagos (lista) | `pagos` |
| Pagos (detalle) | `pagos-detalle` |
| Configuración (índice) | `configuracion` |
| Empresa (edición) | `empresa-edit` |
| Config contable | `config-contable` |
| Conceptos de ingreso | `config-ingresos` |
| Deducciones | `config-deducciones` |
| Numeraciones | `config-numeraciones` |
| Suscripciones (mi.alegra.com) | `suscripciones` |

## 1. Stack y marco visual

- SPA en **Vue** (atributos `data-v-*`), utility-first **Tailwind** (`--tw-*` por todas partes) con una capa de design-system propia prefijada **`s-`** (`s-button`, `s-modal`, `s-layout__content`, `s-pagination`, `s-table`…).
- Tipografía: **Inter** (`Inter, Roboto, sans-serif`). Monoespaciada solo para código.
- Layout: **sidebar oscuro-claro fijo a la izquierda** (~240 px) con logo, ítems con ícono+texto, submenú acordeón (Nómina → Cálculo de nómina / Gestión de envíos); banner fijo abajo "Te quedan N días gratis" + CTA "Elegir plan". Contenido en `<section>` con `<header>` (título h4 + subtítulo descriptivo) + tarjetas blancas sobre fondo gris muy claro.
- Topbar: ayuda (?), apps grid, logo empresa + avatar usuario.

## 2. Color

Color de marca y primario: **teal/verde-azulado** — base `--color-base: #0a9e9a`; escala `--sm-color-primary-*` (RGB en variables):

| Token | RGB | Uso |
|---|---|---|
| primary-50 | 233, 250, 250 | fondos de selección/hover suaves |
| primary-100 | 212, 242, 241 | chips, acentos claros |
| primary-400 | 114, 213, 209 | hover |
| **primary-500** | **0, 177, 157 (#00B19D)** | botones primarios, links, focus ring, barra de progreso |
| primary-600 | 10, 158, 154 | hover de primario |
| primary-700/800/900 | 0,83,94 → 0,84,82 | textos de acento, activos en sidebar |

Variantes de acento presentes en el mismo CSS (temas/badges): azul 53,136,255 · violeta 131,127,243 · naranja 247,134,82.

Neutros (datepicker y texto): slate `#334155` (texto fuerte), `#64748b` (secundario), `#cbd5e1` (bordes/deshabilitado), `#f1f5f9`-`#f8fafc` (fondos). Peligro: `--dp-danger-color: #e11d48` (rose). Estados: "Por calcular"/"Por pagar" en tonos neutros-ámbar; "Calculada/Contabilizada/Pagado/Enviado" en verde.

## 3. Formas y espaciado

- **Radios dominantes**: `0.5rem` (8 px) en inputs/botones/cards; `0.75rem` (12 px) en cards grandes; `9999px` para pills, badges y avatares. También 10 px/4 px puntuales.
- Sombras suaves tipo `sm-card`; contenedores blancos con borde fino `#e2e8f0`.
- Tabla: encabezado gris con label en mayúsculas pequeñas, filas con hover, celdas densas; paginador propio `s-pagination` ("Ítems por página: 10/20/30" + "1-2 de 2" + flechas).
- Barras de progreso finas en el header del periodo (Cálculos % / Contabilización %) en teal.

## 4. Componentes (patrones de interacción)

- **Botones** `s-button`: variantes `filled` (primario teal), `text`/`default` (secundario), tamaños `medium`/`small`; `s-button--only-icon` para acciones de fila (ojo, pagar). Estado disabled muy usado como **regla de negocio** (Pagar se habilita solo tras Contabilizada).
- **Selects custom**: caja `div[aria-expanded]` que abre lista; las opciones son elementos `<p>`/`li`, no `<option>`; varios llevan buscador interno ("Buscar banco…"). Clic sencillo abre/cierra (doble clic la re-cierra).
- **Inputs**: sin `name`/`id` semánticos (indexados por orden); máscaras en moneda (RD$ con formato) y teléfono (+1 con selector de país); datepicker propio (`dp-*`, input `00/00/0000`, dd/mm/yyyy + Enter).
- **Modales** `s-modal-area` (testid `payment-modal`, `*-modal`): overlay, título + descripción, formulario, footer Cancelar/CTA ("Contabilizar (1)", "Enviar recibos (2)", "Pagar"). Confirmaciones destructivas/irreversibles con segundo modal explícito.
- **Wizard**: el alta de empleado son 3 pasos con validación por paso y CTA "Continuar".
- **Skeletons**: las pantallas cargan con skeletons; a veces se quedan pegados tras acciones async (recibo post-liquidación) → recargar.
- **Toasts**: "Los datos se guardaron y liquidaron con éxito", "Enviando recibos de pago…".
- **Tabs**: Bandeja (Principal/Novedades/Archivo), Empleados (Activos/Suspendidos), Importar (Importar archivo/Editor en línea), ficha de empleado (Información/Novedades recurrentes/Historial).
- **Checkbox de preferencia**: "No mostrar este mensaje nuevamente" en el modal de Contabilizar.
- **Empty states** ilustrados: "¡Estás al día!", "¡Empieza a sumar talentos! Agrega tu primer empleado/a…".
- **Typeahead**: el selector de periodo filtra quincenas escribiendo el mes ("Nov" → "1 Nov - 15 Nov" / "16 Nov - 30 Nov").

## 5. Datos y formato

- Moneda dominicana: `RD$45,317.17` (en listados también `RD$45.317,17` — inconsistencia real de la app, mezcla separadores).
- Tablas siempre con paginador cliente; filtros con botón "Filtrar" + panel lateral; selector de año en listados.
- Estados con **badge** por fila y **progreso agregado** arriba (Cálculos %/Contabilización %, Progreso de envío 2/2).
- Validaciones inline bajo el campo en rose `#e11d48`; bloquean el CTA.

## 6. Qué copiar como comportamiento (no como código)

1. Ciclo con estados por fila + barras de progreso agregadas y CTAs que se habilitan/deshabilitan según el estado (Pagar ⟸ Contabilizada).
2. Selects con buscador interno para catálogos (bancos, conceptos, cuentas).
3. Confirmación en dos pasos para acciones irreversibles (envío de colillas).
4. Recibo documental: encabezado empresa+empleado, prorrata visible ("Días calculados"), tablas Ingresos/Deducciones y resumen.
5. Empty states con acción directa ("+ Nuevo empleado" dentro de la gráfica vacía).
