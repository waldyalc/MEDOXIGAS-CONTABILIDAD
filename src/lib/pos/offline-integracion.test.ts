import { describe, expect, it } from "vitest";

import { nuevaOperacionOffline, resumenConfirmacionOffline, resumenSnapshotOffline } from "./cola-offline";
import { armarTicketOffline } from "./impresion";
import { ventaEjemplo } from "./pruebas/ejemplos";
import { PLANTILLA_TICKET_DEFECTO } from "./tipos";
import { clasificarErrorOffline, errorTransitorio } from "./transporte-offline";
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

  it("clasifica red, servidor, sesión y negocio", () => {
    // Red, servidor y conflictos que se resuelven solos: reintento con backoff.
    expect(errorTransitorio(null)).toBe(true);
    expect(errorTransitorio("08006")).toBe(true);
    expect(errorTransitorio("53400")).toBe(true);
    expect(errorTransitorio("57014")).toBe(true);
    expect(errorTransitorio("40001")).toBe(true);
    expect(errorTransitorio("40P01")).toBe(true);
    expect(errorTransitorio("PGRST000")).toBe(true);
    // Sesión: se refresca y se reintenta; no se marca fallida ni se reintenta a ciegas.
    expect(errorTransitorio("PGRST301")).toBe(false);
    expect(errorTransitorio("42501")).toBe(false);
    expect(clasificarErrorOffline("42501")).toBe("sesion");
    expect(clasificarErrorOffline("PGRST301")).toBe("sesion");
    expect(clasificarErrorOffline("PGRST302")).toBe("sesion");
    // Rechazos reales: se marcan fallidos y se conservan en el panel.
    expect(errorTransitorio("P0001")).toBe(false);
    expect(errorTransitorio("22023")).toBe(false);
    expect(clasificarErrorOffline("PGRST202")).toBe("permanente");
    expect(clasificarErrorOffline("PGRST204")).toBe("permanente");
    expect(clasificarErrorOffline("23505")).toBe("permanente");
    expect(clasificarErrorOffline("99999")).toBe("permanente");
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

  it("bloquea el cierre solo con ventas por subir y avisa las que tienen problema", () => {
    const barra = leer("src/app/(pos)/pos/_components/vender/barra-inferior-pos.tsx");
    expect(barra).toContain("Conéctate para subir ${offline.porSubir} ventas antes de cerrar");
    const panel = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    expect(panel).toContain("Conéctate para subir ${porSubir} ventas antes de cerrar el turno.");
    expect(panel).toContain("Ventas con problema");
    expect(panel).toContain("Sí, descartar");
    const dialogo = leer("src/app/(pos)/pos/_components/turnos/dialogo-cerrar-turno.tsx");
    expect(dialogo).toContain("cierreBloqueado");
    expect(dialogo).toContain("offline.porSubir > 0");
    expect(dialogo).not.toContain("offline.pendientes > 0");
    expect(dialogo).toContain("avisoCierreOffline(offline.fallidas)");
    expect(dialogo).toContain("disabled={enviando || esperadoNegativo || cierreBloqueado}");
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
