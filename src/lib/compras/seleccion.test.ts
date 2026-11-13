import { describe, expect, it } from "vitest";

import { elegirCuentaPagoPorDefecto, facturasAbiertasDeProveedor, saldoFactura } from "./seleccion";
import type { CuentaOpcion, FacturaAbierta } from "./tipos";

function factura(cambios: Partial<FacturaAbierta> & Pick<FacturaAbierta, "id">): FacturaAbierta {
  return {
    numero: 1,
    ncf: null,
    fecha: "2026-11-01",
    vencimiento: "2026-11-30",
    total: 100,
    pagado: 0,
    contacto_id: "proveedor-1",
    contactos: null,
    ...cambios,
  };
}

function cuenta(cambios: Partial<CuentaOpcion> & Pick<CuentaOpcion, "id" | "codigo">): CuentaOpcion {
  return {
    nombre: `Cuenta ${cambios.codigo}`,
    tipo: "activo",
    es_caja_banco: true,
    ...cambios,
  };
}

describe("saldoFactura", () => {
  it("redondea el saldo al centavo", () => {
    expect(saldoFactura(factura({ id: "f1", total: 100.1, pagado: 33.333 }))).toBe(66.77);
    expect(saldoFactura(factura({ id: "f2", total: 150.5, pagado: 150.5 }))).toBe(0);
  });
});

describe("facturasAbiertasDeProveedor", () => {
  it("filtra solo las facturas del proveedor indicado", () => {
    const facturas = [
      factura({ id: "f1", contacto_id: "proveedor-1" }),
      factura({ id: "f2", contacto_id: "proveedor-2" }),
    ];

    expect(facturasAbiertasDeProveedor(facturas, "proveedor-1").map((item) => item.id)).toEqual(["f1"]);
  });

  it("excluye facturas sin saldo (pagadas o con pagos de más)", () => {
    const facturas = [
      factura({ id: "pagada", total: 100, pagado: 100 }),
      factura({ id: "excedida", total: 100, pagado: 120 }),
      factura({ id: "abierta", total: 100, pagado: 40 }),
    ];

    expect(facturasAbiertasDeProveedor(facturas, "proveedor-1").map((item) => item.id)).toEqual(["abierta"]);
  });

  it("devuelve una lista vacía cuando no hay proveedor seleccionado", () => {
    expect(facturasAbiertasDeProveedor([factura({ id: "f1" })], "")).toEqual([]);
  });
});

describe("elegirCuentaPagoPorDefecto", () => {
  it("prefiere la cuenta 1102 Banco principal", () => {
    const cuentas = [
      cuenta({ id: "caja", codigo: "1101" }),
      cuenta({ id: "banco", codigo: "1102" }),
      cuenta({ id: "otra", codigo: "1103" }),
    ];

    expect(elegirCuentaPagoPorDefecto(cuentas)).toBe("banco");
  });

  it("usa la primera cuenta de caja/banco si no existe la 1102", () => {
    const cuentas = [cuenta({ id: "caja", codigo: "1101" }), cuenta({ id: "otra", codigo: "1103" })];

    expect(elegirCuentaPagoPorDefecto(cuentas)).toBe("caja");
    expect(elegirCuentaPagoPorDefecto([])).toBe("");
  });
});
