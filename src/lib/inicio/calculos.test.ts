import { describe, expect, it } from "vitest";

import {
  agruparFlujo,
  agruparGastos,
  agruparTopClientes,
  agruparTopProductos,
  iniciales,
  variacionPct,
} from "./calculos";

const HASTA_ANTERIOR = "2026-10-31";

const FECHAS = new Map([
  ["a1", "2026-11-13"],
  ["a2", "2026-11-13"],
  ["a3", "2026-11-20"],
  ["a0", "2026-10-13"],
]);

describe("variacionPct", () => {
  it("devuelve null sin base anterior", () => {
    expect(variacionPct(100, 0)).toBeNull();
  });

  it("calcula el porcentaje con un decimal", () => {
    expect(variacionPct(110, 100)).toBe(10);
    expect(variacionPct(50, 100)).toBe(-50);
  });
});

describe("agruparFlujo", () => {
  const cajaBanco = new Set(["banco", "caja"]);

  it("suma débitos como ingresos y créditos como egresos por día", () => {
    const flujo = agruparFlujo(
      [
        { asientoId: "a1", cuentaId: "banco", debito: 1000, credito: 0 },
        { asientoId: "a2", cuentaId: "banco", debito: 0, credito: 400 },
        { asientoId: "a3", cuentaId: "caja", debito: 250, credito: 0 },
        // Una cuenta de gasto no entra al flujo de caja.
        { asientoId: "a1", cuentaId: "gasto", debito: 900, credito: 0 },
        // Movimientos del período anterior solo alimentan la comparación.
        { asientoId: "a0", cuentaId: "banco", debito: 500, credito: 100 },
      ],
      FECHAS,
      cajaBanco,
      HASTA_ANTERIOR,
    );

    expect(flujo.puntos).toEqual([
      { fecha: "2026-11-13", ingresos: 1000, egresos: 400 },
      { fecha: "2026-11-20", ingresos: 250, egresos: 0 },
    ]);
    expect(flujo.totalIngresos).toBe(1250);
    expect(flujo.totalEgresos).toBe(400);
    expect(flujo.variacionIngresos).toBe(150);
    expect(flujo.variacionEgresos).toBe(300);
  });

  it("sin movimientos devuelve listas vacías y variación null", () => {
    const flujo = agruparFlujo([], FECHAS, cajaBanco, HASTA_ANTERIOR);
    expect(flujo.puntos).toEqual([]);
    expect(flujo.variacionIngresos).toBeNull();
  });
});

describe("agruparGastos", () => {
  const gastos = new Set(["g1", "g2", "g3", "g4", "g5", "g6"]);
  const nombres = new Map([
    ["g1", "Combustibles"],
    ["g2", "Papelería"],
    ["g3", "Agua"],
    ["g4", "Fletes"],
    ["g5", "Sueldos"],
    ["g6", "Publicidad"],
  ]);

  const linea = (asientoId: string, cuentaId: string, debito: number, credito = 0) => ({
    asientoId,
    cuentaId,
    debito,
    credito,
  });

  it("toma el top 5 por valor neto y calcula participación", () => {
    const datos = agruparGastos(
      [
        linea("a1", "g1", 500),
        linea("a2", "g1", 0),
        linea("a2", "g2", 300),
        linea("a3", "g3", 250),
        linea("a3", "g4", 150),
        linea("a1", "g5", 100),
        linea("a1", "g6", 50),
        // Fuera de top: un gasto del período anterior no cuenta.
        linea("a0", "g1", 9999),
        // Cuenta que no es de gasto.
        linea("a1", "banco", 7777),
      ],
      FECHAS,
      gastos,
      nombres,
      HASTA_ANTERIOR,
    );

    expect(datos.total).toBe(1300);
    expect(datos.items).toHaveLength(5);
    expect(datos.items[0]).toMatchObject({ nombre: "Combustibles", valor: 500 });
    expect(datos.items[0]?.participacion).toBeCloseTo(38.46, 2);
    expect(datos.items.map((item) => item.nombre)).not.toContain("Publicidad");
  });

  it("ignora cuentas con saldo neto en cero o negativo", () => {
    const datos = agruparGastos(
      [linea("a1", "g1", 100, 100), linea("a2", "g2", 50, 200)],
      FECHAS,
      gastos,
      nombres,
      HASTA_ANTERIOR,
    );
    expect(datos.items).toEqual([]);
    expect(datos.total).toBe(0);
  });
});

describe("agruparTopProductos", () => {
  it("agrupa por producto, suma items y total, ordena por total y corta en 5", () => {
    const lineas = [
      {
        productoId: "p1",
        descripcion: "Varilla 3/8",
        cantidad: 20,
        total: 8968,
        nombreProducto: "Varilla 3/8",
        referenciaProducto: "v3",
      },
      {
        productoId: "p1",
        descripcion: "Varilla 3/8",
        cantidad: 2,
        total: 900,
        nombreProducto: "Varilla 3/8",
        referenciaProducto: "v3",
      },
      {
        productoId: "p2",
        descripcion: "Tubo PVC",
        cantidad: 10,
        total: 1770,
        nombreProducto: "Tubo PVC",
        referenciaProducto: null,
      },
      {
        productoId: null,
        descripcion: "Servicio",
        cantidad: 1,
        total: 500,
        nombreProducto: null,
        referenciaProducto: null,
      },
    ];

    const top = agruparTopProductos(lineas);

    expect(top[0]).toEqual({ nombre: "Varilla 3/8", referencia: "v3", items: 22, total: 9868 });
    expect(top[1]).toEqual({ nombre: "Tubo PVC", referencia: null, items: 10, total: 1770 });
    // Las líneas sin producto usan su descripción como nombre.
    expect(top[2]).toEqual({ nombre: "Servicio", referencia: null, items: 1, total: 500 });
  });
});

describe("agruparTopClientes", () => {
  it("cuenta documentos y total por cliente, ordena por total", () => {
    const top = agruparTopClientes([
      { contactoId: "c1", total: 15871, nombreContacto: "Constructora" },
      { contactoId: "c2", total: 5192, nombreContacto: "Juan Pérez" },
      { contactoId: "c1", total: 100, nombreContacto: "Constructora" },
    ]);

    expect(top[0]).toEqual({ nombre: "Constructora", documentos: 2, total: 15971 });
    expect(top[1]).toEqual({ nombre: "Juan Pérez", documentos: 1, total: 5192 });
  });
});

describe("iniciales", () => {
  it("primera palabra + última palabra; una sola aporta dos letras", () => {
    expect(iniciales("Varilla 3/8")).toBe("V3");
    expect(iniciales("Juan Pérez")).toBe("JP");
    expect(iniciales("Constructora Prueba SRL")).toBe("CS");
    expect(iniciales("cemento")).toBe("CE");
    expect(iniciales("PRUEBA-INV-CLI")).toBe("PR");
    expect(iniciales("  ")).toBe("·");
  });
});
