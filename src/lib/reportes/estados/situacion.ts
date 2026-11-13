import { centavos } from "../dinero";
import type { FilaBalanceComprobacion } from "../tipos";
import { mapaCuentas, seccionCuenta } from "./cuentas";
import { calcularPorcentaje, coincideBusqueda, crearFila, sinAcentos } from "./filas";
import type {
  ClaseFila,
  CuentaEstado,
  EntradaSituacion,
  FilaReporte,
  OpcionesReporte,
  SituacionFinancieraCalculada,
} from "./tipos";

const PREFIJO_RESULTADOS_ACUMULADOS = "3201";

type Seccion = "corriente" | "no-corriente";

function saldoDe(cuenta: CuentaEstado, saldos: Readonly<Record<string, number>>): number {
  return saldos[cuenta.codigo] ?? 0;
}

function sumarSaldos(cuentas: readonly CuentaEstado[], saldos: Readonly<Record<string, number>>): number {
  return cuentas.reduce((total, cuenta) => total + saldoDe(cuenta, saldos), 0);
}

function cuentasConSaldo(
  cuentas: readonly CuentaEstado[],
  saldosActuales: Readonly<Record<string, number>>,
  saldosAnteriores: Readonly<Record<string, number>>,
): CuentaEstado[] {
  return cuentas.filter((cuenta) => {
    const actual = saldoDe(cuenta, saldosActuales);
    const anterior = saldoDe(cuenta, saldosAnteriores);
    if (actual === 0 && anterior === 0) return false;
    return cuenta.acepta_movimientos || actual !== 0 || anterior !== 0;
  });
}

