# Notas crudas — Alegra Nómina (nomina.alegra.com) — sesión 2026-11-20
Archivo de trabajo; el doc final es ALEGRA-NOMINA.md.

## Cuenta
- Empresa demo "Fiel Ferreteria", usuario David Hernendez, trial 7 días. País: RD.
- Sidebar: Inicio /home, Bandeja de entrada /inbox, Empleados /employees, Nómina (Cálculo de nómina /liquidation, Gestión de envíos /liquidation/payment-stubs), Pagos /payments, Suscripciones (→mi.alegra.com), Configuración /configuration.
- Historial ya mostraba "Calculaste la nómina de diciembre" → /do/liquidation (ejemplo presembrado).

## Onboarding (Inicio)
- Checklist 4 pasos: 1 crear cuenta (hecho), 2 datos empresa (RNC), 3 registrar/importar empleados, 4 calcular primera nómina.
- Modal "Información de tu empresa": logo 259x111px máx 2MB (Editar/Eliminar), radio Sociedad comercial/Persona física, Nombre o razón social*, RNC* (botón ⚡ consulta DGII), Categoría* (Micro Empresa/Empresa pequeña/Empresa mediana/Empresa grande), Municipio* (lista municipios RD, con búsqueda), Dirección*, Teléfono (+1…), Correo*, Método de pago* (Efectivo/Transferencia bancaria/Cheque/Transferencia internacional/Deposito) → si Transferencia muestra Número de cuenta*, Banco* (18 bancos RD: Asociación Popular, Banesco, Popular, Unión, Asociación Cibao, BHD León, Caribe, Banreservas, López de Haro, Promerica, Santa Cruz, BDI, Scotiabank, Citibank, Asociación Mocana, Asociación Bonao, Empire, Vimenca), Tipo de cuenta* (Ahorros/Corriente); Frecuencia de pago* (Quincenal/Mensual).
- OJO: el modal solo persistió parcialmente (RNC/categoría/municipio/dirección/método quedaron "Sin especificar"); hubo que re-entrar por Configuración → Datos básicos de empresa. Al guardar, redirige a /liquidation.

## Configuración (/configuration)
3 grupos: Empresa (Datos básicos /configuration/company/edit, Configuración contable /configuration/accounting, Usuarios →mi.alegra.com/users), Conceptos (Ingresos /configuration/incomes, Deducciones /configuration/deductions), Numeraciones (/configuration/numerations).

### Datos básicos de empresa (3 tarjetas con Editar inline)
- Identificación: Persona natural/jurídica (toggle), logo, RNC* (+botón consulta), Razón social*, Riesgo laboral* (Riesgo Tipo I–IV = SRL), Tipo de categoría* (micro/small/medium/large). Guardado: RNC 131052436, Riesgo Tipo I, Empresa pequeña.
- Contacto: Correo*, Municipio*, Teléfono, Dirección. Guardado Santo Domingo de Guzmán + dirección ficticia.
- Pago: Método* → condicionales Número de cuenta*, Banco*, Tipo de cuenta*; Frecuencia* Quincenal/Mensual. Guardado: transferencia, Banco Popular, corriente.

### Configuración contable (/configuration/accounting) — CLAVE para integración contable
Subtítulo: "cuentas contables para registrar los egresos de nómina en tu contabilidad".
- Tabs de segmento: Administrativa / Operativa / Ventas.
- "Numeración actual: Nómina" + Editar.
- Ingresos (concepto → cuenta): Salario→Sueldos y salarios; Preaviso→Otros gastos generales; Regalía pascual→Salario de navidad; Ayuda al empleado, Devolución ISR, Inasistencia, Préstamos gravado/no gravado, Viáticos, Asistencia económica, Prima Nocturna, Otros Ingresos al Empleado, Cesantías→Otros gastos generales; Comisión→Comisiones; Diferencial Vacaciones Ley→Vacaciones; Horas Extra 35%/100%→Horas extras; Bonificación→Bonificaciones.
- Deducciones: SFS→Retenciones a empleado SFS; AFP(Administradoras de Fondos de Pensiones)→Retenciones empleado AFP; ISR→Retención de ISR retenido empleados; INFOTEP→Acumulaciones INFOTEP; Aporte ordinario voluntario→Otras obligaciones laborales; resto (Licencia médica, Incapacidad riesgo laboral, Licencias no remuneradas, Retención Pensión Alimenticia, Aporte de Dependientes, Deducciones admitidas por el CT, Préstamos, Otros descuentos)→Otro tipo de retención por pagar.
- Seguridad social (Gasto + Pasivo): SFS→Aportes seguro familiar de salud (SFS)/Retenciones a empleado SFS; AFP→Aportes aseguradora fondo de pensiones/Retenciones empleado AFP; SRL→Seguro de riesgo laboral (SRL)/Acumulaciones SRL; INFOTEP→INFOTEP/Acumulaciones INFOTEP.
- Provisiones: toggle "registrar provisiones de empleados". Pagos de empleados→Salarios por pagar.

