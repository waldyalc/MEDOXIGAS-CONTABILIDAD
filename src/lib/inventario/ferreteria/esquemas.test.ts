import { describe, expect, test } from "vitest";

import {
  codigosBarraProductoSchema,
  crearConteoSchema,
  filtroCatalogoPosSchema,
  filtroConteoSchema,
  lineasConteoSchema,
  mensajeValidacion,
  recetaComboSchema,
  unidadesProductoSchema,
  unidadMedidaSchema,
} from "./esquemas";

const COMBO = "11111111-1111-4111-8111-111111111111";
const COMPONENTE = "22222222-2222-4222-8222-222222222222";
const OTRO = "33333333-3333-4333-8333-333333333333";

function errorDe(resultado: { success: boolean; error?: { issues: { message: string }[] } }): string | null {
  if (resultado.success) return null;
  return resultado.error?.issues[0]?.message ?? "sin error";
}

describe("unidadMedidaSchema", () => {
  test("acepta una presentación válida y normaliza el factor a texto", () => {
    const resultado = unidadMedidaSchema.safeParse({
      nombre: "Caja 50 lb",
      factor_base: "50",
      precio: "",
      es_compra: true,
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.factor_base).toBe("50");
    expect(resultado.data.precio).toBeNull();
    expect(resultado.data.es_compra).toBe(true);
    expect(resultado.data.es_venta).toBe(true);
    expect(resultado.data.activa).toBe(true);
  });

  test("acepta un factor de hasta 4 decimales", () => {
    const resultado = unidadMedidaSchema.safeParse({ nombre: "Metro", factor_base: "0.0625" });

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.factor_base).toBe("0.0625");
  });

  test("rechaza factor cero", () => {
    expect(errorDe(unidadMedidaSchema.safeParse({ nombre: "Libra", factor_base: 0 }))).toBe(
      "El factor de la unidad debe ser mayor a cero.",
    );
  });

  test("rechaza factor negativo y factor con más de 4 decimales", () => {
    expect(errorDe(unidadMedidaSchema.safeParse({ nombre: "Libra", factor_base: "-1" }))).toBe(
      "El factor de la unidad debe ser mayor a cero.",
    );
    expect(errorDe(unidadMedidaSchema.safeParse({ nombre: "Libra", factor_base: "0.00001" }))).toBe(
      "El factor de la unidad debe ser un número de hasta 4 decimales.",
    );
  });

  test("exige el nombre y rechaza un precio negativo", () => {
    expect(errorDe(unidadMedidaSchema.safeParse({ nombre: "  ", factor_base: 1 }))).toBe(
      "Cada unidad requiere un nombre.",
    );
    expect(errorDe(unidadMedidaSchema.safeParse({ nombre: "Caja", factor_base: 1, precio: "-5" }))).toBe(
      "El precio no puede ser negativo.",
    );
  });

  test("un id vacío se ignora y un id real se conserva", () => {
    const nuevo = unidadMedidaSchema.safeParse({ id: "", nombre: "Caja", factor_base: 1 });
    const existente = unidadMedidaSchema.safeParse({ id: OTRO, nombre: "Caja", factor_base: 1 });

    expect(nuevo.success && nuevo.data.id).toBeUndefined();
    expect(existente.success && existente.data.id).toBe(OTRO);
  });

  test("rechaza dos unidades con el mismo nombre", () => {
    expect(
      errorDe(
        unidadesProductoSchema.safeParse({
          unidades: [
            { nombre: "Caja", factor_base: 1 },
            { nombre: "caja", factor_base: 2 },
          ],
        }),
      ),
    ).toBe("Repetiste el nombre de una unidad.");
  });
});

describe("codigosBarraProductoSchema", () => {
  test("exige un código no vacío", () => {
    expect(errorDe(codigosBarraProductoSchema.safeParse({ codigos: [{ codigo: "   " }] }))).toBe(
      "El código de barra es obligatorio.",
    );
  });

  test("normaliza el código y deja la unidad nula", () => {
    const resultado = codigosBarraProductoSchema.safeParse({
      codigos: [{ codigo: "  7501234567890  ", unidad_id: "" }],
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.codigos[0]).toEqual({
      codigo: "7501234567890",
      unidad_id: null,
      principal: false,
    });
  });

  test("rechaza el mismo código repetido sin importar mayúsculas", () => {
    expect(
      errorDe(
        codigosBarraProductoSchema.safeParse({
          codigos: [{ codigo: "ABC-1" }, { codigo: "abc-1" }],
        }),
      ),
    ).toBe("Repetiste un código de barra en la lista.");
  });

  test("solo permite un código principal", () => {
    expect(
      errorDe(
        codigosBarraProductoSchema.safeParse({
          codigos: [
            { codigo: "A", principal: true },
            { codigo: "B", principal: true },
          ],
        }),
      ),
    ).toBe("Solo un código de barra puede ser el principal.");
  });
});

describe("recetaComboSchema", () => {
  const receta = (componentes: unknown[]) => recetaComboSchema(COMBO).safeParse({ componentes });

  test("acepta componentes con cantidad positiva", () => {
    const resultado = receta([{ componente_id: COMPONENTE, cantidad: "2", tipo: "producto" }]);

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.componentes[0]?.cantidad).toBe("2");
  });

  test("rechaza cantidad cero o negativa", () => {
    expect(errorDe(receta([{ componente_id: COMPONENTE, cantidad: 0 }]))).toBe(
      "La cantidad del componente debe ser mayor a cero.",
    );
    expect(errorDe(receta([{ componente_id: COMPONENTE, cantidad: -2 }]))).toBe(
      "La cantidad del componente debe ser mayor a cero.",
    );
  });

  test("rechaza que el combo sea componente de sí mismo", () => {
    expect(errorDe(receta([{ componente_id: COMBO, cantidad: 1 }]))).toBe(
      "Un combo no puede ser componente de sí mismo.",
    );
  });

  test("rechaza combos anidados cuando el formulario manda el tipo", () => {
    expect(errorDe(receta([{ componente_id: COMPONENTE, cantidad: 1, tipo: "combo" }]))).toBe(
      "Un combo no puede tener componentes que sean combos.",
    );
  });

  test("rechaza el mismo componente repetido", () => {
    expect(
      errorDe(
        receta([
          { componente_id: COMPONENTE, cantidad: 1 },
          { componente_id: COMPONENTE, cantidad: 2 },
        ]),
      ),
    ).toBe("Repetiste el mismo componente en el combo.");
  });
});

