import { calcularLinea, centavosAValor, valorACentavos } from "@/lib/facturacion/calculo";

import type { ResultadoKardex } from "./kardex";
import type { ProductoTipo } from "./productos";

export interface CuentaResumen {
  id: string;
  codigo: string;
  nombre: string;
}

export interface ProductoFicha {
  id: string;
  nombre: string;
  referencia: string | null;
  descripcion: string | null;
  tipo: ProductoTipo;
  inventariable: boolean;
  precio: number;
  itbis_tasa: number;
  costo: number;
  cantidad: number;
  cuentaIngresoId: string | null;
  cuentaInventarioId: string | null;
  cuentaCostoId: string | null;
}

export interface CuentasFicha {
  ingreso: CuentaResumen | null;
  inventario: CuentaResumen | null;
  costo: CuentaResumen | null;
}

export interface DocumentoFicha {
  id: string;
  numero: number;
  ncf: string | null;
  contactoId: string;
  contactoNombre: string;
  fecha: string;
  vencimiento: string;
  cantidad: number;
  total: number;
  pagado: number;
  estado: string;
}

export interface FichaProducto {
  producto: ProductoFicha;
  cuentas: CuentasFicha;
  facturasVenta: DocumentoFicha[];
  facturasCompra: DocumentoFicha[];
  kardex: ResultadoKardex;
}

export interface DocumentoNumerado {
  numero: number;
  ncf: string | null;
}

export function precioConItbis(precio: number, itbisTasa: number): number {
  const linea = calcularLinea({
    cantidad: 1,
    precioCentavos: valorACentavos(precio),
    itbisTasa,
  });

  return centavosAValor(linea.totalCentavos);
}

export function saldoCentavos(total: number, pagado: number): number {
  return Math.max(0, valorACentavos(total) - valorACentavos(pagado));
}

export function sumarCantidades(cantidades: readonly number[]): number {
  const centesimas = cantidades.reduce(
    (suma, cantidad) => suma + (Number.isFinite(cantidad) ? Math.round(cantidad * 100) : 0),
    0,
  );

  return Number((centesimas / 100).toFixed(2));
}

export function filtrarPorNumero<T extends DocumentoNumerado>(documentos: readonly T[], filtro: string): T[] {
  const termino = filtro.trim().toLowerCase();
  if (termino === "") return [...documentos];

  return documentos.filter((documento) => {
    const ncf = documento.ncf?.toLowerCase() ?? "";
    return String(documento.numero).includes(termino) || ncf.includes(termino);
  });
}
