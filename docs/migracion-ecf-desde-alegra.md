# Migración de Alegra a Medoxigas Contabilidad para e-CF DGII

**Estado:** guía operativa futura. No ejecuta cambios ni desactiva Alegra.
**Empresas objetivo:** primero **MEDOXIGAS ALC, SRL** (RNC `130893489`) y después **OXYMAT SRL** (RNC `131488791`), cada una en una migración separada.
**Objetivo:** pasar de Alegra como Proveedor de Servicios de Facturación Electrónica a Medoxigas Contabilidad como **Desarrollo Propio**, sin detener la facturación, sin perder secuencias y sin crear comprobantes duplicados.

> Regla central: la certificación se hace mientras Alegra sigue emitiendo en producción. Solo existe una ventana corta de corte cuando ya todo esté certificado, respaldado y probado. Jamás se opera con dos sistemas emitiendo la misma serie en producción al mismo tiempo.

---

## 1. Verdades tranquilizadoras de la DGII

### 1.1 El certificado digital no es “de Alegra”

El certificado `.p12`/`.pfx` es un **certificado digital para procedimiento tributario** emitido a nombre del representante legal/persona física autorizada de la empresa. Alegra lo usa porque la empresa se lo entregó para operar como proveedor de servicios.

Consecuencias prácticas:

- Si el certificado sigue vigente, está controlado por su titular y conocemos su contraseña, **se puede reutilizar** en Medoxigas Contabilidad.
- No hay que comprar otro certificado solo por cambiar de software.
- Sí hay que comprar o reemitir uno nuevo si venció, fue revocado, se perdió la contraseña, cambió el representante/firmante o la DGII exige actualizarlo.
- Al migrar a Medoxigas, el archivo y la contraseña se custodian cifrados en el servidor conforme a `docs/dominio-ecf-dgii.md`. Nunca se copian al navegador ni se suben en claro a git.

### 1.2 Las secuencias e-NCF no se pierden

Las secuencias/rangos e-NCF están autorizados al **contribuyente/RNC**, no a Alegra como software. Por eso no se vuelve a empezar desde `0000000001` al cambiar de sistema.

En el corte, cada serie continúa así:

```text
siguiente en Medoxigas = último e-NCF realmente emitido en Alegra + 1
```

Ejemplo ilustrativo: si Alegra emitió hasta `E310000000125`, Medoxigas empieza con `E310000000126`.

Precauciones obligatorias:

- “Último emitido” significa el mayor comprobante enviado/aceptado o quemado fiscalmente, no simplemente el último borrador visible.
- Se reconcilia con Alegra, con los estados DGII disponibles y con el rango/vencimiento de la OFV.
- La DGII no actúa como candado central entre dos sistemas productivos: si Alegra y Medoxigas emiten al mismo tiempo la misma serie, pueden chocar. Por eso la continuidad se activa **después** de apagar la emisión en Alegra.
- Si una secuencia quedó rechazada con `secuenciaUtilizada=true`, también cuenta como no reutilizable y hay que incluirla en la reconciliación.
- Si el rango vence o se agota, se solicita uno nuevo en la OFV; eso es independiente de Alegra/Medoxigas.

### 1.3 No hay que apagar Alegra para certificar Medoxigas

Las pruebas de TesteCF y CerteCF no emiten documentos fiscales productivos. Por eso el camino correcto es:

1. Alegra sigue facturando normal.
2. Medoxigas se construye y prueba en TesteCF.
3. Medoxigas completa la certificación oficial en CerteCF.
4. Solo al final se hace una ventana de corte y se cambia producción.

Si el portal de certificación presenta un bloqueo administrativo por la certificación actual como proveedor, se escala con DGII **sin tocar la operación productiva de Alegra**. No se improvisa una baja ni una activación productiva paralela.

---

## 2. Preparación antes de iniciar

### Responsables

| Rol | Persona/sistema | Responsabilidad |
| --- | --- | --- |
| Dueño/aprobador | Waldy | Autoriza ventana de corte, cambios irreversibles y activación producción |
| Representante/firmante | Titular del certificado DGII | Custodia `.p12`, contraseña y postulaciones firmadas |
| Contable | Contador de la empresa | Valida series, rangos, tipos de comprobante y cierre fiscal |
| Implementación técnica | Equipo Medoxigas | Código, endpoints, cifrado, pruebas, monitoreo y respaldo |
| Operación actual | Alegra | Sigue emitiendo hasta el corte |