## Config: Ingresos/Deducciones/Numeraciones
- /configuration/incomes: 18 conceptos predefinidos (Salario, Comisión, Diferencial Vacaciones Ley, Prima Nocturna, Horas Extra 35%/100%, Otros Ingresos, Bonificación, Cesantías, Preaviso…) + botón "Nuevo ingreso".
- /configuration/deductions: 15 predefinidas (SFS, AFP, ISR, Aporte de Dependientes, INFOTEP, Deducciones CT, Préstamos, Licencia no Remunerada, Otros descuentos, Licencia médica…) + "Nueva deducción".
- /configuration/numerations: 1 numeración "Nómina", prefijo N, próximo 1, Preferida=Sí, Activa.

## Empleados (/employees)
- Lista: cols Nombre/Cargo/Identificación/Salario/Estado; tabs Activos/Suspendidos; "Plan Demo 0/ilimitado"; Filtrar; Exportar empleados; Nuevo empleado → 3 opciones: Agregar manualmente / Importar desde Excel / Agregar desde contrato.
- Importar: tabs "Importar archivo" (plantilla xlsx; máx 100 empleados/archivo; .xlsx/.xls/.csv máx 500MB) y "Editor en línea" (grid editable). Plantilla descargada: /tmp/alegra-dl/Plantilla_importacion_de_empleado_lq.xlsx. Columnas: Primer Nombre*, Segundo Nombre, Primer Apellido*, Segundo Apellido, Tipo identificación* (Cédula/Pasaporte/Residencia Temporal/RNC), Número*, Sexo (si Pasaporte), Fecha nacimiento (si Pasaporte), Clave Nómina* (TSS), Municipio*, Dirección*, Teléfono*, Correo*, Tipo contrato* (Tiempo Definido/Indefinido), Fecha inicio*, Fecha fin (si no indefinido), Jornada*, Salario*, Frecuencia* (Quincenal/Mensual), Cargo*, Área, Método pago* (Efectivo/Transferencia bancaria/Cheque/Transferencia internacional/Depósito), Banco*/Tipo cuenta*/Número cuenta* (solo si transferencia).
- Form manual /employees/new = wizard 3 pasos:
  1. Datos principales: Tipo ID* (Cédula/Pasaporte/Residencia Temporal), Número*, Primer nombre*, Segundo nombre, Primer apellido*, Segundo apellido, Municipio* (lista RD), Dirección*, Teléfono* (+1 con selector país), Correo*.
  2. Contrato "Condiciones contractuales": Tipo de contrato* (Tiempo Definido→muestra Fecha fin*/Indefinido), Fecha de contratación* (datepicker dd/mm/yyyy), Frecuencia de pago* (Quincenal/Mensual), Valor salario* (RD$ mask), Jornada* (Diurna/Nocturna/Mixto), TSS Clave nómina* (3 dígitos, ej. "001"), Cargo* (texto libre), Área* (Administrativa/Operativa/Ventas = mismos segmentos contables).
  3. Forma de pago: Método* → si Transferencia bancaria: Número de cuenta del empleado*, Banco* (18), Tipo de cuenta* (Ahorros/Corriente). Botones "Guardar" y "Guardar y crear nuevo".
- Ficha /employees/detail/<id>: avatar+nombre+estado, botón "Nueva novedad", tarjetas Inicio de labores/Tiempo laborado(días)/Cargo/Salario. Tabs: Información general (secciones Datos principales, Datos salariales —salario base+método pago—, Condiciones contractuales; cada una con Editar), Novedades recurrentes (totales + "Agregar ingreso"/"Agregar deducción" → panel lateral con concepto, monto, periodo de inicio obligatorio), Historial (sub-tabs Nómina/Novedades).
- Creados: María José Fernández López (Contadora, RD$35,000, Quincenal, Transferencia Popular, Indefinido, Administrativa, cédula 40212345677); Juan Carlos Pérez Díaz (Vendedor, RD$25,000, Mensual, Efectivo, Tiempo Definido 01/03/2025→01/03/2026, Ventas); Ana Lucía Gómez Santos (Gerente de ventas, RD$60,000, Quincenal, Cheque, Diurna, Administrativa).
- Nota: en la ficha "Frecuencia de pago" aparece vacía aunque se eligió (posible bug de display).

