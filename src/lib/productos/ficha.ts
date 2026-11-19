import { calcularLinea, centavosAValor, valorACentavos } from "@/lib/facturacion/calculo";
import type { ExistenciaAlmacen, TipoListaPrecio } from "@/lib/inventario/tipos";

import type { ResultadoKardex } from "./kardex";
import type { ProductoTipo } from "./productos";

export interface CuentaResumen {
  id: string;
  codigo: string;
  nombre: string;
}

export interface PrecioListaFicha {
  listaId: string;
  nombre: string;
  esPrincipal: boolean;
  tipo: TipoListaPrecio;
  precio: number | null;
}

export interface ProductoFicha {
  id: string;
  nombre: string;
  referencia: string | null;
  descripcion: string | null;
  tipo: ProductoTipo;
  categoriaNombre: string | null;
  activo: boolean;
  inventariable: boolean;
  precio: number;
  itbis_tasa: number;
  costo: number;
  cantidad: number;
  unidadMedida: string;
  almacenId: string | null;
  vendeNegativo: boolean;
  imagenPath: string | null;
  imagenUrl: string | null;
  precios: PrecioListaFicha[];
  cuentaIngresoId: string | null;
  cuentaInventarioId: string | null;
  cuentaCostoId: string | null;
}

export interface CuentaFicha {
  cuenta: CuentaResumen;
  porDefecto: boolean;
}

export interface CuentasFicha {
  ingreso: CuentaFicha | null;
  inventario: CuentaFicha | null;
  costo: CuentaFicha | null;
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
  credito: number;
  estado: string;
}

export interface DocumentoComercialFicha {
  id: string;
  numero: number;
  fecha: string;
  total: number;
  estado: string;
}

export interface FichaProducto {
  producto: ProductoFicha;
  cuentas: CuentasFicha;
  facturasVenta: DocumentoFicha[];
  facturasCompra: DocumentoFicha[];
  cotizaciones: DocumentoComercialFicha[];
  conduces: DocumentoComercialFicha[];
  existencias: ExistenciaAlmacen[];
  kardex: ResultadoKardex;
}

export interface DocumentoNumerado {
  numero: number;
  ncf?: string | null;
}

export function precioConItbis(precio: number, itbisTasa: number): number {
  const linea = calcularLinea({
    cantidad: 1,
    precioCentavos: valorACentavos(precio),
    itbisTasa,
  });

  return centavosAValor(linea.totalCentavos);
}

export function saldoCentavos(total: number, pagado: number, credito = 0): number {
  return Math.max(0, valorACentavos(total) - valorACentavos(pagado) - valorACentavos(credito));
}

export function sumarCantidades(cantidades: readonly number[]): number {
  const centesimas = cantidades.reduce(
    (suma, cantidad) => suma + (Number.isFinite(cantidad) ? Math.round(cantidad * 100) : 0),
    0,
  );

  return Number((centesimas / 100).toFixed(2));
}

export function elegirCuenta(
  cuentaPropiaId: string | null,
  clavePorDefecto: string | null,
  cuentas: ReadonlyMap<string, CuentaResumen>,
  configuracion: ReadonlyMap<string, string>,
): CuentaFicha | null {
  const usarPorDefecto = cuentaPropiaId === null;
  const cuentaId = cuentaPropiaId ?? (clavePorDefecto === null ? null : (configuracion.get(clavePorDefecto) ?? null));
  if (cuentaId === null) return null;

  const cuenta = cuentas.get(cuentaId);
  if (!cuenta) return null;

  return { cuenta, porDefecto: usarPorDefecto };
}

export function resolverCuentasFicha(
  producto: Pick<ProductoFicha, "tipo" | "inventariable" | "cuentaIngresoId" | "cuentaInventarioId" | "cuentaCostoId">,
  configuracion: ReadonlyMap<string, string>,
  cuentas: ReadonlyMap<string, CuentaResumen>,
): CuentasFicha {
  return {
    ingreso: elegirCuenta(
      producto.cuentaIngresoId,
      producto.tipo === "servicio" ? "ventas_servicios" : "ventas",
      cuentas,
      configuracion,
    ),
    inventario: elegirCuenta(
      producto.cuentaInventarioId,
      producto.inventariable ? "inventario" : null,
      cuentas,
      configuracion,
    ),
    costo: elegirCuenta(producto.cuentaCostoId, "costo_ventas", cuentas, configuracion),
  };
}

export function filtrarPorNumero<T extends DocumentoNumerado>(documentos: readonly T[], filtro: string): T[] {
  const termino = filtro.trim().toLowerCase();
  if (termino === "") return [...documentos];

  return documentos.filter((documento) => {
    const ncf = documento.ncf?.toLowerCase() ?? "";
    return String(documento.numero).includes(termino) || ncf.includes(termino);
  });
}

export function etiquetaEstadoComercial(estado: string): string {
  if (estado === "convertida") return "Convertida";
  if (estado === "anulada") return "Anulada";
  return "Abierta";
}
