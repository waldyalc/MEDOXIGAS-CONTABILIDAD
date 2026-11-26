import type { ContactoBuscado } from "@/lib/contactos/seleccion";
import type { Empresa } from "@/lib/facturacion/tipos";
import type { Numeracion } from "@/lib/numeraciones/tipos";

import { centavosATexto, centavosDeDecimal, type PagoPOSArmado, sumarMontos } from "./calculo";
import type {
  Decimal,
  LineaVenta,
  MetodoPagoDB,
  MetodoPOS,
  PagoVenta,
  PlantillaTicket,
  VentaPOSResultado,
} from "./tipos";

/**
 * Construye una `VentaPOSResultado` completa en el dispositivo para que una
 * venta local-first use exactamente el mismo modal «¡Venta completada!», el
 * mismo ticket térmico (`armarTicketFactura`) y el mismo PDF Carta
 * (`armarCartaFactura`) que una venta ya confirmada por el servidor.
 */

export interface EntradaVentaLocalResultado {
  id: string;
  ncf: string;
  numeracion: Pick<Numeracion, "tipo_comprobante" | "vence">;
  fecha: string;
  creadoEn: string;
  terminal: {
    id: string;
    nombre: string;
    plantilla_ticket: PlantillaTicket;
    cuenta_efectivo_id: string;
    cuenta_tarjeta_debito_id: string | null;
    cuenta_tarjeta_credito_id: string | null;
    cuenta_transferencia_id: string | null;
  };
  turno: { id: string; numero: number };
  empresa: Empresa | null;
  cliente: ContactoBuscado & { direccion?: string | null; telefono?: string | null };
  vendedor: { id: string; nombre: string } | null;
  cuentas: readonly { id: string; nombre: string }[];
  lineas: LineaVenta[];
  pagos: readonly PagoPOSArmado[];
  totales: {
    subtotal: Decimal;
    descuento: Decimal;
    itbis: Decimal;
    total: Decimal;
  };
  notas: string | null;
}

function metodoDbDe(metodo: MetodoPOS): MetodoPagoDB {
  if (metodo === "efectivo") return "efectivo";
  if (metodo === "transferencia") return "transferencia";
  return "tarjeta";
}

function cuentaDePago(pago: PagoPOSArmado, terminal: EntradaVentaLocalResultado["terminal"]): string {
  if (pago.cuenta_id) return pago.cuenta_id;
  if (pago.metodo === "efectivo") return terminal.cuenta_efectivo_id;
  if (pago.metodo === "tarjeta_credito") {
    return terminal.cuenta_tarjeta_credito_id ?? terminal.cuenta_tarjeta_debito_id ?? terminal.cuenta_efectivo_id;
  }
  if (pago.metodo === "tarjeta_debito") {
    return terminal.cuenta_tarjeta_debito_id ?? terminal.cuenta_tarjeta_credito_id ?? terminal.cuenta_efectivo_id;
  }
  return terminal.cuenta_transferencia_id ?? terminal.cuenta_efectivo_id;
}

function centavos(monto: string | null | undefined): number {
  return centavosDeDecimal(monto) ?? 0;
}

export function armarVentaLocalResultado(entrada: EntradaVentaLocalResultado): VentaPOSResultado {
  const {
    id,
    ncf,
    numeracion,
    fecha,
    creadoEn,
    terminal,
    turno,
    empresa,
    cliente,
    vendedor,
    cuentas,
    lineas,
    pagos,
    totales,
    notas,
  } = entrada;

  const efectivoRecibido = sumarMontos(
    pagos.filter((pago) => pago.metodo === "efectivo").map((pago) => pago.monto_recibido ?? pago.monto),
  );
  const efectivoAplicado = sumarMontos(pagos.filter((pago) => pago.metodo === "efectivo").map((pago) => pago.monto));
  const cambio = centavosATexto(Math.max(0, centavos(efectivoRecibido) - centavos(efectivoAplicado)));
  const totalPagado = sumarMontos(pagos.map((pago) => pago.monto));
  const saldo = centavosATexto(Math.max(0, centavos(totales.total) - centavos(totalPagado)));

  let cambioAsignado = false;
  const pagosMapeados: PagoVenta[] = pagos.map((pago, indice) => {
    const cuentaId = cuentaDePago(pago, terminal);
    const cuentaNombre = cuentas.find((cuenta) => cuenta.id === cuentaId)?.nombre ?? null;
    const cambioFila = pago.metodo === "efectivo" && !cambioAsignado ? cambio : "0.00";
    if (pago.metodo === "efectivo") cambioAsignado = true;
    return {
      id: `${id}-pago-${indice + 1}`,
      numero: 0,
      fecha,
      metodo: metodoDbDe(pago.metodo),
      metodo_pos: pago.metodo,
      cuenta_id: cuentaId,
      cuenta_nombre: cuentaNombre,
      monto: pago.monto,
      monto_recibido: pago.monto_recibido ?? pago.monto,
      cambio: cambioFila,
      estado: "aplicado",
    };
  });

  const montoRecibidoFactura = centavos(efectivoRecibido) > 0 ? efectivoRecibido : totalPagado;

  return {
    factura: {
      id,
      numero: 0,
      ncf,
      tipo_comprobante: numeracion.tipo_comprobante,
      fecha,
      vencimiento: fecha,
      estado: centavos(saldo) > 0 ? "abierta" : "pagada",
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      itbis: totales.itbis,
      otros_impuestos: "0.00",
      propina: "0.00",
      total: totales.total,
      pagado: totalPagado,
      retenido: "0.00",
      credito: saldo,
      saldo,
      monto_recibido: montoRecibidoFactura,
      cambio,
      notas,
      terminos: null,
      pie: null,
      origen: "pos",
      turno_id: turno.id,
      almacen_id: null,
      vendedor_id: vendedor?.id ?? null,
      centro_costo_id: null,
      asiento_id: null,
      creado_en: creadoEn,
    },
    contacto: {
      id: cliente.id,
      nombre: cliente.nombre,
      rnc_cedula: cliente.rnc_cedula,
      direccion: cliente.direccion ?? null,
      telefono: cliente.telefono ?? null,
      correo: null,
      tipo_identificacion: null,
      lista_precio_id: null,
      limite_credito: null,
    },
    empresa: empresa
      ? {
          id: empresa.id,
          nombre: empresa.nombre,
          rnc: empresa.rnc,
          direccion: empresa.direccion,
          telefono: empresa.telefono,
          correo: empresa.correo,
          logo_url: empresa.logo_url,
        }
      : null,
    terminal: {
      id: terminal.id,
      nombre: terminal.nombre,
      plantilla_ticket: terminal.plantilla_ticket,
    },
    turno: {
      id: turno.id,
      numero: turno.numero,
      base_inicial: "0.00",
    },
    cajero: null,
    vendedor,
    almacen: null,
    lista_precio: null,
    lineas,
    pagos: pagosMapeados,
    impuestos: [],
    totales: {
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      itbis: totales.itbis,
      otros_impuestos: "0.00",
      propina: "0.00",
      total: totales.total,
      pagado: totalPagado,
      retenido: "0.00",
      credito: saldo,
      saldo,
      monto_recibido: montoRecibidoFactura,
      cambio,
    },
    ncf_vence: numeracion.vence,
  };
}
