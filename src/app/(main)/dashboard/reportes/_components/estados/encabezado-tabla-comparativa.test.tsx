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
});