### Paquete de evidencia que debe existir al final

Crear una carpeta de trabajo fuera del repo, cifrada/respaldada, con una subcarpeta por empresa:

```text
migracion-ecf/
  medoxigas-alc/
    01-postulacion/
    02-certificacion/
    03-respaldo-alegra/
    04-corte/
    05-contingencia-monitoreo/
```

Nunca se commitea al repo porque contiene XML fiscales, RNC, certificados o datos de clientes.

### Prerequisitos verificables

- [ ] RNC activo en DGII.
- [ ] Usuario OFV del contribuyente/representante operativo.
- [ ] Empresa en régimen ordinario/regímenes correctos y sin restricción administrativa conocida.
- [ ] Alta NCF/comprobantes disponible en la OFV.
- [ ] Certificado `.p12`/`.pfx` vigente y contraseña verificada localmente sin exponerla.
- [ ] El campo titular/`SN` del certificado corresponde al representante autorizado.
- [ ] Usuario firmante delegado en DGII si usará certificado propio distinto del representante principal.
- [ ] Dominio público definitivo de Medoxigas para los endpoints receptores.
- [ ] HTTPS válido y endpoints accesibles desde internet.
- [ ] Inventario de series usadas en Alegra: `E31`, `E32`, `E33`, `E34`, `E41`, `E43`, `E44`, `E45`; incluir `E46` y `E47` solo si la empresa las usa.

---

## 3. Etapa 1 — Nueva postulación como Desarrollo Propio

**Objetivo:** abrir el expediente de certificación de Medoxigas Contabilidad sin alterar la producción de Alegra.

### Acciones

1. Entrar a la OFV con el usuario del contribuyente o representante.
2. Ir al área de **Facturación Electrónica / Certificación** según el menú vigente.
3. Iniciar postulación para **Emisor Electrónico con Desarrollo Propio**.
4. Registrar datos del software:
   - nombre: `Medoxigas Contabilidad`;
   - versión/release que se certificará;
   - descripción corta: sistema contable y de facturación propio;
   - responsable técnico y contacto.
5. Descargar la postulación XML generada por DGII.
6. Firmarla con el certificado digital del representante usando el proceso/herramienta indicado por DGII.
7. Subir la postulación firmada.
8. Confirmar que DGII valida:
   - RNC activo;
   - coincidencia representante/certificado;
   - certificado vigente y firma válida;
   - datos del software.
9. Guardar capturas, fecha, número/código de postulación y XML firmado en `01-postulacion/`.

### Candados antes de pasar a Etapa 2

- [ ] Alegra sigue operando exactamente igual; nadie desactivó numeraciones ni usuarios.
- [ ] La postulación quedó aceptada o en proceso visible en el portal.
- [ ] Se identificó cuál es el set de pruebas vigente que manda el portal; no se copian cantidades de blogs ni de implementaciones viejas.
- [ ] Se definió la URL pública final de Medoxigas o al menos la URL de pruebas que se registrará en CerteCF.
- [ ] Waldy aprobó seguir a CerteCF.

### Riesgo típico

Si el portal no permite una segunda postulación porque la empresa ya está certificada mediante proveedor, abrir ticket/consulta DGII y documentar la respuesta. No se da de baja a Alegra para “destrabar” el portal sin aprobación expresa de Waldy y un plan de reversa.

---

## 4. Etapa 2 — Aprobar CerteCF sin tocar producción

**Objetivo:** certificar el software completo antes de emitir un solo e-CF productivo desde Medoxigas.

El orden exacto puede variar según el asistente de DGII. Esta es la secuencia operativa esperada; se sigue lo que mande el portal vigente.

### 4.1 Pruebas internas previas

Antes de consumir intentos oficiales:

- [ ] Pasaron los 9 casos locales del documento de dominio.
- [ ] La firma XMLDSig verifica independientemente.
- [ ] El QR generado abre la URL correcta.
- [ ] El PDF Carta y el ticket 80 mm contienen todos los datos fiscales requeridos.
- [ ] Se probaron timeouts y duplicados contra mocks.
- [ ] TesteCF responde Aceptado o el resultado esperado en las integraciones básicas.

