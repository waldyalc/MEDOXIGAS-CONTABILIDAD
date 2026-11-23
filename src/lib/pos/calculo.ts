/**
 * Aritmética exacta de los montos del POS.
 *
 * Los montos viajan como texto decimal y se convierten a centavos enteros
 * (`number` seguro hasta 2^53, muy por encima de `numeric(14,2)`) para
 * replicar el redondeo del motor (`round(..., 2)` de Postgres, mitad hacia
 * arriba en valores positivos) sin pasar por aritmética flotante de montos.
 * Se usa para la previsualización del carrito, para validar en Zod que los
 * pagos suman y para formatear tickets; nunca para guardar un monto.
 */

import type { Decimal, MetodoPOS } from "./tipos";

const DECIMAL_SIMPLE = /^(-?)(\d+)(?:\.(\d{1,4}))?$/;

/** Convierte un decimal a centavos exactos; `null` si el texto es inválido. */
export function centavosDeDecimal(valor: Decimal | null | undefined): number | null {
  if (valor == null) return null;

  const limpio = valor.trim().replace(/,/g, "");
  const coincidencia = DECIMAL_SIMPLE.exec(limpio);
  if (!coincidencia) return null;

  const signo = coincidencia[1] === "-" ? -1 : 1;
  const entero = Number(coincidencia[2] ?? "0");
  const fraccion = (coincidencia[3] ?? "").padEnd(4, "0");
  const milesimas = Number(fraccion.charAt(2));

  // La tercera posición (milésimas) decide el redondeo a dos: mitad arriba.
  const centavos = entero * 100 + Number(fraccion.slice(0, 2)) + (milesimas >= 5 ? 1 : 0);
  return Number.isSafeInteger(centavos) ? signo * centavos : null;
}

/** Convierte centavos exactos a texto decimal con dos posiciones. */
export function centavosATexto(centavos: number): Decimal {
  const redondeado = Math.round(centavos);
  const negativo = redondeado < 0;
  const absoluto = Math.abs(redondeado);
  const entero = Math.floor(absoluto / 100);
  const fraccion = String(absoluto % 100).padStart(2, "0");
  return `${negativo ? "-" : ""}${entero}.${fraccion}`;
}

/**
 * Cantidad sin los ceros de más que arrastra un monto: «3.00» → «3»,
 * «1.50» → «1.5», «1.25» → «1.25». El consumidor decide cómo mostrarla;
 * el carrito la guarda así para no reaparecer como «3.00».
 */
export function normalizarCantidad(valor: Decimal | null | undefined): Decimal {
  const centavos = centavosDeDecimal(valor);
  if (centavos === null) return "0";

  const signo = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  const entero = Math.floor(absoluto / 100);
  const resto = absoluto % 100;
  if (resto === 0) return `${signo}${entero}`;

  const fraccion = String(resto).padStart(2, "0").replace(/0$/, "");
  return `${signo}${entero}.${fraccion}`;
}

/** División entera con redondeo mitad hacia arriba (valores del POS ≥ 0). */
function dividirRedondeando(numerador: number, denominador: number): number {
  if (denominador === 0) return 0;

  const negativo = numerador < 0 !== denominador < 0;
  const absolutoNumerador = Math.abs(numerador);
  const absolutoDenominador = Math.abs(denominador);
  const redondeado = Math.floor((absolutoNumerador * 2 + absolutoDenominador) / (absolutoDenominador * 2));

  return negativo ? -redondeado : redondeado;
}

/** Suma exacta de montos de texto; los inválidos se tratan como cero. */
export function sumarMontos(valores: readonly (Decimal | null | undefined)[]): Decimal {
  let total = 0;

  for (const valor of valores) {
    total += centavosDeDecimal(valor) ?? 0;
  }

  return centavosATexto(total);
}

/**
 * Compara dos montos: negativo si `a < b`, cero si son iguales y positivo si
 * `a > b`. Un valor inválido cuenta como cero.
 */
