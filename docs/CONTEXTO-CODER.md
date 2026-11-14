# Contexto para seguir Medoxigas Contabilidad sin Coder

Este archivo es para **Waldy** y para cualquier agente (T3 Code, OpenCode, Claude u otro). Reúne lo que Coder sabía hasta el **14 de noviembre de 2026** (hora de República Dominicana, zona America/Santo_Domingo): qué es el sistema, dónde vive, cómo trabajar, lo que ya está hecho, lo que falta y cómo está documentado Alegra.

Léelo junto con `AGENTS.md`, `HANDOFF.md` y las habilidades de `.opencode/skills/`. El estudio de las pantallas de Alegra está en `docs/alegra/ALEGRA.md`.

---

## 1. Qué es el sistema y la meta

**Medoxigas Contabilidad** es el sistema de contabilidad y facturación propio de **MEDOXIGAS ALC, SRL** (y Oxymat), en República Dominicana. Dueño: Waldy Alcántara.

La meta es que quede **igual de sencillo y completo que Alegra Contabilidad**: mismos flujos, mismos campos importantes, mismos asientos y mismos reportes, pero con **nuestros colores** y con **shadcn/ui tal cual**. No es una copia de Alegra: no se clona su código, sus textos largos, sus logos ni su CSS. Los términos de Alegra lo prohíben. Nos inspiramos en cómo trabaja Waldy ahí y lo reconstruimos con nuestro stack.

Lo más importante para Waldy es un **motor contable de doble partida, bien probado**. El usuario no escribe débitos ni créditos: el motor elige las cuentas y arma el asiento. Los formularios deben ser tan simples como los de Alegra: pocos campos a la vista, lo opcional en «Más opciones» y las cuentas puestas solas por defecto.

Stack (el mismo de Medoxigas-OPP): Next.js 16, React 19, TypeScript, shadcn/ui + Tailwind 4, Supabase, Vercel, Biome, Vitest, Playwright y pnpm.

---

## 2. Dónde vive cada cosa

| Qué | Dónde |
| --- | --- |
| Repo de GitHub (privado) | `waldyalc/MEDOXIGAS-CONTABILIDAD` |
| Rama de producción | `main` → https://medoxigas-contabilidad.vercel.app |
| Rama de prueba | `prueba` → https://medoxigas-contabilidad-prueba.vercel.app |
| Copia en la PC de Waldy | `C:\Users\wardy\proyectos\MEDOXIGAS-CONTABILIDAD` (fuera de OneDrive, a propósito) |
| App en local | http://localhost:3000 (suele estar en una ventana que dice «NO CERRAR»; no la cierres) |
| Base de datos | Un solo proyecto Supabase: **MEDOXIGAS-CONTABILIDAD**, ref `ljfdhrnvlsfaweuvnqxz` (región ca-central-1, plan gratis, org «MEDOXIGAS operacioens») |
| Roles | Tabla `perfiles`: `admin`, `contador`, `lector` |

**Importante:** localhost, la web de prueba y la de producción usan **la misma base**. Lo que crees, edites o borres en local queda en la base real. Hoy producción todavía no tiene datos reales de la empresa, pero hay que tratarla con cuidado.

El checkout de trabajo en el box de los agentes (si aparece) suele estar en `/workspace/contab-repo`. Eso no es la PC de Waldy.

---

## 3. Cómo arrancar en local

Hace falta Node.js 22 LTS y pnpm 10. En PowerShell, en la carpeta del repo:

```powershell
cd C:\Users\wardy\proyectos\MEDOXIGAS-CONTABILIDAD
pnpm install
pnpm dev
```

Abre http://localhost:3000. Sin sesión, la app manda a `/login`.

Las variables van en `.env.local` (ese archivo ya debe existir en la PC; **nunca se sube al repo**). Solo estos nombres:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave anon o publishable; no es la `service_role`)

El ejemplo de nombres, sin secretos, está en `.env.example`. No hay registro público: los usuarios se crean a mano en Supabase → Authentication y el administrador les pone su fila en `perfiles`.

Comandos útiles (también están en `AGENTS.md`):