### 4.2 Set de datos DGII

1. Descargar el archivo/set de datos del portal de certificación.
2. Generar los XML usando exactamente los valores, orden, fechas, tipos y RNC indicados.
3. Validar XSD localmente.
4. Firmar y enviar a CerteCF.
5. Registrar cada `trackId`, estado, mensaje y fecha.
6. Si un caso se rechaza, corregir la causa y repetir según instrucciones del portal. No cambiar datos “a ojo”.

Checklist:

- [ ] Todos los casos del set tienen estado final aceptado o el estado que el portal espera.
- [ ] Los `trackId` están archivados con su XML de evidencia.
- [ ] No hay reenvíos ciegos ni duplicados sin reconciliación.
- [ ] Se probaron `E31`, `E32` y las notas/tipos que Medoxigas operará primero.

### 4.3 Aprobaciones comerciales

1. Descargar el set de aprobación/rechazo comercial.
2. Generar XML `ACECF` firmados.
3. Enviar casos de aceptación y rechazo.
4. Confirmar recepción DGII.

Checklist:

- [ ] Las aprobaciones aceptadas tienen `Estado=1`.
- [ ] Los rechazos tienen `Estado=2` y detalle de motivo.
- [ ] Las fechas/montos/RNC coinciden exactamente con el e-CF referenciado.

### 4.4 Simulación integral

La simulación suele combinar emisión, RFCE, acuses, aprobaciones y recepción desde servicios contraparte DGII. Reglas importantes:

- Para cada `E32 < RD$250,000`, primero el resumen `RFCE` debe quedar aceptado antes de continuar la operación de prueba cuando así lo indique el flujo.
- Si una secuencia de prueba se rechaza, no se reutiliza a ciegas; se revisa `secuenciaUtilizada` y las instrucciones del portal.
- Toda representación impresa generada en la simulación se guarda en PDF porque DGII puede pedirla después.

Checklist:

- [ ] XML, RI y TrackId de cada simulación están cruzados en una hoja de control.
- [ ] Las RI muestran QR, código de seguridad y fecha/hora de firma correctas.
- [ ] El QR abre el ambiente de certificación, no producción.
- [ ] Se probó una nota de crédito referenciando un e-CF de simulación.
- [ ] Se probó al menos una indisponibilidad simulada/reintento controlado.

### 4.5 Endpoints propios y comunicación emisor-receptor

Registrar en el portal las URLs de prueba/producción según solicite el paso:

- autenticación/semilla;
- validación de certificado;
- recepción e-CF;
- aprobación comercial.

DGII enviará e-CF de prueba y esperará acuses, o enviará aprobaciones comerciales para comprobar que Medoxigas las recibe.

Checklist:

- [ ] `GET /api/ecf/fe/autenticacion/api/semilla` devuelve XML válido.
- [ ] `POST /api/ecf/fe/autenticacion/api/validacioncertificado` valida firma y devuelve token.
- [ ] `POST /api/ecf/fe/recepcion/api/ecf` responde ARECF firmado.
- [ ] `POST /api/ecf/fe/aprobacioncomercial/api/ecf` procesa aceptación/rechazo.
- [ ] Los endpoints no redirigen al login ni devuelven HTML.
- [ ] Están activos HTTPS, headers correctos, rate limit y logs sin secretos.

### 4.6 Cierre de certificación

- [ ] Representaciones impresas aprobadas por DGII.
- [ ] URLs registradas y confirmadas.
- [ ] Declaración jurada firmada y subida si el portal la exige.
- [ ] DGII habilita producción como emisor electrónico/Desarrollo Propio.
- [ ] Evidencia final guardada en `02-certificacion/`.
- [ ] Alegra nunca dejó de ser el único sistema productivo durante esta etapa.

---

## 5. Etapa 3 — Respaldo completo antes del corte

**Objetivo:** poder reconstruir el expediente fiscal aunque Alegra deje de usarse y calcular exactamente el siguiente número de cada serie.

Hacer esta etapa cerca de la ventana de corte y repetir el delta final justo antes de apagar Alegra.

### 5.1 Qué respaldar de Alegra

