import { describe, expect, test } from "vitest";

import {
  centavosDeDecimal,
  decimal,
  decimalONulo,
  estadoConteo,
  mapearConteoLinea,
  mapearConteoResumen,
  mapearProductoCatalogo,
  mapearProductoPorCodigo,
  mapearStockBajo,
  mapearUnidad,
  mapearUnidadesJson,
  ordenarPorCriticidad,
  tipoProducto,
} from "./mapeo";

const ID = "11111111-1111-4111-8111-111111111111";

describe("decimal", () => {
  test("convierte number y string a texto sin redondear", () => {
    expect(decimal(5)).toBe("5");
    expect(decimal(0.0625)).toBe("0.0625");
    expect(decimal(" 12.50 ")).toBe("12.50");
    expect(decimal(0)).toBe("0");
  });

  test("null y valores inválidos caen en cero", () => {
    expect(decimal(null)).toBe("0");
    expect(decimal(undefined)).toBe("0");
    expect(decimal("")).toBe("0");
    expect(decimal(Number.NaN)).toBe("0");
  });

  test("decimalONulo conserva el null del precio opcional", () => {
    expect(decimalONulo(null)).toBeNull();
    expect(decimalONulo("")).toBeNull();
    expect(decimalONulo(0)).toBe("0");
  });
});

describe("normalizadores", () => {
  test("tipoProducto solo acepta los tipos del catálogo", () => {
    expect(tipoProducto("combo")).toBe("combo");
    expect(tipoProducto("servicio")).toBe("servicio");
    expect(tipoProducto("otro")).toBe("producto");
    expect(tipoProducto(null)).toBe("producto");
  });

  test("estadoConteo solo acepta los estados del conteo", () => {
    expect(estadoConteo("aplicado")).toBe("aplicado");
    expect(estadoConteo("anulado")).toBe("anulado");
    expect(estadoConteo("desconocido")).toBe("borrador");
  });

  test("centavosDeDecimal no multiplica floats", () => {
    expect(centavosDeDecimal("10.25")).toBe(1025);
    expect(centavosDeDecimal("5.5")).toBe(550);
    expect(centavosDeDecimal("0")).toBe(0);
    expect(centavosDeDecimal("-3.10")).toBe(-310);
  });
});

describe("mapeo de respuestas de las RPC", () => {
  test("la búsqueda por código expone precios y cantidades como texto", () => {
    const producto = mapearProductoPorCodigo({
      producto_id: ID,
      nombre: "Cemento gris",
      referencia: null,
      marca: "Ferretería X",
      tipo: "combo",
      unidad_id: null,
      unidad_nombre: "Caja 50 lb",
      factor_base: 5,
      precio: 3200,
      itbis_tasa: 18,
      stock: 10,
      disponible: null,
      imagen_path: null,
      favorito_pos: true,
      codigo: " 7501234567890 ",
    });

    expect(producto.factor_base).toBe("5");
    expect(producto.precio).toBe("3200");
    expect(producto.disponible).toBeNull();
    expect(producto.tipo).toBe("combo");
    expect(producto.codigo).toBe("7501234567890");
    expect(producto.imagen_path).toBeNull();
  });

  test("el catálogo lee el JSONB de unidades y descarta lo incompleto", () => {
    const producto = mapearProductoCatalogo({
      producto_id: ID,
      nombre: "Alambre",
      referencia: "AL-1",
      marca: null,
      tipo: "producto",
      categoria_id: null,
      favorito_pos: false,
      imagen_path: null,
      unidad_medida: "Metro",
      precio: "100.50",
      itbis_tasa: 18,
      stock: 3,
      disponible: 3,
      unidades: [
        { id: ID, nombre: "Rollo 100 m", factor_base: 100, precio: 9500 },
        { id: "no-es-uuid", nombre: "Rota", factor_base: 1, precio: 1 },
        { nombre: "Sin id", factor_base: 1, precio: 1 },
      ],
    });

    expect(producto.unidades).toEqual([{ id: ID, nombre: "Rollo 100 m", factor_base: "100", precio: "9500" }]);
    expect(producto.precio).toBe("100.50");
  });

  test("un catálogo sin unidades devuelve una lista vacía", () => {
    expect(mapearUnidadesJson(null)).toEqual([]);
    expect(mapearUnidadesJson("no es una lista")).toEqual([]);
  });

  test("el stock bajo conserva el máximo nulo y el faltante", () => {
    const producto = mapearStockBajo({
      producto_id: ID,
      nombre: "Tornillo",
      referencia: null,
      marca: null,
      ubicacion: "Pasillo 1",
      almacen_id: ID,
      cantidad: 2,
      minimo: 5,
      maximo: null,
      faltante: 3,
      sugerido: 3,
    });

    expect(producto.cantidad).toBe("2");
    expect(producto.maximo).toBeNull();
    expect(producto.faltante).toBe("3");
  });

  test("el conteo arma la cabecera con el nombre del almacén", () => {
    const conteo = mapearConteoResumen({
      id: ID,
      numero: 7,
      fecha: "2026-11-25",
      estado: "aplicado",
      almacen_id: ID,
      notas: null,
      ajuste_id: null,
      creado_en: "2026-11-25T10:00:00Z",
      almacenes: { nombre: "Principal" },
    });

    expect(conteo.estado).toBe("aplicado");
    expect(conteo.almacen_nombre).toBe("Principal");
  });

  test("una línea de conteo sin producto no rompe la vista", () => {
    const linea = mapearConteoLinea({
      id: ID,
      producto_id: ID,
      cantidad_sistema: 10,
      cantidad_contada: "7.00",
      diferencia: -3,
      notas: null,
      productos: null,
    });

    expect(linea.producto_nombre).toBe("—");
    expect(linea.cantidad_contada).toBe("7.00");
    expect(linea.diferencia).toBe("-3");
  });

  test("la unidad conserva el precio nulo", () => {
    const unidad = mapearUnidad({
      id: ID,
      producto_id: ID,
      nombre: "Caja 50 lb",
      factor_base: 50,
      precio: null,
      es_compra: true,
      es_venta: true,
      activa: true,
      creado_en: "2026-11-25T10:00:00Z",
    });

    expect(unidad.factor_base).toBe("50");
    expect(unidad.precio).toBeNull();
  });

  test("el stock bajo se ordena por cantidad menos mínimo", () => {
    const base = {
      almacen_id: ID,
      referencia: null,
      marca: null,
      ubicacion: null,
      faltante: "0",
      sugerido: "0",
    };
    const productos = ordenarPorCriticidad([
      { ...base, producto_id: "a", nombre: "Sobre el mínimo", cantidad: "10", minimo: "5", maximo: null },
      { ...base, producto_id: "b", nombre: "Negativo", cantidad: "-3", minimo: "0", maximo: null },
      { ...base, producto_id: "c", nombre: "Faltan 4", cantidad: "1", minimo: "5", maximo: "20" },
      { ...base, producto_id: "d", nombre: "Faltan 2", cantidad: "3", minimo: "5", maximo: null },
    ]);

    expect(productos.map((producto) => producto.nombre)).toEqual([
      "Faltan 4",
      "Negativo",
      "Faltan 2",
      "Sobre el mínimo",
    ]);
  });
});
