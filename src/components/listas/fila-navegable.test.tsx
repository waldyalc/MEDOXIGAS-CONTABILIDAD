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

// closest() de verdad recorre el elemento Y sus ancestros: este nodo falso
// reproduce ese contrato para pillar que la fila no se trague su propio click.
type NodoFalso = { closest: (selector: string) => NodoFalso | null };

function nodo(coincide: (selector: string) => boolean, padre?: NodoFalso): NodoFalso {
  const el: NodoFalso = {
    closest: (selector) => (coincide(selector) ? el : (padre?.closest(selector) ?? null)),
  };
  return el;
}

const esToken = (token: string) => (selector: string) => selector.split(",").some((parte) => parte.trim() === token);

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

    expect(dentroDeInteractivo(enLink, null)).toBe(true);
    expect(dentroDeInteractivo(fuera, null)).toBe(false);
    expect(dentroDeInteractivo(null, null)).toBe(false);
    expect(dentroDeInteractivo({}, null)).toBe(false);
    // El target puede ser un SVG (ícono dentro de un botón/link): debe contar igual.
    expect(dentroDeInteractivo({ closest: () => ({ tagName: "BUTTON" }) }, null)).toBe(true);
  });

  it("la fila role=link no se traga su propio click en una celda vacía", () => {
    // Regresión: la fila lleva role="link", que está en SELECTOR_INTERACTIVO;
    // como closest() sube por los ancestros, sin excluir la fila todo click
    // dentro de ella se tragaba y nunca navegaba.
    const filaEl = nodo(esToken('[role="link"]'));
    const celda = nodo(() => false, filaEl);
    const texto = nodo(() => false, celda);

    expect(dentroDeInteractivo(celda, filaEl)).toBe(false);
    expect(dentroDeInteractivo(texto, filaEl)).toBe(false);
    // Click en el borde de la propia fila: también navega.
    expect(dentroDeInteractivo(filaEl, filaEl)).toBe(false);
  });

  it("un link o botón anidado dentro de la fila sí gana el click", () => {
    const filaEl = nodo(esToken('[role="link"]'));
    const link = nodo(esToken("a"), filaEl);
    const iconoSvg = nodo(() => false, link);
    const boton = nodo(esToken("button"), filaEl);

    expect(dentroDeInteractivo(link, filaEl)).toBe(true);
    expect(dentroDeInteractivo(iconoSvg, filaEl)).toBe(true);
    expect(dentroDeInteractivo(boton, filaEl)).toBe(true);
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
