import type { ParametrosFecha } from "../fechas";

export const TIPOS_REGISTRO = [
  { valor: "factura", etiqueta: "Facturas de venta" },
  { valor: "pago_recibido", etiqueta: "Recibos de caja" },
  { valor: "factura_proveedor", etiqueta: "Facturas de proveedor" },
  { valor: "pago_proveedor", etiqueta: "Comprobantes de egreso" },
  { valor: "gasto_menor", etiqueta: "Gastos menores" },
  { valor: "manual", etiqueta: "Comprobantes contables" },
  { valor: "anulacion", etiqueta: "Anulaciones" },
] as const;

export const ETIQUETAS_DOCUMENTO: Record<string, string> = {
  factura: "Factura de venta",
  pago_recibido: "Recibo de caja",
  factura_proveedor: "Factura de proveedor",
  pago_proveedor: "Comprobante de egreso",
  gasto_menor: "Gasto menor",
  manual: "Comprobante contable",
  anulacion: "Anulación",
};

export const VALORES_TIPO_REGISTRO: readonly string[] = TIPOS_REGISTRO.map((tipo) => tipo.valor);

export type ParametrosReporte = ParametrosFecha;

export type ValorParametro = string | number | boolean | null | undefined | readonly string[];

export function leerTexto(valor: string | string[] | undefined): string | null {
  const texto = Array.isArray(valor) ? valor[valor.length - 1] : valor;
  const limpio = texto?.trim();
  return limpio ? limpio : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function leerUuid(valor: string | string[] | undefined): string | null {
  const texto = leerTexto(valor);
  return texto && UUID.test(texto) ? texto : null;
}

export function leerCodigoCuenta(valor: string | string[] | undefined): string | null {
  const texto = leerTexto(valor);
  return texto && /^\d+$/.test(texto) ? texto : null;
}

export function leerLista(valor: string | string[] | undefined): string[] {
  if (valor == null) return [];
  const lista = Array.isArray(valor) ? valor : [valor];
  return [...new Set(lista.map((item) => item.trim()).filter(Boolean))];
}

export function leerBooleano(valor: string | string[] | undefined): boolean {
  const texto = leerTexto(valor)?.toLowerCase();
  return texto === "1" || texto === "true" || texto === "on" || texto === "si";
}

export function leerEntero(
  valor: string | string[] | undefined,
  defecto: number,
  minimo: number,
  maximo: number,
): number {
  const texto = leerTexto(valor);
  const numero = texto == null ? Number.NaN : Number.parseInt(texto, 10);
  if (!Number.isFinite(numero)) return defecto;
  return Math.min(Math.max(numero, minimo), maximo);
}

export function normalizarOrigenes(valor: string | string[] | undefined): string[] {
  return leerLista(valor).filter((origen) => VALORES_TIPO_REGISTRO.includes(origen));
}

export function construirUrl(ruta: string, parametros: Record<string, ValorParametro>): string {
  const busqueda = new URLSearchParams();

  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor == null || valor === "" || valor === false) continue;

    if (Array.isArray(valor)) {
      for (const item of valor) {
        if (item) busqueda.append(clave, item);
      }
      continue;
    }

    busqueda.set(clave, valor === true ? "1" : String(valor));
  }

  const texto = busqueda.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}
