import { beforeEach, describe, expect, test, vi } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const { getCotizacionOrigen } = await import("@/lib/facturacion/consultas");
const { getCotizacionesAbiertas } = await import("@/lib/pos/consultas");
const { enlaceCotizacionPOS, lineasDeCotizacionPOS, payloadCotizacionPOS } = await import("./cotizaciones");

const SRC = join(process.cwd(), "src");
const VENDER = join(SRC, "app", "(pos)", "pos", "_components", "vender");
const ID_TERMINAL = "11111111-1111-4111-8111-111111111111";
const ID_CONTACTO = "22222222-2222-4222-8222-222222222222";
const ID_LISTA = "33333333-3333-4333-8333-333333333333";
const ID_COTIZACION = "44444444-4444-4444-8444-444444444444";
const ID_FACTURA = "55555555-5555-4555-8555-555555555555";
const ID_PRODUCTO = "66666666-6666-4666-8666-666666666666";
const ID_IMPUESTO = "77777777-7777-4777-8777-777777777777";

interface RespuestaMock {
  data: unknown;
  error: unknown;
  count?: number;
}

/** Cadena mínima de PostgREST: todos los filtros devuelven el mismo builder. */
function cadena(respuesta: RespuestaMock) {
  const builder: Record<string, unknown> = {};

  for (const metodo of ["select", "order", "range", "eq", "in", "or", "limit"]) {
    builder[metodo] = vi.fn(() => builder);
  }

  builder.maybeSingle = vi.fn(() => builder);
  builder.returns = vi.fn().mockResolvedValue(respuesta);

  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

const lineasCarrito = [
  {
    productoId: ID_PRODUCTO,
    descripcion: "ZZTEST CARTUCHO",
    cantidad: "2",
    unidadId: null,
    precio: "100.00",
    descuentoPct: "10",
    itbisTasa: "18",
    impuestoId: ID_IMPUESTO,
  },
  {
    productoId: null,
    descripcion: "Servicio de prueba",
    cantidad: "1",
    unidadId: null,
    precio: "50.00",
    descuentoPct: "0",
    itbisTasa: "0",
    impuestoId: null,
  },
];

describe("guardar cotización desde el carrito", () => {
  test("el payload lleva cliente, lista, vendedor, cantidades, precios, descuentos e impuestos", () => {
    const payload = payloadCotizacionPOS({
      terminalId: ID_TERMINAL,
      fecha: "2026-11-22",
      vencimiento: "2026-12-22",
      pestana: {
        contactoId: ID_CONTACTO,
        listaPrecioId: ID_LISTA,
        vendedorId: "88888888-8888-4888-8888-888888888888",
        lineas: lineasCarrito,
      },
    });

    expect(payload).toEqual({
      terminal_id: ID_TERMINAL,
      contacto_id: ID_CONTACTO,
      lista_precio_id: ID_LISTA,
      fecha: "2026-11-22",
      vencimiento: "2026-12-22",
      vendedor_id: "88888888-8888-4888-8888-888888888888",
      lineas: [
        {
          producto_id: ID_PRODUCTO,
          descripcion: "ZZTEST CARTUCHO",
          cantidad: "2",
          unidad_id: null,
          precio: "100.00",
          descuento_pct: "10",
          itbis_tasa: "18",
          impuesto_id: ID_IMPUESTO,
        },
        {
          producto_id: null,
          descripcion: "Servicio de prueba",
          cantidad: "1",
          unidad_id: null,
          precio: "50.00",
          descuento_pct: "0",
          itbis_tasa: "0",
          impuesto_id: null,
        },
      ],
    });
  });

  test("sin cliente, lista ni vendedor manda null y no inventa ids", () => {
    const payload = payloadCotizacionPOS({
      terminalId: ID_TERMINAL,
      fecha: "2026-11-22",
      vencimiento: "2026-12-22",
      pestana: { contactoId: "", listaPrecioId: "", vendedorId: "", lineas: [] },
    });

    expect(payload.contacto_id).toBeNull();
    expect(payload.lista_precio_id).toBeNull();
    expect(payload.vendedor_id).toBeNull();
    expect(payload.lineas).toEqual([]);
  });

  test("el toast enlaza al detalle de la cotización recién guardada", () => {
    expect(enlaceCotizacionPOS(ID_COTIZACION)).toBe(`/dashboard/cotizaciones/${ID_COTIZACION}`);

    const vender = readFileSync(join(VENDER, "vender-pos.tsx"), "utf8");
    expect(vender).toContain("payloadCotizacionPOS(");
    expect(vender, "El toast debe decir el número de la cotización").toMatch(/Cotización No \$\{cotizacion\.numero\}/);
    expect(vender, "El toast debe enlazar al detalle con enlaceCotizacionPOS").toContain(
      "enlaceCotizacionPOS(cotizacion.id)",
    );
  });
});

describe("cargar cotización en el carrito", () => {
  test("mapea la cotización a las líneas que entiende aplicarCotizacion", () => {
    const lineas = lineasDeCotizacionPOS({
      lineas: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          producto_id: ID_PRODUCTO,
          descripcion: "ZZTEST CARTUCHO",
          cantidad: 2,
          precio: 100,
          descuento_pct: 10,
          itbis_tasa: 18,
          impuesto_id: ID_IMPUESTO,
          subtotal: 180,
          itbis: 32.4,
          total: 212.4,
        },
      ],
    });

    expect(lineas).toEqual([
      {
        productoId: ID_PRODUCTO,
        descripcion: "ZZTEST CARTUCHO",
        referencia: null,
        cantidad: "2.00",
        unidadId: null,
        unidadNombre: null,
        precio: "100.00",
        descuentoPct: "10.00",
        itbisTasa: "18.00",
      },
    ]);
  });

  test("el diálogo filtra por el cliente del carrito y muestra el filtro", () => {
    const dialogo = readFileSync(join(VENDER, "dialogo-cargar-cotizacion.tsx"), "utf8");
    expect(dialogo).toContain("cotizacionesAbiertasPOS(q.trim(), contactoId");
    expect(dialogo, "El diálogo debe avisar que está filtrado por cliente").toContain(
      "Solo las cotizaciones abiertas de",
    );
    expect(dialogo).toContain("lineasDeCotizacionPOS(");
  });

  test("getCotizacionesAbiertas aplica el filtro opcional por contacto", async () => {
    const consulta = cadena({ data: [], error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => consulta) });

    await getCotizacionesAbiertas({ contacto_id: ID_CONTACTO });

    expect(consulta.eq).toHaveBeenCalledWith("contacto_id", ID_CONTACTO);
  });
});

