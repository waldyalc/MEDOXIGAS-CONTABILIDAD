import { describe, expect, it } from "vitest";

import { type EmpresaPOS, PLANTILLA_TICKET_DEFECTO, type PlantillaTicket } from "@/lib/pos/tipos";

import { armarTicketDeMuestra } from "./vista-previa-ticket";

/**
 * Candado del editor de ticket: la vista previa pasa por `impresion.ts`, así
 * que cada toggle de la plantilla tiene que verse en el payload. Si alguien
 * deja de respetar un toggle, este test lo dice antes de que Waldy lo vea en
 * el ticket impreso.
 */

const EMPRESA: EmpresaPOS = {
  id: 1,
  nombre: "Empresa de prueba",
  rnc: null,
  direccion: null,
  telefono: null,
  correo: null,
  logo_url: "https://example.com/logo.png",
};

function ticket(cambios: Partial<PlantillaTicket> = {}) {
  return armarTicketDeMuestra({
    empresa: EMPRESA,
    plantilla: { ...PLANTILLA_TICKET_DEFECTO, ...cambios },
    terminal: "Caja 1",
  });
}

describe("vista previa del ticket", () => {
  it("usa el ancho y el estilo de la plantilla", () => {
    const clasico = ticket();
    expect(clasico.diseno.ancho_mm).toBe(80);
    expect(clasico.diseno.estilo).toBe("clasico");
    expect(clasico.diseno.columnas).toBe("dos");

    const angosto = ticket({ ancho_mm: 57, estilo: "minimalista" });
    expect(angosto.diseno.ancho_mm).toBe(57);
    expect(angosto.diseno.columnas).toBe("apilada");
    expect(angosto.diseno.estilo).toBe("minimalista");
  });

  it("respeta logo, referencia, unidad y precio unitario", () => {
    const base = ticket();
    expect(base.diseno.mostrar_logo).toBe(true);
    expect(base.lineas.some((linea) => linea.referencia !== null)).toBe(false);
    expect(base.lineas.some((linea) => linea.detalle.includes("Caja 50 lb"))).toBe(true);
    expect(base.lineas.some((linea) => linea.precio_unitario !== null)).toBe(true);

    const apagados = ticket({
      mostrar_logo: false,
      mostrar_referencia: true,
      mostrar_unidad: false,
      mostrar_precio_unitario: false,
    });

    expect(apagados.diseno.mostrar_logo).toBe(false);
    expect(apagados.lineas.some((linea) => linea.referencia === "REF-002")).toBe(true);
    expect(apagados.lineas.some((linea) => linea.detalle.includes("Caja 50 lb"))).toBe(false);
    expect(apagados.lineas.every((linea) => linea.precio_unitario === null)).toBe(true);
  });

  it("con precios sin impuestos el unitario no lleva ITBIS", () => {
    const conItbis = ticket();
    const sinItbis = ticket({ precios_con_impuestos: false });

    expect(conItbis.lineas[0]?.precio_unitario).toBe("RD$ 295.00");
    expect(sinItbis.lineas[0]?.precio_unitario).toBe("RD$ 250.00");
    expect(conItbis.nota).toBe("ITBIS incluido");
    expect(sinItbis.nota).toBeNull();
  });

  it("el pie solo se imprime si la plantilla lo trae", () => {
    expect(ticket().pie).toBeNull();
    expect(ticket({ pie_ticket: "¡Gracias por su compra!" }).pie).toBe("¡Gracias por su compra!");
  });

  it("la cabecera usa la empresa y la terminal configuradas", () => {
    const payload = ticket();

    expect(payload.encabezado.empresa[0]).toBe("Empresa de prueba");
    expect(payload.encabezado.lineas).toContain("Terminal: Caja 1");
    expect(payload.encabezado.titulo).toBe("Factura de Consumo");
    expect(payload.anulada).toBe(false);
  });
});
