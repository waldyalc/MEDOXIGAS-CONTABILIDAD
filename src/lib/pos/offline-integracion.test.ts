import { describe, expect, it } from "vitest";

import { nuevaOperacionOffline, resumenConfirmacionOffline } from "./cola-offline";
import { armarTicketOffline } from "./impresion";
import { ventaEjemplo } from "./pruebas/ejemplos";
import { PLANTILLA_TICKET_DEFECTO } from "./tipos";
import { transportarOperacionOffline } from "./transporte-offline";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");

describe("integración offline pendiente de RPC tipada", () => {
  it("el log muestra únicamente la numeración confirmada por el servidor", () => {
    expect(resumenConfirmacionOffline(null)).toBeNull();
    expect(resumenConfirmacionOffline({ folio: "POS-LOCAL-uno" })).toBeNull();
    expect(resumenConfirmacionOffline({ factura: { numero: 42, ncf: "B0200000042" } })).toBe(
      "No. 42 · NCF B0200000042",
    );
    expect(resumenConfirmacionOffline({ movimiento: { numero: 3 } })).toBe("No. 3");
  });
  it("imprime folio completo, nunca un NCF ni la leyenda rechazada por Waldy", () => {
    const venta = ventaEjemplo();
    const folio = "POS-LOCAL-550e8400-e29b-41d4-a716-446655440000";
    const ticket = armarTicketOffline({
      folio,
      empresa: null,
      cliente: venta.contacto,
      lineas: venta.lineas,
      plantilla: PLANTILLA_TICKET_DEFECTO,
      fecha: "2026-11-23T10:00:00.000Z",
      subtotal: "200.00",
      descuento: "0.00",
      itbis: "36.00",
      total: "236.00",
      recibido: "250.00",
      cambio: "14.00",
    });
    expect(ticket.encabezado.lineas).toContain(`Folio: ${folio}`);
    expect(JSON.stringify(ticket)).not.toMatch(/NCF|Comprobante provisional|B0200000015/);
    expect(ticket.pagos).toContainEqual({ etiqueta: "Cambio", valor: "RD$14.00" });
    expect(ticket.totales).toContainEqual({ etiqueta: "Total", valor: "RD$236.00" });
  });

  it("no envía por una RPC alternativa mientras falten migración y tipos", async () => {
    const operacion = nuevaOperacionOffline({
      ambito: "usuario/terminal",
      tipo: "venta",
      turnoId: "turno",
      secuencia: 1,
      payload: { total: "236.00" },
      snapshot: {},
    });
    const resultado = await transportarOperacionOffline(operacion);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.transitorio).toBe(false);
      expect(resultado.error).toContain("generar los tipos");
    }
    expect(leer("src/lib/pos/transporte-offline.ts")).not.toContain(".rpc(");
  });

  it("el SQL conserva vencimiento y propone clasificar su tabla en el reset", () => {
    const sql = leer("docs/pruebas/pos-offline-pendiente.sql");
    expect(sql).toContain("(v_payload - 'fecha')");
    expect(sql).not.toContain("- 'vencimiento'");
    expect(sql.trim().endsWith("rollback;")).toBe(true);
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("v_guardado.payload <> v_payload");
    const propuesta = leer("docs/pruebas/pos-offline-reset.patch");
    expect(propuesta).toContain("+  public.pos_sync_operaciones,");
    expect(propuesta).toContain("+    'pos_sync_operaciones',");
  });

  it("el service worker solo sirve GET de POS y assets, nunca mutaciones ni dashboard", () => {
    const sw = leer("public/pos-sw.js");
    expect(sw).toContain('solicitud.method !== "GET"');
    expect(sw).toContain('url.pathname === "/pos"');
    expect(sw).toContain('url.pathname.startsWith("/_next/static/")');
    expect(sw).not.toContain('url.pathname.startsWith("/pos")');
    expect(sw).toContain("datos.hasta > Date.now()");
  });
});
