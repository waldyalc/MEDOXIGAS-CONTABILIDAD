export type TipoRetencion = "itbis" | "isr";

export interface RetencionCalculo {
  id: string;
  nombre: string;
  tipo: TipoRetencion;
  porcentaje: number;
}

export interface BaseRetencion {
  subtotal: number | string;
  itbis: number | string;
}

export interface RetencionCalculada {
  retencion: RetencionCalculo;
  base: number;
  monto: number;
}

function aCentavos(valor: number | string | null | undefined): number {
  if (valor == null || valor === "") return 0;
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(numero * 100);
}

/** ITBIS se retiene sobre el ITBIS de la factura; ISR sobre el subtotal neto. */
export function baseDeRetencion(retencion: Pick<RetencionCalculo, "tipo">, base: BaseRetencion): number {
  return retencion.tipo === "itbis" ? aCentavos(base.itbis) : aCentavos(base.subtotal);
}

export function montoDeRetencion(
  retencion: Pick<RetencionCalculo, "tipo" | "porcentaje">,
  base: BaseRetencion,
): number {
  return Math.round((baseDeRetencion(retencion, base) * retencion.porcentaje) / 100);
}

export function calcularRetenciones(
  seleccionadas: readonly string[],
  catalogo: readonly RetencionCalculo[],
  base: BaseRetencion,
): RetencionCalculada[] {
  const porId = new Map(catalogo.map((retencion) => [retencion.id, retencion]));
  const vistas = new Set<string>();
  const filas: RetencionCalculada[] = [];

  for (const id of seleccionadas) {
    if (vistas.has(id)) continue;
    const retencion = porId.get(id);
    if (retencion == null) continue;
    vistas.add(id);
    filas.push({
      retencion,
      base: baseDeRetencion(retencion, base) / 100,
      monto: montoDeRetencion(retencion, base) / 100,
    });
  }

  return filas;
}

export function totalRetenido(filas: readonly Pick<RetencionCalculada, "monto">[]): number {
  return filas.reduce((total, fila) => total + Math.round(fila.monto * 100), 0) / 100;
}

export function etiquetaTipoRetencion(tipo: TipoRetencion): string {
  return tipo === "itbis" ? "ITBIS" : "ISR";
}
