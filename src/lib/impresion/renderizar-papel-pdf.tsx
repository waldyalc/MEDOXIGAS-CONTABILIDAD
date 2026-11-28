/**
 * Tubería server-side reutilizable para convertir un papel del sistema
 * (`DocumentoPapel`, `PapelImpresion` y derivados) en un PDF Carta real:
 *
 *   renderToStaticMarkup → Tailwind v4 compilado con postcss (mismo patrón
 *   que `src/lib/pos/ticket-pdf.test.tsx`) → reglas de impresión copiadas de
 *   `globals.css` (`@page` letter sin márgenes, print-color-adjust) → fuente
 *   Inter embebida como @font-face base64 → Chromium (`@playwright/test`) →
 *   `page.pdf({ format: "Letter", printBackground: true, margin: 0 })`.
 *
 * Los woff2 latin de Inter (400/600/700) viven en caché local en
 * `/root/referencias/fonts/inter/`; si faltan, el papel cae a la pila
 * sans-serif del sistema con una advertencia, nunca falla por la fuente.
 */

import type { ReactElement } from "react";

import { type Browser, chromium } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * `postcss` y `@tailwindcss/postcss` se cargan con require porque el tsconfig
 * de scripts (moduleResolution "node") no resuelve los tipos de paquetes que
 * solo exponen `exports`; el runtime de Node sí los resuelve sin problema.
 * El nombre va en variable para que TypeScript no intente resolver los tipos
 * del paquete en tiempo de compilación.
 */
interface ProcesadorPostcss {
  process(entrada: string, opciones: { from: string }): Promise<{ css: string }>;
}

const PAQUETE_POSTCSS = "postcss";
const PAQUETE_TAILWIND_POSTCSS = "@tailwindcss/postcss";
// biome-ignore lint/style/noCommonJs: los tipos del paquete no resuelven con moduleResolution "node" de los scripts
const postcss = require(PAQUETE_POSTCSS) as (plugins: unknown[]) => ProcesadorPostcss;
// biome-ignore lint/style/noCommonJs: los tipos del paquete no resuelven con moduleResolution "node" de los scripts
const tailwind = require(PAQUETE_TAILWIND_POSTCSS) as () => unknown;

const DIRECTORIO_FUENTES_INTER = "/root/referencias/fonts/inter";
const PESOS_INTER = [400, 600, 700] as const;

/**
 * Reglas de impresión copiadas de `src/app/globals.css` (solo lectura: la
 * tubería no edita globals.css). `@page documento-venta` letter sin márgenes
 * y print-color-adjust exact dentro del papel, igual que en producción.
 */
const CSS_IMPRESION = `
@page {
  size: letter;
  margin: 0;
}

@page documento-venta {
  size: letter;
  margin: 0;
}

.documento-papel {
  page: documento-venta;
}

html,
body {
  width: auto !important;
  height: auto !important;
  margin: 0 !important;
  overflow: visible !important;
  background: #fff !important;
}

[data-print-root] {
  display: block !important;
  width: auto !important;
  height: auto !important;
  margin: 0 !important;
  overflow: visible !important;
  background: #fff !important;
}

[data-print-root] [data-print-paper] {
  width: auto !important;
  height: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  background: #fff !important;
  box-shadow: none !important;
}

[data-print-root] [data-print-paper],
[data-print-root] [data-print-paper] * {
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
`;

function cssFuentesInter(): string {
  const caras: string[] = [];
  for (const peso of PESOS_INTER) {
    const ruta = path.join(DIRECTORIO_FUENTES_INTER, `inter-latin-${peso}-normal.woff2`);
    if (!existsSync(ruta)) {
      console.warn(`renderizar-papel-pdf: falta ${ruta}; el peso ${peso} cae a sans-serif del sistema`);
      continue;
    }
    const base64 = readFileSync(ruta).toString("base64");
    caras.push(`@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: ${peso};
  font-display: swap;
  src: url(data:font/woff2;base64,${base64}) format("woff2");
}`);
  }

  const familia =
    caras.length > 0 ? '"Inter", ui-sans-serif, system-ui, sans-serif' : "ui-sans-serif, system-ui, sans-serif";
  return `${caras.join("\n")}\n:root { --font-inter: ${familia}; --font-sans: ${familia}; }\n`;
}

let promesaCss: Promise<string> | null = null;

/** Compila Tailwind v4 una sola vez por proceso y cachea el CSS resultante. */
export function compilarCssPapel(): Promise<string> {
  if (!promesaCss) {
    const entrada = '@import "tailwindcss"; @source "./src/components"; @source "./src/lib";';
    promesaCss = postcss([tailwind()])
      .process(entrada, { from: path.resolve("papel-pdf.css") })
      .then((resultado) => `${resultado.css}\n${cssFuentesInter()}\n${CSS_IMPRESION}`);
  }
  return promesaCss;
}

let promesaNavegador: Promise<Browser> | null = null;

function obtenerNavegador(): Promise<Browser> {
  if (!promesaNavegador) {
    promesaNavegador = chromium.launch({ args: ["--no-sandbox"] });
  }
  return promesaNavegador;
}

/** Cierra el Chromium compartido; llamar al final de scripts o suites. */
export async function cerrarNavegadorPapel(): Promise<void> {
  if (!promesaNavegador) return;
  const navegador = await promesaNavegador.catch(() => null);
  promesaNavegador = null;
  await navegador?.close();
}

/** Envuelve el papel en la misma estructura de impresión de producción. */
export function envolverPapelHtml(markup: string, css: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="margin:0"><div data-print-root><div data-print-paper>${markup}</div></div></body></html>`;
}

/**
 * Renderiza un elemento React de papel del sistema a un PDF Carta y devuelve
 * el buffer. El elemento debe ser server-renderable (`renderToStaticMarkup`):
 * `DocumentoPapel` o los documentos `PapelImpresion` derivados.
 */
export async function renderizarPapelPdf(elemento: ReactElement): Promise<Buffer> {
  const [css, navegador] = await Promise.all([compilarCssPapel(), obtenerNavegador()]);
  const markup = renderToStaticMarkup(elemento);
  const pagina = await navegador.newPage();
  try {
    await pagina.setContent(envolverPapelHtml(markup, css), { waitUntil: "load" });
    await pagina.emulateMedia({ media: "print" });
    const pdf = await pagina.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await pagina.close();
  }
}