describe("conteo", () => {
  test("acepta una cabecera con líneas y cantidad contada cero", () => {
    const resultado = crearConteoSchema.safeParse({
      almacen_id: COMBO,
      fecha: "2026-11-25",
      lineas: [{ producto_id: COMPONENTE, cantidad_contada: 0 }],
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.lineas[0]?.cantidad_contada).toBe("0");
  });

  test("las líneas son opcionales al crear el conteo", () => {
    const resultado = crearConteoSchema.safeParse({ almacen_id: COMBO, fecha: "2026-11-25" });

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.lineas).toEqual([]);
  });

  test("rechaza una cantidad contada negativa", () => {
    expect(
      errorDe(
        crearConteoSchema.safeParse({
          almacen_id: COMBO,
          fecha: "2026-11-25",
          lineas: [{ producto_id: COMPONENTE, cantidad_contada: "-1" }],
        }),
      ),
    ).toBe("La cantidad contada no puede ser negativa.");
  });

  test("rechaza un producto repetido en las líneas", () => {
    expect(
      errorDe(
        crearConteoSchema.safeParse({
          almacen_id: COMBO,
          fecha: "2026-11-25",
          lineas: [
            { producto_id: COMPONENTE, cantidad_contada: 1 },
            { producto_id: COMPONENTE, cantidad_contada: 2 },
          ],
        }),
      ),
    ).toBe("Repetiste un producto en el conteo.");
  });

  test("rechaza una fecha inválida", () => {
    expect(errorDe(crearConteoSchema.safeParse({ almacen_id: COMBO, fecha: "25/11/2026" }))).toBe(
      "La fecha del conteo no es válida.",
    );
  });

  test("guardar líneas acepta vaciar el conteo y valida la cantidad", () => {
    expect(lineasConteoSchema.safeParse({ lineas: [] }).success).toBe(true);
    expect(errorDe(lineasConteoSchema.safeParse({ lineas: [{ producto_id: COMPONENTE, cantidad_contada: -1 }] }))).toBe(
      "La cantidad contada no puede ser negativa.",
    );
  });

  test("el filtro exige fechas coherentes", () => {
    expect(errorDe(filtroConteoSchema.safeParse({ desde: "2026-11-30", hasta: "2026-11-01" }))).toBe(
      "La fecha desde no puede ser mayor que la fecha hasta.",
    );
    expect(filtroConteoSchema.safeParse({ estado: "borrador" }).success).toBe(true);
    expect(errorDe(filtroConteoSchema.safeParse({ estado: "cerrado" }))).toBe("El estado del conteo no es válido.");
  });
});

describe("mensajeValidacion", () => {
  test("devuelve el primer error en español", () => {
    const resultado = unidadMedidaSchema.safeParse({ nombre: "", factor_base: 1 });

    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(mensajeValidacion(resultado.error)).toBe("Cada unidad requiere un nombre.");
  });
});

describe("filtroCatalogoPosSchema", () => {
  test("aplica los topes por defecto", () => {
    const resultado = filtroCatalogoPosSchema.safeParse({});

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.limit).toBe(50);
    expect(resultado.data.offset).toBe(0);
    expect(resultado.data.solo_favoritos).toBe(false);
  });

  test("rechaza límites fuera de 1–200", () => {
    expect(errorDe(filtroCatalogoPosSchema.safeParse({ limit: 0 }))).toBe("El límite debe estar entre 1 y 200.");
    expect(errorDe(filtroCatalogoPosSchema.safeParse({ limit: 201 }))).toBe("El límite debe estar entre 1 y 200.");
  });

  test("rechaza un desplazamiento negativo", () => {
    expect(errorDe(filtroCatalogoPosSchema.safeParse({ offset: -1 }))).toBe("El desplazamiento no puede ser negativo.");
  });

  test("acepta filtros completos y descarta ids vacíos", () => {
    const resultado = filtroCatalogoPosSchema.safeParse({
      almacen_id: COMBO,
      lista_precio_id: "",
      busqueda: "  cemento  ",
      solo_favoritos: true,
      limit: "200",
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.busqueda).toBe("cemento");
    expect(resultado.data.lista_precio_id).toBeUndefined();
    expect(resultado.data.limit).toBe(200);
  });
});