Por cada empresa migrar/conservar:

1. **XML firmados de todos los e-CF emitidos**, incluidos aceptados, aceptados condicionales, rechazados y en proceso.
2. Representaciones impresas PDF o evidencias disponibles.
3. `trackId` de cada envío si Alegra lo expone.
4. Estado DGII y mensajes de validación cuando existan.
5. Código de seguridad, fecha de firma y fecha de emisión.
6. Cliente/RNC, tipo de e-CF, e-NCF y monto.
7. XML/estado de `RFCE` de facturas `E32 < RD$250,000`.
8. Aprobaciones comerciales recibidas/enviadas si están disponibles.
9. Última secuencia usada por tipo.
10. Rango autorizado, fecha de vencimiento y límite superior vigente por tipo.
11. Contactos, productos, precios y saldos necesarios para operación comercial (respaldos comerciales, no parte del XML fiscal).

### 5.2 Series mínimas a reconciliar

| Serie | Tipo | Último e-NCF en Alegra | Estado último | Siguiente Medoxigas | Vence/rango |
| --- | --- | --- | --- | --- | --- |
| `E31` | Crédito Fiscal |  |  |  |  |
| `E32` | Consumo |  |  |  |  |
| `E33` | Nota de Débito |  |  |  |  |
| `E34` | Nota de Crédito |  |  |  |  |
| `E41` | Compras |  |  |  |  |
| `E43` | Gastos Menores |  |  |  |  |
| `E44` | Regímenes Especiales |  |  |  |  |
| `E45` | Gubernamental |  |  |  |  |
| `E46` | Exportaciones, si aplica |  |  |  |  |
| `E47` | Pagos al Exterior, si aplica |  |  |  |  |

### 5.3 Cómo obtener el respaldo si Alegra no tiene exportación masiva confirmada

En la revisión operativa se observó que Alegra muestra detalle de factura con estado, código de seguridad, fecha y XML; no debe darse por garantizada una exportación masiva completa de XML/TrackIds sin verificarla en la cuenta real. El runbook usa este orden:

1. **Opción preferida:** exportador/reporte oficial de Alegra o soporte de Alegra que entregue XML firmados y estados en lote.
2. **Opción alternativa:** API oficial de Alegra si el plan/cuenta la habilita y expone los documentos/archivos.
3. **Última opción controlada:** descarga documento por documento desde la interfaz, con una hoja de control de `e-NCF`, `trackId`/estado y hash. Esta vía es lenta y debe planificarse con anticipación.

No se usan scraping frágil ni scripts contra la interfaz como primera opción; si fuera imprescindible, se hace en sesión autorizada, sin guardar credenciales y con revisión humana.

### 5.4 Verificación del respaldo

- [ ] Conteo de XML por tipo/mes igual al conteo de facturas emitidas en Alegra.
- [ ] No hay huecos inexplicados entre primera y última secuencia de cada serie.
- [ ] Todo XML abre, tiene firma y su hash quedó calculado.
- [ ] El archivo de control incluye hash SHA-256 por XML.
- [ ] Se reconciliaron 606/607 o reportes fiscales del periodo contra la lista de comprobantes.
- [ ] Se copió el respaldo a al menos dos ubicaciones independientes/cifradas.
- [ ] Contable firmó la hoja de últimos números por serie.

### 5.5 Candado de conservación

Los XML y evidencias se conservan por **10 años** conforme al marco tributario y al Informe Técnico DGII. Migrar de software no reduce ese plazo. El respaldo de Alegra no se borra después de migrar aunque Medoxigas funcione perfectamente.

---

## 6. Etapa 4 — Ventana de corte sin tiempo muerto

**Objetivo:** terminar un día facturando en Alegra y empezar el siguiente en Medoxigas, sin solape de emisión.

La ventana recomendada es **cierre del día o domingo**, después de cerrar caja/POS y antes de la primera venta del día siguiente. Duración objetivo: corta, pero no se promete un tiempo fijo; depende del volumen y de las validaciones.

### 6.1 Congelamiento operativo previo

Antes de entrar a la ventana:

