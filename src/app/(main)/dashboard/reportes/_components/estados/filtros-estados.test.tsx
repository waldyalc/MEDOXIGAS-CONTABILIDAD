import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard/reportes/estado-resultados",
}));

const { FiltrosEstados } = await import("./filtros-estados");

function filtros(ocultarBusqueda?: boolean) {
  return renderToStaticMarkup(
    <FiltrosEstados
      tipo="rango"
      desde="2026-11-01"
      hasta="2026-11-30"
      vista="detallado"
      busqueda="ventas"
      ocultarBusqueda={ocultarBusqueda}
    />,
  );
}

describe("FiltrosEstados", () => {
  it("mantiene el buscador en la barra por defecto (los otros reportes no cambian)", () => {
    const html = filtros();

    expect(html).toContain('name="q"');
    expect(html).toContain("Buscar cuenta contable");
  });

  it("lo omite cuando el reporte lo pone dentro de la tarjeta", () => {
    const html = filtros(true);

    expect(html).not.toContain("Buscar cuenta contable");
    expect(html).not.toContain('placeholder="Cuenta contable"');
    // La barra conserva la búsqueda aplicada para no perderla al cambiar la vista.
    expect(html).toMatch(/<input type="hidden" name="q" value="ventas"/);
    expect(html).toContain('name="hasta"');
  });

  it("aplica los filtros con el botón Actualizar, como la barra de Alegra", () => {
    const html = filtros(true);

    expect(html).toContain("Actualizar");
    expect(html).toContain('type="submit"');
  });
});