| Para… | Comando |
| --- | --- |
| Tipos | `pnpm typecheck` |
| Formato y lint | `pnpm check` (arreglar: `pnpm check:fix`, mejor solo en los archivos que tocaste) |
| Tests de la app | `pnpm test` |
| Humo del navegador | `pnpm test:e2e` (se salta si no están `E2E_EMAIL` y `E2E_PASSWORD`) |
| Build | `pnpm build` |
| Regenerar tipos de Supabase | `pnpm db:types` (después de cada migración; no edites `src/lib/supabase/types.ts` a mano) |
| Probar RLS y pgTAP | `supabase start` y `supabase test db` (solo en Postgres local, nunca contra el proyecto real) |

Si un agente de T3 Code levanta un servidor en un worktree, que use el puerto **3001** (u otro libre) y no ocupe ni mate el 3000 de Waldy. Para copiar variables a un worktree, solo:

```powershell
Copy-Item C:\Users\wardy\proyectos\MEDOXIGAS-CONTABILIDAD\.env.local .env.local
```

Nunca imprimas el contenido de `.env.local`.

---

## 4. Flujo de trabajo

1. **Parte siempre de `origin/prueba`**, nunca de `main`. Crea una rama `feat/<nombre-corto>`.
2. Si hay cambio de base de datos, la migración debe ser **aditiva** (archivo nuevo en `supabase/migrations/`, nombre `YYYYMMDDHHMMSS_descripcion.sql`). No edites una migración que ya está en el repo o ya se aplicó.
3. Escribe tests: Vitest al lado del código TypeScript; pgTAP en `supabase/tests/` si tocas SQL.
4. Prueba la migración en **BEGIN / ROLLBACK** (y pgTAP) contra una copia o en transacción, sin dejar datos. El agente **no** la aplica al proyecto remoto.
5. Corre `pnpm typecheck`, los tests que cubran el cambio, Biome solo en lo tocado y, si cambió servidor o rutas, `pnpm build`.
6. Commits chicos, en español, con prefijo (`feat`, `fix`, `test`, `docs`, `refactor`). Empuja **tu rama**. No fusiones a `prueba` ni a `main` desde una tarea de agente, salvo que Waldy lo pida con claridad.
7. Quien integra (antes era Coder) revisa el diff, prueba pgTAP en BEGIN/ROLLBACK, aplica la migración en el proyecto (`apply_migration` o el flujo de Supabase que se use), hace merge a `prueba`, corre `pnpm typecheck`, `pnpm test`, `pnpm check` y `pnpm build`, y hace `git push` **sin** `--no-verify`. El hook de pre-push ya corre typecheck y test. En el box, si los hooks lo piden: `export COREPACK_HOME=/home/box/.cache/corepack`.
8. En la PC: `git pull --ff-only origin prueba` en `C:\Users\wardy\proyectos\MEDOXIGAS-CONTABILIDAD`.
9. **`main` y producción solo cuando Waldy lo decida**, y solo por fast-forward. Nunca force-push.

Detalles en `.opencode/skills/flujo-git/SKILL.md`, `probar-cambios`, `supabase-migraciones` y `motor-contable`.

Antes de decir «listo»: actualiza `HANDOFF.md` con lo que se hizo y cómo se resolvió.

---

## 5. Cómo usar T3 Code y OpenCode, y cómo escribir un buen brief

El código lo escribe **OpenCode dentro de T3 Code**, en la computadora MSI de Waldy. El modelo es `opencode-go/deepseek-v4.1-flash`, variante **max**. La MSI tiene que estar prendida y con T3 Code abierto. El repo de T3 es el mismo: MEDOXIGAS-CONTABILIDAD.

Forma habitual de una sesión:

- Parte de `origin/prueba`, con worktree (no ensucies la carpeta principal de Waldy).
- Acceso completo al worktree (`full-access` / runtime de trabajo).
- Una rama `feat/...` por tarea. Varias sesiones pueden ir en paralelo (hasta unas 10), cada una en su worktree, sin pisar los mismos archivos.
- El agente hace commits en su rama y la empuja. No fusiona a `prueba` ni a `main`.
- Si se atasca, pregunta (skill `pedir-ayuda`); no dé vueltas ni use `--no-verify`.

### Cómo escribir un buen brief

