import { describe, expect, test } from "vitest";

import type { CategoriaProducto } from "@/lib/inventario/tipos";

import {
  type CambiosEdicionMasiva,
  calcularEdicionMasiva,
  mapearColumnas,
  parsearCsv,
  parsearPorcentaje,
  plantillaCsv,
  validarFilasImportacion,
  valorTexto,
} from "./importar";
import type { Producto } from "./productos";

const CATEGORIA_GASES = "11111111-1111-4111-8111-111111111111";
const CATEGORIA_EQUIPOS = "22222222-2222-4222-8222-222222222222";

const categorias: CategoriaProducto[] = [
  { id: CATEGORIA_GASES, nombre: "Gases medicinales", descripcion: null, activo: true },
  { id: CATEGORIA_EQUIPOS, nombre: "Equipos", descripcion: null, activo: true },
];

function producto(parcial: Partial<Producto> & Pick<Producto, "id" | "nombre">): Producto {
  return {
    tipo: "producto",
    referencia: null,
    descripcion: null,
    precio: 0,
    itbis_tasa: 18,
    impuesto_id: null,
    inventariable: false,
    cantidad: 0,
    costo: 0,
    categoria_id: null,
    precios: [],
    activo: true,
    ...parcial,
  };
}

function cambios(parcial: Partial<CambiosEdicionMasiva>): CambiosEdicionMasiva {
  return {
    precioModo: "sin_cambio",
    precioFijo: "",
    porcentaje: "",
    itbisTasa: "",
    categoriaId: "",
    activo: "",
    ...parcial,
  };
}

describe("plantilla y CSV", () => {
  test("la plantilla trae las columnas del brief", () => {
    const primeraLinea = plantillaCsv()
      .replace(/^\uFEFF/, "")
      .trim();
    expect(primeraLinea).toBe("nombre,referencia,tipo,precio,ITBIS,costo inicial,unidad,categoría,descripción");
  });

  test("parsea comas, comillas y saltos de línea", () => {
    const filas = parsearCsv('nombre,precio\r\n"Cilindro, 10L",2500\r\n"Regulador ""A""",99.5\r\n');

    expect(filas).toEqual([
      ["nombre", "precio"],
      ["Cilindro, 10L", "2500"],
      ['Regulador "A"', "99.5"],
    ]);
  });

  test("detecta el punto y coma y quita el BOM", () => {
    const filas = parsearCsv("\uFEFFnombre;precio\r\nCilindro;2500");
    expect(filas).toEqual([
      ["nombre", "precio"],
      ["Cilindro", "2500"],
    ]);
  });

  test("ignora filas vacías y acepta celdas entre comillas con salto de línea", () => {
    const filas = parsearCsv('nombre,descripcion\nCilindro,"Línea 1\nLínea 2"\n\n');
    expect(filas).toEqual([
      ["nombre", "descripcion"],
      ["Cilindro", "Línea 1\nLínea 2"],
    ]);
  });

  test("mapea encabezados con acentos y sinónimos", () => {
    const mapa = mapearColumnas(["Producto", "SKU", "Precio de venta", "ITBIS", "Costo inicial", "Categoría"]);

    expect(mapa).toEqual({
      nombre: 0,
      referencia: 1,
      precio: 2,
      itbis_tasa: 3,
      costo: 4,
      categoria: 5,
    });
  });

  test("convierte celdas de Excel a texto", () => {
    expect(valorTexto(18)).toBe("18");
    expect(valorTexto({ richText: [{ text: "Cilin" }, { text: "dro" }] })).toBe("Cilindro");
    expect(valorTexto({ formula: "A1", result: 2500 })).toBe("2500");
    expect(valorTexto(null)).toBe("");
  });
});

describe("validación de filas para importar", () => {
  test("acepta filas válidas y normaliza tipo, ITBIS y categoría", () => {
    const filas = parsearCsv(
      [
        "nombre,referencia,tipo,precio,ITBIS,costo inicial,unidad,categoría,descripción",
        'Cilindro de oxígeno,oxi-001,Producto,"1,250.50",18%,900,Unidad,gases medicinales,"Cilindro 10 litros"',
        "Recarga,rec-10,Servicio,500,0,,Unidad,,Recarga a domicilio",
      ].join("\n"),
    );

    const resultado = validarFilasImportacion(filas, categorias);

    expect(resultado.errorGeneral).toBeNull();
    expect(resultado.filas).toHaveLength(2);

    const [primera, segunda] = resultado.filas;
    expect(primera?.numero).toBe(2);
    expect(primera?.errores).toEqual([]);
    expect(primera?.datos).toEqual({
      nombre: "Cilindro de oxígeno",
      tipo: "producto",
      referencia: "OXI-001",
      descripcion: "Cilindro 10 litros",
      precio: 1250.5,
      itbis_tasa: 18,
      impuesto_id: null,
      costo: 900,
      inventariable: true,
      cantidad: 0,
      categoria_id: CATEGORIA_GASES,
      unidad: "Unidad",
    });

    expect(segunda?.errores).toEqual([]);
    expect(segunda?.datos?.inventariable).toBe(false);
    expect(segunda?.datos?.costo).toBe(0);
    expect(segunda?.datos?.itbis_tasa).toBe(0);
    expect(segunda?.datos?.categoria_id).toBeNull();
  });

  test("reporta errores por fila en español", () => {
    const filas = parsearCsv(
      [
        "nombre,precio,tipo,ITBIS,costo inicial,categoría",
        ",10,Producto,18,0,",
        "Regulador,abc,Producto,18,0,",
        "Manómetro,100,Combo,10,-5,Inventada",
      ].join("\n"),
    );

    const resultado = validarFilasImportacion(filas, categorias);

    expect(resultado.filas.map((fila) => fila.errores)).toEqual([
      ["El nombre es obligatorio."],
      ["El precio no es válido."],
      [
        "El tipo debe ser «Producto» o «Servicio».",
        "El ITBIS debe ser 18, 16 o 0.",
        "El costo inicial no es válido.",
        "La categoría «Inventada» no existe.",
      ],
    ]);
    expect(resultado.filas.every((fila) => fila.datos === null)).toBe(true);
  });

  test("exige las columnas nombre y precio", () => {
    const resultado = validarFilasImportacion(parsearCsv("referencia,precio\nOXI-1,10"), categorias);

    expect(resultado.errorGeneral).toBe("Faltan columnas obligatorias: nombre.");
    expect(resultado.columnasFaltantes).toEqual(["nombre"]);
    expect(resultado.filas).toEqual([]);
  });

  test("avisa cuando el archivo está vacío o no tiene datos", () => {
    expect(validarFilasImportacion([], categorias).errorGeneral).toBe("El archivo está vacío.");

    const soloEncabezado = validarFilasImportacion(parsearCsv("nombre,precio"), categorias);
    expect(soloEncabezado.errorGeneral).toBe("El archivo no tiene filas de datos.");
  });
});

