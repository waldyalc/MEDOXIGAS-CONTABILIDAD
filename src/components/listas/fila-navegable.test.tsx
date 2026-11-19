import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const { FilaNavegable, dentroDeInteractivo } = await import("./fila-navegable");
const { TablaLista } = await import("./tabla-lista");

function fila(href?: string | null) {
  return renderToStaticMarkup(
    <table>
      <tbody>
        <FilaNavegable href={href}>
          <td>#1</td>
          <td>Cliente</td>
        </FilaNavegable>
      </tbody>
    </table>,
  );
}

describe("FilaNavegable", () => {
  it("la fila con destino se marca como link enfocable y lleva su URL", () => {
    const html = fila("/dashboard/facturacion/abc-123");

    expect(html).toContain('role="link"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-href="/dashboard/facturacion/abc-123"');
    expect(html).toContain("cursor-pointer");
  });

  it("sin destino la fila queda como una fila normal", () => {
    for (const html of [fila(null), fila(undefined)]) {
      expect(html).not.toContain('role="link"');
      expect(html).not.toContain("data-href");
      expect(html).not.toContain("tabindex");
    }
  });

  it("dentroDeInteractivo gana el click para links, botones e inputs", () => {
    const enLink = { closest: (selector: string) => (selector.includes("a") ? {} : null) };
    const fuera = { closest: () => null };

    expect(dentroDeInteractivo(enLink)).toBe(true);
    expect(dentroDeInteractivo(fuera)).toBe(false);
    expect(dentroDeInteractivo(null)).toBe(false);
    expect(dentroDeInteractivo({})).toBe(false);
    // El target puede ser un SVG (ícono dentro de un botón/link): debe contar igual.
    expect(dentroDeInteractivo({ closest: () => ({ tagName: "BUTTON" }) })).toBe(true);
  });
});

describe("TablaLista con filaHref", () => {
  it("pasa el destino a cada fila y mantiene celdas interactivas", () => {
    const filas = [
      { id: "a1", numero: 7 },
      { id: "a2", numero: 8 },
    ];
    const html = renderToStaticMarkup(
      <TablaLista
        columnas={[
          {
            clave: "numero",
            encabezado: "Número",
            celda: (fila) => <a href={`/dashboard/facturacion/${fila.id}`}>#{fila.numero}</a>,
          },
          {
            clave: "acciones",
            encabezado: "",
            celda: () => <button type="button">···</button>,
          },
        ]}
        filas={filas}
        claveFila={(fila) => fila.id}
        filaHref={(fila) => `/dashboard/facturacion/${fila.id}`}
        vacio={{ titulo: "Sin facturas" }}
      />,
    );

    expect(html).toContain('role="link"');
    expect(html).toContain('data-href="/dashboard/facturacion/a1"');
    expect(html).toContain('data-href="/dashboard/facturacion/a2"');
    // El link azul de la primera columna y el botón de acciones siguen dentro.
    expect(html).toContain('<a href="/dashboard/facturacion/a1">#7</a>');
    expect(html).toContain("<button");
  });

  it("una filaHref que devuelve null deja la fila no clicable", () => {
    const html = renderToStaticMarkup(
      <TablaLista
        columnas={[{ clave: "numero", encabezado: "Número", celda: (fila: { id: string }) => fila.id }]}
        filas={[{ id: "a1" }]}
        claveFila={(fila) => fila.id}
        filaHref={() => null}
        vacio={{ titulo: "Sin datos" }}
      />,
    );

    expect(html).not.toContain('role="link"');
    expect(html).not.toContain("data-href");
  });
});
