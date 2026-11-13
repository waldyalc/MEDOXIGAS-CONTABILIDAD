import { centavosAValor, valorACentavos } from "@/lib/facturacion/calculo";

export type KardexTipo = "venta" | "compra";

export interface MovimientoKardex {
  tipo: KardexTipo;
  documentoId: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  creadoEn: string;
  terceroId: string;
  terceroNombre: string;
  cantidad: number;
  costoUnitario: number;
}

export interface FilaKardex {
  tipo: KardexTipo;
  documentoId: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  terceroId: string;
  terceroNombre: string;
  entrada: number;
  salida: number;
  costoUnitario: number;
  existencia: number;
}

export interface ResultadoKardex {
  existenciaInicial: number;
  filas: FilaKardex[];
}

interface GrupoKardex {
  tipo: KardexTipo;
  documentoId: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  creadoEn: string;
  terceroId: string;
  terceroNombre: string;
  cantidadCentesimas: number;
  importeCentavos: number;
}

function claveGrupo(movimiento: MovimientoKardex) {
  return `${movimiento.tipo}:${movimiento.documentoId}`;
}

function cantidadACentesimas(cantidad: number) {
  return Number.isFinite(cantidad) ? Math.round(cantidad * 100) : 0;
}

function centesimasACantidad(centesimas: number) {
  return Number((centesimas / 100).toFixed(2));
}

function agruparMovimientos(movimientos: readonly MovimientoKardex[]): GrupoKardex[] {
  const grupos = new Map<string, GrupoKardex>();

  for (const movimiento of movimientos) {
    const cantidadCentesimas = cantidadACentesimas(movimiento.cantidad);
    const clave = claveGrupo(movimiento);
    const existente = grupos.get(clave);

    if (existente) {
      existente.cantidadCentesimas += cantidadCentesimas;
      existente.importeCentavos += cantidadCentesimas * valorACentavos(movimiento.costoUnitario);
      continue;
    }

    grupos.set(clave, {
      tipo: movimiento.tipo,
      documentoId: movimiento.documentoId,
      numero: movimiento.numero,
      ncf: movimiento.ncf,
      fecha: movimiento.fecha,
      creadoEn: movimiento.creadoEn,
      terceroId: movimiento.terceroId,
      terceroNombre: movimiento.terceroNombre,
      cantidadCentesimas,
      importeCentavos: cantidadCentesimas * valorACentavos(movimiento.costoUnitario),
    });
  }

  return [...grupos.values()].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      a.creadoEn.localeCompare(b.creadoEn) ||
      a.documentoId.localeCompare(b.documentoId) ||
      a.tipo.localeCompare(b.tipo),
  );
}

export function construirKardex(existenciaActual: number, movimientos: readonly MovimientoKardex[]): ResultadoKardex {
  const grupos = agruparMovimientos(movimientos);
  const entradas = grupos.reduce((suma, grupo) => suma + (grupo.tipo === "compra" ? grupo.cantidadCentesimas : 0), 0);
  const salidas = grupos.reduce((suma, grupo) => suma + (grupo.tipo === "venta" ? grupo.cantidadCentesimas : 0), 0);

  let existencia = cantidadACentesimas(existenciaActual) - entradas + salidas;
  const existenciaInicial = existencia;

  const filas = grupos.map<FilaKardex>((grupo) => {
    const entrada = grupo.tipo === "compra" ? grupo.cantidadCentesimas : 0;
    const salida = grupo.tipo === "venta" ? grupo.cantidadCentesimas : 0;
    existencia += entrada - salida;

    const costoCentavos =
      grupo.cantidadCentesimas === 0 ? 0 : Math.round(grupo.importeCentavos / grupo.cantidadCentesimas);

    return {
      tipo: grupo.tipo,
      documentoId: grupo.documentoId,
      numero: grupo.numero,
      ncf: grupo.ncf,
      fecha: grupo.fecha,
      terceroId: grupo.terceroId,
      terceroNombre: grupo.terceroNombre,
      entrada: centesimasACantidad(entrada),
      salida: centesimasACantidad(salida),
      costoUnitario: centavosAValor(costoCentavos),
      existencia: centesimasACantidad(existencia),
    };
  });

  return { existenciaInicial: centesimasACantidad(existenciaInicial), filas };
}
