import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/inventario/acciones", () => ({
  crearAjusteInventario: vi.fn(),
}));

const { AjusteForm } = await import("./ajuste-form");
const { NOTA_COSTO_SALIDA } = await import("./campo-costo-linea");

function formulario() {
  return renderToStaticMarkup(
    <AjusteForm
      almacenes={[
        { id: "33333333-3333-4333-8333-333333333333", nombre: "Principal", es_principal: true, activo: true },
      ]}
      productos={[
        {
          id: "11111111-1111-4111-8111-111111111111",
          nombre: "Gas 25 lb",
          referencia: "G25",
          cantidad: 12,
          costo: 10667.35,
        },
      ]}
      almacenPorDefecto="33333333-3333-4333-8333-333333333333"
      fechaHoy="2026-11-20"
    />,
  );
}

describe("AjusteForm", () => {
  it("arranca con una línea de entrada y el costo editable", () => {
    const html = formulario();

    expect(html).toContain("Entrada");
    expect(html).toContain('id="ajuste-costo-0"');
    expect(html.toLowerCase()).not.toContain('readonly=""');
  });

  it("explica que el costo de la salida va bloqueado al promedio vigente", () => {
    expect(formulario()).toContain(`${NOTA_COSTO_SALIDA} y su campo va bloqueado`);
  });
});
