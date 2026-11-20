import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Candado: las fichas muestran solo datos reales de Supabase. Un estado vacío
 * honesto es preferible a filas o tarjetas inventadas que parezcan del cliente.
 * Si falta un dato, se dice «sin registros»; nunca se rellena con ejemplos.
 */
const SRC = join(process.cwd(), "src");
const FICHAS = [
  join(SRC, "app", "(main)", "dashboard", "contactos", "[id]"),
  join(SRC, "app", "(main)", "dashboard", "productos", "[id]"),
];

function listar(archivo: string): string[] {
  return readdirSync(archivo, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(archivo, entrada.name);
    if (entrada.isDirectory()) return listar(ruta);
    return /\.(tsx|ts)$/.test(entrada.name) ? [ruta] : [];
  });
}

function rutaRelativa(ruta: string) {
  return relative(SRC, ruta).split(sep).join("/");
}

const ARCHIVOS = FICHAS.flatMap(listar);

/** Constantes y textos del diseño anterior: contactos ficticios de la ficha. */
const DATOS_FICTICIOS = [
  "PERSONAS_EJEMPLO",
  "ADJUNTOS_EJEMPLO",
  "Ana García",
  "Luis Peña",
  "María Santos",
  "Carlos Núñez",
  "Rosa Díaz",
  "@empresa.com",
  "555-010",
];

function leer(ruta: string): string {
  return readFileSync(ruta, "utf8");
}

describe("fichas sin datos de ejemplo", () => {
  it("encuentra las fichas de contactos y productos", () => {
    expect(ARCHIVOS.length).toBeGreaterThan(0);
  });

  it("no define constantes *_EJEMPLO", () => {
    const infractores = ARCHIVOS.filter((ruta) => /\b[A-Z0-9_]+_EJEMPLO\b/.test(leer(ruta)));

    expect(
      infractores.map(rutaRelativa),
      "Quita los datos de ejemplo: la ficha debe mostrar solo datos reales o un estado vacío honesto.",
    ).toEqual([]);
  });

  it("no reintroduce los contactos ficticios del diseño", () => {
    const infractores = ARCHIVOS.filter((ruta) => {
      const codigo = leer(ruta);
      return DATOS_FICTICIOS.some((texto) => codigo.includes(texto));
    });

    expect(
      infractores.map(rutaRelativa),
      "Esos nombres, correos y teléfonos eran datos de ejemplo; no los vuelvas a poner en una ficha.",
    ).toEqual([]);
  });

  it("no justifica datos inventados con comentarios", () => {
    const infractores = ARCHIVOS.filter((ruta) => /datos de ejemplo/i.test(leer(ruta)));

    expect(
      infractores.map(rutaRelativa),
      "Si no hay backend para un dato, muestra un estado vacío; no dejes comentarios que justifiquen datos inventados.",
    ).toEqual([]);
  });
});