describe("edición masiva", () => {
  const productos = [
    producto({ id: "1", nombre: "Cilindro", precio: 100, categoria_id: CATEGORIA_GASES }),
    producto({ id: "2", nombre: "Regulador", precio: 250.55, tipo: "producto" }),
  ];

  test("fija un precio y conserva los demás campos", () => {
    const resultado = calcularEdicionMasiva(productos, cambios({ precioModo: "fijo", precioFijo: "150.25" }));

    expect(resultado.error).toBeNull();
    expect(resultado.filas.map((fila) => fila.datos.precio)).toEqual([150.25, 150.25]);
    expect(resultado.filas[0]?.datos.categoria_id).toBe(CATEGORIA_GASES);
    expect(resultado.filas[1]?.datos.nombre).toBe("Regulador");
    expect(resultado.filas[0]?.datos.activo).toBe(true);
  });

  test("ajusta el precio con porcentaje positivo y negativo", () => {
    const subida = calcularEdicionMasiva(productos, cambios({ precioModo: "porcentaje", porcentaje: "+10" }));
    expect(subida.filas.map((fila) => fila.datos.precio)).toEqual([110, 275.61]);

    const bajada = calcularEdicionMasiva(productos, cambios({ precioModo: "porcentaje", porcentaje: "-10%" }));
    expect(bajada.filas.map((fila) => fila.datos.precio)).toEqual([90, 225.5]);
  });

  test("rechaza una baja que deje un precio negativo", () => {
    const resultado = calcularEdicionMasiva(productos, cambios({ precioModo: "porcentaje", porcentaje: "-150" }));

    expect(resultado.error).toBe("El ajuste deja un precio negativo en «Cilindro».");
    expect(resultado.filas).toEqual([]);
  });

  test("cambia ITBIS, categoría y estado", () => {
    const resultado = calcularEdicionMasiva(
      productos,
      cambios({ itbisTasa: "0", categoriaId: CATEGORIA_EQUIPOS, activo: "inactivo" }),
    );

    expect(resultado.filas.map((fila) => fila.datos.itbis_tasa)).toEqual([0, 0]);
    expect(resultado.filas.map((fila) => fila.datos.categoria_id)).toEqual([CATEGORIA_EQUIPOS, CATEGORIA_EQUIPOS]);
    expect(resultado.filas.map((fila) => fila.datos.activo)).toEqual([false, false]);
  });

  test("sin categoría deja la categoría en nulo", () => {
    const resultado = calcularEdicionMasiva(productos, cambios({ categoriaId: "__sin_categoria__" }));

    expect(resultado.filas.map((fila) => fila.datos.categoria_id)).toEqual([null, null]);
  });

  test("exige al menos un cambio y valores válidos", () => {
    expect(calcularEdicionMasiva(productos, cambios({})).error).toBe("Selecciona al menos un cambio.");
    expect(calcularEdicionMasiva(productos, cambios({ precioModo: "fijo", precioFijo: "" })).error).toBe(
      "Escribe un precio fijo válido.",
    );
    expect(calcularEdicionMasiva(productos, cambios({ precioModo: "porcentaje", porcentaje: "abc" })).error).toBe(
      "Escribe un porcentaje válido (puede ser negativo).",
    );
    expect(calcularEdicionMasiva(productos, cambios({ itbisTasa: "10" })).error).toBe("El ITBIS debe ser 18, 16 o 0.");
  });

  test("parsea porcentajes con signo, coma y símbolo", () => {
    expect(parsearPorcentaje("+10")).toBe(10);
    expect(parsearPorcentaje("-12,5 %")).toBe(-12.5);
    expect(parsearPorcentaje("")).toBeNull();
    expect(parsearPorcentaje("10abc")).toBeNull();
  });
});