- Di **una sola tarea**, con el resultado que se espera ver en pantalla o en la base.
- Di de qué rama parte (`origin/prueba`) y el nombre de la rama nueva.
- Di qué archivos o carpetas puede tocar y **qué no debe tocar** (otras sesiones, `main`, secretos, `.env.local`).
- Si hay guía de diseño, enlázala (`docs/alegra/css-pagos/GUIA-FORMULARIOS.md`, `docs/alegra/css-vista/GUIA-VISTA.md`, `docs/alegra/css-factura/`, este archivo).
- Si hace falta migración: que sea aditiva, con pgTAP aislado, **sin aplicarla** en el remoto.
- Si es solo diseño: deja claro que no cambien cálculos, validaciones ni lo que se guarda.
- Pide tests y `pnpm typecheck` en verde. No pidas verificación visual ni levantar localhost salvo que haga falta (el agente no tiene el login; el puerto 3000 es de Waldy).
- Pide que actualice `HANDOFF.md` al terminar.
- No pegues claves, tokens ni el contenido de ningún `.env`.

Las habilidades del repo (cargarlas según el caso): `localhost`, `probar-cambios`, `flujo-git`, `diseno-ui`, `motor-contable`, `supabase-migraciones`, `pedir-ayuda`.

---

## 6. Preferencias de diseño y de producto de Waldy

Estas reglas se mantienen aunque el agente sea otro:

- **Simple como Alegra:** pocos campos a la vista; lo opcional en «Más opciones»; cuentas contables puestas solas por defecto. Eso es lo que más quiere Waldy.
- **Colores propios, no los de Alegra.** Fondo blanco; azul principal `#1e56c7` (botones, enlaces, íconos activos); azul oscuro `#0a2352`; hover `#123c8c`; suave `#eaf0fc`. Viven como preset «Medoxigas» en `src/styles/presets/`. En los componentes, usar tokens del tema, no hex sueltos. Guía: `docs/plantilla-diseno.md`.
- **shadcn/ui tal cual.** Usar `src/components/ui/` sin editarlos. Personalizar donde se consumen.
- **Sin listas nativas del navegador.** Siempre `Select` / `SelectCampo` o el `Combobox` de shadcn. Nunca `<select>` ni `NativeSelect` fuera de `components/ui`. Lo vigila `src/lib/selects-nativos.test.ts`.
- **Formularios con el kit común** `src/components/formularios/formulario.tsx`: `FormCard`, `FormGrid`, `FormField`, `FormSectionTitle`, `FormDivider`, `FormTotal`, `FormActions`. Medidas en `docs/alegra/css-pagos/GUIA-FORMULARIOS.md` (campo 40 px, radio 10, borde slate-300, foco de 2 px con el primario, etc.).
- **Esqueletos al cargar:** la pantalla aparece al instante con tablas y tarjetas grises; los datos llegan después. No dejar la app congelada al cambiar de pestaña.
- **Todo conectado:** cada cliente, producto, documento, asiento o cuenta que aparezca en una vista debe ser un enlace a su ficha, y cada ficha debe listar los documentos relacionados.
- **«Crear nuevo cliente / proveedor / producto»** desde el selector del documento, como en Alegra, sin borrar lo que ya se había llenado.
- **Impuestos agrupados** como en Alegra: ITBIS, Otro, Propina legal y Exento. Por ahora **no** hay que poner «Crear nuevo impuesto».
- **PDF y vista** de factura, cotización y conduce como Alegra (mismo orden visual: logo, empresa, cliente, NCF, líneas y totales). Los tres documentos comparten vista y papel. El logo de Medoxigas va donde Alegra pone el suyo.
- **Catálogo de cuentas en árbol**, por ramas, como Alegra: padres con chevron, búsqueda, panel de información.
- **Pagos con varias facturas:** al elegir el cliente (o proveedor) se cargan solas las facturas pendientes; retenciones por factura; pestañas «Pago a factura» y «Otros ingresos» (o egresos).
- Prefijos **RD$** y **%** dentro del recuadro (`InputGroup`). Fechas con el `DatePicker` del repo, no con `<input type="date">`.
- Texto de la UI en **español de RD**. Números con formato `es-DO`. Fechas y horas en `America/Santo_Domingo`.
- Dinero: nunca `number` flotante para montos guardados; en la base `numeric(14,2)`; ITBIS y totales se calculan en el servidor.
- No copiar código, CSS, textos largos ni logos de Alegra al producto. Las carpetas `docs/alegra/css-*` son **estudio**, no para pegarlas en la app.

---

