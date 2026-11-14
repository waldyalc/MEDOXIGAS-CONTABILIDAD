import { centavos } from "../../dinero";
import { normalizar } from "./texto";
import type { DocumentoEstadoCuenta, FilaEstadoCuenta, FiltroVencimiento, TotalesEstadoCuenta } from "./tipos";

function aUtc(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

export function diferenciaDias(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86400000);
}

export function calcularEstadoCuenta(filas: readonly FilaEstadoCuenta[], corte: string): DocumentoEstadoCuenta[] {
  const documentos = filas.map((fila) => {
    const total = centavos(fila.total);
    const cobrado = centavos(fila.cobrado);
    const retenido = centavos(fila.retenido);
    const saldo = total - cobrado - retenido;
    const estado: DocumentoEstadoCuenta["estado"] = saldo > 0 ? "Pendiente" : "Cobrada";

    return {
      facturaId: fila.facturaId,
      documento: fila.ncf ?? `#${fila.numero}`,
      creacion: fila.fecha,
      vencimiento: fila.vencimiento,
      antiguedad: Math.max(0, diferenciaDias(fila.fecha, corte)),
      diasVencidos: Math.max(0, diferenciaDias(fila.vencimiento, corte)),
      estado,
      moneda: "DOP" as const,
      total,
      retenido,
      cobrado,
      saldo,
    };
  });

  return documentos.sort(
    (a, b) => b.creacion.localeCompare(a.creacion) || b.documento.localeCompare(a.documento, "es", { numeric: true }),
  );
}

function cumpleVencimiento(documento: DocumentoEstadoCuenta, filtro: FiltroVencimiento): boolean {
  switch (filtro) {
    case "sin-vencer":
      return documento.diasVencidos === 0;
    case "1-30":
      return documento.diasVencidos >= 1 && documento.diasVencidos <= 30;
    case "31-60":
      return documento.diasVencidos >= 31 && documento.diasVencidos <= 60;
    case "61-90":
      return documento.diasVencidos >= 61 && documento.diasVencidos <= 90;
    case "91-mas":
      return documento.diasVencidos >= 91;
    default:
      return true;
  }
}

export function filtrarDocumentos(
  documentos: readonly DocumentoEstadoCuenta[],
  vencimiento: FiltroVencimiento,
  busqueda: string,
): DocumentoEstadoCuenta[] {
  const texto = normalizar(busqueda);

  return documentos.filter((documento) => {
    if (!cumpleVencimiento(documento, vencimiento)) return false;
    if (texto === "") return true;
    return normalizar(documento.documento).includes(texto);
  });
}

export function resumirEstadoCuenta(documentos: readonly DocumentoEstadoCuenta[]): TotalesEstadoCuenta {
  return documentos.reduce<TotalesEstadoCuenta>(
    (totales, documento) => ({
      totalVentas: totales.totalVentas + documento.total,
      retenciones: totales.retenciones + documento.retenido,
      totalCobrado: totales.totalCobrado + documento.cobrado,
      saldoPorCobrar: totales.saldoPorCobrar + documento.saldo,
    }),
    { totalVentas: 0, retenciones: 0, totalCobrado: 0, saldoPorCobrar: 0 },
  );
}
