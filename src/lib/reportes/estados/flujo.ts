import { centavos } from "../dinero";
import { calcularEstadoResultados } from "../resultados";
import { mapaCuentas, seccionCuenta } from "./cuentas";
import { calcularPorcentaje, coincideBusqueda, crearFila, sinAcentos } from "./filas";
import type {
  ClaseFila,
  CuentaEstado,
  EntradaFlujo,
  FilaReporte,
  FlujoEfectivoCalculado,
  FlujoPeriodo,
  OpcionesReporte,
} from "./tipos";

const ETIQUETA_DEPRECIACION = "Depreciaciones, amortizaciones y desvalorizaciones";
const ETIQUETA_ACTIVOS_NO_CORRIENTES = "Activos no corrientes (inversión)";
const ETIQUETA_PASIVOS_NO_CORRIENTES = "Pasivos no corrientes (financiación)";
const TERMINOS_DEPRECIACION = ["deprecia", "amortiza", "desvalori"];
const EXCLUSIONES_PAGAR = ["impuesto", "itbis", "retenci", "nomina", "salario"];

interface DetalleFlujo {
  codigo: string;
  nombre: string;
  impacto: number;
}

interface DetalleComparativo {
  codigo: string;
  nombre: string;
  actual: number;
  anterior: number;
}

type ClasificacionCuenta =
  | { categoria: "cuentas-por-cobrar"; impacto: number }
  | { categoria: "inventarios"; impacto: number }
  | { categoria: "otros-activos"; impacto: number }
  | { categoria: "cuentas-por-pagar"; impacto: number }
  | { categoria: "otros-pasivos"; impacto: number }
  | { categoria: "inversion"; detalle: DetalleFlujo }
  | { categoria: "financiacion"; detalle: DetalleFlujo };

interface AcumuladorFlujo {
  cuentasPorCobrar: number;
  inventarios: number;
  otrosActivos: number;
  cuentasPorPagar: number;
  otrosPasivos: number;
  inversiones: DetalleFlujo[];
  financiaciones: DetalleFlujo[];
}

interface AnalisisPeriodo {
  utilidadNeta: number;
  depreciacion: number;
  cuentasPorCobrar: number;
  inventarios: number;
  otrosActivos: number;
  cuentasPorPagar: number;
  otrosPasivos: number;
  totalOperacion: number;
  inversiones: DetalleFlujo[];
  financiaciones: DetalleFlujo[];
  totalInversion: number;
  totalFinanciacion: number;
  efectivoInicio: number;
  efectivoSituacion: number;
}

function esDepreciacion(nombre: string): boolean {
  const texto = sinAcentos(nombre);
  return TERMINOS_DEPRECIACION.some((termino) => texto.includes(termino));
}

function detalleCuenta(cuenta: CuentaEstado, impacto: number): DetalleFlujo {
  return { codigo: cuenta.codigo, nombre: cuenta.nombre, impacto };
}

function clasificarCapital(cuenta: CuentaEstado, inicio: number, fin: number): ClasificacionCuenta | null {
  const nombre = sinAcentos(cuenta.nombre);
  if (cuenta.codigo.startsWith("3201") || nombre.includes("resultado")) return null;
  return { categoria: "financiacion", detalle: detalleCuenta(cuenta, fin - inicio) };
}

function clasificarActivo(
  cuenta: CuentaEstado,
  inicio: number,
  fin: number,
  porId: ReadonlyMap<string, CuentaEstado>,
): ClasificacionCuenta {
  const impacto = inicio - fin;
  if (seccionCuenta(cuenta, porId) === "no-corriente") {
    return { categoria: "inversion", detalle: detalleCuenta(cuenta, impacto) };
  }

  const nombre = sinAcentos(cuenta.nombre);
  if (nombre.includes("cobrar") || nombre.includes("deudor")) return { categoria: "cuentas-por-cobrar", impacto };
  if (nombre.includes("inventario")) return { categoria: "inventarios", impacto };
  return { categoria: "otros-activos", impacto };
}

