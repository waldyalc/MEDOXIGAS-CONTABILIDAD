import { centavos } from "../dinero";
import type { FilaEstadoResultados } from "../tipos";
import { calcularPorcentaje, coincideBusqueda, crearFila } from "./filas";
import type { EstadoResultadosComparativo, FilaReporte, OpcionesReporte } from "./tipos";

interface CuentaResultado {
  tipo: string;
  codigo: string;
  nombre: string;
  actual: number;
  anterior: number;
}

function unirCuentas(
  actuales: readonly FilaEstadoResultados[],
  anteriores: readonly FilaEstadoResultados[],
): CuentaResultado[] {
  const porCodigo = new Map<string, CuentaResultado>();

  for (const fila of actuales) {
    porCodigo.set(fila.cuenta_codigo, {
      tipo: fila.tipo,
      codigo: fila.cuenta_codigo,
      nombre: fila.cuenta_nombre,
      actual: centavos(fila.monto),
      anterior: 0,
    });
  }

  for (const fila of anteriores) {
    const existente = porCodigo.get(fila.cuenta_codigo);
    if (existente == null) {
      porCodigo.set(fila.cuenta_codigo, {
        tipo: fila.tipo,
        codigo: fila.cuenta_codigo,
        nombre: fila.cuenta_nombre,
        actual: 0,
        anterior: centavos(fila.monto),
      });
    } else {
      existente.anterior = centavos(fila.monto);
    }
  }

  return [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function sumarActual(cuentas: readonly CuentaResultado[]): number {
  return cuentas.reduce((total, cuenta) => total + cuenta.actual, 0);
}

function sumarAnterior(cuentas: readonly CuentaResultado[]): number {
  return cuentas.reduce((total, cuenta) => total + cuenta.anterior, 0);
}

export function calcularEstadoResultadosComparativo(
  actuales: readonly FilaEstadoResultados[],
  anteriores: readonly FilaEstadoResultados[],
  opciones: OpcionesReporte = {},
): EstadoResultadosComparativo {
  const cuentas = unirCuentas(actuales, anteriores);
  const ingresos = cuentas.filter((cuenta) => cuenta.tipo === "ingreso");
  const costos = cuentas.filter((cuenta) => cuenta.tipo === "costo");
  const gastos = cuentas.filter((cuenta) => cuenta.tipo === "gasto");

  const totalIngresosActual = sumarActual(ingresos);
  const totalIngresosAnterior = sumarAnterior(ingresos);
  const totalCostosActual = sumarActual(costos);
  const totalCostosAnterior = sumarAnterior(costos);
  const totalGastosActual = sumarActual(gastos);
  const totalGastosAnterior = sumarAnterior(gastos);
  const utilidadBrutaActual = totalIngresosActual - totalCostosActual;
  const utilidadBrutaAnterior = totalIngresosAnterior - totalCostosAnterior;
  const utilidadOperativaActual = utilidadBrutaActual - totalGastosActual;
  const utilidadOperativaAnterior = utilidadBrutaAnterior - totalGastosAnterior;

  const porcentajeActual = (valor: number) => calcularPorcentaje(valor, totalIngresosActual);
  const porcentajeAnterior = (valor: number) => calcularPorcentaje(valor, totalIngresosAnterior);
  const resumido = opciones.resumido === true;
  const busqueda = opciones.busqueda ?? "";

  const visibles = (lista: readonly CuentaResultado[]) =>
    resumido ? [] : lista.filter((cuenta) => coincideBusqueda(cuenta.codigo, cuenta.nombre, busqueda));

  const filaCuenta = (cuenta: CuentaResultado, signo: number): FilaReporte =>
    crearFila({
      clave: cuenta.codigo,
      clase: "detalle",
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      cuentaId: opciones.cuentasPorCodigo?.get(cuenta.codigo) ?? null,
      actual: signo * cuenta.actual,
      anterior: signo * cuenta.anterior,
      porcentajeActual: porcentajeActual(cuenta.actual),
      porcentajeAnterior: porcentajeAnterior(cuenta.anterior),
      variacionEnMagnitud: true,
    });

  const filas: FilaReporte[] = [
    crearFila({
      clave: "ingresos",
      clase: "grupo",
      nombre: "Ingresos de actividades ordinarias",
      actual: totalIngresosActual,
      anterior: totalIngresosAnterior,
      porcentajeActual: porcentajeActual(totalIngresosActual),
      porcentajeAnterior: porcentajeAnterior(totalIngresosAnterior),
      variacionEnMagnitud: true,
    }),
    ...visibles(ingresos).map((cuenta) => filaCuenta(cuenta, 1)),
    crearFila({
      clave: "costos",
      clase: "grupo",
      nombre: "Costos de ventas y operación",
      actual: -totalCostosActual,
      anterior: -totalCostosAnterior,
      porcentajeActual: porcentajeActual(totalCostosActual),
      porcentajeAnterior: porcentajeAnterior(totalCostosAnterior),
      variacionEnMagnitud: true,
    }),
    ...visibles(costos).map((cuenta) => filaCuenta(cuenta, -1)),
    crearFila({
      clave: "utilidad-bruta",
      clase: "total",
      nombre: "Utilidad bruta",
      actual: utilidadBrutaActual,
      anterior: utilidadBrutaAnterior,
      porcentajeActual: porcentajeActual(utilidadBrutaActual),
      porcentajeAnterior: porcentajeAnterior(utilidadBrutaAnterior),
    }),
    crearFila({
      clave: "gastos",
      clase: "grupo",
      nombre: "Gastos",
      actual: -totalGastosActual,
      anterior: -totalGastosAnterior,
      porcentajeActual: porcentajeActual(totalGastosActual),
      porcentajeAnterior: porcentajeAnterior(totalGastosAnterior),
      variacionEnMagnitud: true,
    }),
    ...visibles(gastos).map((cuenta) => filaCuenta(cuenta, -1)),
    crearFila({
      clave: "utilidad-operativa",
      clase: "total",
      nombre: "Utilidad operativa",
      actual: utilidadOperativaActual,
      anterior: utilidadOperativaAnterior,
      porcentajeActual: porcentajeActual(utilidadOperativaActual),
      porcentajeAnterior: porcentajeAnterior(utilidadOperativaAnterior),
    }),
    crearFila({
      clave: "otros",
      clase: "total",
      nombre: "Otros ingresos/gastos",
      actual: 0,
      anterior: 0,
      porcentajeActual: 0,
      porcentajeAnterior: 0,
    }),
    crearFila({
      clave: "utilidad-antes-impuestos",
      clase: "total",
      nombre: "Utilidad antes de impuestos",
      actual: utilidadOperativaActual,
      anterior: utilidadOperativaAnterior,
      porcentajeActual: porcentajeActual(utilidadOperativaActual),
      porcentajeAnterior: porcentajeAnterior(utilidadOperativaAnterior),
    }),
    crearFila({
      clave: "impuestos",
      clase: "total",
      nombre: "Impuestos",
      actual: 0,
      anterior: 0,
      porcentajeActual: 0,
      porcentajeAnterior: 0,
    }),
    crearFila({
      clave: "utilidad-neta",
      clase: "total",
      nombre: "Utilidad (pérdida) neta",
      actual: utilidadOperativaActual,
      anterior: utilidadOperativaAnterior,
      porcentajeActual: porcentajeActual(utilidadOperativaActual),
      porcentajeAnterior: porcentajeAnterior(utilidadOperativaAnterior),
    }),
  ];

  return { filas };
}