## 7. Historial de lo hecho (hasta S28)

Casi todo se construyó el **13 de noviembre de 2026**, en muchas sesiones paralelas de T3 Code / OpenCode, y se fue integrando a la rama `prueba`. La numeración S1–S14 no quedó siempre escrita con ese nombre; abajo va primero la **Beta 1** y el resto de módulos, y luego las sesiones que sí quedaron numeradas (S15 a S28). El detalle de cada una está en `HANDOFF.md`.

### Arranque y Beta 1

- Repo privado, ramas `main` y `prueba`, proyecto Vercel y proyecto Supabase nuevos. Login (correo/contraseña y botón Google) y cascarón con menú.
- **Motor contable** de doble partida (`20261113140000_motor_contable.sql`): catálogo inicial, `config_contable`, contactos, productos, numeraciones NCF, facturas, compras, pagos, gastos menores, anulación y reportes. Guías: `docs/motor-contable.md` y `docs/contrato-db.md`.
- Pantallas de Inicio, Contactos, Productos, Facturación, Pagos recibidos, Compras, Gastos menores, Contabilidad y Reportes (libro diario, balance, estado de resultados, CxC, ventas).
- Caja chica / gastos menores con NCF B13; numeraciones B14, B15 y B16; notas de crédito de venta; cotizaciones y conduces (remisiones); catálogo editable; asientos manuales; bancos (cuentas, transferencias, depósitos, conciliaciones); anulación de compras con recálculo de costo.

### Módulos que siguieron (antes de la numeración S15)

- Notas de débito de venta y facturas recurrentes.
- Compras completas: notas de crédito, órdenes de compra y pagos recurrentes.
- Activos fijos, depreciación y cierre de periodos.
- Inventario 1: ajustes, almacenes y categorías.
- Configuración: empresa, logo, términos de pago, impuestos (entonces solo lectura), usuarios.
- Diseño del formulario de factura, plantilla única de documento de venta, vista compartida de factura/cotización/conduce y PDF al estilo Alegra. Ajustes: logo más grande, `InputGroup`, `Select` de shadcn y calendario propio.
- Reportes administrativos (CxC/CxP, compras, valor de inventario), reportes fiscales 606/607/608, detallado de impuestos, IT-1 e «Exportar para el contador».
- Fichas y enlaces tempranos; bancos con ficha, transferencia y conciliación más completas.
- Inventario 2: stock por almacén, transferencias, listas de precios y anulación de ajustes.
- Retenciones de ITBIS e ISR en pagos, reportes IR-17 y cartas de retención.
- Vendedores, centros de costo, monedas (DOP/USD/EUR y tasas; los comprobantes siguen en DOP) y plantillas de impresión.
- Selector de rango de fechas único en reportes.
- CxP restando créditos; NCF del proveedor en notas de crédito de compra.

### Sesiones numeradas

| Sesión | Rama / tema | Qué entró a `prueba` |
| --- | --- | --- |
| S15 / S18 | Higiene de migraciones | `20261115500000_funciones_fusionadas_s15.sql`: junta stock por almacén, vendedor/centro, anulación y NCF de notas de compra. pgTAP de configuración e inventario aislados de datos reales. |
| S16 | `feat/importar-productos` | Importar productos desde CSV/Excel y edición masiva. La columna «unidad» se acepta en el archivo pero **no se guarda** (la tabla aún no tiene ese campo). |
| S17 | `feat/clonar-editar-documentos` | Clonar factura/cotización/conduce; editar cotización y conduce abiertos; convertir cotización en conduce o factura. Migración `20261115400000`. |
| S19 | `feat/crear-contacto-rapido` | «+ Crear nuevo» cliente/proveedor/producto desde los selectores. Migración `20261115600000` (tipo de identificación y municipio). |
| S21 | `feat/todo-conectado` | Enlaces a fichas en vistas, listados y reportes; documentos relacionados en cada ficha. Sin migración. |
| S22 | `perf/navegacion-rapida` | Esqueletos, Suspense, menos viajes a Auth (`getClaims`), joins y índices `20261115900000`. |
| S20 | `feat/impuestos-completos` | Catálogo de impuestos agrupado (Ninguno, ITBIS 18/16/0, CDT 2 %, Propina 10 %, Exento). Cuentas 2105 y 2106. Motor por impuesto. Migraciones `20261115700000` y `20261115701000`. |
| S23 | `feat/inicio-dashboard` | Inicio «Resumen del negocio» (tarjetas CxC/CxP, KPIs, gráfica de ventas). Función `dashboard_resumen` (`20261116100000`). |
| S24 | Papel / PDF | Montos que no se parten; se ocultan RNC, teléfono y vencimiento NCF si van vacíos. |
| S26 | `fix/select-shadcn` | Todos los `<select>` nativos pasaron a `SelectCampo`. Ya no queda ninguno fuera de `components/ui`. |
| S27 | `feat/catalogo-arbol` | Catálogo de cuentas en árbol, con búsqueda y panel. Sin migración. |
| S25 | `feat/pagos-multifactura` | Pago recibido y pago a proveedor con varias facturas, retenciones por factura y pestañas de otros ingresos/egresos. Migración `20261116200000`. Componentes `FormCard` / `FormGrid` / `FormField`. |
| S28 | `feat/formularios-alegra` | Todos los formularios de alta/edición (ventas, compras, contactos, productos, contabilidad, bancos, configuración e inventario) pasaron al diseño de Alegra. Solo diseño; sin migraciones. Los pagos de S25 no se rehicieron. |

