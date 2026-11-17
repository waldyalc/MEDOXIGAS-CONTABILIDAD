import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Candado del 17/11/2026: el botón «Autocompletar» de la DGII debe verse sin
 * abrir «Más opciones». En el formulario del contacto estaba escondido ahí y el
 * perfil del cliente no lo mostraba al crear ni al editar.
 */
const CONTACTOS = join(process.cwd(), "src", "components", "contactos");

function leer(nombre: string): string {
  return readFileSync(join(CONTACTOS, nombre), "utf8");
}

describe("autocompletar con la DGII en los formularios de contacto", () => {
  it("el diálogo de Nuevo contacto muestra el botón y el mensaje", () => {
    const codigo = leer("dialogo-nuevo-contacto.tsx");
    expect(codigo).toContain("<BotonAutocompletarDgii");
    expect(codigo).toContain("<MensajeDgii");
  });

  it("el formulario del contacto (crear, editar y ficha) muestra el botón y el mensaje", () => {
    const codigo = leer("formulario-contacto.tsx");
    expect(codigo).toContain("<BotonAutocompletarDgii");
    expect(codigo).toContain("<MensajeDgii");
  });

  it("el botón de la DGII no queda escondido dentro de «Más opciones»", () => {
    const codigo = leer("formulario-contacto.tsx");
    const inicio = codigo.indexOf("<Collapsible");
    const fin = codigo.indexOf("</Collapsible>");
    expect(inicio, "No se encontró el bloque «Más opciones» de formulario-contacto.tsx").toBeGreaterThan(-1);
    expect(fin, "No se encontró el cierre del bloque «Más opciones»").toBeGreaterThan(inicio);

    const masOpciones = codigo.slice(inicio, fin);
    expect(
      masOpciones,
      "Saca BotonAutocompletarDgii del Collapsible «Más opciones»: con el formulario cerrado el usuario no lo ve",
    ).not.toContain("<BotonAutocompletarDgii");
  });
});
