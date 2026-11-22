import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");
const POS = join(SRC, "app", "(pos)", "pos");
const GLOBALS = join(SRC, "app", "globals.css");

/**
 * Candado del rediseño Alegra del POS (decisión de Waldy, 22-11-2026):
 * el POS se ve como Alegra — teal #00b19d y tokens `--pos-*` propios — y
 * nunca usa el `--primary` azul de Medoxigas ni el hex `#1e56c7`.
 *
 * PENDIENTES: archivos que hoy todavía usan el azul y se migran después.
 * La lista SOLO PUEDE ENCOGERSE: al migrar un archivo se borra de aquí;
 * agregarlo de vuelta rompe el test. Archivo nuevo con `--primary` también
 * rompe el test (no está en la lista).
 */
const PENDIENTES = [
  "_components/devoluciones/confirmacion-devolucion.tsx",
  "_components/devoluciones/wizard-devolucion.tsx",
  "_components/estado-turno-pos.tsx",
  "_components/historial/detalle-venta-pos.tsx",
  "_components/menu-pos-estilos.ts",
  "_components/menu-pos.tsx",
  "_components/pagos/lista-pagos.tsx",
  "_components/vender/checkout-pos.tsx",
  "_components/vender/confirmacion-venta.tsx",
  "_components/vender/dialogo-venta-simple.tsx",
];

function listar(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) return listar(ruta);
    return /\.(tsx?|css|jsx)$/.test(entrada.name) ? [ruta] : [];
  });
}

function rutaRelativa(ruta: string) {
  return relative(POS, ruta).split(sep).join("/");
}

const ARCHIVOS = listar(POS);
const MARCA_AZUL = /#1e56c7|--primary|(?:bg|text|border|ring|fill|stroke|from|to|via|shadow|outline)-primary\b/;

describe("diseño POS estilo Alegra", () => {
  it("los archivos del POS no usan --primary ni #1e56c7 salvo los pendientes", () => {
    const infractores = ARCHIVOS.filter((ruta) => MARCA_AZUL.test(readFileSync(ruta, "utf8"))).map(rutaRelativa);
    const nuevos = infractores.filter((archivo) => !PENDIENTES.includes(archivo));

    expect(
      nuevos,
      `Estos archivos usan el azul de Medoxigas; cámbialos por tokens pos-*: ${nuevos.join(", ")}`,
    ).toEqual([]);
    expect(infractores, "La lista PENDIENTES tiene archivos de más o alguno ya está migrado: actualízala").toEqual(
      [...PENDIENTES].sort(),
    );
  });

  it("globals.css define la paleta POS (--pos-*) en claro y oscuro", () => {
    const css = readFileSync(GLOBALS, "utf8");
    const tokens = [
      "--pos-primario",
      "--pos-primario-hover",
      "--pos-acento",
      "--pos-acento-texto",
      "--pos-oscuro",
      "--pos-linea",
      "--pos-panel",
      "--pos-texto",
      "--pos-texto-suave",
      "--pos-icono",
    ];

    for (const token of tokens) {
      expect(css, `Falta ${token} en globals.css`).toContain(`${token}:`);
      expect(css, `Falta el alias --color-${token.slice(2)} en @theme`).toContain(`--color-${token.slice(2)}:`);
    }
    expect(css, "El teal de Alegra #00b19d debe estar en globals.css").toContain("#00b19d");
  });
});
