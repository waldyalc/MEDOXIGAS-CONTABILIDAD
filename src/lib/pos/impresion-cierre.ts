import { formatoMoneda } from "@/lib/facturacion/formato";
import { centavosATexto, centavosDeDecimal } from "@/lib/pos/calculo";
import type { CierreTurnoPOS, TerminalPOS } from "@/lib/pos/tipos";

export type CuentasTarjetaCierre = Pick<TerminalPOS, "id" | "cuenta_tarjeta_debito_id" | "cuenta_tarjeta_credito_id">;

function moneda(monto: string): string {
  return formatoMoneda(monto).replace(/\s/g, "");
}

function fecha(valor: string): string {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(valor));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("day")}/${parte("month")}/${parte("year")} ${Number(parte("hour"))}:${parte("minute")} ${parte("dayPeriod").toLowerCase()}`;
}

export function prepararCierre(datos: CierreTurnoPOS, terminales: CuentasTarjetaCierre[]) {
  const { turno, resumen } = datos;
  const terminal = terminales.find((t) => t.id === turno.terminal_id);
  const debito = terminal?.cuenta_tarjeta_debito_id;
  const credito = terminal?.cuenta_tarjeta_credito_id;
  const porCuenta = (id: string) =>
    resumen.ventas.por_cuenta
      .filter((c) => c.metodo === "tarjeta" && c.cuenta_id === id)
      .reduce((total, c) => total + (centavosDeDecimal(c.monto) ?? 0), 0);
  const separable =
    debito &&
    credito &&
    debito !== credito &&
    porCuenta(debito) + porCuenta(credito) === centavosDeDecimal(resumen.ventas.por_metodo.tarjeta);
  const tarjetas = separable
    ? {
        debito: moneda(centavosATexto(porCuenta(debito))),
        credito: moneda(centavosATexto(porCuenta(credito))),
      }
    : null;
  return {
    numero: turno.numero,
    inicio: fecha(turno.abierto_en),
    fin: turno.cerrado_en ? fecha(turno.cerrado_en) : "-",
    ventas: moneda(resumen.ventas.total),
    base: moneda(resumen.efectivo.base_inicial),
    efectivo: moneda(resumen.ventas.por_metodo.efectivo),
    tarjetas:
      centavosDeDecimal(resumen.ventas.por_metodo.tarjeta) === 0
        ? { debito: moneda("0.00"), credito: moneda("0.00") }
        : tarjetas,
    tarjeta: moneda(resumen.ventas.por_metodo.tarjeta),
    transferencias: moneda(resumen.ventas.por_metodo.transferencia),
    devoluciones: moneda(resumen.devoluciones.efectivo),
    retiros:
      (centavosDeDecimal(resumen.retiros.total) ?? 0) > 0
        ? `(-${moneda(resumen.retiros.total)})`
        : moneda(resumen.retiros.total),
    movimientos: moneda(resumen.efectivo.efectivo_esperado),
    contado: moneda(resumen.efectivo.efectivo_real ?? resumen.efectivo.efectivo_esperado),
    observaciones: turno.observaciones?.trim() || "-",
  };
}

export type PresentacionCierre = ReturnType<typeof prepararCierre>;
