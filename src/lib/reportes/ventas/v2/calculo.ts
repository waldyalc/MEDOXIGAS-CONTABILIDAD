import { centavos } from "@/lib/reportes/dinero";
import type { ParametrosFecha } from "@/lib/reportes/fechas";

import type {
  FilaRentabilidadProducto,
  FilaVentaProducto,
  LineaVenta,
  TotalesRentabilidad,
  TotalesVentas,
} from "./tipos";

interface GrupoVenta {
  clave: string;
  productoId: string | null;
  nombre: string;
  referencia: string | null;
  cantidad: number;
  antes: number;
  despues: number;
}

interface GrupoRentabilidad {
  clave: string;
  productoId: string | null;
  nombre: string;
  referencia: string | null;
  totalVendido: number;
  costoTotal: number;
}

function normalizar(texto: string): string {
  return texto.trim().toLocaleLowerCase("es");
}

function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizarBusqueda(texto: string): string {
  return sinAcentos(texto).toLocaleLowerCase("es").trim();
}

function redondearCantidad(cantidad: number): number {
  return Math.round(cantidad * 100) / 100;
}

function nombreDeLinea(linea: LineaVenta): string {
  const nombre = linea.nombre.trim();
  return nombre === "" ? "Sin descripción" : nombre;
}

function referenciaDeLinea(linea: LineaVenta): string | null {
  const referencia = linea.referencia?.trim() ?? "";
  return referencia === "" ? null : referencia;
}

function claveDeLinea(linea: LineaVenta): string {
  return linea.productoId ?? `desc:${normalizar(linea.nombre)}`;
}

function costoLinea(linea: LineaVenta): number {
  // Usa el costo histórico guardado en factura_lineas.costo_unitario.
  return Math.round(Number(linea.cantidad) * Number(linea.costoUnitario) * 100);
}

function ordenar<T extends { nombre: string }>(filas: T[], monto: (fila: T) => number): T[] {
  return filas.sort((a, b) => monto(b) - monto(a) || a.nombre.localeCompare(b.nombre, "es"));
}

export function agruparVentasPorProducto(lineas: readonly LineaVenta[]): FilaVentaProducto[] {
  const grupos = new Map<string, GrupoVenta>();

  for (const linea of lineas) {
    const clave = claveDeLinea(linea);
    const grupo = grupos.get(clave);

    if (grupo) {
      grupo.cantidad += Number(linea.cantidad);
      grupo.antes += centavos(linea.subtotal);
      grupo.despues += centavos(linea.total);
      grupo.referencia ??= referenciaDeLinea(linea);
      continue;
    }

    grupos.set(clave, {
      clave,
      productoId: linea.productoId,
      nombre: nombreDeLinea(linea),
      referencia: referenciaDeLinea(linea),
      cantidad: Number(linea.cantidad),
      antes: centavos(linea.subtotal),
      despues: centavos(linea.total),
    });
  }

  const filas = [...grupos.values()].map<FilaVentaProducto>((grupo) => ({
    ...grupo,
    cantidad: redondearCantidad(grupo.cantidad),
  }));

  return ordenar(filas, (fila) => fila.antes);
}

export function resumirVentas(filas: readonly FilaVentaProducto[]): TotalesVentas {
  const totales = filas.reduce<TotalesVentas>(
    (acumulado, fila) => ({
      cantidad: acumulado.cantidad + fila.cantidad,
      antes: acumulado.antes + fila.antes,
      despues: acumulado.despues + fila.despues,
    }),
    { cantidad: 0, antes: 0, despues: 0 },
  );

  return { ...totales, cantidad: redondearCantidad(totales.cantidad) };
}

export function filtrarVentas(filas: readonly FilaVentaProducto[], busqueda: string): FilaVentaProducto[] {
  const termino = normalizarBusqueda(busqueda);

  if (termino === "") return [...filas];

  return filas.filter(
    (fila) =>
      normalizarBusqueda(fila.nombre).includes(termino) || normalizarBusqueda(fila.referencia ?? "").includes(termino),
  );
}

export function agruparRentabilidad(lineas: readonly LineaVenta[]): FilaRentabilidadProducto[] {
  const grupos = new Map<string, GrupoRentabilidad>();

  for (const linea of lineas) {
    const clave = claveDeLinea(linea);
    const grupo = grupos.get(clave);

    if (grupo) {
      grupo.totalVendido += centavos(linea.subtotal);
      grupo.costoTotal += costoLinea(linea);
      grupo.referencia ??= referenciaDeLinea(linea);
      continue;
    }

    grupos.set(clave, {
      clave,
      productoId: linea.productoId,
      nombre: nombreDeLinea(linea),
      referencia: referenciaDeLinea(linea),
      totalVendido: centavos(linea.subtotal),
      costoTotal: costoLinea(linea),
    });
  }

  const filas = [...grupos.values()].map<FilaRentabilidadProducto>((grupo) => {
    const rentabilidad = grupo.totalVendido - grupo.costoTotal;
    const porcentaje = grupo.totalVendido > 0 ? Math.round((rentabilidad / grupo.totalVendido) * 10000) / 100 : 0;

    return { ...grupo, rentabilidad, porcentaje };
  });

  return ordenar(filas, (fila) => fila.totalVendido);
}

export function resumirRentabilidad(filas: readonly FilaRentabilidadProducto[]): TotalesRentabilidad {
  return filas.reduce<TotalesRentabilidad>(
    (acumulado, fila) => ({
      totalVendido: acumulado.totalVendido + fila.totalVendido,
      costoTotal: acumulado.costoTotal + fila.costoTotal,
      rentabilidad: acumulado.rentabilidad + fila.rentabilidad,
    }),
    { totalVendido: 0, costoTotal: 0, rentabilidad: 0 },
  );
}

export function paginar<T>(
  filas: readonly T[],
  pagina: number,
  tamano: number,
): { filas: T[]; pagina: number; totalPaginas: number } {
  const tamanoPagina = Math.max(1, Math.trunc(tamano));
  const totalPaginas = Math.max(1, Math.ceil(filas.length / tamanoPagina));
  const paginaActual = Math.min(Math.max(1, Math.trunc(pagina)), totalPaginas);
  const inicio = (paginaActual - 1) * tamanoPagina;

  return {
    filas: filas.slice(inicio, inicio + tamanoPagina),
    pagina: paginaActual,
    totalPaginas,
  };
}

export function parsearBusqueda(params: ParametrosFecha): string {
  const valor = params.q;
  const texto = Array.isArray(valor) ? valor[0] : valor;

  return (texto ?? "").trim().slice(0, 100);
}

export function parsearPagina(params: ParametrosFecha): number {
  const valor = Array.isArray(params.pagina) ? params.pagina[0] : params.pagina;
  const pagina = Number(valor);

  return Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
}
