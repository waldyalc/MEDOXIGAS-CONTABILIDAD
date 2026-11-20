import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = process.cwd();
const SRC = join(RAIZ, "src");
const UI = join(SRC, "components", "ui");
const FECHA_NATIVA = /type\s*=\s*["']date["']/;

const MENSAJE =
  'Usa DatePicker, o DatePickerCampo para formularios GET/FormData, de src/components/date-picker.tsx; no <input type="date"> nativo.';

function listar(archivo: string): string[] {
  return readdirSync(archivo, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(archivo, entrada.name);
    if (entrada.isDirectory()) return listar(ruta);
    return /\.(ts|tsx)$/.test(entrada.name) && !/\.test\./.test(entrada.name) ? [ruta] : [];
  });
}

function rutaRelativa(ruta: string) {
  return relative(RAIZ, ruta).split(sep).join("/");
}

describe("fechas nativas", () => {
  it('no usa <input type="date"> fuera de components/ui', () => {
    const infractores = listar(SRC)
      .filter((ruta) => !ruta.startsWith(`${UI}${sep}`))
      .filter((ruta) => FECHA_NATIVA.test(readFileSync(ruta, "utf8")))
      .map(rutaRelativa);

    expect(infractores, MENSAJE).toEqual([]);
  });
});
