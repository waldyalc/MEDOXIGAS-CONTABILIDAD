import { describe, expect, test } from "vitest";

import { calcularMovimientosBanco, type LineaBanco } from "./movimientos";

function linea(cambios: Partial<LineaBanco>): LineaBanco {
  return {
    id: "linea-1",
    asientoId: "asiento-1",
    asientoNumero: 1,
    fecha: "2026-11-01",
    descripcion: null,
    debito: 0,
    credito: 0,
    documento: { etiqueta: "Transferencia", href: null },
    tercero: null,
    ...cambios,
  };
}

const lineas: LineaBanco[] = [
  linea({ id: "a", fecha: "2026-11-01", asientoNumero: 1, debito: 1000 }),
  linea({ id: "b", fecha: "2026-11-02", asientoNumero: 2, credito: 400 }),
  linea({ id: "c", fecha: "2026-11-03", asientoNumero: 3, debito: 200 }),
];

describe("calcularMovimientosBanco", () => {
  test("acumula entrada y salida en el saldo", () => {
    const resultado = calcularMovimientosBanco(lineas);

    expect(resultado.movimientos.map((movimiento) => movimiento.saldoCentavos)).toEqual([100000, 60000, 80000]);
    expect(resultado.saldoCentavos).toBe(80000);
    expect(resultado.totalEntradasCentavos).toBe(120000);
    expect(resultado.totalSalidasCentavos).toBe(40000);
  });

  test("el filtro desde arrastra el saldo anterior pero no suma sus totales", () => {
    const resultado = calcularMovimientosBanco(lineas, "2026-11-02", "2026-11-03");

    expect(resultado.movimientos).toHaveLength(2);
    expect(resultado.movimientos[0]?.saldoCentavos).toBe(60000);
    expect(resultado.movimientos[1]?.saldoCentavos).toBe(80000);
    expect(resultado.totalEntradasCentavos).toBe(20000);
    expect(resultado.totalSalidasCentavos).toBe(40000);
  });

  test("el filtro hasta corta el saldo y los movimientos posteriores", () => {
    const resultado = calcularMovimientosBanco(lineas, undefined, "2026-11-02");

    expect(resultado.movimientos).toHaveLength(2);
    expect(resultado.saldoCentavos).toBe(60000);
  });

  test("conserva el documento y el tercero de la línea", () => {
    const resultado = calcularMovimientosBanco([
      linea({
        documento: { etiqueta: "Factura #7", href: "/dashboard/facturacion/1" },
        tercero: { id: "contacto-1", nombre: "Cliente" },
      }),
    ]);

    expect(resultado.movimientos[0]?.documento.etiqueta).toBe("Factura #7");
    expect(resultado.movimientos[0]?.tercero?.nombre).toBe("Cliente");
  });
});
