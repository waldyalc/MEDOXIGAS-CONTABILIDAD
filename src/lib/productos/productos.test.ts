import { describe, expect, test } from "vitest";

import {
  esquemaProducto,
  etiquetaTasaItbis,
  filtrarProductos,
  formatoCantidad,
  formatoMoneda,
  normalizarNombre,
  normalizarReferencia,
  type Producto,
  parsearMonto,
  textoOpcional,
} from "./productos";

function producto(parcial: Partial<Producto> & Pick<Producto, "id" | "nombre">): Producto {
  return {
    tipo: "producto",
    referencia: null,
    descripcion: null,
    precio: 0,
    itbis_tasa: 18,
    inventariable: false,
    cantidad: 0,
    costo: 0,
    categoria_id: null,
    activo: true,
    ...parcial,
  };
}

const lista: Producto[] = [
  producto({ id: "1", nombre: "Cilindro de oxígeno", referencia: "OXI-001", precio: 2500 }),
  producto({ id: "2", nombre: "Recarga de gas medicinal", tipo: "servicio", referencia: "REC-10" }),
  producto({ id: "3", nombre: "Regulador de presión", referencia: "REG-200" }),
];

describe("parsearMonto", () => {
  test("acepta montos con comas, puntos y prefijo RD$", () => {
    expect(parsearMonto("1,250.50")).toBe(1250.5);
    expect(parsearMonto("RD$ 99")).toBe(99);
    expect(parsearMonto("1250,50")).toBe(1250.5);
    expect(parsearMonto(" 10.5 ")).toBe(10.5);
  });

  test("rechaza textos vacíos, negativos y no numéricos", () => {
    expect(parsearMonto("")).toBeNull();
    expect(parsearMonto("RD$")).toBeNull();
    expect(parsearMonto("-5")).toBeNull();
    expect(parsearMonto("abc")).toBeNull();
  });

  test("interpreta la coma como separador de miles cuando no es decimal", () => {
    expect(parsearMonto("1,250")).toBe(1250);
    expect(parsearMonto("1,250,000")).toBe(1250000);
  });
});

describe("normalización de productos", () => {
  test("normaliza nombre, referencia y campos opcionales", () => {
    expect(normalizarNombre("  Cilindro   de oxígeno  ")).toBe("Cilindro de oxígeno");
    expect(normalizarReferencia("  oxi-001 ")).toBe("OXI-001");
    expect(textoOpcional("   ")).toBeNull();
    expect(textoOpcional(" Descripción ")).toBe("Descripción");
  });

  test("etiqueta las tasas de ITBIS permitidas", () => {
    expect(etiquetaTasaItbis(18)).toBe("18 %");
    expect(etiquetaTasaItbis(16)).toBe("16 %");
    expect(etiquetaTasaItbis(0)).toBe("0 %");
  });
});

