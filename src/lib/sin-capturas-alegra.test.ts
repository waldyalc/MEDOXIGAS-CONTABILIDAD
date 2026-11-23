import { describe, expect, it } from "vitest";

import { execFileSync } from "node:child_process";
import { basename } from "node:path";

/**
 * Candado de la auditoría Punto 1 (23-11-2026): el repo es público y AGENTS.md
 * prohíbe commitear capturas, HTML ni CSS de Alegra. Las capturas de referencia
 * viven FUERA del repo, en `/root/referencias/` del VPS.
 *
 * LEGADO: archivos que ya estaban en `main` antes de este candado. No se tocan
 * aquí (se reportan aparte); esta lista SOLO PUEDE ENCOGERSE. Un archivo nuevo
 * con «alegra» en el nombre rompe el test, y si uno de estos desaparece hay que
 * borrarlo de la lista.
 */
const AYUDA =
  "Las capturas de Alegra no se commitean: el repo es público. " +
  "Guárdalas fuera del repo, en /root/referencias/ del VPS, y deja en docs/ solo texto propio.";

const CARPETA_CAPTURAS = "docs/diseno/alegra-pos/";

/** El candado mismo lleva «alegra» en el nombre: se excluye solo a sí mismo. */
const PROPIO = "src/lib/sin-capturas-alegra.test.ts";

const LEGADO = new Set([
  "docs/PLAN-FASE-3-REDISENO-ALEGRA.md",
  "docs/alegra/ALEGRA.md",
  "docs/alegra/catalogo-cuentas-alegra.xlsx",
  "docs/alegra/nomina/ALEGRA-NOMINA.md",
  "docs/alegra/nomina/DESIGN-ALEGRA-NOMINA.md",
  "docs/alegra/pos/alegra-pos.md",
  "docs/alegra/pos/design-alegra-pos.md",
  "docs/alegra/ref-vista/alegra-factura-vista.png",
  "docs/alegra/reporte-investigacion-inventario-fiscal/reporte-investigacion-alegra.md",
  "docs/diseno/auditoria-diseno-vs-alegra.md",
  "docs/planes/rediseno-alegra/img/02-alegra-pos-carrito.png",
  "docs/planes/rediseno-alegra/img/03-alegra-pos-menu.png",
  "docs/planes/rediseno-alegra/img/05-alegra-registro-pagos.png",
  "supabase/migrations/20261117210938_producto_campos_alegra.sql",
  "supabase/tests/comparacion_alegra_test.sql",
  "supabase/tests/motor_compras_alegra_test.sql",
  "supabase/tests/producto_campos_alegra_test.sql",
]);

function archivosRastreados(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: process.cwd(), encoding: "utf8" }).split("\0").filter(Boolean);
}

const ARCHIVOS = archivosRastreados();

describe("capturas de Alegra fuera del repo", () => {
  it("bajo docs/diseno/alegra-pos/ solo quedan guías .md", () => {
    const noSonGuias = ARCHIVOS.filter((ruta) => ruta.startsWith(CARPETA_CAPTURAS) && !ruta.endsWith(".md"));

    expect(noSonGuias, AYUDA).toEqual([]);
  });

  it("ningún archivo nuevo lleva «alegra» en el nombre", () => {
    const conNombre = ARCHIVOS.filter((ruta) => ruta !== PROPIO && /alegra/i.test(basename(ruta)) && !LEGADO.has(ruta));

    expect(conNombre, AYUDA).toEqual([]);
  });

  it("la lista de legado solo encoge", () => {
    const rastreados = new Set(ARCHIVOS);
    const yaNoExisten = [...LEGADO].filter((ruta) => !rastreados.has(ruta));

    expect(
      yaNoExisten,
      "Un archivo de la lista LEGADO ya no existe: bórralo de la lista (solo puede encoger).",
    ).toEqual([]);
  });
});
