import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const POS = join(process.cwd(), "src", "app", "(pos)", "pos", "_components");
const WIZARD = readFileSync(join(POS, "devoluciones", "wizard-devolucion.tsx"), "utf8");
const LISTA = readFileSync(join(POS, "devoluciones", "devoluciones-pos.tsx"), "utf8");
const ACCIONES = readFileSync(join(process.cwd(), "src", "lib", "pos", "acciones.ts"), "utf8");

function cuerpoCrear(): string {
  const inicio = WIZARD.indexOf("async function crear()");
  if (inicio < 0) return "";
  return WIZARD.slice(inicio, WIZARD.indexOf("\n  function ", inicio + 1));
}

/**
 * Candado del QA de Waldy (23-11-2026): al crear una devolución la nota de
 * crédito ya quedó registrada, así que la lista de /pos/devoluciones tiene que
 * refrescarse sola. Si el flujo deja de refrescar, el cajero ve una lista
 * vieja y puede repetir la devolución.
 */
describe("devoluciones del POS: refresh al crear", () => {
  it("el wizard refresca la lista solo cuando la RPC confirmó la NC", () => {
    const crear = cuerpoCrear();
    expect(crear, "No existe crear() en wizard-devolucion.tsx").not.toBe("");

    const error = crear.indexOf("if (!respuesta.ok)");
    const refresco = crear.indexOf("onCreada(respuesta.data)");
    expect(
      refresco,
      "crear() tiene que avisar al padre con onCreada(respuesta.data) para refrescar la lista",
    ).toBeGreaterThan(-1);
    expect(
      error,
      "El refresh va después de comprobar el error: un fallo de la RPC no puede refrescar ni reportar éxito",
    ).toBeGreaterThan(-1);
    expect(error).toBeLessThan(refresco);
  });

  it("la lista refresca el servidor y selecciona la devolución recién creada", () => {
    const inicio = LISTA.indexOf("<WizardDevolucion");
    expect(inicio, "DevolucionesPos tiene que renderizar WizardDevolucion").toBeGreaterThan(-1);
    const bloque = LISTA.slice(inicio, LISTA.indexOf("/>", inicio));

    expect(
      bloque,
      "El padre debe pasar onCreada con router.refresh() para que la lista lea la NC nueva del servidor",
    ).toContain("router.refresh()");
    expect(bloque, "Tras crear, deja seleccionada la devolución nueva con su nota.id").toContain(
      "setDetalleId(creada.nota.id)",
    );
  });

  it("la server action revalida la ruta de devoluciones", () => {
    const inicio = ACCIONES.indexOf("export async function crearDevolucionPOS");
    expect(inicio, "No existe crearDevolucionPOS en acciones.ts").toBeGreaterThan(-1);
    const bloque = ACCIONES.slice(inicio, ACCIONES.indexOf("\nexport async function", inicio + 1));

    expect(bloque, "crearDevolucionPOS tiene que revalidar /pos/devoluciones después de crear la NC").toContain(
      'revalidatePath("/pos/devoluciones")',
    );
  });

  it("la devolución se fecha con el día en RD, no con la fecha UTC del servidor", () => {
    const crear = cuerpoCrear();
    expect(
      crear,
      "Envía fecha: hoyRD(): sin eso, después de las 8 PM la NC queda fechada mañana y no aparece en la lista",
    ).toContain("fecha: hoyRD()");
  });
});