export function compararMontos(a: Decimal | null | undefined, b: Decimal | null | undefined): number {
  const centavosA = centavosDeDecimal(a) ?? 0;
  const centavosB = centavosDeDecimal(b) ?? 0;
  return centavosA - centavosB;
}

/** `porcentaje` con hasta dos decimales expresado en puntos base (18 → 1800). */
function puntosBase(porcentaje: Decimal | null | undefined): number {
  return centavosDeDecimal(porcentaje) ?? 0;
}

export interface TotalesLineaPOS {
  /** `cantidad × precio` redondeado a 2. */
  bruto: Decimal;
  descuento: Decimal;
  /** `bruto − descuento`. */
  subtotal: Decimal;
  itbis: Decimal;
  /** `subtotal + itbis`. */
  total: Decimal;
  bruto_centavos: number;
  descuento_centavos: number;
  subtotal_centavos: number;
  itbis_centavos: number;
  total_centavos: number;
}

/**
 * Réplica exacta de `crear_factura` por línea:
 * `bruto = round(cantidad × precio, 2)`, `descuento = round(bruto × pct/100, 2)`,
 * `subtotal = bruto − descuento`, `itbis = round(subtotal × tasa/100, 2)`.
 */
export function calcularLineaPOS(entrada: {
  cantidad: Decimal;
  precio: Decimal;
  descuento_pct?: Decimal | null;
  itbis_tasa?: Decimal | null;
}): TotalesLineaPOS {
  const cantidad = centavosDeDecimal(entrada.cantidad) ?? 0;
  const precio = centavosDeDecimal(entrada.precio) ?? 0;
  const bruto = dividirRedondeando(cantidad * precio, 100);
  const descuento = dividirRedondeando(bruto * puntosBase(entrada.descuento_pct), 10000);
  const subtotal = bruto - descuento;
  const itbis = dividirRedondeando(subtotal * puntosBase(entrada.itbis_tasa), 10000);
  const total = subtotal + itbis;

  return {
    bruto: centavosATexto(bruto),
    descuento: centavosATexto(descuento),
    subtotal: centavosATexto(subtotal),
    itbis: centavosATexto(itbis),
    total: centavosATexto(total),
    bruto_centavos: bruto,
    descuento_centavos: descuento,
    subtotal_centavos: subtotal,
    itbis_centavos: itbis,
    total_centavos: total,
  };
}

export interface TotalesCarritoPOS {
  subtotal: Decimal;
  descuento: Decimal;
  itbis: Decimal;
  total: Decimal;
}

/** Suma de líneas ya calculadas; sirve para la previsualización del carrito. */
export function sumarTotalesLineasPOS(
  lineas: readonly { subtotal: Decimal; descuento: Decimal; itbis: Decimal; total: Decimal }[],
): TotalesCarritoPOS {
  return {
    subtotal: sumarMontos(lineas.map((linea) => linea.subtotal)),
    descuento: sumarMontos(lineas.map((linea) => linea.descuento)),
    itbis: sumarMontos(lineas.map((linea) => linea.itbis)),
    total: sumarMontos(lineas.map((linea) => linea.total)),
  };
}

/**
 * Precio unitario con ITBIS incluido para el ticket: `round(precio × (1 + tasa/100), 2)`.
 * Solo presentación; no cambia el monto guardado.
 */
export function precioConImpuesto(precio: Decimal, tasa: Decimal | null | undefined): Decimal {
  const precioCentavos = centavosDeDecimal(precio) ?? 0;
  const itbis = dividirRedondeando(precioCentavos * puntosBase(tasa), 10000);
  return centavosATexto(precioCentavos + itbis);
}

/** Fila del cobro combinado del POS. El método puede repetirse entre filas. */
export interface FilaPagoCombinadoPOS {
  metodo: MetodoPOS;
  monto: Decimal;
  /** Solo efectivo: lo que entrega el cliente. */
  recibido?: Decimal | null;
}

