import { calcularRetenciones, type RetencionCalculo, totalRetenido } from "@/lib/retenciones/calculo";

import type { MetodoPago } from "./tipos";

export interface FacturaPago {
  id: string;
  numero: number;
  ncf: string | null;
  contacto_id: string;
  vencimiento: string;
  subtotal: number;
  itbis: number;
  total: number;
  pagado: number;
  credito: number;
  retenido: number;
}

export interface LineaOtroPago {
  clave: string;
  cuentaId: string;
  descripcion: string;
  monto: string;
  itbisTasa: string;
  observacion: string;
}

export type PestanaPago = "facturas" | "otros";

export const TAMANO_PAGINA_FACTURAS = 8;

export function saldoPendiente(factura: Pick<FacturaPago, "total" | "pagado" | "credito" | "retenido">): number {
  const total = Number(factura.total) || 0;
  const pagado = Number(factura.pagado) || 0;
  const credito = Number(factura.credito) || 0;
  const retenido = Number(factura.retenido) || 0;
  return Math.max(0, Math.round((total - pagado - credito - retenido) * 100) / 100);
}

export function retenidoDeFactura(
  ids: readonly string[],
  catalogo: readonly RetencionCalculo[],
  factura: Pick<FacturaPago, "subtotal" | "itbis">,
): number {
  return totalRetenido(calcularRetenciones(ids, catalogo, { subtotal: factura.subtotal, itbis: factura.itbis }));
}

export function filtroFacturas(facturas: readonly FacturaPago[], busqueda: string): FacturaPago[] {
  const texto = busqueda.trim().toLowerCase();
  if (!texto) return [...facturas];
  return facturas.filter((factura) => {
    const numero = String(factura.numero).toLowerCase();
    const ncf = (factura.ncf ?? "").toLowerCase();
    return numero.includes(texto) || ncf.includes(texto);
  });
}

export function paginaDe<T>(items: readonly T[], pagina: number, tamano = TAMANO_PAGINA_FACTURAS): T[] {
  const inicio = Math.max(0, pagina - 1) * tamano;
  return items.slice(inicio, inicio + tamano);
}

export function totalPaginas(cantidad: number, tamano = TAMANO_PAGINA_FACTURAS): number {
  return Math.max(1, Math.ceil(cantidad / tamano));
}

export function totalLineaOtroCentavos(linea: LineaOtroPago): number {
  const monto = Math.round((Number(linea.monto.replace(",", ".")) || 0) * 100);
  if (monto <= 0) return 0;
  const tasa = Number(linea.itbisTasa) || 0;
  return monto + Math.round((monto * tasa) / 100);
}

export function totalOtrosCentavos(lineas: readonly LineaOtroPago[]): number {
  return lineas.reduce((total, linea) => total + totalLineaOtroCentavos(linea), 0);
}

export interface FilaValidacionPago {
  factura: FacturaPago;
  monto: string;
  retenciones: readonly string[];
}

export interface EntradaValidacionPago {
  tipo: "recibido" | "proveedor";
  contactoId: string;
  cuentaId: string;
  fecha: string;
  metodo: MetodoPago;
  pestana: PestanaPago;
  filas: readonly FilaValidacionPago[];
  otros: readonly LineaOtroPago[];
  retenciones: readonly RetencionCalculo[];
}

function textoMonto(valor: string): number | null {
  const limpio = valor.trim().replace(/\s/g, "").replace(/,/g, "");
  if (limpio === "") return 0;
  if (!/^\d{1,15}(\.\d{1,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio) * 100);
}

function validarFilasFacturas(entrada: EntradaValidacionPago): string | null {
  let conMonto = 0;

  for (const fila of entrada.filas) {
    const montoCentavos = textoMonto(fila.monto);
    if (montoCentavos == null) return `El monto de la factura #${fila.factura.numero} no es válido.`;
    if (montoCentavos === 0) continue;

    const retenidoCentavos = Math.round(retenidoDeFactura(fila.retenciones, entrada.retenciones, fila.factura) * 100);
    const disponibleCentavos = Math.round(saldoPendiente(fila.factura) * 100);

    if (montoCentavos + retenidoCentavos > disponibleCentavos) {
      return `El monto más las retenciones supera lo pendiente de la factura #${fila.factura.numero}.`;
    }

    conMonto += 1;
  }

  if (conMonto === 0) {
    return entrada.tipo === "recibido"
      ? "Agrega el monto recibido a al menos una factura."
      : "Agrega el monto pagado a al menos una factura.";
  }

  return null;
}

function validarOtros(entrada: EntradaValidacionPago): string | null {
  const conMonto = entrada.otros.filter((linea) => (textoMonto(linea.monto) ?? 0) > 0);
  if (conMonto.length === 0) {
    return entrada.tipo === "recibido" ? "Agrega al menos un ingreso." : "Agrega al menos un egreso.";
  }

  for (const linea of conMonto) {
    if (textoMonto(linea.monto) == null) return "Uno de los montos no es válido.";
    if (!linea.cuentaId) {
      return entrada.tipo === "recibido" ? "Selecciona la cuenta del ingreso." : "Selecciona la cuenta del egreso.";
    }
  }

  return null;
}

export function validarPago(entrada: EntradaValidacionPago): string | null {
  const documento = entrada.tipo === "recibido" ? "cliente" : "proveedor";

  if (!entrada.contactoId) return `Selecciona un ${documento}.`;
  if (!entrada.cuentaId) return "Selecciona la cuenta de caja o banco.";
  if (!entrada.fecha) return "Selecciona la fecha del pago.";

  return entrada.pestana === "facturas" ? validarFilasFacturas(entrada) : validarOtros(entrada);
}