describe("enlace cotización ↔ factura", () => {
  test("la venta desde cotización manda cotizacion_id y no reenvía las líneas", () => {
    const checkout = readFileSync(join(VENDER, "checkout-pos.tsx"), "utf8");
    expect(checkout).toContain("cotizacion ? { cotizacion_id: cotizacion.id } : { lineas: lineasPayload() }");
  });

  test("getCotizacionOrigen busca la cotización por factura_id", async () => {
    const consulta = cadena({
      data: {
        id: ID_COTIZACION,
        numero: 12,
        fecha: "2026-11-20",
        total: 236,
        estado: "convertida",
      },
      error: null,
    });
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => consulta) });

    const cotizacion = await getCotizacionOrigen(ID_FACTURA);

    expect(consulta.eq).toHaveBeenCalledWith("factura_id", ID_FACTURA);
    expect(cotizacion).toEqual({
      id: ID_COTIZACION,
      numero: 12,
      fecha: "2026-11-20",
      total: 236,
      estado: "convertida",
    });
  });

  test("el detalle de factura muestra la pestaña «Cotización origen»", () => {
    const vista = readFileSync(join(SRC, "components", "documento-venta", "vista-documento-venta.tsx"), "utf8");
    expect(vista).toContain("Cotización origen");
    expect(vista).toContain('documento={cotizacionOrigen} tipo="cotizacion"');
    expect(vista, "La pestaña solo aparece si la factura vino de una cotización").toContain("{cotizacionOrigen ? (");
  });
});

describe("candado del botón «más opciones»", () => {
  test("el botón oscuro abre el panel con historial y cotizaciones, y conserva su diseño", () => {
    const panel = readFileSync(join(VENDER, "panel-factura.tsx"), "utf8");
    const overlay = readFileSync(join(VENDER, "mas-opciones-pos.tsx"), "utf8");

    expect(panel, "El botón de abajo a la derecha ya no navega directo al historial").not.toContain(
      'href="/pos/historial"',
    );
    expect(panel, "El botón debe seguir siendo el cuadro oscuro de 45×44 px").toContain(
      "bg-pos-oscuro hover:bg-pos-oscuro/85 relative h-[45px] w-11 shrink-0 rounded-[10px] text-white",
    );
    expect(panel, "El ⋯ abre el panel grande que tapa el carrito (MSG-34), no una listita").toContain(
      "<MasOpcionesPos",
    );
    expect(panel, "Falta la opción de guardar").toContain('etiqueta: "Guardar cotización"');
    expect(panel, "Falta la opción de cargar").toContain('etiqueta: "Cargar cotización"');
    expect(panel, "El historial navega a /pos/historial desde el panel").toContain('href: "/pos/historial"');
    expect(overlay, "El panel de opciones cubre todo el carrito").toContain("absolute inset-0");
  });
});