- [ ] Medoxigas está certificado en CerteCF.
- [ ] Producción DGII está autorizada para el contribuyente.
- [ ] URLs productivas de Medoxigas responden desde internet.
- [ ] El certificado `.p12` ya está cifrado/cargado y probado con firma local, sin imprimir secretos.
- [ ] Variables de entorno y claves de servidor están configuradas en el ambiente correcto.
- [ ] Respaldo completo de Etapa 3 está verificado.
- [ ] Hay plan de reversa escrito y responsables presentes/conectados.
- [ ] Waldy aprobó la fecha/hora exacta.

### 6.2 Cierre de Alegra

1. Cerrar ventas/caja del día.
2. Esperar a que no queden documentos pendientes de sincronizar/enviar en Alegra.
3. Exportar el **delta final** desde el respaldo anterior hasta el cierre.
4. Capturar la tabla definitiva de últimos e-NCF.
5. Confirmar que no hay envíos `En Proceso` sin consultar. Si los hay, esperar o documentar el estado antes de cortar.
6. Desactivar la emisión de nuevos e-CF en Alegra:
   - quitar permisos de facturación electrónica a usuarios operativos, o
   - bloquear/desactivar numeraciones electrónicas, o
   - usar el control que Alegra provea para impedir nuevas emisiones.
7. Mantener acceso de solo lectura/consulta/exportación en Alegra. No cancelar todavía la cuenta.

Punto sin retorno controlado:

- Si no se ha emitido ningún e-CF productivo aceptado desde Medoxigas, la reversa a Alegra es sencilla: reactivar Alegra y corregir la causa.
- Si ya se emitió y aceptó un e-CF en Medoxigas, una reversa exige actualizar manualmente Alegra para continuar después de esa secuencia; por eso la factura controlada solo se emite cuando todos los chequeos previos están verdes.

### 6.3 Cargar continuidad en Medoxigas

Para cada serie electrónica operativa:

1. Calcular `siguiente = último e-NCF Alegra + 1`.
2. Validar que el siguiente esté dentro del rango autorizado y no vencido.
3. Cargar la serie en `numeraciones` o en la tabla final diseñada para e-CF:
   - prefijo `E31`, `E32`, etc.;
   - formato de 10 dígitos;
   - `siguiente` exacto;
   - `hasta` y `vence` del rango DGII;
   - serie activa solo en la modalidad correcta.
4. Bloquear edición manual que reduzca `siguiente`.
5. Registrar en auditoría quién cargó cada serie y con qué evidencia.

Ejemplo:

```text
Último Alegra E31: E310000000125
Siguiente Medoxigas: E310000000126
```

### 6.4 Actualizar Directorio FE en DGII/OFV

Actualizar las URLs productivas de recepción/aprobación/autenticación del contribuyente para que otros emisores puedan enviar e-CF a Medoxigas:

- `/api/ecf/fe/autenticacion/api/semilla`
- `/api/ecf/fe/autenticacion/api/validacioncertificado`
- `/api/ecf/fe/recepcion/api/ecf`
- `/api/ecf/fe/aprobacioncomercial/api/ecf`

Verificar inmediatamente desde el directorio DGII que el RNC apunta a las URLs correctas.

### 6.5 Activar producción en Medoxigas

1. Cambiar configuración de `certecf` a `ecf` / Producción.
2. Ejecutar chequeo de certificado vigente.
3. Ejecutar autenticación semilla contra producción sin emitir documento.
4. Confirmar token recibido.
5. Habilitar emisión solo para un usuario controlado.
6. Emitir **una operación real controlada**, no una factura ficticia:
   - preferiblemente una venta real pequeña o un documento acordado con Contable;
   - nunca inventar una operación comercial falsa en producción.
7. Guardar `trackId` y consultar estado.
8. Verificar:
   - estado DGII `Aceptado` o `Aceptado Condicional` con mensaje entendido;
   - QR abre Consulta Timbre productiva;
   - e-NCF es el siguiente esperado;
   - PDF/ticket contiene todos los datos fiscales;
   - no hay error de RFCE si es `E32 < RD$250,000`.
9. Solo después abrir emisión a caja/operación normal.

### 6.6 Checklist de salida del corte

