import { describe, expect, test } from "vitest";

import { conContactoActual, type DocumentoOrigen, prellenarDocumento } from "./prellenado";

const ORIGEN: DocumentoOrigen = {
  contacto_id: "contacto-1",
  fecha: "2026-11-01",
  vencimiento: "2026-11-10",
  notas: "Nota original",
  terminos: "Contado",
  lineas: [
    { producto_id: "producto-1", cantidad: 2.5, precio: 650, descuento_pct: 10, itbis_tasa: 18 },
    { producto_id: null, cantidad: 1, precio: 99.5, descuento_pct: 0, itbis_tasa: 0 },
  ],
};

describe("prellenarDocumento", () => {
  test("copia cliente, notas, términos y líneas al formulario", () => {
    const valores = prellenarDocumento(ORIGEN, "2026-11-15");

    expect(valores.clienteId).toBe("contacto-1");
    expect(valores.notas).toBe("Nota original");
    expect(valores.terminos).toBe("Contado");
    expect(valores.lineas).toEqual([
      {
        clave: "l1",
        productoId: "producto-1",
        cantidad: "2.5",
        precio: "650.00",
        descuentoPct: "10",
        itbisTasa: "18",
      },
      {
        clave: "l2",
        productoId: "",
        cantidad: "1",
        precio: "99.50",
        descuentoPct: "0",
        itbisTasa: "0",
      },
    ]);
  });

  test("clonar usa la fecha de hoy y conserva el tipo de comprobante", () => {
    const valores = prellenarDocumento({ ...ORIGEN, tipo_comprobante: "01" }, "2026-11-15");

    expect(valores.fecha).toBe("2026-11-15");
    expect(valores.vencimiento).toBe("2026-11-15");
    expect(valores.tipoComprobante).toBe("01");
  });

  test("editar conserva las fechas del documento", () => {
    const valores = prellenarDocumento(ORIGEN, "2026-11-15", { conservarFechas: true });

    expect(valores.fecha).toBe("2026-11-01");
    expect(valores.vencimiento).toBe("2026-11-10");
  });

  test("documento sin notas ni términos deja los campos vacíos", () => {
    const valores = prellenarDocumento({ ...ORIGEN, notas: null, terminos: null }, "2026-11-15");

    expect(valores.notas).toBe("");
    expect(valores.terminos).toBe("");
    expect(valores.tipoComprobante).toBeUndefined();
  });

  test("documento sin líneas deja una línea vacía", () => {
    const valores = prellenarDocumento({ ...ORIGEN, lineas: [] }, "2026-11-15");

    expect(valores.lineas).toHaveLength(1);
    expect(valores.lineas[0]?.productoId).toBe("");
  });
});

describe("conContactoActual", () => {
  test("agrega el contacto del documento si ya no está activo", () => {
    const contactos = [{ id: "otro" }];
    expect(conContactoActual(contactos, { id: "contacto-1" })).toEqual([{ id: "contacto-1" }, { id: "otro" }]);
  });

  test("no duplica el contacto si ya está en la lista", () => {
    const contactos = [{ id: "contacto-1" }, { id: "otro" }];
    expect(conContactoActual(contactos, { id: "contacto-1" })).toHaveLength(2);
  });
});
