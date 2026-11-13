import type { TablaReporte } from "@/lib/reportes/exportar/tipos";

import type { DetalleImpuesto, DocumentoFiscal } from "./tipos";

export interface CasillasIt1 {
  totalOperaciones: number;
  noGravadas: number;
  gravadas18: number;
  gravadas16: number;
  totalGravadas: number;
  itbisCobrado18: number;
  itbisCobrado16: number;
  totalItbisCobrado: number;
  itbisComprasLocales: number;
  itbisServicios: number;
  itbisImportaciones: number;
  totalItbisDeducible: number;
  impuestosAPagar: number;
  saldoAFavor: number;
  pagosComputables: number;
  totalAPagar: number;
  diferenciaAPagar: number;
  nuevoSaldoAFavor: number;
  totalGeneral: number;
  totalFacturadoConImpuestos: number;
}

function porTasa(detalles: readonly DetalleImpuesto[], tasa: number, campo: "base" | "impuesto"): number {
  return detalles.reduce((total, detalle) => {
    if (detalle.tasa == null || Math.round(detalle.tasa) !== tasa) return total;
    return total + detalle[campo];
  }, 0);
}

export function calcularIt1(
  ventas: readonly DetalleImpuesto[],
  comprasDeducibles: readonly DocumentoFiscal[],
  totalFacturadoConImpuestos?: number,
): CasillasIt1 {
  const totalOperaciones = ventas.reduce((total, detalle) => total + detalle.base, 0);
  const gravadas18 = porTasa(ventas, 18, "base");
  const gravadas16 = porTasa(ventas, 16, "base");
  const itbisCobrado18 = porTasa(ventas, 18, "impuesto");
  const itbisCobrado16 = porTasa(ventas, 16, "impuesto");
  const totalItbisCobrado = ventas.reduce((total, detalle) => total + detalle.impuesto, 0);

  let itbisComprasLocales = 0;
  let itbisServicios = 0;

  for (const compra of comprasDeducibles) {
    const base = compra.baseBienes + compra.baseServicios;
    if (base <= 0 || compra.baseServicios <= 0) {
      itbisComprasLocales += compra.itbis;
      continue;
    }

    const bienes = Math.round((compra.itbis * compra.baseBienes) / base);
    itbisComprasLocales += bienes;
    itbisServicios += compra.itbis - bienes;
  }

  const itbisImportaciones = 0;
  const totalItbisDeducible = itbisComprasLocales + itbisServicios + itbisImportaciones;
  const impuestosAPagar = Math.max(totalItbisCobrado - totalItbisDeducible, 0);
  const saldoAFavor = Math.max(totalItbisDeducible - totalItbisCobrado, 0);
  const pagosComputables = 0;
  const totalAPagar = impuestosAPagar;
  const diferenciaAPagar = Math.max(totalAPagar - pagosComputables, 0);

  return {
    totalOperaciones,
    noGravadas: totalOperaciones - gravadas18 - gravadas16,
    gravadas18,
    gravadas16,
    totalGravadas: gravadas18 + gravadas16,
    itbisCobrado18,
    itbisCobrado16,
    totalItbisCobrado,
    itbisComprasLocales,
    itbisServicios,
    itbisImportaciones,
    totalItbisDeducible,
    impuestosAPagar,
    saldoAFavor,
    pagosComputables,
    totalAPagar,
    diferenciaAPagar,
    nuevoSaldoAFavor: saldoAFavor,
    totalGeneral: diferenciaAPagar,
    totalFacturadoConImpuestos: totalFacturadoConImpuestos ?? totalOperaciones + totalItbisCobrado,
  };
}

/** Fecha límite del IT-1: día 20 del mes siguiente al período (AAAAMM). */
export function fechaLimiteIt1(periodo: string): string {
  const anio = Number(periodo.slice(0, 4));
  const mes = Number(periodo.slice(4, 6));
  if (!anio || !mes) return "";

  const siguiente = new Date(Date.UTC(anio, mes, 1));
  const anioTexto = siguiente.getUTCFullYear();
  const mesTexto = String(siguiente.getUTCMonth() + 1).padStart(2, "0");
  return `${anioTexto}-${mesTexto}-20`;
}

export function tablaIt1(casillas: CasillasIt1): TablaReporte {
  return {
    titulo: "IT-1",
    columnas: [
      { clave: "operacion", titulo: "Operaciones", tipo: "texto" },
      { clave: "monto", titulo: "Monto", tipo: "dinero" },
    ],
    filas: [
      { celdas: { operacion: "1 Total de operaciones del período", monto: casillas.totalOperaciones } },
      { celdas: { operacion: "9 Total de ingresos por operaciones no gravadas", monto: casillas.noGravadas } },
      { celdas: { operacion: "10 Total de ingresos por operaciones gravadas", monto: casillas.totalGravadas } },
      { celdas: { operacion: "11 Operaciones gravadas al 18%", monto: casillas.gravadas18 } },
      { celdas: { operacion: "12 Operaciones gravadas al 16%", monto: casillas.gravadas16 } },
      { celdas: { operacion: "16 ITBIS cobrado 18%", monto: casillas.itbisCobrado18 } },
      { celdas: { operacion: "17 ITBIS cobrado 16%", monto: casillas.itbisCobrado16 } },
      { celdas: { operacion: "21 Total de ITBIS cobrado", monto: casillas.totalItbisCobrado } },
      { celdas: { operacion: "22 ITBIS pagado en compras locales", monto: casillas.itbisComprasLocales } },
      { celdas: { operacion: "23 ITBIS pagado por servicios deducibles", monto: casillas.itbisServicios } },
      { celdas: { operacion: "24 ITBIS pagado en importaciones", monto: casillas.itbisImportaciones } },
      { celdas: { operacion: "25 Total de ITBIS deducible", monto: casillas.totalItbisDeducible } },
      { celdas: { operacion: "26 Impuestos a pagar", monto: casillas.impuestosAPagar } },
      { celdas: { operacion: "27 Saldo a favor", monto: casillas.saldoAFavor } },
      { celdas: { operacion: "30 Pagos computables por retenciones", monto: casillas.pagosComputables } },
      { celdas: { operacion: "33 Diferencia a pagar", monto: casillas.diferenciaAPagar } },
      { celdas: { operacion: "34 Nuevo saldo a favor", monto: casillas.nuevoSaldoAFavor } },
      { celdas: { operacion: "38 Total a pagar", monto: casillas.totalAPagar } },
      { celdas: { operacion: "68 Total general", monto: casillas.totalGeneral }, estilo: "total" },
    ],
  };
}
