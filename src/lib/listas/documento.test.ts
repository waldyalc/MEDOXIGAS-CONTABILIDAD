import { describe, expect, test } from "vitest";

import { condicionesDocumento } from "./documento";

describe("condicionesDocumento", () => {
  test("sin término no filtra nada", () => {
    expect(condicionesDocumento({ q: "" })).toBeNull();
    expect(condicionesDocumento({ q: "   " })).toBeNull();
  });

  test("un número busca el número exacto del documento", () => {
    expect(condicionesDocumento({ q: "15236" })).toBe("numero.eq.15236");
    expect(condicionesDocumento({ q: "#15236" })).toBe("numero.eq.15236");
  });

  test("un texto busca en el NCF y suma contactos y facturas ya resueltos", () => {
    expect(
      condicionesDocumento({
        q: "B0100001234",
        idsContactos: ["contacto-1", "contacto-2"],
        idsFacturas: ["factura-1"],
      }),
    ).toBe('ncf.ilike."%B0100001234%",contacto_id.in.(contacto-1,contacto-2),factura_id.in.(factura-1)');
  });

  test("limpia comillas y barras del término de texto", () => {
    expect(condicionesDocumento({ q: 'a"b\\c' })).toBe('ncf.ilike."%a b c%"');
  });

  test("pagos no tiene columna de texto: solo filtra por los ids resueltos", () => {
    expect(condicionesDocumento({ q: "Pérez", campos: { texto: "" } })).toBeNull();
    expect(
      condicionesDocumento({
        q: "Pérez",
        idsContactos: ["contacto-1"],
        idsFacturas: ["factura-1"],
        campos: { texto: "" },
      }),
    ).toBe("contacto_id.in.(contacto-1),factura_id.in.(factura-1)");
  });

  test("permite cambiar el nombre de las columnas", () => {
    expect(
      condicionesDocumento({
        q: "ZZTEST",
        idsFacturas: ["factura-1"],
        campos: { texto: "ncf", factura: "factura_proveedor_id" },
      }),
    ).toBe('ncf.ilike."%ZZTEST%",factura_proveedor_id.in.(factura-1)');
  });
});