function ordenarPorCodigo(cuentas: readonly CuentaEstado[]): CuentaEstado[] {
  return [...cuentas].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function porTipoSeccion(
  cuentas: readonly CuentaEstado[],
  porId: ReadonlyMap<string, CuentaEstado>,
  tipo: string,
  seccion: Seccion,
): CuentaEstado[] {
  return cuentas.filter((cuenta) => cuenta.tipo === tipo && seccionCuenta(cuenta, porId) === seccion);
}

/** Utilidad del período a partir de la balanza; el saldo ya viene en su naturaleza. */
export function utilidadDesdeBalance(filas: readonly FilaBalanceComprobacion[]): number {
  let utilidad = 0;

  for (const fila of filas) {
    const saldo = centavos(fila.saldo);
    if (fila.tipo === "ingreso") utilidad += saldo;
    else if (fila.tipo === "costo" || fila.tipo === "gasto") utilidad -= saldo;
  }

  return utilidad;
}

export function calcularSituacionFinanciera(
  entrada: EntradaSituacion,
  opciones: OpcionesReporte = {},
): SituacionFinancieraCalculada {
  const { cuentas, saldosActuales, saldosAnteriores } = entrada;
  const porId = mapaCuentas(cuentas);
  const busqueda = opciones.busqueda ?? "";
  const resumido = opciones.resumido === true;

  const conSaldo = cuentasConSaldo(cuentas, saldosActuales, saldosAnteriores);
  const activosCorrientes = ordenarPorCodigo(porTipoSeccion(conSaldo, porId, "activo", "corriente"));
  const activosNoCorrientes = ordenarPorCodigo(porTipoSeccion(conSaldo, porId, "activo", "no-corriente"));
  const pasivosCorrientes = ordenarPorCodigo(porTipoSeccion(conSaldo, porId, "pasivo", "corriente"));
  const pasivosNoCorrientes = ordenarPorCodigo(porTipoSeccion(conSaldo, porId, "pasivo", "no-corriente"));
  const capitales = ordenarPorCodigo(conSaldo.filter((cuenta) => cuenta.tipo === "capital"));
  const esCuentaDeResultado = (cuenta: CuentaEstado) =>
    cuenta.codigo.startsWith(PREFIJO_RESULTADOS_ACUMULADOS) || sinAcentos(cuenta.nombre).includes("resultado");
  const capitalSinAcumulados = capitales.filter((cuenta) => !esCuentaDeResultado(cuenta));
  const resultadosAcumulados = capitales.filter((cuenta) => cuenta.codigo.startsWith(PREFIJO_RESULTADOS_ACUMULADOS));

  const activosCorrientesActual = sumarSaldos(activosCorrientes, saldosActuales);
  const activosCorrientesAnterior = sumarSaldos(activosCorrientes, saldosAnteriores);
  const activosNoCorrientesActual = sumarSaldos(activosNoCorrientes, saldosActuales);
  const activosNoCorrientesAnterior = sumarSaldos(activosNoCorrientes, saldosAnteriores);
  const pasivosCorrientesActual = sumarSaldos(pasivosCorrientes, saldosActuales);
  const pasivosCorrientesAnterior = sumarSaldos(pasivosCorrientes, saldosAnteriores);
  const pasivosNoCorrientesActual = sumarSaldos(pasivosNoCorrientes, saldosActuales);
  const pasivosNoCorrientesAnterior = sumarSaldos(pasivosNoCorrientes, saldosAnteriores);
  const capitalActual = sumarSaldos(capitalSinAcumulados, saldosActuales);
  const capitalAnterior = sumarSaldos(capitalSinAcumulados, saldosAnteriores);
  const acumuladosActual = sumarSaldos(resultadosAcumulados, saldosActuales);
  const acumuladosAnterior = sumarSaldos(resultadosAcumulados, saldosAnteriores);

  const resultadosAnterioresActual = entrada.utilidadAnterior + acumuladosActual;
  const resultadosAnterioresAnterior = entrada.utilidadAnteriorAnterior + acumuladosAnterior;
  const totalActivosActual = activosCorrientesActual + activosNoCorrientesActual;
  const totalActivosAnterior = activosCorrientesAnterior + activosNoCorrientesAnterior;
  const totalPasivosActual = pasivosCorrientesActual + pasivosNoCorrientesActual;
  const totalPasivosAnterior = pasivosCorrientesAnterior + pasivosNoCorrientesAnterior;
  const totalPatrimonioActual = capitalActual + entrada.utilidadEjercicio + resultadosAnterioresActual;
  const totalPatrimonioAnterior = capitalAnterior + entrada.utilidadEjercicioAnterior + resultadosAnterioresAnterior;
  const totalPasivosPatrimonioActual = totalPasivosActual + totalPatrimonioActual;
  const totalPasivosPatrimonioAnterior = totalPasivosAnterior + totalPatrimonioAnterior;
  const diferencia = totalActivosActual - totalPasivosPatrimonioActual;

  const filas: FilaReporte[] = [];

  const agregar = (clave: string, clase: ClaseFila, nombre: string, actual: number, anterior: number, codigo = "") => {
    filas.push(
      crearFila({
        clave,
        clase,
        codigo,
        nombre,
        actual,
        anterior,
        porcentajeActual: calcularPorcentaje(Math.abs(actual), Math.abs(totalActivosActual)),
        porcentajeAnterior: calcularPorcentaje(Math.abs(anterior), Math.abs(totalActivosAnterior)),
      }),
    );
  };

  const agregarCuenta = (cuenta: CuentaEstado) => {
    agregar(
      `detalle-${cuenta.id}`,
      "detalle",
      cuenta.nombre,
      saldoDe(cuenta, saldosActuales),
      saldoDe(cuenta, saldosAnteriores),
      cuenta.codigo,
    );
  };

  const visibles = (cuentas: readonly CuentaEstado[]) =>
    cuentas.filter((cuenta) => coincideBusqueda(cuenta.codigo, cuenta.nombre, busqueda));
  const detalles = (cuentas: readonly CuentaEstado[]) => (resumido ? [] : visibles(cuentas));

  agregar("titulo-activos", "titulo", "Activos", 0, 0);
  agregar(
    "grupo-activos-corrientes",
    "grupo",
    "Activos corrientes",
    activosCorrientesActual,
    activosCorrientesAnterior,
  );
  for (const cuenta of detalles(activosCorrientes)) agregarCuenta(cuenta);
  agregar(
    "grupo-activos-no-corrientes",
    "grupo",
    "Activos no corrientes",
    activosNoCorrientesActual,
    activosNoCorrientesAnterior,
  );
  for (const cuenta of detalles(activosNoCorrientes)) agregarCuenta(cuenta);
  agregar("total-activos", "total", "Total activos", totalActivosActual, totalActivosAnterior);

  agregar("titulo-pasivos", "titulo", "Pasivos", 0, 0);
  agregar(
    "grupo-pasivos-corrientes",
    "grupo",
    "Pasivos corrientes",
    pasivosCorrientesActual,
    pasivosCorrientesAnterior,
  );
  for (const cuenta of detalles(pasivosCorrientes)) agregarCuenta(cuenta);
  agregar(
    "grupo-pasivos-no-corrientes",
    "grupo",
    "Pasivos no corrientes",
    pasivosNoCorrientesActual,
    pasivosNoCorrientesAnterior,
  );
  for (const cuenta of detalles(pasivosNoCorrientes)) agregarCuenta(cuenta);
  agregar("total-pasivos", "total", "Total pasivos", totalPasivosActual, totalPasivosAnterior);

  agregar("titulo-patrimonio", "titulo", "Patrimonio", 0, 0);
  for (const cuenta of detalles(capitalSinAcumulados)) agregarCuenta(cuenta);
  agregar(
    "detalle-resultado-ejercicio",
    "detalle",
    "Resultado del ejercicio",
    entrada.utilidadEjercicio,
    entrada.utilidadEjercicioAnterior,
  );
  agregar(
    "detalle-resultados-anteriores",
    "detalle",
    "Resultados de ejercicios anteriores",
    resultadosAnterioresActual,
    resultadosAnterioresAnterior,
  );
  agregar("total-patrimonio", "total", "Total patrimonio", totalPatrimonioActual, totalPatrimonioAnterior);
  agregar(
    "total-pasivos-patrimonio",
    "total",
    "Total pasivos + patrimonio",
    totalPasivosPatrimonioActual,
    totalPasivosPatrimonioAnterior,
  );

  return {
    filas,
    totalActivos: totalActivosActual,
    totalPasivosPatrimonio: totalPasivosPatrimonioActual,
    diferencia,
    cuadra: diferencia === 0,
  };
}
