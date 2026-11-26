import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/contactos/actions", () => ({
  actualizarContacto: vi.fn(),
  crearContacto: vi.fn(),
}));

vi.mock("@/lib/contactos/buscar-duplicado", () => ({
  buscarContactoDuplicado: vi.fn(),
}));

vi.mock("@/lib/dgii/acciones", () => ({
  buscarContribuyenteDgii: vi.fn(),
}));

const { SelectorTipoContacto } = await import("./dialogo-nuevo-contacto");

function renderizar(permitirProveedor: boolean): string {
  return renderToStaticMarkup(
    <SelectorTipoContacto
      permitirProveedor={permitirProveedor}
      esCliente
      esProveedor={false}
      onCliente={() => undefined}
      onProveedor={() => undefined}
    />,
  );
}

describe("SelectorTipoContacto del diálogo Nuevo contacto", () => {
  test("sin restricción muestra Cliente y Proveedor, como Alegra Contabilidad", () => {
    const html = renderizar(true);

    expect(html).toContain(">Cliente<");
    expect(html).toContain(">Proveedor<");
  });

  test("con permitirProveedor=false no renderiza el toggle Proveedor", () => {
    expect(renderizar(false)).toBe("");
  });
});
