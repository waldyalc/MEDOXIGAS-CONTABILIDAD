import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();
const leer = (archivo: string) => readFileSync(join(RAIZ, archivo), "utf8");

/** Devuelve el texto de un job de `ci.yml` sin agregar un parser YAML. */
function bloqueDeTrabajo(yml: string, nombre: string) {
  const inicio = yml.indexOf(`\n  ${nombre}:`);
  expect(inicio, `CI no tiene el job «${nombre}»`).toBeGreaterThan(-1);
  const desde = inicio + 1;
  const siguiente = yml.slice(desde + 1).search(/\n {2}[a-z][a-z0-9_-]*:\n/);
  return siguiente === -1 ? yml.slice(desde) : yml.slice(desde, desde + 1 + siguiente);
}

/**
 * Candado de velocidad (auditoría punto 5): el test del ticket 80 mm lanza
 * Chromium real y usa Poppler, así que vive en su propio carril. Si alguien
 * lo devuelve a `pnpm test` o mete las herramientas en el job `ci`, esto falla.
 * Correr con `pnpm test:pdf`; ver skill `ticket-80mm`.
 */
describe("carril del test de ticket 80 mm", () => {
  it("pnpm test excluye el test que lanza Chromium y Poppler", () => {
    expect(leer("vitest.config.mts")).toMatch(/exclude:\s*\[[^\]]*"src\/lib\/pos\/ticket-pdf\.test\.tsx"/);
  });

  it("pnpm test:pdf corre solo el test del ticket", () => {
    expect(leer("vitest.pdf.config.mts")).toContain('include: ["src/lib/pos/ticket-pdf.test.tsx"]');
    const scripts = JSON.parse(leer("package.json")).scripts;
    expect(scripts["test:pdf"]).toBe("vitest run --config vitest.pdf.config.mts");
  });

  it("CI deja Chromium y Poppler solo en el job pdf", () => {
    const ci = leer(".github/workflows/ci.yml");
    expect(bloqueDeTrabajo(ci, "ci")).not.toMatch(/playwright install|poppler-utils/);
    const pdf = bloqueDeTrabajo(ci, "pdf");
    expect(pdf).toMatch(/playwright install/);
    expect(pdf).toMatch(/poppler-utils/);
    expect(pdf).toContain("pnpm test:pdf");
  });
});
