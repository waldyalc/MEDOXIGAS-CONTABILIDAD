import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ConteoDetalle } from "@/lib/inventario/ferreteria/tipos";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/inventario/ferreteria/acciones", () => ({
  aplicarConteo: vi.fn(),
  anularConteo: vi.fn(),
  guardarLineasConteo: vi.fn(),
}));

vi.mock("../../_components/acciones-conteo", () => ({
  buscarProductosConteo: vi.fn(),
}));

const { DetalleConteo } = await import("./detalle-conteo");

const AJUSTE = "22222222-2222-4222-8222-222222222222";

function conteo(estado: "borrador" | "aplicado" | "anulado", ajusteId: string | null = null): ConteoDetalle {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    numero: 7,
    fecha: "2026-11-20",
    estado,
    almacen_id: "33333333-3333-4333-8333-333333333333",
    almacen_nombre: "Principal",
    notas: "Conteo de cierre",
    ajuste_id: ajusteId,
    creado_en: "2026-11-20T10:00:00-04:00",
    lineas: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        producto_id: "55555555-5555-4555-8555-555555555555",
        producto_nombre: "Gas 25 lb",
        producto_referencia: "G25",
        cantidad_sistema: "10.00",
        cantidad_contada: "12.50",
        diferencia: "2.50",
        notas: null,
      },
    ],
  };
}

function renderizar(estado: "borrador" | "aplicado" | "anulado", ajusteId: string | null = null) {
  return renderToStaticMarkup(<DetalleConteo conteo={conteo(estado, ajusteId)} puedeEscribir />);
}

describe("DetalleConteo", () => {
  it("en borrador deja editar la cantidad contada y muestra la diferencia en pantalla", () => {
    const html = renderizar("borrador");

    expect(html).toContain("Cantidad contada de Gas 25 lb");
    expect(html).toContain("+2.5");
    expect(html).toContain("Guardar líneas");
    expect(html).toContain("Aplicar conteo");
    expect(html).toContain("Anular");
  });

  it("aplicado es solo lectura y enlaza el ajuste que generó", () => {
    const html = renderizar("aplicado", AJUSTE);

    expect(html).not.toContain("Aplicar conteo");
    expect(html).not.toContain("Cantidad contada de Gas 25 lb");
    expect(html).toContain("Ver ajuste");
    expect(html).toContain(`/dashboard/inventario/ajustes/${AJUSTE}`);
  });

  it("aplicado sin diferencias explica que no hubo ajuste", () => {
    expect(renderizar("aplicado")).toContain("no se generó ajuste de inventario");
  });

  it("anulado no ofrece acciones y avisa que no tocó el inventario", () => {
    const html = renderizar("anulado");

    expect(html).not.toContain("Aplicar conteo");
    expect(html).toContain("Este conteo está anulado y no afectó el inventario.");
  });
});
