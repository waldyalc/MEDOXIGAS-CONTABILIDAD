# Dejar la base de datos en estado virgen

Guía para ejecutar [`reset-base-virgen.sql`](./reset-base-virgen.sql) a mano en el SQL Editor de
Supabase. Deja el proyecto **MEDOXIGAS-CONTABILIDAD** (`ljfdhrnvlsfaweuvnqxz`) sin un solo documento
ni dato de prueba, conservando esquema, usuarios, empresa, catálogo de cuentas, configuración
contable y semillas del sistema.

- **Tiempo:** menos de un minuto de SQL, más el respaldo y el Storage.
- **Se puede deshacer:** solo restaurando un respaldo. El script no tiene vuelta atrás.
- **Se ejecuta una vez.** No es una tarea programada ni algo que se corra en cada PR.

> Esto **no** borra solo lo `ZZTEST-*`/`E2E-*`: vacía **todas** las tablas de documentos, contactos,
> productos, inventario, bancos, contabilidad y auditoría. Si en esa base hubiera documentos
> reales, también se van. Por eso el paso 0 es un respaldo. Ojo también con las categorías de
> productos, los centros de costo y los vendedores: son catálogos de usuario y el reset los deja
> vacíos (si tenías alguno real, anótalo para volver a crearlo).

---

## 0. Antes de tocar nada

1. **Respaldo reciente.** Supabase → **Database → Backups**. En el plan gratis hay respaldos
   diarios con retención corta (7 días) y **no** hay point-in-time recovery. Si el respaldo más
   nuevo es de hace horas y te sirve, adelante. Si no, exporta antes con `pg_dump` desde tu máquina
   (necesitas la cadena de conexión del proyecto, no la pongas en el repo):

   ```bash
   pg_dump "postgresql://postgres.<ref>:<password>@aws-0-ca-central-1.pooler.supabase.com:5432/postgres" \
     -Fc -f respaldo-medoxigas-$(date +%Y%m%d).dump
   ```

2. **Nadie escribiendo.** Cierra la app en el navegador (`medoxigas-contabilidad.vercel.app`),
   cualquier `pnpm dev` local (`.env.local` apunta a la misma base), los scripts de
   `tests/carga/` y cualquier E2E en curso. El paso 1 apaga los E2E de GitHub Actions.

3. **Ventana tranquila.** El `TRUNCATE` pide bloqueo exclusivo de las tablas: si hay una sesión con
   una transacción abierta, el script espera. Sin usuarios conectados tarda segundos.

---

## 1. Apagar los E2E que escriben en esta base

Los specs de Playwright (`tests/e2e/flujo-*.spec.ts`) **crean datos reales**: contactos y productos
`E2E-*`, facturas, asientos, bancos… y no los borran. El job `e2e` de
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) solo corre si existen los cuatro
secrets `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_SUPABASE_URL` y `E2E_SUPABASE_ANON_KEY`; ese último par
apunta a este mismo proyecto, así que **cada PR volvería a llenar la base de `E2E-*`**.

1. GitHub → repo `waldyalc/MEDOXIGAS-CONTABILIDAD` → **Settings → Secrets and variables → Actions**.
2. Borra **`E2E_EMAIL`** y **`E2E_PASSWORD`** (con esos dos fuera, el primer step del job calcula
   `enabled=false` y el resto se salta: el job termina en verde, sin escribir nada).
3. Recomendado: borra también **`E2E_SUPABASE_URL`** y **`E2E_SUPABASE_ANON_KEY`**. Sin credenciales
   no sirven de nada y así nadie los vuelve a apuntar a producción por descuido.
4. Verifícalo en el próximo PR: Actions → job **e2e** → el step «Comprobar secrets de staging»
   corre y los demás aparecen como *skipped*.

> Si algún día quieres volver a correr la suite completa, créale un **proyecto Supabase aparte**
> para staging y apunta ahí esos secrets. Mientras apunten a este proyecto, cada corrida vuelve a
> ensuciar la base y hay que repetir este reset.

