import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DASHBOARD = join(process.cwd(), "src", "app", "(main)", "dashboard");

function listarPaginas(archivo: string): string[] {
  return readdirSync(archivo, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(archivo, entrada.name);
    if (entrada.isDirectory()) return listarPaginas(ruta);
    return entrada.name === "page.tsx" ? [ruta] : [];
  });
}

function rutaRelativa(ruta: string) {
  return relative(DASHBOARD, ruta).split(sep).join("/");
}

const PAGINAS = listarPaginas(DASHBOARD);

/** Piloto de la fase 1a: el marco de la página es EncabezadoPagina + contenedor. */
const PAGINAS_MIGRADAS = ["facturacion/page.tsx", "compras/page.tsx", "facturacion/nueva/page.tsx"] as const;

/**
 * Deuda congelada de la fase 1b. Son las page.tsx que todavía traen `h1.text-3xl`
 * (30 px, el tamaño de la plantilla vieja); no se pueden tocar todas en este PR.
 * Al migrar una pantalla a `EncabezadoPagina`, quítala de esta lista: el test falla
 * si una entrada ya no tiene `text-3xl` (la lista solo puede encoger).
 */
const PENDIENTES_TEXT_3XL = [
  "bancos/[id]/page.tsx",
  "bancos/conciliaciones/[id]/page.tsx",
  "bancos/conciliaciones/nueva/page.tsx",
  "bancos/conciliaciones/page.tsx",
  "bancos/page.tsx",
  "bancos/transferencias/[id]/page.tsx",
  "conduces/page.tsx",
  "configuracion/page.tsx",
  "contabilidad/activos/page.tsx",
  "contabilidad/asientos/page.tsx",
  "contabilidad/numeraciones/page.tsx",
  "contabilidad/page.tsx",
  "contabilidad/periodos/page.tsx",
  "cotizaciones/page.tsx",
  "facturas-recurrentes/page.tsx",
  "gastos/page.tsx",
  "notas-credito/page.tsx",
  "notas-debito/page.tsx",
  "pagos-recibidos/page.tsx",
  "reportes/page.tsx",
] as const;

const AYUDA_TITULO =
  "Usa <EncabezadoPagina titulo=... subtitulo=... migas=... /> de src/components/pagina/encabezado-pagina.tsx: " +
  "el h1 de página es 20 px / 600 (text-xl font-semibold), como en Alegra. No escribas h1 sueltos ni text-3xl " +
  "(30 px) o text-2xl en el marco de la página; si es un piloto de la fase 1, quita el archivo de PENDIENTES_TEXT_3XL.";

const AYUDA_ANCHO =
  "El ancho lo decide el contenedor, no la pantalla: <ContenedorFormulario> o <ContenedorDetalle> (1040 px) de " +
  "src/components/pagina/contenedor-pagina.tsx, o <ContenedorLista> (1289 px) de src/components/listas/tabla-lista.tsx. " +
  "No pongas max-w-2xl/3xl/4xl/6xl en el contenedor de la page.tsx.";

function leer(ruta: string): string {
  return readFileSync(join(DASHBOARD, ruta), "utf8");
}

describe("marco de las páginas del dashboard", () => {
  it("las páginas migradas usan EncabezadoPagina con migas y sin h1 propio", () => {
    const infractores = PAGINAS_MIGRADAS.filter((ruta) => {
      const texto = leer(ruta);
      const usaEncabezado =
        /from "@\/components\/pagina\/encabezado-pagina"/.test(texto) && /<EncabezadoPagina\b/.test(texto);
      return !usaEncabezado || !/\bmigas=/.test(texto) || /<h1[\s>]/.test(texto);
    });

    expect(infractores, AYUDA_TITULO).toEqual([]);
  });

  it("las páginas migradas no eligen su ancho con max-w-* de formulario", () => {
    const infractores = PAGINAS_MIGRADAS.filter((ruta) => /max-w-(2xl|3xl|4xl|6xl)\b/.test(leer(ruta)));

    expect(infractores, AYUDA_ANCHO).toEqual([]);
  });

  it("no estrena text-3xl en las page.tsx del dashboard", () => {
    const infractores = PAGINAS.map(rutaRelativa).filter(
      (ruta) => /text-3xl/.test(leer(ruta)) && !(PENDIENTES_TEXT_3XL as readonly string[]).includes(ruta),
    );

    expect(infractores, AYUDA_TITULO).toEqual([]);
  });

  it("la lista de pendientes de text-3xl solo encoge", () => {
    const yaMigradas = PENDIENTES_TEXT_3XL.filter((ruta) => !/text-3xl/.test(leer(ruta)));

    expect(yaMigradas, `Estas páginas ya no tienen text-3xl: quítalas de PENDIENTES_TEXT_3XL. ${AYUDA_TITULO}`).toEqual(
      [],
    );
  });
});