Al cerrar S28, `prueba` estaba en `2947d7b`, con typecheck, **662** tests de la app, Biome y build en verde. No quedaban sesiones de código activas.

---

## 8. Migraciones aplicadas

En el proyecto Supabase compartido (`ljfdhrnvlsfaweuvnqxz`) ya están aplicadas, en este orden, las migraciones que viven en `supabase/migrations/` de la rama `prueba` (estado al 14 nov 2026):

- `20261113132637_perfiles.sql`
- `20261113140000_motor_contable.sql`
- `20261113160000_caja_chica_b13.sql`
- `20261113180000_reportes_libros.sql`
- `20261113180100_saldos_caja_banco.sql`
- `20261113210000_ncf_b14_b15_b16.sql`
- `20261113220000_notas_credito_venta.sql`
- `20261113230000_cotizaciones_remisiones.sql`
- `20261113240000_cuentas_crear_editar.sql`
- `20261113250000_asientos_manuales.sql`
- `20261113260000_bancos_transferencias.sql`
- `20261113270000_anular_compra_costo.sql`
- `20261113280000_bancos_nueva_cuenta.sql`
- `20261113290000_conciliaciones_bancarias.sql`
- `20261114100000_notas_debito_venta.sql`
- `20261114101000_facturas_recurrentes.sql`
- `20261114200000_notas_credito_compra.sql`
- `20261114201000_ordenes_compra.sql`
- `20261114202000_pagos_recurrentes.sql`
- `20261114300000_activos_fijos.sql`
- `20261114300100_periodos_cierre.sql`
- `20261114500000_inventario.sql`
- `20261114600000_configuracion.sql`
- `20261114600100_configuracion_logos_storage.sql`
- `20261114700000_notas_credito_compra_ncf_proveedor.sql`
- `20261114900000_inventario_existencias_precios.sql`
- `20261114901000_transferencias_inventario.sql`
- `20261115100000_retenciones.sql`
- `20261115100100_pagos_retenciones.sql`
- `20261115100200_reporte_cxc_retenciones.sql`
- `20261115200000_vendedores.sql`
- `20261115201000_centros_costo.sql`
- `20261115202000_monedas.sql`
- `20261115203000_plantillas_impresion.sql`
- `20261115400000_documentos_venta_editar_clonar.sql`
- `20261115500000_funciones_fusionadas_s15.sql`
- `20261115600000_contacto_rapido_identificacion.sql`
- `20261115700000_impuestos_catalogo.sql`
- `20261115701000_motor_impuestos.sql`
- `20261115900000_indices_rendimiento.sql`
- `20261116100000_dashboard_resumen.sql`
- `20261116200000_pagos_multifactura.sql`

**Pendiente técnico:** regenerar `src/lib/supabase/types.ts` con `pnpm db:types` y commitear el resultado. En varias sesiones se actualizó a mano; CI espera que el archivo coincida con la base.

Algunas notas de `HANDOFF.md` dicen «migración no aplicada» porque se escribieron **antes** de integrar. Si hay duda, manda la lista de `supabase/migrations/` y el historial de Supabase, no el texto viejo del handoff.