## Nómina (/liquidation)
- Lista: "Calcular nómina" + buscador, Filtrar, selector de año (2026). Botón "Nuevo periodo de nómina"/"Crear nuevo periodo" → modal con "Periodo*" = typeahead: escribir el mes ("Nov") lista sus quincenas ("1 Nov - 15 Nov", "16 Nov - 30 Nov") + campo año 2026. Nota: "podrás editar los datos de los empleados que incluirás".
- Periodo creado → /liquidation/period/from/2026-11-16/to/2026-11-30. Solo incluye empleados QUINCENALES (María+Ana; Juan mensual excluido). Header: Contabilizar / Calcular nómina / Añadir empleados; barras Cálculos % y Contabilización %; resumen Empleados, Ingresos adicionales, Deducciones, Total a pagar; tabla con Cargo/Departamento/Salario/Método por fila + estado "Por calcular".
- Estimación previa: deducciones = 5.91% del salario quincenal (SFS 3.04% + AFP 2.87%; sin ISR bajo el umbral). Ana 30,000→ded 1,773→28,227; María 17,500→1,034.25→16,465.75.
- Recibo de pago (clic en fila → /liquidation/payroll/<id>): encabezado empresa (Fiel Ferreteria, NIT 131052436, municipio, correo), empleado (CC, dirección, correo), Fechas inicio/fin cálculo, Medio de pago, "Días calculados 11.915" (días prorrateados del periodo; leyenda "se liquidan únicamente los días trabajados"), Resumen de pago (Salario/Ingresos adicionales/Deducciones/Total), tablas Ingresos (Concepto/Cantidad/Valor) y Deducciones (Concepto/Porcentaje/Valor).
- Editar → filas editables + "Agregar ingreso"/"Agregar deducción". Conceptos ingreso = los 18 de config; deducción = los 15. VALIDACIÓN clave: el campo Valor hay que escribirlo con decimales ("1500.00") o queda error "El valor de debe ser mayor a 0" y bloquea Guardar.
- Horas Extra al 35% AUTOCALCULA valor: 5h × (60,000/23.83/8 ×1.35) = RD$2,124.42 (fórmula RD: salario mensual/23.83/8).
- Deducciones SFS/AFP se calcularon sobre 30,000 base (no incluyó las horas extra en la base TSS visible).
- "Guardar y liquidar" → modal "Estas por liquidar la nómina de 1 empleado, periodo … Total a pagar / Total del costo" (el primer modal mostró cifras sin novedades RD$28,227/43,681.59; tras guardar cambió a 28,851.42/45,806.01 — el "Total del costo" incluye cargas patronales+provisiones). Confirmar "Calcular nómina (1)" → toast "Los datos se guardaron y liquidaron con éxito", estado CALCULADA.
- "Contabilizar nómina" → modal "Contabilidad inteligente": contabiliza nómina de 1 empleado; "Cuentas contables: 1 Disponible"; incluye devengados+deducciones+provisiones; "Se creará un comprobante de nómina por cada empleado"; "Todas las cuentas contables de nómina se verán reflejados en Alegra Contabilidad"; opción "No mostrar este mensaje nuevamente". Tras Contabilizar (1): banner "1 comprobantes se están procesando en segundo plano. Puedes verlos en el detalle de cada nómina o desde Alegra Contabilidad."
- PENDIENTE: liquidar a María (periodo completo), estado del periodo, Pagos/TXT, Gestión de envíos, Bandeja, Inicio post-nómina, Suscripciones, verificar comprobante en app.alegra.com.

## Inicio (/home)
- Saludo + checklist; tarjeta "Periodo a calcular / No. empleados / Total pago / Total costo" + botón Calcular nómina; gráfica "Costo de nómina vs Pago de nómina"; Indicadores 2026: Salario mínimo RD$23,223.00, AFP RD$464,460.00, SFS RD$232,230.00, SRL RD$92,892.40 (topes anuales); Contrataciones por mes; Historial.

## Envío de colillas / Gestión de envíos
- Botón "Enviar recibos" en el periodo → modal "Colilla de pago": lista 2/2 empleados con correo + estado Pendiente, "Seleccionar todo", "Enviar colilla de pago" → confirmación "¿Quieres confirmar el envío? Se enviarán los recibos de pago de 2 empleados. Esta acción no se puede deshacer" → "Enviar recibos (2)". Envía el volante por email al correo de cada empleado.
- /liquidation/payment-stubs ("Gestión de envío"): tabla Periodo | Fecha de envío | Empleados | Progreso | Estado → 16-30 nov 2026 | 20 nov 2026 | 2 | 2/2 | Enviado.

