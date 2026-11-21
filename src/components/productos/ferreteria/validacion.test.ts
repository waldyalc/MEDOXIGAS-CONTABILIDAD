import { describe, expect, it } from "vitest";

import {
  codigosBarraProductoSchema,
  recetaComboSchema,
  unidadesProductoSchema,
} from "@/lib/inventario/ferreteria/esquemas";

import { erroresDeZod } from "./validacion";

const COMBO = "11111111-1111-4111-8111-111111111111";
const PRODUCTO = "22222222-2222-4222-8222-222222222222";
const OTRO = "33333333-3333-4333-8333-333333333333";

describe("errores de la sección de ferretería", () => {
  it("señala el código repetido y el segundo principal con claves por fila", () => {
    const resultado = codigosBarraProductoSchema.safeParse({
      codigos: [
        { codigo: "ABC", unidad_id: null, principal: true },
        { codigo: "abc", unidad_id: null, principal: true },
      ],
    });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    const errores = erroresDeZod(resultado.error);
    expect(errores["codigos-1-codigo"]).toBe("Repetiste un código de barra en la lista.");
    expect(errores.codigos).toBe("Solo un código de barra puede ser el principal.");
  });

  it("exige un factor base mayor a cero en la fila de la unidad", () => {
    const resultado = unidadesProductoSchema.safeParse({
      unidades: [{ nombre: "Caja", factor_base: "0", precio: null, es_compra: false, es_venta: true, activa: true }],
    });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    expect(erroresDeZod(resultado.error)["unidades-0-factor_base"]).toBe(
      "El factor de la unidad debe ser mayor a cero.",
    );
  });

  it("rechaza que un combo se incluya a sí mismo como componente", () => {
    const resultado = recetaComboSchema(COMBO).safeParse({
      componentes: [{ componente_id: COMBO, cantidad: "1", tipo: "producto" }],
    });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    expect(erroresDeZod(resultado.error)["componentes-0-componente_id"]).toBe(
      "Un combo no puede ser componente de sí mismo.",
    );
  });

  it("rechaza un combo anidado dentro de la receta", () => {
    const resultado = recetaComboSchema(COMBO).safeParse({
      componentes: [{ componente_id: PRODUCTO, cantidad: "1", tipo: "combo" }],
    });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    expect(erroresDeZod(resultado.error)["componentes-0-componente_id"]).toBe(
      "Un combo no puede tener componentes que sean combos.",
    );
  });

  it("acepta una receta válida con productos simples", () => {
    const resultado = recetaComboSchema(COMBO).safeParse({
      componentes: [
        { componente_id: PRODUCTO, cantidad: "2", tipo: "producto" },
        { componente_id: OTRO, cantidad: "1", tipo: "producto" },
      ],
    });

    expect(resultado.success).toBe(true);
  });
});
