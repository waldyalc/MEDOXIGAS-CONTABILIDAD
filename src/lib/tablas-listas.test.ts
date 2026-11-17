import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const COMPONENTE = join(SRC, "components", "listas", "tabla-lista.tsx");

/**
 * Listas ya migradas al patrón Facturas. Al migrar otra, agrégala aquí con su
 * ruta relativa a `src/`; el candado exige que use el componente compartido.
 */
const LISTAS_MIGRADAS = [
  "app/(main)/dashboard/facturacion/_components/facturas-tabla.tsx",
  "app/(main)/dashboard/contabilidad/numeraciones/_components/numeraciones-cliente.tsx",
  "app/(main)/dashboard/reportes/compras/_components/tabla-compras.tsx",
] as const;

function leer(ruta: string): string {
  return readFileSync(join(SRC, ruta), "utf8");
}

describe("tablas de listas unificadas", () => {
  it("cada lista migrada importa TablaLista", () => {
    for (const archivo of LISTAS_MIGRADAS) {
      const importa = /import\s*\{[^}]*\bTablaLista\b[^}]*\}\s*from\s*"@\/components\/listas\/tabla-lista"/.test(
        leer(archivo),
      );

      expect(
        importa,
        `${archivo} debe importar TablaLista de "@/components/listas/tabla-lista" (patrón Facturas); no reescribas la tabla a mano.`,
      ).toBe(true);
    }
  });

  it("cada lista migrada usa PillEstado y no define pills locales", () => {
    for (const archivo of LISTAS_MIGRADAS) {
      const contenido = leer(archivo);

      expect(
        /\b(?:function|const)\s+(?:EstadoPill|EstadoBadge)\b/.test(contenido),
        `${archivo} define EstadoPill/EstadoBadge local. Bórralo e importa PillEstado de "@/components/listas/tabla-lista" con el tono del estado.`,
      ).toBe(false);
    }
  });

  it("tabla-lista conserva las clases canónicas de la guía", () => {
    const contenido = readFileSync(COMPONENTE, "utf8");
    const clases = [
      ["h-14", "las filas de 56 px"],
      ["h-12", "la cabecera de 48 px"],
      ["bg-slate-200/20", "la cabecera con fondo slate-200/20"],
      ["text-[11px]", "la pill de 11 px"],
    ] as const;

    for (const [clase, pieza] of clases) {
      expect(
        contenido.includes(clase),
        `tabla-lista.tsx perdió ${pieza}. Restaura la clase "${clase}" según docs/diseno/tablas-unificadas.md (nota de espaciado 48/56); no cambies la guía para que pase el test.`,
      ).toBe(true);
    }
  });

  it("las listas migradas usan el contenedor centrado", () => {
    const contenido = readFileSync(COMPONENTE, "utf8");

    expect(
      contenido.includes("max-w-[1289px]") && contenido.includes("mx-auto"),
      "tabla-lista.tsx debe exportar ContenedorLista con mx-auto y max-w-[1289px] para que la tarjeta no se estire en pantallas anchas.",
    ).toBe(true);

    const pagina = leer("app/(main)/dashboard/facturacion/page.tsx");
    expect(
      /import\s*\{[^}]*\bContenedorLista\b[^}]*\}\s*from\s*"@\/components\/listas\/tabla-lista"/.test(pagina),
      "facturacion/page.tsx debe envolver el encabezado y la tarjeta con ContenedorLista (no repitas mx-auto max-w-[1289px] a mano).",
    ).toBe(true);
  });

  it("tabla-lista se puede usar desde componentes de servidor", () => {
    expect(
      /^\s*["']use client["']/m.test(readFileSync(COMPONENTE, "utf8")),
      'tabla-lista.tsx no puede llevar "use client": las páginas de servidor le pasan funciones `celda`. Aísla lo interactivo en su propio componente cliente.',
    ).toBe(false);
  });
});
