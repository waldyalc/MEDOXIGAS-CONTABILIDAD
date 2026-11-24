import { describe, expect, it } from "vitest";

import type { OperacionOffline } from "./cola-offline";
import {
  combinarHistorialPOS,
  idDeItemHistorial,
  lineasVentaDeLocal,
  proyectarVentaLocal,
  proyectarVentasLocales,
} from "./historial-offline";
import type { HistorialPOSFila } from "./tipos";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const COMPONENTES = join(process.cwd(), "src", "app", "(pos)", "pos", "_components");
const leer = (ruta: string) => readFileSync(join(COMPONENTES, ruta), "utf8");

function operacion(cambios: Partial<OperacionOffline> = {}): OperacionOffline {
  return {
    uuid: "uuid-1",
    ambito: "usuario/terminal",
    secuencia: 1,
    tipo: "venta",
    turnoId: "turno-1",
    folio: "POS-LOCAL-uuid-1",
    payload: {},
    snapshot: {
      pestana: { id: "pestana-1", nombre: "Venta 2", lineas: [], contactoId: "contacto-1" },
      ticket: {
        cliente: { nombre: "ZZTEST Cliente", rnc_cedula: "131234567" },
        fecha: "2026-11-23T10:00:00.000Z",
        subtotal: "200.00",
        descuento: "0.00",
        itbis: "36.00",
        total: "236.00",
        recibido: "250.00",
        cambio: "14.00",
        lineas: [
          {
            id: "linea-1",
            descripcion: "Gas 20 lb",
            referencia: "GAS-20",
            cantidad: "2",
            unidad_nombre: "Unidad",
            precio: "100.00",
            descuento_pct: "0",
            itbis_tasa: "18",
            total: "236.00",
          },
        ],
      },
    },
    estado: "pendiente",
    intentos: 0,
    proximoIntento: 0,
    error: null,
    resultado: null,
    ...cambios,
  };
}

function fila(cambios: Partial<HistorialPOSFila> = {}): HistorialPOSFila {
  return {
    id: "factura-1",
    numero: 12,
    ncf: "B0200000012",
    tipo_comprobante: "02",
    fecha: "2026-11-23",
    creado_en: "2026-11-23T10:00:00.000Z",
    contacto_id: "contacto-1",
    cliente_nombre: "ZZTEST Cliente",
    terminal_id: "terminal-1",
    terminal_nombre: "Caja 1",
    turno_id: "turno-1",
    turno_numero: 3,
    estado: "pagada",
    total: "236.00",
    pagado: "236.00",
    retenido: "0.00",
    credito: "0.00",
    saldo: "0.00",
    metodos: ["efectivo"],
    ...cambios,
  };
}