- [ ] Alegra no puede emitir nuevos e-CF.
- [ ] Medoxigas emitió una factura controlada real y su estado fue validado.
- [ ] QR productivo consulta correctamente en DGII.
- [ ] Secuencias cargadas coinciden con la hoja firmada por Contable.
- [ ] Directorio FE apunta a Medoxigas.
- [ ] Monitoreo de `ecf_envios` activo.
- [ ] Responsables confirman operación de apertura siguiente.
- [ ] Evidencias en `04-corte/`.

### 6.7 Reversa

Si falla la activación antes del primer e-CF aceptado:

1. Apagar switch producción en Medoxigas.
2. Reactivar emisión en Alegra.
3. Documentar causa y correcciones.
4. No cambiar números de secuencia si ninguna fue consumida/aceptada.

Si falla después de un e-CF productivo aceptado en Medoxigas:

1. No emitir más en ninguno de los dos sistemas.
2. Reconciliar secuencias inmediatamente.
3. Decidir con Contable/Waldy si se corrige Medoxigas en caliente o se revierte a Alegra cargando allí `último aceptado + 1`.
4. Documentar el e-CF ya aceptado; no se anula ni ignora por cambiar de sistema.

---

## 7. Etapa 5 — Contingencia, monitoreo y operación continua

### 7.1 Monitoreo de `ecf_envios`

La operación diaria necesita una vista de excepciones, no solo una tabla técnica. Alertas mínimas:

| Condición | Severidad | Acción |
| --- | --- | --- |
| `error_transporte` por más de 15 minutos | Alta | Verificar red/DGII; reconciliar antes de reenviar |
| `en_proceso` por más de 1 hora | Media | Consultar TrackId/estado y revisar DGII |
| `en_proceso` al cierre del día o más de 24 h | Alta | Escalar; la Norma exige resultado final dentro de 24 h |
| `rechazado` | Alta | Leer mensajes y `secuenciaUtilizada`; corregir/reemitir según caso |
| `aceptado_condicional` | Media | Registrar mensaje, corregir causa en próximos comprobantes y hacer seguimiento dentro de 15 días |
| certificado vence en <30 días | Alta | Gestionar renovación antes de que se bloquee la firma |
| secuencia llega a 90% del rango o vence en <30 días | Media | Solicitar nuevo rango en OFV |
| diferencia entre documentos internos y envíos DGII | Alta | Detener emisión del tipo afectado hasta reconciliar |

Consultas operativas diarias:

- cantidad por tipo y estado;
- último e-NCF emitido por serie;
- documentos internos sin fila en `ecf_envios`;
- envíos sin estado final;
- huecos de secuencia no explicados por anulación/rechazo documentado;
- tiempo promedio entre firma, envío y aceptación.

### 7.2 Conservación por 10 años

- Conservar XML firmados, representaciones/evidencias y respuestas DGII al menos 10 años.
- Hacer backup automático fuera del servidor principal.
- Probar restauración; un backup no probado no es evidencia operativa.
- Mantener exportación anual/mensual en formato legible para auditoría.
- No depender de que Alegra conserve el expediente histórico: la responsabilidad final es del contribuyente.

### 7.3 Contingencia DGII o conectividad

La habilitación general de contingencia viene de la Ley 32-23; el procedimiento operativo vigente descrito aquí sigue el Decreto 587-24, el Informe Técnico y el Instructivo de Contingencia DGII.


#### A. Medoxigas puede generar/firmar pero no puede enviar

1. Generar y firmar el e-CF normalmente.
2. Guardarlo en cola `contingencia_pendiente_envio`.
3. Entregar RI con la leyenda de contingencia correspondiente.
4. Reenviar dentro de un plazo no mayor de **72 horas** al restablecerse la conexión.
5. No editar el XML firmado.

#### B. Medoxigas no puede generar/firmar e-CF

1. Notificar entrada en contingencia en OFV (`Facturación Electrónica > Contingencia FE`).
2. Verificar que la empresa tenga **NCF Serie B no electrónicos** autorizados y vigentes (`B01`, `B02`, `B03`, `B04` u otro equivalente según el tipo) para usar solo durante la contingencia.
3. Emitir comprobantes no electrónicos solo durante la contingencia y por no más de **15 días calendario**.
4. Al restablecerse, notificar salida de contingencia.
5. Emitir los e-CF de reemplazo referenciando el NCF modificado con `CodigoModificacion=4`.
6. Enviar esos e-CF solo a DGII; no entregarlos al receptor como si fueran otra venta.
7. Registrar equivalencias en una hoja de control.