---

## 2. Ejecutar el SQL

1. Abre el SQL Editor del proyecto:
   <https://supabase.com/dashboard/project/ljfdhrnvlsfaweuvnqxz/sql/new>
2. Copia **todo** el contenido de [`reset-base-virgen.sql`](./reset-base-virgen.sql) y pégalo.
3. Pulsa **Run** (o `Ctrl/Cmd + Enter`). No uses «Run selection».
4. Debe responder `Success. No rows returned`: todo el reset va dentro de `BEGIN … COMMIT` y los
   bloques `DO` no devuelven filas.
5. Si sale un error, **no cambió nada**: la transacción se revierte completa. Los mensajes están en
   español y dicen qué tabla falló. Lo normal es `public.<tabla> quedó con N filas` porque alguien
   escribió mientras corría; cierra la app y vuelve a ejecutarlo.
6. Con el reset confirmado, corre el bloque **6) VERIFICACIÓN DE SOLO LECTURA** (está al final del
   archivo, después del `COMMIT`) seleccionándolo y pulsando Run. Revisa:
   - **6.1** → todas las filas con `filas = 0` y `en_cero = true`.
   - **6.2** → `empresa` 1, `almacenes` 1, `listas_precios` 1, `numeraciones` 8,
     `tipos_entrada_diario` 13; `impuestos` 7, `retenciones` 5, `monedas` 3, `terminos_pago` 5,
     `plantillas_impresion` 3; `perfiles` con tus usuarios.
   - **6.3** → las 8 series y los 13 tipos con `siguiente = 1`.
   - **6.4** → `proximo_valor = 1` en todas las secuencias.
   - **6.5** → tamaño por tabla (las vaciadas quedan en unos pocos kB) y tamaño total de la base.

Qué hace el script, en orden: valida que sea esta base; vacía las 51 tablas de documentos y datos
en un solo `TRUNCATE … RESTART IDENTITY CASCADE`; reinicia todas las secuencias `public.*` en 1;
borra solo cuentas/impuestos/retenciones/monedas/términos de prueba (con `NOT EXISTS`, nunca toca
el catálogo base); deja un solo almacén y una sola lista de precios; deja las 8 series fiscales y
los 13 tipos de entrada en 1; repone cualquier semilla que falte; y antes del `COMMIT` comprueba
una por una las 51 tablas vaciadas, las semillas y las secuencias. Si algo no cuadra, revierte.

Las tablas que **nunca** toca: `auth.users`, `perfiles`, `empresa`, `cuentas`, `config_contable`,
`impuestos`, `retenciones`, `monedas`, `terminos_pago`, `plantillas_impresion`, `almacenes`,
`listas_precios`, `numeraciones` y `tipos_entrada_diario`. El detalle de las 64 tablas está en el
inventario del propio `.sql` y lo vigila el candado `src/lib/supabase/reset-virgen.test.ts`.

---

## 3. Vaciar los archivos de prueba (Storage)

El SQL no toca Storage: los metadatos de adjuntos se borran, pero los archivos siguen en los
buckets privados.

1. **Bucket `documentos`:** Supabase → **Storage → documentos** → selecciona todo → **Delete**.
   Todos los adjuntos eran de documentos que ya no existen; se pueden borrar sin miedo.
2. **Bucket `productos`:** antes de vaciarlo, mira la consulta **6.6** del script
   (`select … logo_url from public.empresa`). Si `logo_url` apunta a un objeto de ese bucket
   (el logo de la empresa vive ahí), **conserva ese archivo** y borra el resto. Las imágenes de
   productos son huérfanas: esos productos ya no existen.
3. Vuelve a correr la consulta **6.7** (`select bucket_id, count(*) from storage.objects …`).
   Debe quedar vacía o solo con el logo que decidiste conservar.