---

## 9. Pendiente y lo que Waldy dejó para el futuro

### Lo dejó para más adelante (no hacerlo ahora, hasta que lo pida)

- Pasar facturas en dólares a pesos (hoy se pueden configurar monedas y tasas, pero los comprobantes siguen en pesos).
- Revisar con la DGII las tasas de retención y las columnas de los reportes 606 y 607 (en el código hay marcas `VERIFICAR`).
- Variantes de productos.
- Recibir facturas electrónicas (e-CF de entrada; en Alegra es «Recepción de comprobantes»).
- Guardar la unidad del producto (el importador ya la lee, pero no la persiste).
- Botón «Crear nuevo impuesto».
- En el Inicio: «Funciones sugeridas», «Agregar gráfica» y borrar tarjetas.

### Pendiente conocido (se puede hacer cuando toque)

- Pasar las facturas y los pagos **recurrentes** al catálogo de impuestos (siguen con tasas 0/16/18 a mano).
- En el Inicio, en las vistas de 3 y 6 meses: barras del **año anterior**; y restar las **devoluciones** de las ventas (hoy van en su propia tarjeta).
- El lápiz para cambiar la numeración de los recibos de caja / comprobantes de egreso (hoy no hay numeración configurable de recibos).
- Regenerar `src/lib/supabase/types.ts` con `pnpm db:types`.
- Cierre de periodos: se corrigió el valor esperado del test pgTAP (la utilidad del ejercicio es débito − crédito de la cuenta 3202, **sin negarlo**). Si se toca el cierre, volver a comprobar que el signo siga bien.
- Anular una nota de crédito de venta (y revertir bien el efecto).
- Al anular un ajuste de inventario, revertir también el **costo promedio**.
- Almacén, vendedor y centro de costo no tienen ficha propia (se editan en Configuración), así que en las vistas siguen como texto.
- Humo e2e: hace falta definir las variables `E2E_EMAIL` y `E2E_PASSWORD` (y las de Supabase del humo) en secretos de CI, sin ponerlas en el repo.
- Documentar en Notion el avance, si Waldy lo quiere.

### Producción

Pasar `prueba` a `main` y a producción **solo cuando Waldy lo decida**. Producción aún no tiene datos reales; él quería el sistema listo para un lunes, pero las pruebas profundas están en pausa (ver la sección siguiente).

---

## 10. Plan de pruebas intensivas (en pausa)

Waldy pidió un plan de pruebas fuertes y después dijo **«todavía no»**. El plan queda guardado y **solo se arranca cuando él lo diga**. No se crearon datos de esa ronda.

Cuando lo autorice:

- Usar **datos falsos bien marcados**: una empresa de prueba o un prefijo claro, por ejemplo `ZZTEST-`. Nunca mezclarlos con datos reales sin etiqueta.
- Cargar **años de movimientos** (facturas, compras, pagos, notas, asientos) y probar **muchos usuarios a la vez**.
- Comprobar que **todo cuadre**: débitos = créditos, saldos de facturas, CxC/CxP, inventario, impuestos y reportes 606/607.
- Incluir **casos raros**: anular, pagar de más (debe fallar), varias facturas en un pago, retenciones, periodos cerrados, recurrentes, notas de crédito.
- El script para borrar esos datos (`limpiar.sql` o el equivalente) **no se ejecuta sin el OK explícito de Waldy**.

---

## 11. Reglas de seguridad

- **Ninguna clave, token ni secreto en el repo.** Ni en este archivo, ni en `ALEGRA.md`, ni en un brief, ni en un log. Las claves viven solo en variables de entorno (`.env.local` en la PC, variables de Vercel, secretos de GitHub).
- Nunca subas `.env*`, el contenido de `aviso.env`, la clave `service_role`, contraseñas de Alegra, de Supabase o de la DGII.
- La app solo usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. La `service_role` no va en el cliente ni en un script del repo.
- No desactives RLS. No cambies una política solo para que un test pase.
- No edites migraciones ya aplicadas. No borres datos reales ni hagas cambios irreversibles sin pensarlo y, si toca la base o producción, sin el OK de Waldy.
- Nunca `--no-verify`, nunca `HUSKY=0`, nunca force-push, nunca trabajar directo en `main`.
- No pruebes comandos de Supabase (`--linked`, `--db-url`, `db push`) contra el proyecto real desde una tarea, salvo el flujo acordado de aplicar una migración ya revisada.
- No copies código de Alegra al producto. No escribas a clientes ni a terceros desde una tarea.

