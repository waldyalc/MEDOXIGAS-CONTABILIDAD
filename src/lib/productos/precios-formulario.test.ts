import { describe, expect, test } from "vitest";

import { formDataProducto } from "@/app/(main)/dashboard/productos/_components/form-data-producto";

import { calcularEdicionMasiva, validarFilasImportacion } from "./importar";
import { construirPayloadProducto, leerPreciosFormulario } from "./precios-formulario";
import type { DatosProducto, Producto } from "./productos";

const LISTA_GENERAL = "11111111-1111-4111-8111-111111111111";
const LISTA_MAYOREO = "22222222-2222-4222-8222-222222222222";

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
    unidad_medida: "Unidad",
    almacen_id: null,
    vende_negativo: false,
    imagen_path: null,
    ...parcial,
  };
}

function datosProducto(): DatosProducto {
  return {
    nombre: "Cilindro",
    tipo: "producto",
    referencia: null,
    descripcion: null,
    precio: 100,
    itbis_tasa: 18,
    impuesto_id: null,
    inventariable: false,
    cantidad: 0,
    costo: 0,
    categoria_id: null,
    activo: true,
  };
}

describe("precios de listas en productos", () => {
  test("la edición masiva no manda la clave precios y deja intactos los precios de listas", () => {
    const original = producto({
      id: "1",
      nombre: "Cilindro",
      precio: 100,
      precios: [
        { lista_id: LISTA_GENERAL, precio: 120 },
        { lista_id: LISTA_MAYOREO, precio: 130 },
      ],
    });

    const calculo = calcularEdicionMasiva([original], {
      precioModo: "porcentaje",
      precioFijo: "",
      porcentaje: "10",
      itbisTasa: "",
      categoriaId: "",
      activo: "",
    });

    expect(calculo.error).toBeNull();
    const fila = calculo.filas[0];
    expect(fila).toBeDefined();
    if (!fila) return;

    expect(fila.datos.precio).toBe(110);
    expect(fila.datos).not.toHaveProperty("precios");

    const formulario = formDataProducto(fila.datos);
    const precios = leerPreciosFormulario(formulario);
    expect(precios).toEqual({ precios: [], presente: false });

    const payload = construirPayloadProducto(fila.datos, precios);
    expect("precios" in payload).toBe(false);
  });

  test("la importación tampoco manda precios de listas", () => {
    const resultado = validarFilasImportacion(
      [
        ["nombre", "precio"],
        ["Regulador", "250"],
      ],
      [],
    );

    const datos = resultado.filas[0]?.datos;
    expect(datos).not.toBeNull();
    if (!datos) return;

    const precios = leerPreciosFormulario(formDataProducto(datos));
    expect(precios?.presente).toBe(false);

    const payload = construirPayloadProducto(datos, precios);
    expect("precios" in payload).toBe(false);
  });

  test("el formulario del producto sí manda precios y permite vaciar una lista", () => {
    const formulario = new FormData();
    formulario.set(`precio_lista_${LISTA_GENERAL}`, "125,50");
    formulario.set(`precio_lista_${LISTA_MAYOREO}`, "");

    const precios = leerPreciosFormulario(formulario);
    expect(precios).toEqual({
      presente: true,
      precios: [
        { lista_id: LISTA_GENERAL, precio: 125.5 },
        { lista_id: LISTA_MAYOREO, precio: null },
      ],
    });

    const payload = construirPayloadProducto(datosProducto(), precios);
    expect(payload.precios).toEqual(precios?.precios);
  });

  test("ignora ids de lista inválidos y rechaza precios no numéricos", () => {
    const sinLista = new FormData();
    sinLista.set("precio_lista_no-es-uuid", "10");
    expect(leerPreciosFormulario(sinLista)).toEqual({ precios: [], presente: false });

    const invalido = new FormData();
    invalido.set(`precio_lista_${LISTA_GENERAL}`, "abc");
    expect(leerPreciosFormulario(invalido)).toBeNull();
  });
});
