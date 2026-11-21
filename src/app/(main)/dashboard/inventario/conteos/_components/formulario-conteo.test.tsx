import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/inventario/ferreteria/acciones", () => ({
  crearConteo: vi.fn(),
}));

vi.mock("./acciones-conteo", () => ({
  buscarProductosConteo: vi.fn(),
}));

const { FormularioConteo } = await import("./formulario-conteo");

function formulario() {
  return renderToStaticMarkup(
    <FormularioConteo
      almacenes={[
        { id: "33333333-3333-4333-8333-333333333333", nombre: "Principal", es_principal: true, activo: true },
      ]}
      almacenPorDefecto="33333333-3333-4333-8333-333333333333"
      fechaHoy="2026-11-20"
    />,
  );
}

describe("FormularioConteo", () => {
  it("arranca con el almacén y la fecha de hoy, y el buscador de productos listo", () => {
    const html = formulario();

    expect(html).toContain("Datos del conteo");
    expect(html).toContain('id="almacen"');
    expect(html).toContain("20/11/2026");
    expect(html).toContain('id="conteo-buscador"');
  });

  it("no usa select nativo ni input de fecha nativo", () => {
    const html = formulario();

    expect(html).not.toContain("<select");
    expect(html).not.toContain('type="date"');
  });

  it("se guarda como borrador y no promete aplicar el ajuste en esta pantalla", () => {
    const html = formulario();

    expect(html).toContain("Guardar borrador");
    expect(html).not.toContain("Aplicar conteo");
  });
});