## Pagos (/payments)
- "Registro de pagos — Realiza el registro contable de los pagos de nómina". Tabla por periodo: Periodo | Salario | Ingresos adicionales | Deducciones | Total a pagar | Total costo → 16-30 Nov: 47,500 | 2,124.42 | 4,307.25 | 45,317.17 | **70,368.97** (costo empresa = neto + cargas patronales + provisiones).
- Ícono ojo → /payments/period/from/.../type/payroll/frequency/4: "Pagar todo" + filas por empleado (Nombre/ID/Salario/Ingresos/Deducciones/Total a pagar/Estado "Por pagar").
- Pago individual (ícono de fila) → modal "Pagar nómina": Fecha de pago (datepicker) + Cuenta bancaria* = searchable con las cuentas de Alegra Contabilidad: Efectivo POS-Terminal 1, Banco Popular Prueba, Tarjeta de crédito empresarial, Banco 1, Caja general, Caja chica → "Pagar" → estado "Pagado".
- REGLA: el botón de pago por fila y "Pagar todo" están DESHABILITADOS mientras la nómina del empleado no esté "Contabilizada" (María quedó en "Calculada" cuando el proceso quedó 50% "En proceso"; tras re-ejecutar Contabilizar(1) → "Contabilizada" → botón habilitado). "Pagar todo" también deshabilitado cuando ya no quedan 2+ por pagar.
- El pago NO genera otra entrada de diario visible (solo los comprobantes NO); registra movimiento en Bancos de Alegra Contabilidad (el usuario limitado no puede ver /banks: "Tu usuario tiene un perfil limitado").
- No se encontró generación de archivo TXT de dispersión bancaria en la UI (solo registro contable del pago).

## Estado final del periodo 16-30 nov 2026
- Cálculos: Completado; Contabilización: procesó tras 2ª ejecución; Ana+María "Contabilizada"; colillas enviadas 2/2; ambos "Pagado".

## Alegra Contabilidad (app.alegra.com) — verificación
- Contabilidad → Entrada de diario (/ledger/documents): aparecen NO-1 (RD$37,011.42) y NO-2 (RD$20,350.75), fecha 30/11/2026, estado Abierto, tipo "Nómina (NO)", numeración "Nómina", observaciones "Ref-2026", un comprobante por empleado.
- NO-1 (Ana, /ledger/documents/view/id/4): campo Empleado + tabla Código/Cuenta contable/Contacto/Descripción/Débito/Crédito:
  DÉBITOS: INFOTEP 300 (1%), SRL 330 (1.1% riesgo tipo I), Aportes AFP empleador 2,130 (7.10%), Aportes SFS empleador 2,127 (7.09%), Horas extras 2,124.42, Sueldos y salarios 30,000 = 37,011.42.
  CRÉDITOS: Retenciones SFS 912 (3.04%), Retenciones AFP 861 (2.87%), Otra retención por pagar–Préstamos 1,500, Retenciones SFS (aporte empleador→por pagar) 2,127, Retenciones AFP 2,130, Acumulaciones SRL 330, Acumulaciones INFOTEP 300, Salarios por pagar 28,851.42 = 37,011.42.
- Contactos por línea: Tesorería de la Seguridad Social, INFOTEP, el empleado. Parte inferior: "Asiento contable / Mostrar detalles".
- => Sí se ve en contabilidad general: los comprobantes NO aparecen en Entrada de diario y alimentan Libro diario/estados; cada línea va a su cuenta según el mapeo de /configuration/accounting.

## Bandeja / Suscripciones / Inicio post-nómina
- /inbox: tabs Principal(4)/Novedades/Archivo + Filtrar/Ordenar; contenido "¡Estás al día! Aquí verás actividades, recordatorios y avisos".
- Suscripciones (mi.alegra.com, solo lectura): Plan actual Demo. Nómina Inicial US$26/mes (US$313/año, hasta 10 empleados), Nómina Pro US$53/mes (US$637/año, hasta 40), Nómina Plus US$80/mes (US$961/año, ilimitados). Todos incluyen: cálculo automatizado, contabilización automática con Alegra Contabilidad, reportes TSS, importación masiva. Anual ahorra 10%.
- /home post-nómina: checklist onboarding sigue "0 de 4" (no se marca pese a tener todo hecho — posible bug); tarjeta Periodo a calcular vacía; Indicadores 2026: Salario mínimo RD$23,223.00, AFP RD$464,460.00, SFS RD$232,230.00, SRL RD$92,892.40 (topes anuales de cotización); gráficas Costo vs Pago y Contrataciones/mes sin datos aún.
- Empleados finales (5): + Carlos Eduardo Ramírez Ortiz (Chofer reparto, 26,000) y Elena Sofía Marte Jiménez (Supervisora operaciones, 75,000) creados por Waldy.
