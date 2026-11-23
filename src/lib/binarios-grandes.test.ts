import { describe, expect, it } from "vitest";

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Candado de binarios (auditoría VPS, 23-11-2026):
 *
 * 1. Ningún archivo binario commiteado puede pesar más de 200 KB.
 * 2. Ninguna imagen puede llevar «alegra» en el nombre ni estar bajo
 *    docs/diseno/alegra-pos/ (material de estudio de Alegra: no se commitea).
 *
 * Lo que ya estaba commiteado quedó abuelado en binarios-permitidos.txt; la
 * lista solo puede ENCOGER (si tu PR borra archivos, borra también su línea).
 * Un binario nuevo permitido por Waldy se anota a mano en ese archivo con el
 * motivo en el mensaje del commit.
 */

const TOPE_BYTES = 200 * 1024;
const DIR_ALEGRA_POS = "docs/diseno/alegra-pos/";

const EXT_BINARIA = new Set(
  "png jpg jpeg webp gif ico bmp tif tiff avif heic heif pdf zip gz tgz bz2 xz 7z rar xlsx xls xlsm xlsb doc docx ppt pptx woff woff2 ttf otf eot mp3 mp4 webm mov m4a wav ogg sqlite sqlite3 db wasm jar exe dll so dylib icns snap dmg iso".split(
    " ",
  ),
);
const EXT_IMAGEN = new Set("png jpg jpeg webp gif ico bmp avif svg".split(" "));

function archivosCommiteados(): string[] {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((ruta) => ruta.length > 0 && existsSync(ruta));
}

function esBinario(ruta: string): boolean {
  const extension = ruta.split(".").pop()?.toLowerCase() ?? "";
  if (EXT_BINARIA.has(extension)) return true;
  // Texto con otro nombre (singlefile.html, .sql, .ts) nunca contiene NUL.
  const cabeza = readFileSync(ruta).subarray(0, 8192);
  return cabeza.includes(0);
}

function esImagen(ruta: string): boolean {
  return EXT_IMAGEN.has(ruta.split(".").pop()?.toLowerCase() ?? "");
}

const PERMITIDOS = new Set(
  readFileSync(join(process.cwd(), "src", "lib", "binarios-permitidos.txt"), "utf8")
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0 && !linea.startsWith("#")),
);

const AYUDA_GRANDES =
  "Un binario de más de 200 KB no entra al repo. Comprime la imagen (<=200 KB), " +
  "súbela al bucket de Supabase o guárdala fuera del repo (/root/referencias/). " +
  "Si Waldy la aprueba, añade la ruta a src/lib/binarios-permitidos.txt con el motivo en el commit.";
const AYUDA_ALEGRA =
  "Capturas y material de Alegra NO se commitean (sus términos lo prohíben). " +
  "Guárdalas fuera del repo o en /root/referencias/; en docs/ solo van guías destiladas en texto.";

describe("binarios grandes", () => {
  const archivos = archivosCommiteados();

  it("sin binarios nuevos de más de 200 KB", () => {
    const infractores = archivos.filter((ruta) => {
      if (PERMITIDOS.has(ruta)) return false;
      try {
        return statSync(ruta).size > TOPE_BYTES && esBinario(ruta);
      } catch {
        return false;
      }
    });
    expect(infractores, AYUDA_GRANDES).toEqual([]);
  });

  it("sin imágenes con «alegra» en el nombre ni bajo docs/diseno/alegra-pos/", () => {
    const infractores = archivos.filter((ruta) => {
      if (PERMITIDOS.has(ruta) || !esImagen(ruta)) return false;
      const nombre = (ruta.split("/").pop() ?? "").toLowerCase();
      return nombre.includes("alegra") || ruta.startsWith(DIR_ALEGRA_POS);
    });
    expect(infractores, AYUDA_ALEGRA).toEqual([]);
  });
});
