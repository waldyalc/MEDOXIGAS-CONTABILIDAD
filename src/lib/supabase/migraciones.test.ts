import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIRECTORIO = join(process.cwd(), "supabase", "migrations");
const FRONTERA = "20261123000000";
const HISTORICAS = 58;
const FORMATO = /^(\d{14})_[a-z0-9_]+\.sql$/;

const ARCHIVOS = readdirSync(DIRECTORIO, { withFileTypes: true })
  .filter((entrada) => entrada.isFile())
  .map((entrada) => entrada.name);
const MIGRACIONES = ARCHIVOS.filter((nombre) => nombre.endsWith(".sql"));

const AYUDA =
  "Nombra la migración con un timestamp UTC real YYYYMMDDHHMMSS, estrictamente mayor a " +
  `${FRONTERA} (por ejemplo 20261125143000_mi_cambio.sql), en minúsculas y solo [a-z0-9_]. ` +
  "Supabase aplica los archivos en orden lexicográfico: un prefijo inválido, repetido o anterior " +
  "al historial ya aplicado queda desordenado y rompe `supabase db reset` / `supabase db push`.";

function version(nombre: string): string | null {
  return FORMATO.exec(nombre)?.[1] ?? null;
}

function esTimestampValido(prefijo: string): boolean {
  const anio = Number(prefijo.slice(0, 4));
  const mes = Number(prefijo.slice(4, 6));
  const dia = Number(prefijo.slice(6, 8));
  const hora = Number(prefijo.slice(8, 10));
  const minuto = Number(prefijo.slice(10, 12));
  const segundo = Number(prefijo.slice(12, 14));
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto, segundo));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia &&
    fecha.getUTCHours() === hora &&
    fecha.getUTCMinutes() === minuto &&
    fecha.getUTCSeconds() === segundo
  );
}

describe("migraciones de Supabase", () => {
  it("todas cumplen YYYYMMDDHHMMSS_nombre_en_minusculas.sql", () => {
    const invalidas = MIGRACIONES.filter((nombre) => !FORMATO.test(nombre));

    expect(invalidas, AYUDA).toEqual([]);
  });

  it("no hay versiones de 14 dígitos duplicadas", () => {
    const porVersion = new Map<string, string[]>();

    for (const nombre of MIGRACIONES) {
      const prefijo = version(nombre);
      if (prefijo === null) continue;
      porVersion.set(prefijo, [...(porVersion.get(prefijo) ?? []), nombre]);
    }

    const duplicadas = [...porVersion.entries()]
      .filter(([, nombres]) => nombres.length > 1)
      .map(([prefijo, nombres]) => `${prefijo}: ${nombres.join(", ")}`);

    expect(duplicadas, `Dos migraciones comparten prefijo. ${AYUDA}`).toEqual([]);
  });

  it("están en orden estrictamente creciente", () => {
    const ordenadas = [...MIGRACIONES].sort();
    const versiones = ordenadas.flatMap((nombre) => {
      const prefijo = version(nombre);
      return prefijo === null ? [] : [prefijo];
    });

    const retrocesos = versiones.filter((prefijo, indice) => {
      const anterior = versiones[indice - 1];
      return anterior !== undefined && prefijo <= anterior;
    });

    expect(retrocesos, `Hay versiones repetidas o fuera de orden. ${AYUDA}`).toEqual([]);
  });

  it("no agrega migraciones dentro del historial ya aplicado", () => {
    const historicas = MIGRACIONES.filter((nombre) => {
      const prefijo = version(nombre);
      return prefijo !== null && prefijo <= FRONTERA;
    });

    expect(
      historicas.length,
      `El bloque histórico (hasta ${FRONTERA}) tiene ${HISTORICAS} archivos y no admite migraciones nuevas. ` +
        `Una migración nueva va después de la frontera. ${AYUDA}`,
    ).toBe(HISTORICAS);
  });

  it("no están vacías", () => {
    const vacias = MIGRACIONES.filter((nombre) => readFileSync(join(DIRECTORIO, nombre), "utf8").trim() === "");

    expect(vacias, "Una migración vacía no aplica nada; escribe el SQL o no crees el archivo.").toEqual([]);
  });

  it("las migraciones nuevas usan un timestamp de calendario válido", () => {
    const invalidas = MIGRACIONES.filter((nombre) => {
      const prefijo = version(nombre);
      return prefijo !== null && prefijo > FRONTERA && !esTimestampValido(prefijo);
    });

    expect(invalidas, AYUDA).toEqual([]);
  });

  it("no deja archivos sueltos que no terminen en .sql", () => {
    if (!MIGRACIONES.some((nombre) => FORMATO.test(nombre))) return;

    const sueltos = ARCHIVOS.filter((nombre) => !nombre.endsWith(".sql"));

    expect(sueltos, "supabase/migrations/ solo contiene migraciones .sql; mueve cualquier otro archivo fuera.").toEqual(
      [],
    );
  });

  it("reconoce timestamps de calendario válidos e inválidos", () => {
    expect(esTimestampValido("20261125143000")).toBe(true);
    expect(esTimestampValido("20261123000001")).toBe(true);

    expect(esTimestampValido("20261301000000")).toBe(false);
    expect(esTimestampValido("20261132000000")).toBe(false);
    expect(esTimestampValido("20261123240000")).toBe(false);
    expect(esTimestampValido("20261123006000")).toBe(false);
    expect(esTimestampValido("20261123000060")).toBe(false);
    expect(esTimestampValido("20260230000000")).toBe(false);
  });
});