---

## 12. Índice de `docs/alegra`

Esta carpeta es el estudio de **Alegra Contabilidad**, recorrido en una cuenta de prueba (nunca la cuenta real de Medoxigas). El archivo principal es `ALEGRA.md` (unas 1085 líneas). Las capturas van en `docs/alegra/capturas/`. Hay también `catalogo-cuentas-alegra.xlsx`.

### Qué hay en `ALEGRA.md`

| Sección | Contenido |
| --- | --- |
| 1. Mapa de menús | Ingresos, Compras, Contactos, Inventario, Bancos, Contabilidad, Reportes, Configuración |
| 2. Formulario de factura de venta | Campos y orden de `/invoice/add` |
| 3. Motor contable | Cuentas por defecto, catálogo, numeraciones NCF y asientos (factura a crédito, de contado, pago recibido) |
| 4. Formularios | Contacto, producto y datos de prueba de la cuenta de estudio |
| 5. Impresión (PDF) | Factura, cotización y remisión/conduce |
| 8. Reportes | Contables, administrativos, ventas, financieros, fiscales (DGII) y «Para trabajar» |
| 9. Fichas y enlaces | Cómo se conectan cliente, proveedor, producto y documentos |
| 10. Bancos | Cuentas/cajas, transferencias y conciliación |
| 11. Contabilidad | Catálogo en árbol, asientos manuales, activos fijos y depreciación |
| 13. Notas de crédito y débito | Venta y compra; menú de Ingresos y Compras |
| 14. Numeraciones y tipos de NCF | B01, B02, B14, B15, B16 |
| 17. Cierre, órdenes, recurrentes y recepción de comprobantes | Periodos, orden de compra, pago recurrente, factura recurrente, e-CF de entrada |
| 18. Copia del diseño del formulario de factura | Medidas y capturas guía |
| Inicio (dashboard) | Funciones sugeridas, resumen del negocio, tarjetas y gráfica de ventas |
| Formularios de pago | Pago recibido, pago a proveedor y guía de estilo de formularios |

(La numeración de secciones salta algunos números; no faltan capítulos en el archivo, así se fue armando.)

### Guías de estilo (`css-*`)

- `docs/alegra/css-factura/` — `GUIA-DISENO-FACTURA.md` (formulario de factura), `GUIA-CALENDARIO.md`, `NOTA.md`. Estudio visual; no pegar el HTML/CSS en la app.
- `docs/alegra/css-vista/` — `GUIA-VISTA.md` y `NOTA.md`: vista de factura, cotización y conduce ya guardados (tarjetas, menú, pestañas). Hay capturas de la versión nuestra para comparar.
- `docs/alegra/css-pagos/` — `GUIA-FORMULARIOS.md` y `NOTA.md`: medidas comunes de todos los formularios, más el estudio de pago recibido y pago a proveedor.
- `docs/alegra/ref-vista/` — capturas de referencia (Alegra vs nuestra factura y conduce).
- `docs/alegra/README.md` — reglas del estudio (no secretos, no datos reales de clientes).

### Otros documentos del repo

- `docs/motor-contable.md` — cómo funciona el motor, en corto.
- `docs/contrato-db.md` — tablas y RPC (puede ir un poco atrás; revisa también las migraciones posteriores).
- `docs/plantilla-diseno.md` — plantilla Studio Admin y colores Medoxigas.
- `supabase/AGENTS.md` — reglas del backend y RLS.
- `HANDOFF.md` — diario de integración de cada sesión.

---

## 13. Cómo está la copia local (14 nov 2026)

La carpeta `C:\Users\wardy\proyectos\MEDOXIGAS-CONTABILIDAD` debe estar en la rama `prueba`, al día con GitHub. Ahí tienen que verse este archivo y el `ALEGRA.md` completo (unas 1085 líneas), con capturas, guías `css-*` y el Excel del catálogo.

Si algo no aparece, en esa carpeta corre:

```powershell
git pull --ff-only origin prueba
```

Waldy va a terminar el sistema él mismo, en local, con o sin un agente a su lado. Este archivo existe para que no se pierda el contexto.
