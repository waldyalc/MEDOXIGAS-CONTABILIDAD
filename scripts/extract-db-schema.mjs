#!/usr/bin/env node
// Extrae de un types.ts generado por Supabase únicamente el bloque
// `public: { Tables … Views … Functions … Enums … CompositeTypes }`
// dentro de `export type Database`, con espacios normalizados.
//
// La cabecera, `__InternalSupabase` y los helpers (`DefaultSchema` vs
// `PublicSchema`, etc.) cambian con la versión del generador, no con el
// esquema: compararlos daría falsos positivos en CI.
//
// Uso: node scripts/extract-db-schema.mjs <archivo>   (imprime a stdout)
// Falla (exit 1) si no encuentra el bloque: mejor fallar que comparar vacío.
//
// Supuesto: el bloque generado no tiene `{`/`}` dentro de strings
// (cierto en lo que genera `supabase gen types` hoy).
import { readFileSync } from "node:fs";

const [ruta] = process.argv.slice(2);
if (!ruta) {
  process.stderr.write("uso: node scripts/extract-db-schema.mjs <archivo>\n");
  process.exit(1);
}

const texto = readFileSync(ruta, "utf8");

const inicioDb = texto.indexOf("export type Database");
if (inicioDb === -1) {
  throw new Error("no se encontró `export type Database`");
}

const matchPublic = /public\s*:\s*\{/.exec(texto.slice(inicioDb));
if (!matchPublic) {
  throw new Error("no se encontró el bloque `public:` de Database");
}

let nivel = 0;
let fin = -1;
const abre = inicioDb + matchPublic.index + matchPublic[0].length - 1;
for (let i = abre; i < texto.length; i++) {
  const ch = texto[i];
  if (ch === "{") {
    nivel++;
  } else if (ch === "}") {
    nivel--;
    if (nivel === 0) {
      fin = i;
      break;
    }
  }
}
if (fin === -1) {
  throw new Error("llaves sin balancear en el bloque `public:`");
}

const bloque = texto.slice(inicioDb + matchPublic.index, fin + 1);
process.stdout.write(`${bloque.replace(/\s+/g, " ").trim()}\n`);
