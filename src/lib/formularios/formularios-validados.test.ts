import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");
const RUTAS = [join(SRC, "app"), join(SRC, "components")];

function listar(archivo: string): string[] {
  return readdirSync(archivo, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(archivo, entrada.name);
    if (entrada.isDirectory()) return listar(ruta);
    return /\.tsx$/.test(entrada.name) ? [ruta] : [];
  });
}

function rutaRelativa(ruta: string) {
  return relative(SRC, ruta).split(sep).join("/");
}

const ARCHIVOS = RUTAS.flatMap(listar);

describe("formularios validados", () => {
  it("los formularios con CampoFormulario desactivan la validación nativa", () => {
    const infractores = ARCHIVOS.filter((ruta) => {
      const contenido = readFileSync(ruta, "utf8");
      const usaCampo = contenido.includes("CampoFormulario");
      const tieneForm = /<form[\s>]/.test(contenido);
      return usaCampo && tieneForm && !contenido.includes("noValidate");
    });

    expect(
      infractores.map(rutaRelativa),
      "Agrega noValidate al <form> para que el navegador no bloquee el submit antes de mostrar los errores en rojo",
    ).toEqual([]);
  });
});
