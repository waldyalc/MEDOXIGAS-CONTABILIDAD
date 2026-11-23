import { expect, test } from "@playwright/test";
import ts from "typescript";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const fuente = ts.transpileModule(readFileSync(join(process.cwd(), "src/lib/pos/almacen-offline.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

const cola = ts.transpileModule(readFileSync(join(process.cwd(), "src/lib/pos/cola-offline.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

test("IndexedDB real conserva tres operaciones y los carritos tras recargar offline", async ({ page, context }) => {
  await page.route("**/__prueba_idb", (ruta) =>
    ruta.fulfill({ contentType: "text/html", body: "<!doctype html><title>Prueba aislada IndexedDB</title>" }),
  );
  await page.goto("/__prueba_idb");
  const uuid = await page.evaluate(
    async ({ almacen, operaciones }) => {
      const db = await import(`data:text/javascript,${encodeURIComponent(almacen)}`);
      const modulo = await import(`data:text/javascript,${encodeURIComponent(operaciones)}`);
      await db.guardarOffline("carritos", "ZZTEST/terminal", { pestanas: [{ id: "uno", precio: "236.00" }] });
      const uuids: string[] = [];
      for (const secuencia of [1, 2, 3]) {
        const operacion = modulo.nuevaOperacionOffline({
          ambito: "ZZTEST/terminal",
          tipo: "venta",
          turnoId: "turno",
          secuencia,
          payload: { total: "236.00" },
          snapshot: { cliente: "ZZTEST" },
        });
        await db.almacenColaOffline.guardar(operacion);
        uuids.push(operacion.uuid);
      }
      return uuids;
    },
    { almacen: fuente, operaciones: cola },
  );
  await context.setOffline(true);
  await page.reload();
  const resultado = await page.evaluate(async (almacen) => {
    const db = await import(`data:text/javascript,${encodeURIComponent(almacen)}`);
    return {
      filas: await db.almacenColaOffline.listar("ZZTEST/terminal"),
      carrito: await db.leerOffline("carritos", "ZZTEST/terminal"),
      ajenas: await db.almacenColaOffline.listar("otro/terminal"),
    };
  }, fuente);
  expect(resultado.filas).toHaveLength(3);
  expect(resultado.filas.map((fila: { uuid: string }) => fila.uuid).sort()).toEqual([...uuid].sort());
  expect(resultado.carrito).toEqual({ pestanas: [{ id: "uno", precio: "236.00" }] });
  expect(resultado.ajenas).toEqual([]);
});

test("dos pestañas serializan la cola con Web Locks sin crear dos secuencias iguales", async ({ page, context }) => {
  await context.route("**/__prueba_idb", (ruta) =>
    ruta.fulfill({ contentType: "text/html", body: "<!doctype html><title>Prueba aislada locks</title>" }),
  );
  await page.goto("/__prueba_idb");
  const otra = await context.newPage();
  await otra.goto("/__prueba_idb");
  const asignar = async (almacen: string) => {
    const db = await import(`data:text/javascript,${encodeURIComponent(almacen)}`);
    return db.conBloqueoOffline("ZZTEST/terminal", () => db.siguienteSecuenciaOffline("ZZTEST/terminal"));
  };
  const secuencias = await Promise.all([page.evaluate(asignar, fuente), otra.evaluate(asignar, fuente)]);
  expect(secuencias.sort()).toEqual([1, 2]);
});
