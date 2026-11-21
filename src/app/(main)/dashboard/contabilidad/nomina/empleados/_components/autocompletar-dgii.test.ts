import { beforeEach, describe, expect, it, vi } from "vitest";

import { buscarContribuyenteDgii } from "@/lib/dgii/acciones";

import { completarEmpleadoConDgii, type PartesNombreDgii } from "./formato-nomina";

vi.mock("@/lib/dgii/acciones", () => ({
  buscarContribuyenteDgii: vi.fn(),
}));

const buscar = vi.mocked(buscarContribuyenteDgii);

const VACIOS: PartesNombreDgii = { primerNombre: "", segundoNombre: "", primerApellido: "", segundoApellido: "" };

function datosDgii(nombre: string) {
  return { nombre, nombreComercial: null, municipioProvincia: null, direccion: null, estado: "ACTIVO" };
}

interface ResultadoAutocompletar {
  tono: "ok" | "error";
  texto: string;
  campos: Partial<PartesNombreDgii>;
  rellenos: PartesNombreDgii;
}

/**
 * La misma secuencia que ejecuta el wizard: `useConsultaDgii` llama la acción
 * del servidor, el callback pasa los datos a `completarEmpleadoConDgii` y el
 * mensaje se muestra bajo el campo. El hook no se puede montar en Vitest (no
 * hay DOM), así que aquí se replica su flujo contra la acción mockeada.
 */
async function autocompletarComoElWizard(
  identificacion: string,
  escritos: PartesNombreDgii,
  rellenos: PartesNombreDgii,
): Promise<ResultadoAutocompletar> {
  const rellenosRef = { ...rellenos };
  try {
    const resultado = await buscarContribuyenteDgii(identificacion, "cedula");
    if (!resultado.ok) {
      return { tono: "error", texto: resultado.error, campos: {}, rellenos: rellenosRef };
    }
    const { campos, mensaje } = completarEmpleadoConDgii(resultado.datos, escritos, rellenosRef);
    Object.assign(rellenosRef, campos);
    return { tono: "ok", texto: mensaje, campos, rellenos: rellenosRef };
  } catch {
    return {
      tono: "error",
      texto: "No se pudo consultar la DGII. Intenta de nuevo o escríbelo a mano.",
      campos: {},
      rellenos: rellenosRef,
    };
  }
}

describe("autocompletar el empleado con la DGII", () => {
  beforeEach(() => {
    buscar.mockReset();
  });

  it("con la cédula encontrada reparte el nombre en los cuatro campos", async () => {
    buscar.mockResolvedValue({ ok: true, datos: datosDgii("JOSE MANUEL DIAZ ENCARNACION") });

    const resultado = await autocompletarComoElWizard("40237721184", VACIOS, VACIOS);

    expect(buscar).toHaveBeenCalledWith("40237721184", "cedula");
    expect(resultado.tono).toBe("ok");
    expect(resultado.campos).toEqual({
      primerNombre: "Jose",
      segundoNombre: "Manuel",
      primerApellido: "Diaz",
      segundoApellido: "Encarnacion",
    });
    expect(resultado.rellenos).toEqual(resultado.campos);
    expect(resultado.texto).toContain("DGII");
  });

  it("no pisa los campos que el usuario ya escribió", async () => {
    buscar.mockResolvedValue({ ok: true, datos: datosDgii("JOSE MANUEL DIAZ ENCARNACION") });
    const escritos = { ...VACIOS, primerNombre: "Pedro" };

    const resultado = await autocompletarComoElWizard("40237721184", escritos, VACIOS);

    expect(resultado.campos.primerNombre).toBeUndefined();
    expect(resultado.campos.primerApellido).toBe("Diaz");
  });

  it("una segunda consulta puede reemplazar lo que rellenó la anterior", async () => {
    buscar.mockResolvedValue({ ok: true, datos: datosDgii("JOSE MANUEL DIAZ ENCARNACION") });
    const primera = await autocompletarComoElWizard("40237721184", VACIOS, VACIOS);

    buscar.mockResolvedValue({ ok: true, datos: datosDgii("LEIDY SANCHEZ AQUINO") });
    const segunda = await autocompletarComoElWizard(
      "00800235491",
      primera.campos as PartesNombreDgii,
      primera.rellenos,
    );

    expect(segunda.campos.primerNombre).toBe("Leidy");
    expect(segunda.campos.primerApellido).toBe("Sanchez");
  });

  it("cuando la DGII no la encuentra muestra el error de la acción", async () => {
    buscar.mockResolvedValue({ ok: false, error: "No encontramos la cédula en el registro de la DGII." });

    const resultado = await autocompletarComoElWizard("40237721184", VACIOS, VACIOS);

    expect(resultado.tono).toBe("error");
    expect(resultado.texto).toBe("No encontramos la cédula en el registro de la DGII.");
    expect(resultado.campos).toEqual({});
  });

  it("cuando la consulta falla por red muestra el aviso genérico", async () => {
    buscar.mockRejectedValue(new Error("fetch failed"));

    const resultado = await autocompletarComoElWizard("40237721184", VACIOS, VACIOS);

    expect(resultado.tono).toBe("error");
    expect(resultado.texto).toBe("No se pudo consultar la DGII. Intenta de nuevo o escríbelo a mano.");
    expect(resultado.campos).toEqual({});
  });
});