#### C. DGII fuera de servicio

- Seguir los comunicados/ventanas de mantenimiento DGII.
- Mantener documentos firmados en cola.
- No reenviar en tormenta; usar backoff y monitoreo.
- Si DGII publica instrucciones especiales, esas instrucciones prevalecen.

### 7.4 Operación normal después de migrar

- Alegra queda como archivo/consulta histórica durante el tiempo que Waldy decida.
- No reactivar emisión Alegra salvo contingencia contractual decidida por Waldy y con secuencias reconciliadas.
- Conciliación diaria el primer mes; luego semanal o según volumen.
- Revisión mensual de vencimiento de certificado y secuencias.
- Prueba trimestral de restauración de XML/backup.
- Antes de actualizar el módulo e-CF, correr TesteCF con la versión nueva cuando el cambio toque XML, firma, QR o estados.

---

## 8. Migración posterior de OXYMAT

OXYMAT no se migra “por arrastre”. Se repite el proceso completo porque cambian:

- RNC emisor;
- representante/titular y certificado;
- rangos/secuencias e-NCF;
- URLs/registros del contribuyente en Directorio FE si hay separación operativa;
- responsables y ventana de corte.

Usar el checklist de MEDOXIGAS como plantilla, pero con una carpeta `oxymat/`, hoja de secuencias nueva y pruebas propias. No copiar números ni certificados de una empresa a otra.

---

## 9. Matriz de responsabilidad en el corte

| Actividad | Waldy | Contable | Técnico | Alegra/DGII |
| --- | --- | --- | --- | --- |
| Aprobar iniciar certificación | Decide | Consulta | Ejecuta | DGII valida |
| Custodiar certificado | Aprueba acceso | Verifica titular | Implementa cifrado | DGII no lo almacena |
| Completar CerteCF | Aprueba hitos | Valida datos fiscales | Ejecuta pruebas | DGII evalúa |
| Exportar respaldo Alegra | Autoriza | Reconcilia | Ejecuta/verifica | Alegra provee acceso/exportación |
| Definir último +1 | Aprueba | Firma hoja de control | Carga series | DGII mantiene rango autorizado |
| Desactivar emisión Alegra | Decide momento | Confirma cierre | Ejecuta control | Alegra deja de emitir |
| Actualizar Directorio FE | Autoriza | Acompaña | Ejecuta | DGII publica |
| Emitir factura controlada | Decide | Valida fiscalmente | Monitorea | DGII acepta/rechaza |
| Activar contingencia | Decide | Valida NCF/manual | Ejecuta cola/reemplazos | DGII recibe notificación |

---

## 10. Errores que no se deben cometer

- Empezar Medoxigas en producción desde `E310000000001` “porque es un sistema nuevo”.
- Emitir el mismo tipo desde Alegra y Medoxigas en paralelo para “probar”.
- Cambiar a producción antes de aprobar CerteCF.
- Tratar un `TrackId` como si fuera aceptación fiscal.
- Reenviar tras un timeout sin consultar si DGII recibió el XML.
- Editar el XML después de firmado para arreglar formato.
- Copiar el `.p12` o contraseña a una computadora de caja o al navegador.
- Borrar el respaldo de Alegra después de migrar.
- Usar `ANECF` para esconder una factura aceptada; las correcciones van por nota de crédito/débito.
- Emitir facturas ficticias en producción solo para probar; la prueba controlada debe ser una operación real acordada.
- Usar series B de contingencia sin notificar/validar la contingencia en la OFV.

---

## 11. Resumen ejecutivo del camino seguro

```text
1. Alegra sigue facturando.
2. Medoxigas se certifica en CerteCF.
3. Se respalda todo Alegra y se firma la hoja de últimas secuencias.
4. En una ventana corta:
   Alegra deja de emitir → Medoxigas carga último+1 → DGII apunta URLs →
   Medoxigas emite una operación real controlada → se valida QR/DGII.
5. Se abre operación normal con monitoreo, colas y respaldo 10 años.
```

La migración es segura si se trata como un **corte de custodia fiscal**, no como una simple instalación de software.
