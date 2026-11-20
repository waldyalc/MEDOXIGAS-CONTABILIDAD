import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ProductoInventario } from "@/lib/inventario/tipos";

import { CampoCostoLinea, NOTA_COSTO_SALIDA } from "./campo-costo-linea";

const producto: ProductoInventario = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre: "Gas 25 lb",
  referencia: "G25",
  cantidad: 12,
  costo: 10667.35,
};

function campo(tipo: "entrada" | "salida", costo: string) {
  return renderToStaticMarkup(
    <CampoCostoLinea
      id="ajuste-costo-0"
      indice={0}
      tipo={tipo}
      producto={producto}
      costo={costo}
      error={null}
      disabled={false}
      onCambiar={() => undefined}
    />,
  );
}

describe("CampoCostoLinea", () => {
  it("en la salida bloquea el costo y muestra el promedio vigente, como Alegra", () => {
    const html = campo("salida", "999");

    expect(html.toLowerCase()).toContain('readonly=""');
    expect(html).toContain('aria-readonly="true"');
    expect(html).toContain("RD$ 10,667.35");
    expect(html).toContain(`title="${NOTA_COSTO_SALIDA}"`);
    expect(html).not.toContain('value="999"');
  });

  it("en la entrada deja el costo editable y con el prefijo RD$", () => {
    const html = campo("entrada", "250.50");

    expect(html.toLowerCase()).not.toContain("readonly");
    expect(html).toContain("RD$");
    expect(html).toContain('value="250.50"');
  });
});
