import { describe, expect, it } from "vitest";

import { aplicarDescuentoStockLocal, buscarCodigoLocal, filtrarCatalogoLocal } from "./catalogo-local";
import { nuevaOperacionOffline, type OperacionOffline } from "./cola-offline";
import type { ProductoPOS } from "./tipos";

const CATEGORIA_A = "11111111-1111-4111-8111-111111111111";
const CATEGORIA_B = "22222222-2222-4222-8222-222222222222";
const TURNO = "88888888-8888-4888-8888-888888888888";

function producto(cambios: Partial<ProductoPOS> & { producto_id: string }): ProductoPOS {
  return {
    nombre: "Producto",
    referencia: null,
    marca: null,
    tipo: "producto",
    categoria_id: null,
    favorito_pos: false,
    imagen_path: null,
    unidad_medida: null,
    precio: "100.00",
    itbis_tasa: "18",
    stock: "10.00",
    disponible: "10.00",
    unidades: [],
    ...cambios,
  };
}

function ventaPendiente(lineas: unknown[], estado: OperacionOffline["estado"] = "pendiente"): OperacionOffline {
  const operacion = nuevaOperacionOffline({
    ambito: "usuario/terminal",
    tipo: "venta",
    turnoId: TURNO,
    secuencia: 1,
    payload: { lineas },
    snapshot: null,
  });
  return { ...operacion, estado };
}

describe("catálogo local del POS", () => {
  const productos = [
    producto({
      producto_id: "1",
      nombre: "Cánula nasal",
      referencia: "CAN-01",
      marca: "Oxymat",
      categoria_id: CATEGORIA_A,
    }),
    producto({
      producto_id: "2",
      nombre: "Alambre galvanizado",
      referencia: "ALM-22",
      marca: "Metaldom",
      categoria_id: CATEGORIA_B,
    }),
  ];

  it("filtra sin acentos ni mayúsculas por nombre, referencia o marca", () => {
    expect(filtrarCatalogoLocal(productos, { busqueda: "CANULA", categoria: "" })).toEqual([productos[0]]);
    expect(filtrarCatalogoLocal(productos, { busqueda: "can-01", categoria: "" })).toEqual([productos[0]]);
    expect(filtrarCatalogoLocal(productos, { busqueda: "metaldom", categoria: "" })).toEqual([productos[1]]);
  });

  it("combina el texto con la categoría y vacío muestra todo", () => {
    expect(filtrarCatalogoLocal(productos, { busqueda: "", categoria: CATEGORIA_B })).toEqual([productos[1]]);
    expect(filtrarCatalogoLocal(productos, { busqueda: "canula", categoria: CATEGORIA_B })).toEqual([]);
    expect(filtrarCatalogoLocal(productos, { busqueda: "", categoria: "" })).toHaveLength(2);
  });

  it("la pistola encuentra la referencia exacta sin distinguir mayúsculas y espacios", () => {
    expect(buscarCodigoLocal(productos, " can-01 ")?.producto_id).toBe("1");
    expect(buscarCodigoLocal(productos, "ALM-22")?.producto_id).toBe("2");
    expect(buscarCodigoLocal(productos, "can")).toBeNull();
    expect(buscarCodigoLocal(productos, "")).toBeNull();
  });

  it("descuenta lo vendido en ventas pendientes del stock y del disponible", () => {
    const catalogo = [
      producto({ producto_id: "1", stock: "10.00", disponible: "8.00" }),
      producto({ producto_id: "2", stock: "5.00", disponible: "5.00" }),
    ];
    const resultado = aplicarDescuentoStockLocal(catalogo, [
      ventaPendiente([{ producto_id: "1", cantidad: "2" }]),
      ventaPendiente([{ producto_id: "1", cantidad: "1.5" }]),
    ]);

    expect(resultado[0]).toMatchObject({ stock: "6.50", disponible: "4.50" });
    expect(resultado[1]).toMatchObject({ stock: "5.00", disponible: "5.00" });
  });

  it("usa el factor de la unidad y nunca baja de cero", () => {
    const catalogo = [
      producto({
        producto_id: "1",
        stock: "10.00",
        disponible: "10.00",
        unidades: [{ id: "caja", nombre: "Caja", factor_base: "12.0000", precio: "1200.00" }],
      }),
    ];
    const resultado = aplicarDescuentoStockLocal(catalogo, [
      ventaPendiente([{ producto_id: "1", cantidad: "1", unidad_id: "caja" }]),
    ]);
    expect(resultado[0]).toMatchObject({ stock: "0.00", disponible: "0.00" });
  });

  it("ignora ventas ya sincronizadas o fallidas, servicios, combos y disponibilidad desconocida", () => {
    const catalogo = [
      producto({ producto_id: "1" }),
      producto({ producto_id: "2", tipo: "servicio" }),
      producto({ producto_id: "3", tipo: "combo", disponible: null }),
    ];
    const resultado = aplicarDescuentoStockLocal(catalogo, [
      ventaPendiente([{ producto_id: "1", cantidad: "1" }], "sincronizada"),
      ventaPendiente([{ producto_id: "1", cantidad: "1" }], "fallida"),
      ventaPendiente([{ producto_id: "2", cantidad: "1" }]),
      ventaPendiente([{ producto_id: "3", cantidad: "1" }]),
    ]);

    expect(resultado[0]?.stock).toBe("10.00");
    expect(resultado[1]?.stock).toBe("10.00");
    expect(resultado[2]?.disponible).toBeNull();
  });

  it("un movimiento del turno no toca el inventario de la venta", () => {
    const operacion = nuevaOperacionOffline({
      ambito: "usuario/terminal",
      tipo: "movimiento",
      turnoId: TURNO,
      secuencia: 2,
      payload: { monto: "100", lineas: [{ producto_id: "1", cantidad: "1" }] },
      snapshot: null,
    });
    const resultado = aplicarDescuentoStockLocal([producto({ producto_id: "1" })], [operacion]);
    expect(resultado[0]?.stock).toBe("10.00");
  });
});
