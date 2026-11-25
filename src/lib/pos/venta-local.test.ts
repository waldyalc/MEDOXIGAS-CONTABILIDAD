import { describe, expect, it } from "vitest";

import { armarCartaFactura, armarTicketFactura } from "./impresion";
import { PLANTILLA_TICKET_DEFECTO } from "./tipos";
import { armarVentaLocalResultado } from "./venta-local";

const ENTRADA_BASE = {
  id: "11111111-1111-4111-8111-111111111111",
  ncf: "B0200000145",
  numeracion: { tipo_comprobante: "02", vence: "2027-12-31" },
  fecha: "2026-11-24",
  creadoEn: "2026-11-24T17:46:00.000Z",
  terminal: {
    id: "term-1",
    nombre: "Terminal SANDY URBAEZ",
    plantilla_ticket: PLANTILLA_TICKET_DEFECTO,
    cuenta_efectivo_id: "cta-caja",
    cuenta_tarjeta_debito_id: null,
    cuenta_tarjeta_credito_id: "cta-tarjeta",
    cuenta_transferencia_id: "cta-bhd",
  },
  turno: { id: "turno-12", numero: 12 },
  empresa: {
    id: 1,
    nombre: "MEDOXIGAS ALC, SRL",
    rnc: "130893489",
    direccion: "Santo Domingo",
    telefono: "809-555-0000",
    correo: "info@medoxigas.com",
    logo_url: null,
  },
  cliente: {
    id: "cli-1",
    nombre: "ARIAS MONTES DE OCA CONSTRUCTIONS SRL",
    rnc_cedula: "131234567",
    direccion: "Av. Principal #10",
    telefono: "809-555-1111",
  },
  vendedor: { id: "vend-1", nombre: "Sandy Urbaez" },
  cuentas: [
    { id: "cta-caja", nombre: "Caja general" },
    { id: "cta-tarjeta", nombre: "Banco BHD Tarjeta" },
    { id: "cta-bhd", nombre: "BANCO BHD" },
  ],
  lineas: [
    {
      id: "lin-1",
      producto_id: "prod-1",
      producto_nombre: "ALAMBRE DULCE EN ROLLO",
      referencia: "ALA-01",
      descripcion: "ALAMBRE DULCE EN ROLLO",
      cantidad: "2",
      unidad_id: null,
      unidad_nombre: "Unidad",
      factor_base: null,
      precio: "64.99",
      descuento_pct: "0",
      itbis_tasa: "0",
      impuesto_id: null,
      subtotal: "129.98",
      itbis: "0.00",
      total: "129.98",
    },
  ],
  pagos: [{ metodo: "efectivo" as const, monto: "129.98", monto_recibido: "200.00" }],
  totales: { subtotal: "129.98", descuento: "0.00", itbis: "0.00", total: "129.98" },
  notas: null,
};

describe("venta local-first (resultado y ticket oficial sin POS-LOCAL)", () => {
  it("arma una VentaPOSResultado lista para ConfirmacionVenta, TicketPos oficial y PDF Carta", () => {
    const venta = armarVentaLocalResultado(ENTRADA_BASE);

    expect(venta.factura.ncf).toBe("B0200000145");
    expect(venta.factura.numero).toBe(0);
    expect(venta.factura.cambio).toBe("70.02");
    expect(venta.factura.monto_recibido).toBe("200.00");
    expect(venta.ncf_vence).toBe("2027-12-31");

    const ticket = armarTicketFactura(venta, PLANTILLA_TICKET_DEFECTO);
    expect(ticket.encabezado.titulo).toBe("Factura de Consumo");
    expect(ticket.encabezado.lineas).toContain("NCF B0200000145");
    expect(ticket.encabezado.lineas).toContain("Tipo de pago: Contado");
    expect(ticket.encabezado.lineas).toContain("Método de pago: Efectivo");
    expect(ticket.encabezado.lineas.join("\n")).not.toContain("POS-LOCAL");
    expect(ticket.pagos).toEqual([
      { etiqueta: "Total recibido", valor: "RD$200.00" },
      { etiqueta: "Cambio", valor: "RD$70.02" },
    ]);

    const carta = armarCartaFactura(venta, { mostrarLogo: false });
    expect(carta.factura.ncf).toBe("B0200000145");
    expect(carta.factura.total).toBe(129.98);
  });

  it("imprime «Método de pago: Tarjeta» unificado y respeta el banco destino en transferencia", () => {
    const tarjeta = armarVentaLocalResultado({
      ...ENTRADA_BASE,
      pagos: [{ metodo: "tarjeta_credito", monto: "129.98", cuenta_id: "cta-tarjeta" }],
    });
    expect(armarTicketFactura(tarjeta, PLANTILLA_TICKET_DEFECTO).encabezado.lineas).toContain(
      "Método de pago: Tarjeta",
    );

    const transferencia = armarVentaLocalResultado({
      ...ENTRADA_BASE,
      pagos: [{ metodo: "transferencia", monto: "129.98", cuenta_id: "cta-bhd" }],
    });
    expect(transferencia.pagos[0]?.cuenta_id).toBe("cta-bhd");
    expect(transferencia.pagos[0]?.cuenta_nombre).toBe("BANCO BHD");
    expect(armarTicketFactura(transferencia, PLANTILLA_TICKET_DEFECTO).encabezado.lineas).toContain(
      "Método de pago: Transferencia",
    );
  });
});
