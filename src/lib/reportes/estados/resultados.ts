import { centavos } from "../dinero";
import type { FilaEstadoResultados } from "../tipos";
import { calcularPorcentaje, coincideBusqueda, crearFila, sinAcentos } from "./filas";
import type { CuentaEstado, EstadoResultadosComparativo, FilaReporte, OpcionesReporte } from "./tipos";

interface CuentaResultado {
  tipo: string;
  codigo: string;
  nombre: string;
  cuentaId: string | null;
  actual: number;
  anterior: number;
}

const TIPOS_RESULTADO = new Set(["ingreso", "costo", "gasto"]);

function unirCuentas(
  actuales: readonly FilaEstadoResultados[],
  anteriores: readonly FilaEstadoResultados[],
  catalogo: readonly CuentaEstado[],
): CuentaResultado[] {
  const porCodigo = new Map<string, CuentaResultado>();
  const idsPorCodigo = new Map(catalogo.map((cuenta) => [cuenta.codigo, cuenta.id]));

  for (const cuenta of catalogo) {
    if (!TIPOS_RESULTADO.has(cuenta.tipo)) continue;
    if (!cuenta.acepta_movimientos) continue;
    if (cuenta.activa === false) continue;

    porCodigo.set(cuenta.codigo, {
      tipo: cuenta.tipo,
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      cuentaId: cuenta.id,
      actual: 0,
      anterior: 0,
    });
  }

  for (const fila of actuales) {
    const existente = porCodigo.get(fila.cuenta_codigo);
    if (existente == null) {
      porCodigo.set(fila.cuenta_codigo, {
        tipo: fila.tipo,
        codigo: fila.cuenta_codigo,
        nombre: fila.cuenta_nombre,
        cuentaId: idsPorCodigo.get(fila.cuenta_codigo) ?? null,
        actual: centavos(fila.monto),
        anterior: 0,
      });
    } else {
      existente.actual = centavos(fila.monto);
    }
  }

  for (const fila of anteriores) {
    const existente = porCodigo.get(fila.cuenta_codigo);
    if (existente == null) {
      porCodigo.set(fila.cuenta_codigo, {
        tipo: fila.tipo,
        codigo: fila.cuenta_codigo,
        nombre: fila.cuenta_nombre,
        cuentaId: idsPorCodigo.get(fila.cuenta_codigo) ?? null,
        actual: 0,
        anterior: centavos(fila.monto),
      });
    } else {
      existente.anterior = centavos(fila.monto);
    }
  }

  return [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

type Destino =
  | "ventas"
  | "devoluciones"
  | "costos-mercancia"
  | "costos-otros"
  | "gastos-venta"
  | "gastos-personal-ventas"
  | "gastos-personal"
  | "gastos-admin"
  | "gastos-generales"
  | "otros-ingresos"
  | "gastos-financieros"
  | "otros-gastos"
  | "impuestos";

const RE_OTROS_INGRESOS = /interes|financier|descuento|diferencia|redondeo|rendimiento/;
const RE_GASTOS_FINANCIEROS = /financier|interes|mora/;
const RE_OTROS_GASTOS = /comision|bancari|diferencia|cambio|disposicion|redondeo/;
const RE_IMPUESTOS = /impuesto|renta|retencion|itbis|isr/;
const RE_PERSONAL = /nomina|sueldo|salario|personal|emplead|laboral|cesantia|vacaciones|pascual|infotep|aportes/;
const RE_PERSONAL_VENTAS =
  /(personal|vendedor|comision).*(venta|comercial)|(venta|comercial).*(personal|vendedor|comision)/;
const RE_VENTA = /venta|vendedor|comercial|propaganda|publicidad|flete|envio/;
const RE_ADMIN = /admin|legal|profesional|arrendamiento|alquiler|seguro(?! de riesgos)/;

function destinoGasto(cuenta: CuentaResultado, nombre: string): Destino {
  const numero = Number.parseInt(cuenta.codigo, 10);

  if (RE_IMPUESTOS.test(nombre) || cuenta.codigo.startsWith("64") || cuenta.codigo.startsWith("65")) {
    return "impuestos";
  }
  if (RE_GASTOS_FINANCIEROS.test(nombre) || cuenta.codigo.startsWith("63")) {
    return "gastos-financieros";
  }
  if (RE_OTROS_GASTOS.test(nombre) || cuenta.codigo.startsWith("66")) {
    return "otros-gastos";
  }
  if ((numero >= 6110 && numero <= 6122) || RE_PERSONAL.test(nombre)) {
    return RE_PERSONAL_VENTAS.test(nombre) ? "gastos-personal-ventas" : "gastos-personal";
  }
  if (RE_VENTA.test(nombre)) return "gastos-venta";
  if (RE_ADMIN.test(nombre)) return "gastos-admin";
  return "gastos-generales";
}

/** Ubica cada cuenta en el esqueleto del estado de resultados de Alegra. */
function destinoDe(cuenta: CuentaResultado): Destino {
  const nombre = sinAcentos(cuenta.nombre);

  if (cuenta.tipo === "ingreso") {
    if (nombre.includes("devoluc")) return "devoluciones";
    if (RE_OTROS_INGRESOS.test(nombre)) return "otros-ingresos";
    return "ventas";
  }

  if (cuenta.tipo === "costo") {
    if (nombre.includes("servicio") || cuenta.codigo.startsWith("52")) return "costos-otros";
    return "costos-mercancia";
  }

  return destinoGasto(cuenta, nombre);
}

function sumar(cuentas: readonly CuentaResultado[], campo: "actual" | "anterior"): number {
  return cuentas.reduce((total, cuenta) => total + cuenta[campo], 0);
}

/** Ingresos suman positivo; costos y gastos restan (muestra neta de la sección). */
function sumarSignado(cuentas: readonly CuentaResultado[], campo: "actual" | "anterior"): number {
  return cuentas.reduce((total, cuenta) => total + (cuenta.tipo === "ingreso" ? cuenta[campo] : -cuenta[campo]), 0);
}

interface Seccion {
  clave: string;
  nombre: string;
  destinos: Destino[];
}

/** Esqueleto fijo del estado de resultados, idéntico al de Alegra. */
const SECCIONES: readonly Seccion[] = [
  { clave: "ingresos", nombre: "Ingresos de actividades ordinarias", destinos: ["ventas", "devoluciones"] },
  {
    clave: "costos",
    nombre: "Costos de ventas y operación",
    destinos: ["costos-mercancia", "costos-otros"],
  },
  {
    clave: "gastos-venta",
    nombre: "Gastos de venta",
    destinos: ["gastos-personal-ventas", "gastos-venta"],
  },
  {
    clave: "gastos-admin",
    nombre: "Gastos de administración",
    destinos: ["gastos-personal", "gastos-admin"],
  },
  { clave: "gastos-generales", nombre: "Gastos generales", destinos: ["gastos-generales"] },
  { clave: "otros-ingresos", nombre: "Otros Ingresos", destinos: ["otros-ingresos"] },
  { clave: "gastos-financieros", nombre: "Gastos financieros", destinos: ["gastos-financieros"] },
  { clave: "otros-gastos", nombre: "Otros gastos", destinos: ["otros-gastos"] },
  { clave: "impuestos", nombre: "Gastos por impuestos", destinos: ["impuestos"] },
];

interface Subgrupo {
  clave: string;
  nombre: string;
  seccion: string;
  destino: Destino;
}

/** Subgrupos expandibles dentro de cada sección (los fijos de Alegra). */
const SUBGRUPOS: readonly Subgrupo[] = [
  { clave: "ventas", nombre: "Ventas", seccion: "ingresos", destino: "ventas" },
  {
    clave: "costos-mercancia",
    nombre: "Costos de la mercancía vendida",
    seccion: "costos",
    destino: "costos-mercancia",
  },
  {
    clave: "gastos-personal-ventas",
    nombre: "Gastos de personal de ventas",
    seccion: "gastos-venta",
    destino: "gastos-personal-ventas",
  },
  {
    clave: "gastos-personal",
    nombre: "Gastos de personal",
    seccion: "gastos-admin",
    destino: "gastos-personal",
  },
];

/** Destinos que se muestran como hojas sueltas dentro de su sección. */
const DESTINOS_HOJA: ReadonlyMap<string, Destino[]> = new Map([
  ["ingresos", ["devoluciones"]],
  ["costos", ["costos-otros"]],
  ["gastos-venta", ["gastos-venta"]],
  ["gastos-admin", ["gastos-admin"]],
  ["gastos-generales", ["gastos-generales"]],
  ["otros-ingresos", ["otros-ingresos"]],
  ["gastos-financieros", ["gastos-financieros"]],
  ["otros-gastos", ["otros-gastos"]],
  ["impuestos", ["impuestos"]],
]);

export function calcularEstadoResultadosComparativo(
  actuales: readonly FilaEstadoResultados[],
  anteriores: readonly FilaEstadoResultados[],
  opciones: OpcionesReporte = {},
): EstadoResultadosComparativo {
  const cuentas = unirCuentas(actuales, anteriores, opciones.cuentas ?? []);
  const porDestino = new Map<Destino, CuentaResultado[]>();
  for (const cuenta of cuentas) {
    const destino = destinoDe(cuenta);
    const lista = porDestino.get(destino) ?? [];
    lista.push(cuenta);
    porDestino.set(destino, lista);
  }
  const en = (destino: Destino): CuentaResultado[] => porDestino.get(destino) ?? [];

  const ingresos = [...en("ventas"), ...en("devoluciones")];
  const costos = [...en("costos-mercancia"), ...en("costos-otros")];
  const gastosOperativos = [
    ...en("gastos-personal-ventas"),
    ...en("gastos-venta"),
    ...en("gastos-personal"),
    ...en("gastos-admin"),
    ...en("gastos-generales"),
  ];
  const otrosIngresos = en("otros-ingresos");
  const otrosEgresos = [...en("gastos-financieros"), ...en("otros-gastos")];
  const impuestos = en("impuestos");

  const ingresosActual = sumar(ingresos, "actual");
  const ingresosAnterior = sumar(ingresos, "anterior");
  const costosActual = sumar(costos, "actual");
  const costosAnterior = sumar(costos, "anterior");
  const gastosActual = sumar(gastosOperativos, "actual");
  const gastosAnterior = sumar(gastosOperativos, "anterior");
  const otrosActual = sumar(otrosIngresos, "actual") - sumar(otrosEgresos, "actual");
  const otrosAnterior = sumar(otrosIngresos, "anterior") - sumar(otrosEgresos, "anterior");
  const impuestosActual = sumar(impuestos, "actual");
  const impuestosAnterior = sumar(impuestos, "anterior");

  const brutaActual = ingresosActual - costosActual;
  const brutaAnterior = ingresosAnterior - costosAnterior;
  const operativaActual = brutaActual - gastosActual;
  const operativaAnterior = brutaAnterior - gastosAnterior;
  const antesActual = operativaActual + otrosActual;
  const antesAnterior = operativaAnterior + otrosAnterior;
  const netaActual = antesActual - impuestosActual;
  const netaAnterior = antesAnterior - impuestosAnterior;

  const porcentajeActual = (valor: number) => calcularPorcentaje(Math.abs(valor), Math.abs(ingresosActual));
  const porcentajeAnterior = (valor: number) => calcularPorcentaje(Math.abs(valor), Math.abs(ingresosAnterior));
  const resumido = opciones.resumido === true;
  const busqueda = opciones.busqueda ?? "";

  const hoja = (cuenta: CuentaResultado, nivel: number): FilaReporte | null => {
    if (resumido) return null;
    if (!coincideBusqueda(cuenta.codigo, cuenta.nombre, busqueda)) return null;

    const signo = cuenta.tipo === "ingreso" ? 1 : -1;
    return crearFila({
      clave: `cuenta-${cuenta.codigo}`,
      clase: "detalle",
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      cuentaId: cuenta.cuentaId ?? opciones.cuentasPorCodigo?.get(cuenta.codigo) ?? null,
      nivel,
      contra: cuenta.tipo === "ingreso" && (cuenta.actual < 0 || cuenta.anterior < 0),
      actual: signo * cuenta.actual,
      anterior: signo * cuenta.anterior,
      porcentajeActual: porcentajeActual(cuenta.actual),
      porcentajeAnterior: porcentajeAnterior(cuenta.anterior),
      variacionEnMagnitud: cuenta.tipo !== "ingreso",
    });
  };

  const hojas = (destino: Destino, nivel: number): FilaReporte[] =>
    en(destino)
      .map((cuenta) => hoja(cuenta, nivel))
      .filter((fila): fila is FilaReporte => fila != null);

  const seccion = (config: Seccion): FilaReporte => {
    const miembros = config.destinos.flatMap(en);
    const actual = sumarSignado(miembros, "actual");
    const anterior = sumarSignado(miembros, "anterior");
    const soloGastos = miembros.every((cuenta) => cuenta.tipo !== "ingreso");

    return crearFila({
      clave: `seccion-${config.clave}`,
      clase: "grupo",
      nombre: config.nombre,
      nivel: 0,
      actual,
      anterior,
      porcentajeActual: porcentajeActual(actual),
      porcentajeAnterior: porcentajeAnterior(anterior),
      variacionEnMagnitud: soloGastos,
    });
  };

  const subgrupo = (config: Subgrupo): FilaReporte => {
    const miembros = en(config.destino);
    const actual = sumarSignado(miembros, "actual");
    const anterior = sumarSignado(miembros, "anterior");

    return crearFila({
      clave: `subgrupo-${config.clave}`,
      clase: "grupo",
      nombre: config.nombre,
      nivel: 1,
      actual,
      anterior,
      porcentajeActual: porcentajeActual(actual),
      porcentajeAnterior: porcentajeAnterior(anterior),
      variacionEnMagnitud: miembros.every((cuenta) => cuenta.tipo !== "ingreso"),
    });
  };

  const total = (clave: string, nombre: string, actual: number, anterior: number): FilaReporte =>
    crearFila({
      clave: `total-${clave}`,
      clase: "total",
      nombre,
      nivel: 0,
      actual,
      anterior,
      porcentajeActual: porcentajeActual(actual),
      porcentajeAnterior: porcentajeAnterior(anterior),
    });

  const hijosDeSeccion = (config: Seccion): FilaReporte[] => {
    if (resumido) return [];

    const filas: FilaReporte[] = [];
    for (const sub of SUBGRUPOS.filter((grupo) => grupo.seccion === config.clave)) {
      filas.push(subgrupo(sub), ...hojas(sub.destino, 2));
    }
    for (const destino of DESTINOS_HOJA.get(config.clave) ?? []) {
      filas.push(...hojas(destino, 1));
    }
    return filas;
  };

  const totalTras: Readonly<Record<string, FilaReporte>> = {
    costos: total("utilidad-bruta", "Utilidad bruta", brutaActual, brutaAnterior),
    "gastos-generales": total("utilidad-operativa", "Utilidad operativa", operativaActual, operativaAnterior),
    "otros-gastos": total("utilidad-antes-impuestos", "Utilidad antes de impuestos", antesActual, antesAnterior),
    impuestos: total("utilidad-neta", "Utilidad/pérdida neta", netaActual, netaAnterior),
  };

  const filas: FilaReporte[] = [];
  for (const config of SECCIONES) {
    filas.push(seccion(config), ...hijosDeSeccion(config));
    const despues = totalTras[config.clave];
    if (despues != null) filas.push(despues);
  }

  return { filas };
}
