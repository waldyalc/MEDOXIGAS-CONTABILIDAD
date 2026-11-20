import { describe, expect, it } from "vitest";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = process.cwd();
const SRC = join(RAIZ, "src");
const UI = join(SRC, "components", "ui");
const FECHA_NATIVA = /type\s*=\s*["']date["']/;

// Temporal: esa pantalla la migra otro PR en paralelo. El Orquestador vacía esta lista al integrar.
const PENDIENTES: readonly string[] = ["src/app/(main)/dashboard/contabilidad/cuentas/[id]/page.tsx"];

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
      .filter((ruta) => !PENDIENTES.includes(rutaRelativa(ruta)))
      .filter((ruta) => FECHA_NATIVA.test(readFileSync(ruta, "utf8")))
      .map(rutaRelativa);

    expect(infractores, MENSAJE).toEqual([]);
  });

  it("PENDIENTES no guarda rutas que ya no existen", () => {
    const inexistentes = PENDIENTES.filter((ruta) => !existsSync(join(RAIZ, ruta)));

    expect(inexistentes, "Quita de PENDIENTES (src/lib/fechas-nativas.test.ts) las rutas que ya no existen").toEqual(
      [],
    );
  });
});