export interface TotalesPagoCombinadoPOS {
  /** Suma de los montos aplicados; cada fila repetida cuenta aparte. */
  aplicado: Decimal;
  /** `total − aplicado`, nunca negativo. */
  porCobrar: Decimal;
  /** Cambio total del efectivo; cero cuando la venta queda a crédito. */
  cambio: Decimal;
  /** La venta queda total o parcialmente por cobrar. */
  hayCredito: boolean;
  /** La suma aplicada supera el total de la venta. */
  excede: boolean;
  /** Hay una fila sin monto o con efectivo recibido menor al aplicado sin crédito. */
  invalido: boolean;
}

/**
 * Matemática del cobro combinado con filas repetidas (dos efectivos, dos
 * transferencias…). Replica el motor: el cambio es la suma de lo recibido en
 * efectivo menos lo aplicado en efectivo, y solo existe si no queda crédito.
 */
export function calcularTotalesCombinadoPOS(
  filas: readonly FilaPagoCombinadoPOS[],
  total: Decimal,
): TotalesPagoCombinadoPOS {
  let aplicadoCentavos = 0;
  let efectivoAplicadoCentavos = 0;
  let efectivoRecibidoCentavos = 0;

  for (const fila of filas) {
    const montoCentavos = centavosDeDecimal(fila.monto) ?? 0;
    aplicadoCentavos += montoCentavos;

    if (fila.metodo === "efectivo") {
      efectivoAplicadoCentavos += montoCentavos;
      efectivoRecibidoCentavos += Math.max(0, centavosDeDecimal(fila.recibido) ?? 0);
    }
  }

  const totalCentavos = Math.max(0, centavosDeDecimal(total) ?? 0);
  const porCobrarCentavos = Math.max(0, totalCentavos - aplicadoCentavos);
  const hayCredito = porCobrarCentavos > 0;

  return {
    aplicado: centavosATexto(aplicadoCentavos),
    porCobrar: centavosATexto(porCobrarCentavos),
    cambio: hayCredito ? "0.00" : centavosATexto(Math.max(0, efectivoRecibidoCentavos - efectivoAplicadoCentavos)),
    hayCredito,
    excede: aplicadoCentavos > totalCentavos,
    invalido: hayFilaCombinadaInvalida(filas, hayCredito),
  };
}

/** Fila sin monto, o efectivo que no cubre lo aplicado cuando no queda crédito. */
function hayFilaCombinadaInvalida(filas: readonly FilaPagoCombinadoPOS[], hayCredito: boolean): boolean {
  return filas.some((fila) => {
    const montoCentavos = centavosDeDecimal(fila.monto) ?? 0;
    if (montoCentavos <= 0) return true;
    if (hayCredito || fila.metodo !== "efectivo") return false;
    return (centavosDeDecimal(fila.recibido) ?? 0) < montoCentavos;
  });
}

/** Pago listo para el payload de `pos_completar_venta`. */
export interface PagoPOSArmado {
  metodo: MetodoPOS;
  monto: Decimal;
  monto_recibido?: Decimal;
}

/**
 * Arma un pago por fila, sin fusionar métodos repetidos. En efectivo,
 * `monto_recibido` es lo entregado por el cliente y no baja del monto aplicado;
 * si la venta queda a crédito se envía igual al monto (no hay cambio).
 */
export function armarPagosCombinadoPOS(filas: readonly FilaPagoCombinadoPOS[], hayCredito: boolean): PagoPOSArmado[] {
  return filas
    .filter((fila) => (centavosDeDecimal(fila.monto) ?? 0) > 0)
    .map((fila) => {
      const montoCentavos = centavosDeDecimal(fila.monto) ?? 0;
      const monto = centavosATexto(montoCentavos);

      if (fila.metodo !== "efectivo") return { metodo: fila.metodo, monto };

      const recibidoCentavos = Math.max(0, centavosDeDecimal(fila.recibido) ?? 0);
      return {
        metodo: "efectivo" as const,
        monto,
        monto_recibido: hayCredito ? monto : centavosATexto(Math.max(montoCentavos, recibidoCentavos)),
      };
    });
}