function clasificarPasivo(
  cuenta: CuentaEstado,
  inicio: number,
  fin: number,
  porId: ReadonlyMap<string, CuentaEstado>,
): ClasificacionCuenta {
  const impacto = fin - inicio;
  if (seccionCuenta(cuenta, porId) === "no-corriente") {
    return { categoria: "financiacion", detalle: detalleCuenta(cuenta, impacto) };
  }

  const nombre = sinAcentos(cuenta.nombre);
  const esCuentaPorPagar = nombre.includes("pagar") && !EXCLUSIONES_PAGAR.some((termino) => nombre.includes(termino));
  return { categoria: esCuentaPorPagar ? "cuentas-por-pagar" : "otros-pasivos", impacto };
}

function clasificarCuenta(
  cuenta: CuentaEstado,
  inicio: number,
  fin: number,
  porId: ReadonlyMap<string, CuentaEstado>,
): ClasificacionCuenta | null {
  if (cuenta.tipo === "capital") return clasificarCapital(cuenta, inicio, fin);
  if (cuenta.tipo === "activo") return clasificarActivo(cuenta, inicio, fin, porId);
  if (cuenta.tipo === "pasivo") return clasificarPasivo(cuenta, inicio, fin, porId);
  return null;
}

function aplicarClasificacion(acumulador: AcumuladorFlujo, clasificacion: ClasificacionCuenta): void {
  switch (clasificacion.categoria) {
    case "cuentas-por-cobrar":
      acumulador.cuentasPorCobrar += clasificacion.impacto;
      break;
    case "inventarios":
      acumulador.inventarios += clasificacion.impacto;
      break;
    case "otros-activos":
      acumulador.otrosActivos += clasificacion.impacto;
      break;
    case "cuentas-por-pagar":
      acumulador.cuentasPorPagar += clasificacion.impacto;
      break;
    case "otros-pasivos":
      acumulador.otrosPasivos += clasificacion.impacto;
      break;
    case "inversion":
      acumulador.inversiones.push(clasificacion.detalle);
      break;
    case "financiacion":
      acumulador.financiaciones.push(clasificacion.detalle);
      break;
  }
}

function analizarPeriodo(
  periodo: FlujoPeriodo,
  cuentas: readonly CuentaEstado[],
  porId: ReadonlyMap<string, CuentaEstado>,
): AnalisisPeriodo {
  const estado = calcularEstadoResultados(periodo.resultados);
  const depreciacion = periodo.resultados
    .filter((fila) => fila.tipo === "gasto" && esDepreciacion(fila.cuenta_nombre))
    .reduce((total, fila) => total + centavos(fila.monto), 0);

  const acumulador: AcumuladorFlujo = {
    cuentasPorCobrar: 0,
    inventarios: 0,
    otrosActivos: 0,
    cuentasPorPagar: 0,
    otrosPasivos: 0,
    inversiones: [],
    financiaciones: [],
  };

  for (const cuenta of cuentas) {
    if (!cuenta.acepta_movimientos || cuenta.es_caja_banco) continue;
    const inicio = periodo.saldosInicio[cuenta.codigo] ?? 0;
    const fin = periodo.saldosFin[cuenta.codigo] ?? 0;
    const clasificacion = clasificarCuenta(cuenta, inicio, fin, porId);
    if (clasificacion != null) aplicarClasificacion(acumulador, clasificacion);
  }

  let efectivoInicio = 0;
  let efectivoSituacion = 0;
  for (const cuenta of cuentas) {
    if (!cuenta.acepta_movimientos || !cuenta.es_caja_banco) continue;
    efectivoInicio += periodo.saldosInicio[cuenta.codigo] ?? 0;
    efectivoSituacion += periodo.saldosFin[cuenta.codigo] ?? 0;
  }

  const totalOperacion =
    estado.utilidadNeta +
    depreciacion +
    acumulador.cuentasPorCobrar +
    acumulador.inventarios +
    acumulador.otrosActivos +
    acumulador.cuentasPorPagar +
    acumulador.otrosPasivos;
  const totalInversion = acumulador.inversiones.reduce((total, detalle) => total + detalle.impacto, 0);
  const totalFinanciacion = acumulador.financiaciones.reduce((total, detalle) => total + detalle.impacto, 0);

  return {
    utilidadNeta: estado.utilidadNeta,
    depreciacion,
    cuentasPorCobrar: acumulador.cuentasPorCobrar,
    inventarios: acumulador.inventarios,
    otrosActivos: acumulador.otrosActivos,
    cuentasPorPagar: acumulador.cuentasPorPagar,
    otrosPasivos: acumulador.otrosPasivos,
    totalOperacion,
    inversiones: acumulador.inversiones,
    financiaciones: acumulador.financiaciones,
    totalInversion,
    totalFinanciacion,
    efectivoInicio,
    efectivoSituacion,
  };
}

