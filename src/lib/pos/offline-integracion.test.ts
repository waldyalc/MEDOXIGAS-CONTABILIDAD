import { describe, expect, it } from "vitest";

import { nuevaOperacionOffline, resumenConfirmacionOffline, resumenSnapshotOffline } from "./cola-offline";
import { armarTicketOffline } from "./impresion";
import { ventaEjemplo } from "./pruebas/ejemplos";
import { PLANTILLA_TICKET_DEFECTO } from "./tipos";
import { errorTransitorio } from "./transporte-offline";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");

describe("integración offline con la RPC idempotente", () => {
  it("el log muestra únicamente la numeración confirmada por el servidor", () => {
    expect(resumenConfirmacionOffline(null)).toBeNull();
    expect(resumenConfirmacionOffline({ folio: "POS-LOCAL-uno" })).toBeNull();
    expect(resumenConfirmacionOffline({ factura: { numero: 42, ncf: "B0200000042" } })).toBe(
      "No. 42 · NCF B0200000042",
    );
    expect(resumenConfirmacionOffline({ movimiento: { numero: 3 } })).toBe("No. 3");
  });

  it("conserva en el log lo que se cobró offline aunque el catálogo cambie al sincronizar", () => {
    expect(resumenSnapshotOffline({ ticket: { cliente: { nombre: "ZZTEST Cliente" }, total: "236.00" } })).toBe(
      "ZZTEST Cliente · RD$236.00",
    );
    expect(resumenSnapshotOffline({ turnoId: "turno", motivo: "gasto_menor", monto: "50.00" })).toBe(
      "gasto_menor · RD$50.00",
    );
    expect(resumenSnapshotOffline(null)).toBeNull();
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
    expect(ticket.encabezado.titulo).toBe("Venta");
    expect(ticket.encabezado.lineas).toContain(`Folio: ${folio}`);
    expect(JSON.stringify(ticket)).not.toMatch(/NCF|Comprobante provisional|B0200000015/);
    expect(ticket.pagos).toContainEqual({ etiqueta: "Cambio", valor: "RD$14.00" });
    expect(ticket.totales).toContainEqual({ etiqueta: "Total", valor: "RD$236.00" });
  });

  it("llama la RPC nueva directamente y conserva el UUID en el reintento", () => {
    const fuente = leer("src/lib/pos/transporte-offline.ts");
    expect(fuente).toContain('rpc("pos_sincronizar_operacion"');
    expect(fuente).toContain("client_uuid: operacion.uuid");
    expect(fuente).not.toContain("const rpc");
    expect(fuente).not.toContain(" as ");
    expect(fuente).not.toContain('rpc("pos_completar_venta"');
    const operacion = nuevaOperacionOffline({
      ambito: "usuario/terminal",
      tipo: "venta",
      turnoId: "turno",
      secuencia: 1,
      payload: { total: "236.00" },
      snapshot: {},
    });
    expect(operacion.folio).toBe(`POS-LOCAL-${operacion.uuid}`);
  });

  it("distingue errores de red/servidor de los rechazos de negocio", () => {
    expect(errorTransitorio(null)).toBe(true);
    expect(errorTransitorio("PGRST301")).toBe(true);
    expect(errorTransitorio("08006")).toBe(true);
    expect(errorTransitorio("57014")).toBe(true);
    expect(errorTransitorio("P0001")).toBe(false);
    expect(errorTransitorio("22023")).toBe(false);
    expect(errorTransitorio("42501")).toBe(false);
  });

  it("el SQL aplicado conserva vencimiento y la tabla queda clasificada para el reset", () => {
    const sql = leer("supabase/migrations/20261126120000_pos_offline_client_uuid.sql");
    expect(sql).toContain("(v_payload - 'fecha')");
    expect(sql).not.toContain("- 'vencimiento'");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("v_guardado.payload <> v_payload");
    const reset = leer("docs/pruebas/reset-base-virgen.sql");
    expect(reset).toContain("public.pos_sync_operaciones,");
    expect(reset).toContain("'pos_sync_operaciones',");
  });

  it("el service worker solo sirve GET de POS y assets, y nunca toca IndexedDB", () => {
    const sw = leer("public/pos-sw.js");
    expect(sw).toContain('solicitud.method !== "GET"');
    expect(sw).toContain('url.pathname === "/pos"');
    expect(sw).toContain('url.pathname.startsWith("/_next/static/")');
    expect(sw).not.toContain('url.pathname.startsWith("/pos")');
    expect(sw).toContain("datos.hasta > Date.now()");
    expect(sw).not.toContain("indexedDB");
    expect(sw).not.toContain("medoxigas-pos-offline");
    expect(sw).not.toContain('caches.delete("medoxigas-pos-offline")');
  });
});
