import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIRECTORIO_MIGRACIONES = join(process.cwd(), "supabase", "migrations");
const RUTA_SCRIPT = join(process.cwd(), "docs", "pruebas", "reset-base-virgen.sql");
const SQL = readFileSync(RUTA_SCRIPT, "utf8");

const AYUDA =
  "docs/pruebas/reset-base-virgen.sql debe clasificar TODAS las tablas de supabase/migrations: " +
  "las transaccionales en el TRUNCATE (y en el array de verificación del bloque DO) y las que se " +
  "conservan con un comentario `-- @conservar public.<tabla>`. Si una migración nueva crea una " +
  "tabla, decide qué hacer con ella en el script antes de mergear.";

/** Quita los comentarios de línea para revisar solo lo que Postgres ejecuta. */
function sinComentarios(sql: string): string {
  return sql
    .split("\n")
    .map((linea) => {
      const corte = linea.indexOf("--");
      return corte === -1 ? linea : linea.slice(0, corte);
    })
    .join("\n");
}

const CODIGO = sinComentarios(SQL);

function agregar(set: Set<string>, nombre: string | undefined, enMinusculas: boolean): void {
  if (nombre === undefined) return;
  set.add(enMinusculas ? nombre.toLowerCase() : nombre);
}

function tablasDeLasMigraciones(): Set<string> {
  const tablas = new Set<string>();
  const archivos = readdirSync(DIRECTORIO_MIGRACIONES).filter((nombre) => nombre.endsWith(".sql"));

  for (const archivo of archivos) {
    const sql = readFileSync(join(DIRECTORIO_MIGRACIONES, archivo), "utf8");
    const patron = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi;
    for (const coincidencia of sql.matchAll(patron)) {
      agregar(tablas, coincidencia[1]?.toLowerCase(), false);
    }
  }

  return tablas;
}

function tablasDelTruncate(): Set<string> {
  const tablas = new Set<string>();
  const bloque = /truncate\s+table([\s\S]*?);/i.exec(CODIGO)?.[1] ?? "";
  for (const coincidencia of bloque.matchAll(/public\.([a-z0-9_]+)/gi)) {
    agregar(tablas, coincidencia[1]?.toLowerCase(), false);
  }
  return tablas;
}

function tablasConservadas(): Set<string> {
  const tablas = new Set<string>();
  for (const coincidencia of SQL.matchAll(/^--\s*@conservar\s+public\.([a-z0-9_]+)\s*$/gim)) {
    agregar(tablas, coincidencia[1], true);
  }
  return tablas;
}

function tablasVerificadasEnLaTransaccion(): Set<string> {
  const tablas = new Set<string>();
  const bloque = /foreach\s+v_tabla\s+in\s+array\s+array\s*\[([\s\S]*?)\]\s*loop/i.exec(CODIGO)?.[1] ?? "";
  for (const coincidencia of bloque.matchAll(/'([a-z0-9_]+)'/gi)) {
    agregar(tablas, coincidencia[1]?.toLowerCase(), false);
  }
  return tablas;
}

const TODAS = tablasDeLasMigraciones();
const VACIADAS = tablasDelTruncate();
const CONSERVADAS = tablasConservadas();
const VERIFICADAS = tablasVerificadasEnLaTransaccion();

describe("reset a base virgen (docs/pruebas/reset-base-virgen.sql)", () => {
  it("extrae las tablas de las migraciones (el candado no está vacío)", () => {
    expect(TODAS.size, "No se pudo leer ninguna tabla de supabase/migrations.").toBeGreaterThan(50);
  });

  it("clasifica cada tabla de las migraciones una sola vez", () => {
    const sinClasificar = [...TODAS].filter((tabla) => !VACIADAS.has(tabla) && !CONSERVADAS.has(tabla)).sort();
    expect(sinClasificar, AYUDA).toEqual([]);

    const enAmbasListas = [...TODAS].filter((tabla) => VACIADAS.has(tabla) && CONSERVADAS.has(tabla)).sort();
    expect(enAmbasListas, `Una tabla no puede vaciarse y conservarse a la vez. ${AYUDA}`).toEqual([]);

    const inventadas = [...VACIADAS, ...CONSERVADAS].filter((tabla) => !TODAS.has(tabla)).sort();
    expect(inventadas, `El script menciona tablas que no existen en las migraciones. ${AYUDA}`).toEqual([]);
  });

  it("verifica dentro de la transacción exactamente las tablas que vacía", () => {
    expect([...VERIFICADAS].sort(), AYUDA).toEqual([...VACIADAS].sort());
  });

  it("es una sola transacción que trunca entre BEGIN y COMMIT", () => {
    const inicio = CODIGO.search(/\bbegin\s*;/i);
    const fin = CODIGO.search(/\bcommit\s*;/i);
    const truncado = CODIGO.search(/\btruncate\s+table\b/i);
    const commits = (CODIGO.match(/\bcommit\s*;/gi) ?? []).length;

    expect(inicio, "Falta BEGIN; al inicio del reset.").toBeGreaterThan(-1);
    expect(commits, "El reset debe tener un único COMMIT; partir la transacción deja la base a medias.").toBe(1);
    expect(fin, "Falta COMMIT; al final del reset.").toBeGreaterThan(inicio);
    expect(truncado, "El TRUNCATE debe ir dentro de BEGIN … COMMIT.").toBeGreaterThan(inicio);
    expect(truncado).toBeLessThan(fin);
  });

  it("vacía con RESTART IDENTITY CASCADE", () => {
    expect(CODIGO).toMatch(/restart\s+identity\s+cascade/i);
  });

  it("nunca vacía ni borra perfiles ni auth.users", () => {
    expect(VACIADAS.has("perfiles"), AYUDA).toBe(false);
    expect(CONSERVADAS.has("perfiles"), "perfiles debe estar documentada como tabla conservada.").toBe(true);
    expect(CODIGO).not.toMatch(/truncate\s+(?:table\s+)?[^;]*public\.perfiles/i);
    expect(CODIGO).not.toMatch(/delete\s+from\s+public\.perfiles/i);
    expect(CODIGO, "El reset no debe tocar auth.users (ni en SQL dinámico).").not.toMatch(/auth\.users/i);
  });

  it("solo borra cuentas de prueba y lo hace con NOT EXISTS", () => {
    const borrado = /delete\s+from\s+public\.cuentas\b([\s\S]*?);/i.exec(CODIGO)?.[1] ?? "";
    const guardas = (borrado.match(/not\s+exists/gi) ?? []).length;

    expect(borrado, "Falta el DELETE de cuentas de prueba.").not.toBe("");
    expect(
      guardas,
      "El DELETE de cuentas debe protegerse con NOT EXISTS (hijas y referencias).",
    ).toBeGreaterThanOrEqual(4);
    expect(borrado).toMatch(/%ZZTEST%/i);
    expect(borrado).toMatch(/%E2E-%/i);
  });

  it("es un script de datos: no crea ni altera esquema", () => {
    expect(CODIGO).not.toMatch(/\b(create|alter|drop)\s+(table|policy|function|trigger|view|index|type)\b/i);
  });

  it("documenta los catálogos que conserva", () => {
    for (const tabla of ["empresa", "cuentas", "config_contable", "numeraciones", "tipos_entrada_diario"]) {
      expect(CONSERVADAS.has(tabla), `${tabla} debe estar documentada como conservada.`).toBe(true);
    }
  });
});
