import { describe, expect, test } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Candado de la capa POS: las lecturas usan el cliente con RLS y las
 * escrituras solo las RPC transaccionales. Si alguien agrega un `insert`,
 * `update` o `delete` directo (o `service_role`), este test falla y el commit
 * no entra. Los nombres exportados también quedan fijados porque la UI de
 * 2C/2D los importa.
 */

const DIRECTORIO = join(process.cwd(), "src", "lib", "pos");

function archivosFuente(): string[] {
  return readdirSync(DIRECTORIO)
    .filter((archivo) => archivo.endsWith(".ts") && !archivo.endsWith(".test.ts"))
    .sort();
}

function leer(archivo: string): string {
  return readFileSync(join(DIRECTORIO, archivo), "utf8");
}

describe("reglas de la capa POS", () => {
  test("ningún archivo escribe directo en tablas ni usa service_role", () => {
    for (const archivo of archivosFuente()) {
      const texto = leer(archivo);
      // El almacén offline borra la copia local en IndexedDB (no es una tabla
      // de Supabase); se descuenta esa llamada y el candado sigue cazando
      // cualquier escritura directa contra el API.
      const sinBorradoLocal = texto.replace(/objectStore\([^)]*\)\.delete\(/g, "");

      expect(sinBorradoLocal, `${archivo} no puede hacer insert/update/delete/upsert directo`).not.toMatch(
        /\.(insert|update|delete|upsert)\s*\(/,
      );
      expect(texto, `${archivo} no puede mencionar service_role`).not.toContain("service_role");
    }
  });

  test("las acciones son server actions y llaman supabase.rpc directo", () => {
    const texto = leer("acciones.ts");

    expect(texto.startsWith('"use server";')).toBe(true);
    expect(texto).not.toMatch(/const\s+\w+\s*=\s*supabase\.rpc/);
    expect(texto).not.toMatch(/supabase\.rpc\([\s\S]*?\)\s+as\s/);
  });

  test("se mantienen los nombres que consume la UI", () => {
    const acciones = leer("acciones.ts");
    const consultas = leer("consultas.ts");

    for (const nombre of [
      "crearTerminal",
      "actualizarTerminal",
      "abrirTurno",
      "registrarMovimientoTurno",
      "cerrarTurno",
      "completarVenta",
      "crearCotizacionPOS",
      "crearDevolucionPOS",
    ]) {
      expect(acciones).toContain(`export async function ${nombre}`);
    }

    for (const nombre of [
      "getTerminales",
      "getTerminal",
      "getTurnoAbierto",
      "getResumenTurno",
      "getHistorialPOS",
      "getCotizacionesAbiertas",
      "getProductosPOS",
      "buscarProductoPorCodigo",
    ]) {
      expect(consultas).toContain(`export async function ${nombre}`);
    }
  });

  test("los tipos del contrato existen en tipos.ts", () => {
    const texto = leer("tipos.ts");

    for (const nombre of [
      "TerminalPOS",
      "TurnoPOS",
      "ResumenTurno",
      "ProductoPOS",
      "LineaVenta",
      "PagoVenta",
      "VentaPOSResultado",
      "CotizacionPOSResultado",
      "DevolucionPOSResultado",
      "HistorialPOSFila",
      "PlantillaTicket",
    ]) {
      const declarado = texto.includes(`export interface ${nombre}`) || texto.includes(`export type ${nombre} `);
      expect(declarado, `${nombre} debe estar declarado en tipos.ts`).toBe(true);
    }
  });
});