> Vaciar Storage no cambia `pg_database_size` (los archivos no viven en la base), pero sí libera
> la cuota de almacenamiento del proyecto.

---

## 4. Verificar en la app

Abre <https://medoxigas-contabilidad.vercel.app>, entra con tu usuario **admin** y revisa:

- **Inicio:** todo en 0 (ventas, compras, cobros, pagos, gráficas vacías).
- **Ingresos → Facturas / Cotizaciones / Conduces:** listas vacías, sin `E2E-*`.
- **Compras / Pagos / Gastos:** listas vacías.
- **Contactos y Productos:** listas vacías; el catálogo no se ve afectado.
- **Inventario:** almacén «Principal» y lista «General»; existencias en 0.
- **Bancos:** las cuentas del catálogo siguen ahí, sin movimientos ni conciliaciones.
- **Contabilidad → Numeraciones:** exactamente las series **B01, B02, B03, B04, B13, B14, B15,
  B16** y «próximo número» en **1**. **Tipos de entrada de diario:** los 13, con consecutivo 1.
- **Configuración → Empresa:** nombre, RNC, dirección y logo intactos.
- **Reportes:** todos en 0 (libro diario, balance, 606/607, CxC/CxP…).

Si aparece cualquier `ZZTEST-*` o `E2E-*`, se creó **después** del reset: algo quedó escribiendo
(app abierta, un `pnpm dev`, el job e2e con secrets). Ciérralo y repite el paso 2.

---

## 5. Si algo sale mal

- **El SQL falló:** no hay nada que hacer, se revirtió solo. Lee el mensaje y vuelve a correrlo.
- **Se confirmó y no era lo que querías:** restaura el respaldo del paso 0 desde
  **Database → Backups → Restore**. Restaura la base completa a ese punto; lo que se haya creado
  después se pierde. Sin respaldo no hay vuelta atrás.
- **El esquema sigue intacto**, así que la app no se rompe por el reset. Si algo se ve raro, casi
  siempre es caché del navegador o el usuario sin rol en `perfiles` (eso no lo toca el script).

---

## 6. Preguntas rápidas

- **¿Por qué `TRUNCATE` y no `DELETE`?** Es instantáneo, no dispara triggers `FOR EACH ROW`
  (auditoría, asiento cuadrado, periodo cerrado) y reinicia las identidades. `DELETE` fila por
  fila sobre cientos de miles de líneas tardaría minutos y podría chocar con `statement_timeout`.
- **¿Por qué no hay que correr `VACUUM FULL`?** `TRUNCATE` estrena archivo vacío: el disco de esas
  tablas se libera en el mismo `COMMIT`. `VACUUM FULL` solo compacta tablas que **no** se vaciaron
  (`perfiles`, `cuentas`, catálogos) y no es necesario; si lo quieres, va fuera de la transacción y
  bloquea la tabla mientras corre.
- **¿Se pierden los usuarios?** No. `auth.users` y `perfiles` no se tocan.
- **¿Se pierde la empresa y el logo?** La fila de `empresa` queda igual. El archivo del logo vive
  en el bucket `productos`; por eso el paso 3 dice cuál conservar.
- **¿Y las migraciones?** No se tocan. El esquema queda exactamente como está; no hay que volver a
  aplicar nada ni regenerar tipos.
- **¿Puedo correrlo otra vez?** Sí, es idempotente: volvería a dejar todo en 0 y las semillas en 1.
- **¿El candado de Vitest qué hace?** `src/lib/supabase/reset-virgen.test.ts` lee todas las
  migraciones y falla si una tabla `public.*` no está clasificada (vaciada o conservada), si el
  script no está entre `BEGIN`/`COMMIT`, o si intenta `TRUNCATE`/`DELETE` sobre `perfiles` o
  `auth.users`. Cuando una migración nueva cree una tabla, ese test obliga a decidir qué hacer con
  ella antes de mergear.