function unirDetalles(actuales: readonly DetalleFlujo[], anteriores: readonly DetalleFlujo[]): DetalleComparativo[] {
  const porCodigo = new Map<string, DetalleComparativo>();

  for (const detalle of anteriores) {
    porCodigo.set(detalle.codigo, {
      codigo: detalle.codigo,
      nombre: detalle.nombre,
      actual: 0,
      anterior: detalle.impacto,
    });
  }

  for (const detalle of actuales) {
    const existente = porCodigo.get(detalle.codigo);
    if (existente == null) {
      porCodigo.set(detalle.codigo, {
        codigo: detalle.codigo,
        nombre: detalle.nombre,
        actual: detalle.impacto,
        anterior: 0,
      });
    } else {
      existente.nombre = detalle.nombre;
      existente.actual = detalle.impacto;
    }
  }

  return [...porCodigo.values()]
    .filter((detalle) => detalle.actual !== 0 || detalle.anterior !== 0)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export function calcularFlujoEfectivo(entrada: EntradaFlujo, opciones: OpcionesReporte = {}): FlujoEfectivoCalculado {
  const porId = mapaCuentas(entrada.cuentas);
  const analisisActual = analizarPeriodo(entrada.actual, entrada.cuentas, porId);
  const analisisAnterior = analizarPeriodo(entrada.anterior, entrada.cuentas, porId);
  const baseActual = analisisActual.totalOperacion;
  const baseAnterior = analisisAnterior.totalOperacion;

  const crear = (
    clave: string,
    clase: ClaseFila,
    nombre: string,
    montoActual: number,
    montoAnterior: number,
    codigo = "",
  ): FilaReporte =>
    crearFila({
      clave,
      clase,
      codigo,
      nombre,
      actual: montoActual,
      anterior: montoAnterior,
      porcentajeActual: calcularPorcentaje(montoActual, baseActual),
      porcentajeAnterior: calcularPorcentaje(montoAnterior, baseAnterior),
    });

  const filas: FilaReporte[] = [
    crear("operacion-titulo", "titulo", "Actividades de operación", 0, 0),
    crear("utilidad-neta", "detalle", "Utilidad neta", analisisActual.utilidadNeta, analisisAnterior.utilidadNeta),
    crear("depreciacion", "detalle", ETIQUETA_DEPRECIACION, analisisActual.depreciacion, analisisAnterior.depreciacion),
    crear(
      "cuentas-por-cobrar",
      "detalle",
      "Cambios en cuentas por cobrar",
      analisisActual.cuentasPorCobrar,
      analisisAnterior.cuentasPorCobrar,
    ),
    crear("inventarios", "detalle", "Cambios en inventarios", analisisActual.inventarios, analisisAnterior.inventarios),
    crear(
      "otros-activos",
      "detalle",
      "Cambios en otros activos corrientes",
      analisisActual.otrosActivos,
      analisisAnterior.otrosActivos,
    ),
    crear(
      "cuentas-por-pagar",
      "detalle",
      "Cambios en cuentas por pagar",
      analisisActual.cuentasPorPagar,
      analisisAnterior.cuentasPorPagar,
    ),
    crear(
      "otros-pasivos",
      "detalle",
      "Cambios en otros pasivos corrientes",
      analisisActual.otrosPasivos,
      analisisAnterior.otrosPasivos,
    ),
    crear(
      "operacion-total",
      "total",
      "Total efectivo generado en actividades de operación",
      analisisActual.totalOperacion,
      analisisAnterior.totalOperacion,
    ),
    crear("inversion-titulo", "titulo", "Actividades de inversión", 0, 0),
  ];

  for (const detalle of unirDetalles(analisisActual.inversiones, analisisAnterior.inversiones)) {
    filas.push(
      crear(`inversion-${detalle.codigo}`, "detalle", detalle.nombre, detalle.actual, detalle.anterior, detalle.codigo),
    );
  }

  filas.push(
    crear(
      "inversion-total",
      "total",
      "Total actividades de inversión",
      analisisActual.totalInversion,
      analisisAnterior.totalInversion,
    ),
    crear("financiacion-titulo", "titulo", "Actividades de financiación", 0, 0),
  );

  for (const detalle of unirDetalles(analisisActual.financiaciones, analisisAnterior.financiaciones)) {
    filas.push(
      crear(
        `financiacion-${detalle.codigo}`,
        "detalle",
        detalle.nombre,
        detalle.actual,
        detalle.anterior,
        detalle.codigo,
      ),
    );
  }

  filas.push(
    crear(
      "financiacion-total",
      "total",
      "Total actividades de financiación",
      analisisActual.totalFinanciacion,
      analisisAnterior.totalFinanciacion,
    ),
  );

  const aumentoActual =
    analisisActual.totalOperacion + analisisActual.totalInversion + analisisActual.totalFinanciacion;
  const aumentoAnterior =
    analisisAnterior.totalOperacion + analisisAnterior.totalInversion + analisisAnterior.totalFinanciacion;
  const efectivoFinalActual = analisisActual.efectivoInicio + aumentoActual;
  const efectivoFinalAnterior = analisisAnterior.efectivoInicio + aumentoAnterior;
  const diferenciaActual = efectivoFinalActual - analisisActual.efectivoSituacion;
  const diferenciaAnterior = efectivoFinalAnterior - analisisAnterior.efectivoSituacion;

  filas.push(
    crear("aumento-efectivo", "total", "Aumento (disminución) de efectivo", aumentoActual, aumentoAnterior),
    crear(
      "efectivo-inicio",
      "detalle",
      "Efectivo al inicio",
      analisisActual.efectivoInicio,
      analisisAnterior.efectivoInicio,
    ),
    crear("efectivo-final", "total", "Efectivo al final", efectivoFinalActual, efectivoFinalAnterior),
    crear(
      "saldo-situacion",
      "detalle",
      "Saldo del Estado de Situación Financiera",
      analisisActual.efectivoSituacion,
      analisisAnterior.efectivoSituacion,
    ),
    crear("diferencia", "total", "Diferencia", diferenciaActual, diferenciaAnterior),
  );

  const conceptosSinCuentas: string[] = [];
  const hayDepreciacion = entrada.cuentas.some((cuenta) => cuenta.tipo === "gasto" && esDepreciacion(cuenta.nombre));
  if (!hayDepreciacion) conceptosSinCuentas.push(ETIQUETA_DEPRECIACION);

  const hayActivoNoCorriente = entrada.cuentas.some(
    (cuenta) => cuenta.tipo === "activo" && seccionCuenta(cuenta, porId) === "no-corriente",
  );
  if (!hayActivoNoCorriente) conceptosSinCuentas.push(ETIQUETA_ACTIVOS_NO_CORRIENTES);

  const hayPasivoNoCorriente = entrada.cuentas.some(
    (cuenta) => cuenta.tipo === "pasivo" && seccionCuenta(cuenta, porId) === "no-corriente",
  );
  if (!hayPasivoNoCorriente) conceptosSinCuentas.push(ETIQUETA_PASIVOS_NO_CORRIENTES);

  const busqueda = opciones.busqueda?.trim() ?? "";
  const filasFiltradas =
    busqueda === ""
      ? filas
      : filas.filter((fila) => fila.clase !== "detalle" || coincideBusqueda(fila.codigo, fila.nombre, busqueda));

  return {
    filas: filasFiltradas,
    efectivoFinal: efectivoFinalActual,
    saldoSituacion: analisisActual.efectivoSituacion,
    diferencia: diferenciaActual,
    conceptosSinCuentas,
  };
}
