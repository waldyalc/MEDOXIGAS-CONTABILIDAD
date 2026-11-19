#!/usr/bin/env node
// Extrae de un types.ts generado por Supabase únicamente el bloque
// `public: { Tables … Views … Functions … Enums … CompositeTypes }`
// dentro de `export type Database`, con espacios normalizados.
//
// La cabecera, `__InternalSupabase` y los helpers (`DefaultSchema` vs
// `PublicSchema`, etc.) cambian con la versión del generador, no con el
// esquema: compararlos daría falsos positivos en CI. Lo mismo pasa con el
// formato (claves entre comillas, `ComputedFields: never`, comas y punto y
// coma), así que aquí se normaliza para que dos versiones del generador con
// el mismo esquema impriman exactamente lo mismo.
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

const matchPublic = /"?public"?\s*:\s*\{/.exec(texto.slice(inicioDb));
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

let bloque = texto.slice(inicioDb + matchPublic.index, fin + 1);

// Diferencias de versión del generador que no son esquema (mismo motivo que la
// normalización de abajo): --local (CLI) y --project-id (remoto, más nuevo)
// emiten el mismo esquema con formato distinto y la comparación fallaba.
// · viejo: `Args: Record<PropertyKey, never>` · nuevo: `Args: never`.
// · nuevo agrega `SetofOptions: {…}` a funciones que devuelven una fila
//   compuesta; el viejo no lo emite (el `Returns` sigue comparándose).
// · viejo: args y columnas en orden de declaración · nuevo: orden
//   alfabético. Se ordenan los campos de cada objeto hoja para que el orden
//   no importe (los objetos anidados conservan su orden, igual en ambos).
bloque = bloque
  .replace(/Record<\s*PropertyKey\s*,\s*never\s*>/g, "never")
  .replace(/SetofOptions\s*:\s*\{[^{}]*\}/g, "");

// Ordena los campos dentro de cada objeto sin llaves anidadas ({ a: T, b: U }):
// separadores `;` (formato compacto) o saltos de línea (formato expandido).
bloque = bloque.replace(/\{[^{}]*\}/g, (obj) => {
  const campos = obj
    .slice(1, -1)
    .replace(/;/g, "\n")
    .split("\n")
    .map((c) => c.replace(/,$/, "").trim())
    .filter(Boolean);
  if (campos.length <= 1) {
    return obj;
  }
  campos.sort((x, y) => x.split(":")[0].localeCompare(y.split(":")[0]));
  return `{ ${campos.join("; ")} }`;
});

process.stdout.write(
  `${bloque
    .replace(/\/\/[^\n]*/g, "")
    .replace(/ComputedFields:\s*never;?/g, "")
    .replace(/"/g, "")
    .replace(/[;,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()}\n`,
);