describe("validación del formulario de producto", () => {
  test("exige el nombre y lo normaliza", () => {
    expect(esquemaProducto.safeParse({ nombre: "   ", precio: "10" }).success).toBe(false);

    const resultado = esquemaProducto.safeParse({ nombre: "  Cilindro   de oxígeno ", precio: "10" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.nombre).toBe("Cilindro de oxígeno");
  });

  test("exige un precio válido y lo convierte a número", () => {
    const vacio = esquemaProducto.safeParse({ nombre: "Cilindro", precio: "" });
    expect(vacio.success).toBe(false);
    if (!vacio.success) expect(vacio.error.issues[0]?.message).toBe("El precio es obligatorio");

    const invalido = esquemaProducto.safeParse({ nombre: "Cilindro", precio: "abc" });
    expect(invalido.success).toBe(false);
    if (!invalido.success) expect(invalido.error.issues[0]?.message).toBe("Precio inválido");

    const valido = esquemaProducto.safeParse({ nombre: "Cilindro", precio: "1,250.50" });
    expect(valido.success).toBe(true);
    if (valido.success) expect(valido.data.precio).toBe(1250.5);
  });

  test("rechaza una tasa de ITBIS distinta de 0, 16 o 18", () => {
    expect(esquemaProducto.safeParse({ nombre: "Cilindro", precio: "10", itbis_tasa: "10" }).success).toBe(false);
    expect(esquemaProducto.safeParse({ nombre: "Cilindro", precio: "10", itbis_tasa: 16 }).success).toBe(true);
  });

  test("usa 18 % de ITBIS y producto como valores por defecto", () => {
    const resultado = esquemaProducto.safeParse({ nombre: "Cilindro", precio: "10" });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipo).toBe("producto");
      expect(resultado.data.itbis_tasa).toBe(18);
      expect(resultado.data.inventariable).toBe(false);
    }
  });

  test("un servicio fuerza inventariable, cantidad y costo en cero", () => {
    const resultado = esquemaProducto.safeParse({
      nombre: "Recarga",
      tipo: "servicio",
      precio: "500",
      inventariable: true,
      cantidad: "5",
      costo: "100",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.inventariable).toBe(false);
      expect(resultado.data.cantidad).toBe(0);
      expect(resultado.data.costo).toBe(0);
    }
  });

  test("un producto inventariable conserva cantidad y costo", () => {
    const resultado = esquemaProducto.safeParse({
      nombre: "Cilindro",
      tipo: "producto",
      precio: "2500",
      inventariable: true,
      cantidad: "12.5",
      costo: "1500",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.inventariable).toBe(true);
      expect(resultado.data.cantidad).toBe(12.5);
      expect(resultado.data.costo).toBe(1500);
    }
  });

  test("un producto no inventariable deja cantidad y costo en cero", () => {
    const resultado = esquemaProducto.safeParse({
      nombre: "Cilindro",
      precio: "2500",
      inventariable: false,
      cantidad: "12.5",
      costo: "1500",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.cantidad).toBe(0);
      expect(resultado.data.costo).toBe(0);
    }
  });

  test("normaliza la referencia y la descripción al guardar", () => {
    const resultado = esquemaProducto.safeParse({
      nombre: "Cilindro",
      precio: "2500",
      referencia: " oxi-001 ",
      descripcion: "  Cilindro de 10 litros ",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.referencia).toBe("OXI-001");
      expect(resultado.data.descripcion).toBe("Cilindro de 10 litros");
      expect(resultado.data).toEqual({
        nombre: "Cilindro",
        tipo: "producto",
        referencia: "OXI-001",
        descripcion: "Cilindro de 10 litros",
        precio: 2500,
        itbis_tasa: 18,
        inventariable: false,
        cantidad: 0,
        costo: 0,
        categoria_id: null,
      });
    }
  });

  test("la categoría es opcional y el centinela significa sin categoría", () => {
    const sinCategoria = esquemaProducto.safeParse({
      nombre: "Cilindro",
      precio: "10",
      categoria_id: "__sin_categoria__",
    });
    expect(sinCategoria.success).toBe(true);
    if (sinCategoria.success) expect(sinCategoria.data.categoria_id).toBeNull();

    const conCategoria = esquemaProducto.safeParse({
      nombre: "Cilindro",
      precio: "10",
      categoria_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(conCategoria.success).toBe(true);
    if (conCategoria.success) {
      expect(conCategoria.data.categoria_id).toBe("11111111-1111-4111-8111-111111111111");
    }
  });
});

describe("filtro de productos", () => {
  test("busca sin importar acentos por nombre", () => {
    expect(filtrarProductos(lista, "oxigeno").map((item) => item.id)).toEqual(["1"]);
    expect(filtrarProductos(lista, "presion").map((item) => item.id)).toEqual(["3"]);
  });

  test("busca por referencia sin importar mayúsculas", () => {
    expect(filtrarProductos(lista, "rec-10").map((item) => item.id)).toEqual(["2"]);
    expect(filtrarProductos(lista, "reg").map((item) => item.id)).toEqual(["3"]);
  });

  test("con una búsqueda vacía devuelve todos los productos", () => {
    expect(filtrarProductos(lista, "  ")).toHaveLength(3);
  });
});

describe("formatos", () => {
  test("formatea montos en pesos dominicanos", () => {
    expect(formatoMoneda(1250)).toBe("RD$ 1,250.00");
    expect(formatoMoneda("99.5")).toBe("RD$ 99.50");
    expect(formatoMoneda(null)).toBe("—");
    expect(formatoMoneda(Number.NaN)).toBe("—");
  });

  test("formatea cantidades con un máximo de dos decimales", () => {
    expect(formatoCantidad(1250)).toBe("1,250");
    expect(formatoCantidad(12.5)).toBe("12.5");
    expect(formatoCantidad(12.345)).toBe("12.35");
    expect(formatoCantidad(undefined)).toBe("—");
  });
});
