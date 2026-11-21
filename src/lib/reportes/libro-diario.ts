import { centavos } from "./dinero";
import type { FilaLibroDiario } from "./tipos";

export const ETIQUETAS_ORIGEN: Record<string, string> = {
  factura: "Factura",
  pago_recibido: "Pago recibido",
  factura_proveedor: "Factura de proveedor",
  pago_proveedor: "Pago a proveedor",
  gasto_menor: "Gasto menor",
  manual: "Manual",
  saldo_inicial: "Saldos iniciales",
  anulacion: "Anulación",
  nota_credito_venta: "Nota de crédito de venta",
  nota_credito_compra: "Nota de crédito de compra",
  nota_debito: "Nota de débito",
  transferencia: "Transferencia",
  deposito: "Depósito",
  conciliacion: "Conciliación",
  ajuste_inventario: "Ajuste de inventario",
  inventario_inicial: "Inventario inicial",
  pos_movimiento: "Movimiento de caja POS",
  pos_diferencia: "Diferencia de cierre POS",
  nomina: "Nómina",
  pago_nomina: "Pago de nómina",
};

export interface LineaLibroDiario {
  clave: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  debito: number;
  credito: number;
}

export interface AsientoLibroDiario {
  numero: number;
  fecha: string;
  descripcion: string;
  origenTipo: string;
  lineas: LineaLibroDiario[];
  totalDebito: number;
  totalCredito: number;
}

export interface TotalesLibroDiario {
  debitos: number;
  creditos: number;
}

export function agruparLibroDiario(filas: readonly FilaLibroDiario[]): AsientoLibroDiario[] {
  const porNumero = new Map<number, AsientoLibroDiario>();

  for (const fila of filas) {
    let asiento = porNumero.get(fila.asiento_numero);

    if (asiento == null) {
      asiento = {
        numero: fila.asiento_numero,
        fecha: fila.fecha,
        descripcion: fila.asiento_descripcion ?? "",
        origenTipo: fila.origen_tipo,
        lineas: [],
        totalDebito: 0,
        totalCredito: 0,
      };
      porNumero.set(fila.asiento_numero, asiento);
    }

    const debito = centavos(fila.debito);
    const credito = centavos(fila.credito);

    asiento.lineas.push({
      clave: `${fila.asiento_numero}-${asiento.lineas.length}`,
      cuentaCodigo: fila.cuenta_codigo,
      cuentaNombre: fila.cuenta_nombre,
      debito,
      credito,
    });
    asiento.totalDebito += debito;
    asiento.totalCredito += credito;
  }

  return [...porNumero.values()].sort((a, b) => a.numero - b.numero);
}

export function totalesLibroDiario(asientos: readonly AsientoLibroDiario[]): TotalesLibroDiario {
  return asientos.reduce<TotalesLibroDiario>(
    (totales, asiento) => ({
      debitos: totales.debitos + asiento.totalDebito,
      creditos: totales.creditos + asiento.totalCredito,
    }),
    { debitos: 0, creditos: 0 },
  );
}

export function etiquetaOrigen(origen: string): string {
  return ETIQUETAS_ORIGEN[origen] ?? origen;
}
