import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EncabezadoTablaComparativa } from "./encabezado-tabla-comparativa";

describe("EncabezadoTablaComparativa", () => {
  it("pone el buscador en la tarjeta y conserva los filtros del reporte", () => {
    const html = renderToStaticMarkup(
      <EncabezadoTablaComparativa
        accion="/dashboard/reportes/estado-resultados"
        etiquetaRango="Del 1 al 30 de noviembre: Comparativo 2026 - 2025"
        busqueda="ventas"
        parametros={[
          { nombre: "desde", valor: "2026-11-01" },
          { nombre: "hasta", valor: "2026-11-30" },
          { nombre: "vista", valor: "detallado" },
        ]}
      />,
    );

    expect(html).toContain('action="/dashboard/reportes/estado-resultados"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain('placeholder="Buscar cuenta contable"');
    expect(html).toContain('value="ventas"');
    expect(html).toContain('name="desde" value="2026-11-01"');
    expect(html).toContain('name="hasta" value="2026-11-30"');
    expect(html).toContain('name="vista" value="detallado"');
    expect(html).toContain("Del 1 al 30 de noviembre: Comparativo 2026 - 2025");
  });

  it("muestra el botón limpio de contraer/expandir todas las cuentas cuando la tabla lo controla", () => {
    const html = renderToStaticMarkup(
      <EncabezadoTablaComparativa
        accion="/dashboard/reportes/estado-resultados"
        etiquetaRango="Del 1 de enero al 31 de diciembre: Comparativo 2026 - 2025"
        busqueda=""
        todasContraidas={false}
        onAlternarTodas={() => undefined}
      />,
    );

    expect(html).toContain('aria-label="Contraer todas las cuentas"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('title="Contraer todas las cuentas"');
    expect(html).toContain("hover:bg-transparent");
    expect(html).toContain("aria-expanded:bg-transparent");
    expect(html).not.toContain("bg-muted");
  });

  it("cambia la etiqueta a expandir cuando todas las cuentas están contraídas", () => {
    const html = renderToStaticMarkup(
      <EncabezadoTablaComparativa
        accion="/dashboard/reportes/estado-resultados"
        etiquetaRango="Del 1 de enero al 31 de diciembre: Comparativo 2026 - 2025"
        busqueda=""
        todasContraidas
        onAlternarTodas={() => undefined}
      />,
    );

    expect(html).toContain('aria-label="Expandir todas las cuentas"');
    expect(html).toContain("rotate-180");
  });
});