describe("historial del POS con ventas locales", () => {
  it("una venta pendiente se ve como «Sincronizando» con su folio temporal", () => {
    const venta = proyectarVentaLocal(operacion(), []);

    expect(venta?.estado).toBe("sincronizando");
    expect(venta?.folio).toBe("POS-LOCAL-uuid-1");
    expect(venta?.ncf).toBeNull();
    expect(venta?.motivo).toBeNull();
    expect(venta?.cliente.nombre).toBe("ZZTEST Cliente");
    expect(venta?.total).toBe("236.00");
    expect(venta?.fecha).toBe("2026-11-23T10:00:00.000Z");
    expect(venta?.lineas).toHaveLength(1);
    expect(venta?.lineas[0]?.descripcion).toBe("Gas 20 lb");
    expect(venta?.pestana).toMatchObject({ id: "pestana-1" });
  });

  it("una venta fallida se ve como «Error» con el motivo legible", () => {
    const venta = proyectarVentaLocal(
      operacion({ estado: "fallida", error: "No hay existencia suficiente del producto Gas 20 lb." }),
      [],
    );

    expect(venta?.estado).toBe("error");
    expect(venta?.motivo).toBe("No hay existencia suficiente del producto Gas 20 lb.");
    expect(venta?.ncf).toBeNull();
  });

  it("una venta sincronizada que ya está en el servidor no se duplica", () => {
    const sincronizada = operacion({
      estado: "sincronizada",
      resultado: { factura: { id: "factura-1", numero: 12, ncf: "B0200000012" } },
    });

    expect(proyectarVentaLocal(sincronizada, [fila()]), "Se queda la fila real del servidor").toBeNull();
    expect(proyectarVentaLocal(sincronizada, [fila({ id: "otra", ncf: "B0200000012" })])).toBeNull();
  });

  it("una venta sincronizada que aún no aparece en el servidor se muestra con su NCF definitivo", () => {
    const venta = proyectarVentaLocal(
      operacion({
        estado: "sincronizada",
        resultado: { factura: { id: "factura-9", numero: 90, ncf: "B0200000090" } },
      }),
      [fila()],
    );

    expect(venta?.estado).toBe("sincronizada");
    expect(venta?.ncf).toBe("B0200000090");
    expect(venta?.numero).toBe(90);
  });

  it("ignora movimientos de caja y ordena las ventas locales de la más nueva a la más vieja", () => {
    const ventas = proyectarVentasLocales(
      [
        operacion({ uuid: "uuid-1", secuencia: 1 }),
        operacion({ uuid: "uuid-3", secuencia: 3 }),
        operacion({ uuid: "uuid-2", secuencia: 2, tipo: "movimiento" }),
      ],
      [],
    );

    expect(ventas.map((venta) => venta.uuid)).toEqual(["uuid-3", "uuid-1"]);
  });

  it("combina las ventas locales primero y conserva los ids de selección", () => {
    const venta = proyectarVentaLocal(operacion(), []);
    expect(venta).not.toBeNull();
    if (!venta) return;

    const items = combinarHistorialPOS([fila()], [venta]);
    expect(items.map(idDeItemHistorial)).toEqual(["uuid-1", "factura-1"]);
    expect(items[0]?.origen).toBe("local");
    expect(items[1]?.origen).toBe("servidor");
  });

  it("arma las líneas del ticket de soporte con sus totales calculados", () => {
    const venta = proyectarVentaLocal(operacion(), []);
    expect(venta).not.toBeNull();
    if (!venta) return;

    const lineas = lineasVentaDeLocal(venta.lineas);
    expect(lineas[0]?.descripcion).toBe("Gas 20 lb");
    expect(lineas[0]?.subtotal).toBe("200.00");
    expect(lineas[0]?.itbis).toBe("36.00");
    expect(lineas[0]?.total).toBe("236.00");
  });

  it("ignora un snapshot roto sin lanzar", () => {
    const venta = proyectarVentaLocal(operacion({ snapshot: null }), []);

    expect(venta?.cliente.nombre).toBe("Cliente sin nombre");
    expect(venta?.lineas).toEqual([]);
    expect(venta?.total).toBe("0");
    expect(venta?.pestana).toBeNull();
  });
});

/**
 * Candados de la pantalla: el cobro fallido se detiene en un modal con salida
 * clara y el detalle de una venta local permite reintentar, editar o descartar.
 */
describe("pantallas de ventas offline", () => {
  it("el cobro fallido muestra «Venta pendiente de guardar» con imprimir y editar", () => {
    const checkout = leer("vender/checkout-pos.tsx");
    const plano = checkout.replace(/\s+/g, " ");

    expect(checkout).toContain("Venta pendiente de guardar");
    expect(plano).toContain(
      "Tu venta no se ha guardado. Puedes imprimir esta factura como soporte, pero recuerda que debes editar la venta para completar el registro.",
    );
    expect(checkout, "El ticket de soporte no lleva NCF: es una prefactura").toContain("armarTicketPrefactura");
    expect(checkout).toContain("Imprimir ticket");
    expect(checkout).toContain("Editar venta");
    expect(checkout, "Editar venta cierra el modal y conserva el carrito").toContain("onClick={onCerrar}");
  });

  it("el detalle de una venta local ofrece reintentar, editar, imprimir y descartar", () => {
    const detalle = leer("historial/detalle-venta-offline.tsx");

    for (const texto of [
      "No se pudo sincronizar la venta",
      "Reintentar sincronización",
      "Editar venta",
      "Imprimir ticket",
      "Descartar",
      "¿Descartar esta venta?",
      "Sincronizando",
    ]) {
      expect(detalle, `Falta «${texto}» en el detalle de la venta offline`).toContain(texto);
    }

    expect(detalle, "El reintento se deshabilita sin conexión o mientras sincroniza").toContain(
      'estado === "offline" || estado === "sincronizando"',
    );
    expect(detalle, "El detalle no usa el azul de Medoxigas").not.toMatch(
      /#1e56c7|--primary|(?:bg|text|border)-primary\b/,
    );
  });

  it("el historial pinta la lista aunque el servidor no devuelva filas", () => {
    const historial = leer("historial/historial-pos.tsx");

    expect(historial).toContain("proyectarVentasLocales");
    expect(historial).toContain("combinarHistorialPOS");
    expect(historial).toContain("DetalleVentaOffline");
    expect(historial, "No puede mostrar el vacío si hay ventas locales").not.toContain("filas.length === 0 ? (");
  });
});
