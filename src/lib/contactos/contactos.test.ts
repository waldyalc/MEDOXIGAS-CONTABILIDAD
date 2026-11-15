import { describe, expect, test } from "vitest";

import {
  type Contacto,
  esquemaContacto,
  esRncCedulaValida,
  etiquetaTipoContacto,
  filtrarContactos,
  leerPestanaContactos,
  normalizarNombre,
  normalizarRncCedula,
  normalizarTelefono,
  textoOpcional,
} from "./contactos";

function contacto(parcial: Partial<Contacto> & Pick<Contacto, "id" | "nombre">): Contacto {
  return {
    rnc_cedula: null,
    telefono: null,
    correo: null,
    direccion: null,
    tipo: "cliente",
    lista_precio_id: null,
    ...parcial,
  };
}

const lista: Contacto[] = [
  contacto({ id: "1", nombre: "José Peña", tipo: "cliente", rnc_cedula: "131123456", telefono: "8095551234" }),
  contacto({ id: "2", nombre: "Gasóleo Dominicano", tipo: "proveedor", correo: "compras@gasoleo.do" }),
  contacto({ id: "3", nombre: "Ferretería Central", tipo: "ambos", rnc_cedula: "101234567" }),
];

describe("normalización de contactos", () => {
  test("limpia espacios y mayúsculas del nombre", () => {
    expect(normalizarNombre("  José   Peña  ")).toBe("José Peña");
  });

  test("deja solo los dígitos del RNC o la cédula", () => {
    expect(normalizarRncCedula("1-31-12345-6")).toBe("131123456");
    expect(normalizarRncCedula("001-1234567-8")).toBe("00112345678");
  });

  test("acepta RNC de 9 dígitos y cédula de 11", () => {
    expect(esRncCedulaValida("131123456")).toBe(true);
    expect(esRncCedulaValida("00112345678")).toBe(true);
    expect(esRncCedulaValida("12345")).toBe(false);
  });

  test("normaliza el teléfono y conserva el prefijo internacional", () => {
    expect(normalizarTelefono("809-555-1234")).toBe("8095551234");
    expect(normalizarTelefono("+1 (809) 555-1234")).toBe("+18095551234");
  });

  test("los campos opcionales vacíos quedan en null", () => {
    expect(textoOpcional("   ")).toBeNull();
    expect(textoOpcional(undefined)).toBeNull();
    expect(textoOpcional(" Valor ")).toBe("Valor");
    expect(etiquetaTipoContacto("ambos")).toBe("Cliente y proveedor");
  });
});

describe("validación del formulario de contacto", () => {
  test("nombre obligatorio y tipo cliente por defecto", () => {
    const resultado = esquemaContacto.safeParse({ nombre: "  Ana Pérez " });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.nombre).toBe("Ana Pérez");
      expect(resultado.data.tipo).toBe("cliente");
      expect(resultado.data.rnc_cedula).toBeNull();
      expect(resultado.data.correo).toBeNull();
    }
  });

  test("rechaza un nombre vacío", () => {
    const resultado = esquemaContacto.safeParse({ nombre: "   ", tipo: "cliente" });
    expect(resultado.success).toBe(false);
  });

  test("rechaza RNC con longitud inválida y correos mal formados", () => {
    expect(esquemaContacto.safeParse({ nombre: "Ana", rnc_cedula: "123" }).success).toBe(false);
    expect(esquemaContacto.safeParse({ nombre: "Ana", correo: "ana@" }).success).toBe(false);
  });

  test("normaliza los campos opcionales al guardar", () => {
    const resultado = esquemaContacto.safeParse({
      nombre: "Ana",
      tipo: "proveedor",
      rnc_cedula: "1-31-12345-6",
      telefono: "809 555 1234",
      correo: " ana@medoxigas.do ",
      direccion: " Av. 27 de Febrero ",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data).toEqual({
        nombre: "Ana",
        tipo: "proveedor",
        rnc_cedula: "131123456",
        telefono: "8095551234",
        correo: "ana@medoxigas.do",
        direccion: "Av. 27 de Febrero",
        lista_precio_id: null,
      });
    }
  });
});

describe("filtro de contactos por pestaña y búsqueda", () => {
  test("la pestaña Todos devuelve la lista completa", () => {
    expect(filtrarContactos(lista, "todos", "")).toHaveLength(3);
  });

  test("Clientes incluye a los que son cliente y proveedor", () => {
    expect(filtrarContactos(lista, "clientes", "").map((item) => item.id)).toEqual(["1", "3"]);
  });

  test("Proveedores incluye a los que son cliente y proveedor", () => {
    expect(filtrarContactos(lista, "proveedores", "").map((item) => item.id)).toEqual(["2", "3"]);
  });

  test("busca sin importar acentos por nombre, RNC, teléfono o correo", () => {
    expect(filtrarContactos(lista, "todos", "jose").map((item) => item.id)).toEqual(["1"]);
    expect(filtrarContactos(lista, "todos", "1311").map((item) => item.id)).toEqual(["1"]);
    expect(filtrarContactos(lista, "todos", "gasoleo.do").map((item) => item.id)).toEqual(["2"]);
    expect(filtrarContactos(lista, "todos", "8095").map((item) => item.id)).toEqual(["1"]);
  });

  test("busca y filtra la pestaña al mismo tiempo", () => {
    expect(filtrarContactos(lista, "clientes", "ferreteria").map((item) => item.id)).toEqual(["3"]);
    expect(filtrarContactos(lista, "proveedores", "jose")).toEqual([]);
  });
});

describe("pestaña desde la URL", () => {
  test("acepta clientes y proveedores y cae en todos", () => {
    expect(leerPestanaContactos("clientes")).toBe("clientes");
    expect(leerPestanaContactos("proveedores")).toBe("proveedores");
    expect(leerPestanaContactos("todos")).toBe("todos");
    expect(leerPestanaContactos("")).toBe("todos");
    expect(leerPestanaContactos("otra")).toBe("todos");
  });
});
