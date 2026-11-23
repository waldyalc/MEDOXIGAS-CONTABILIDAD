import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Star } from "@/components/icons";
import type { ProductoPOS } from "@/lib/pos/tipos";

import { TarjetaProductoPos } from "./tarjeta-producto-pos";

const producto: ProductoPOS = {
  producto_id: "11111111-1111-4111-8111-111111111111",
  nombre: "Agua 5 galones",
  referencia: "AGUA-5",
  marca: null,
  tipo: "producto",
  categoria_id: null,
  favorito_pos: false,
  imagen_path: null,
  unidad_medida: "Unidad",
  precio: "250.00",
  itbis_tasa: "18",
  stock: "10",
  disponible: null,
  unidades: [],
};

const sinAccion = () => undefined;

function tarjeta(favorito: boolean) {
  return renderToStaticMarkup(
    <TarjetaProductoPos
      producto={producto}
      cantidad={0}
      resaltado={false}
      favorito={favorito}
      imagenUrl={null}
      onAgregar={sinAccion}
      onFavorito={sinAccion}
    />,
  );
}

/** El primer `svg` de la tarjeta es la estrella del cuadro teal. */
function estrella(html: string) {
  const svg = /<svg[\s\S]*?<\/svg>/.exec(html);
  expect(svg, "la tarjeta debe dibujar la estrella con un svg").not.toBeNull();
  const forma = /<path d="([^"]+)"/.exec(svg?.[0] ?? "");
  expect(forma, "la estrella de Phosphor debe dibujarse con un path").not.toBeNull();
  return forma?.[1] ?? "";
}

const rellena = estrella(renderToStaticMarkup(<Star weight="fill" aria-hidden="true" />));
const contorno = estrella(renderToStaticMarkup(<Star weight="regular" aria-hidden="true" />));

describe("estrella de favoritos en la tarjeta del POS (MSG-31)", () => {
  it("marcada = estrella sólida; sin marcar = contorno, y no se ven iguales", () => {
    expect(rellena, "Phosphor debe tener un path distinto para «fill» y «regular»").not.toBe(contorno);

    expect(estrella(tarjeta(true)), "la tarjeta marcada pinta la variante rellena (weight=fill)").toBe(rellena);
    expect(estrella(tarjeta(false)), "la tarjeta sin marcar deja el contorno (weight=regular)").toBe(contorno);
  });

  it("aria-pressed sigue el estado del favorito", () => {
    expect(tarjeta(true)).toContain('aria-pressed="true"');
    expect(tarjeta(false)).toContain('aria-pressed="false"');
  });
});
