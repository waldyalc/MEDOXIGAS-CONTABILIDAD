import { describe, expect, test } from "vitest";

import { rutaDeResultado } from "./rutas";
import type { EntidadBusqueda } from "./tipos";

/** Las 16 entidades con ficha (§2.1), con la base exacta de `src/lib/enlaces.ts`. */
const CASOS: readonly { entidad: EntidadBusqueda; id: string; esperada: string }[] = [
  { entidad: "contacto", id: "c-1", esperada: "/dashboard/contactos/c-1" },
  { entidad: "producto", id: "p-1", esperada: "/dashboard/productos/p-1" },
  { entidad: "factura", id: "f-1", esperada: "/dashboard/facturacion/f-1" },
  { entidad: "nota_credito_venta", id: "nc-1", esperada: "/dashboard/notas-credito/nc-1" },
  { entidad: "nota_debito_venta", id: "nd-1", esperada: "/dashboard/notas-debito/nd-1" },
  { entidad: "cotizacion", id: "q-1", esperada: "/dashboard/cotizaciones/q-1" },
  { entidad: "remision", id: "r-1", esperada: "/dashboard/conduces/r-1" },
  { entidad: "factura_recurrente", id: "fr-1", esperada: "/dashboard/facturas-recurrentes/fr-1" },
  { entidad: "pago_recibido", id: "pr-1", esperada: "/dashboard/pagos-recibidos/pr-1" },
  { entidad: "factura_proveedor", id: "cp-1", esperada: "/dashboard/compras/cp-1" },
  { entidad: "nota_credito_compra", id: "ncc-1", esperada: "/dashboard/compras/notas-credito/ncc-1" },
  { entidad: "orden_compra", id: "oc-1", esperada: "/dashboard/ordenes-compra/oc-1" },
  { entidad: "pago_proveedor", id: "pp-1", esperada: "/dashboard/compras/pagos/pp-1" },
  { entidad: "gasto_menor", id: "g-1", esperada: "/dashboard/gastos/g-1" },
  { entidad: "asiento", id: "a-1", esperada: "/dashboard/contabilidad/asientos/a-1" },
  { entidad: "cuenta", id: "ct-1", esperada: "/dashboard/contabilidad/cuentas/ct-1" },
];

/** Catálogo completo de §2.1: si se agrega una entidad, esta lista la debe seguir. */
const ENTIDADES: readonly EntidadBusqueda[] = [
  "contacto",
  "producto",
  "factura",
  "nota_credito_venta",
  "nota_debito_venta",
  "cotizacion",
  "remision",
  "factura_recurrente",
  "pago_recibido",
  "factura_proveedor",
  "nota_credito_compra",
  "orden_compra",
  "pago_proveedor",
  "gasto_menor",
  "asiento",
  "cuenta",
  "reporte",
  "navegacion",
  "documento",
];

describe("rutaDeResultado", () => {
  test("cada entidad abre su ficha con la ruta de src/lib/enlaces.ts", () => {
    for (const { entidad, id, esperada } of CASOS) {
      expect(rutaDeResultado({ entidad, id })).toBe(esperada);
    }
  });

  test("el id se codifica como en enlaces.ts", () => {
    expect(rutaDeResultado({ entidad: "contacto", id: "a b/c" })).toBe("/dashboard/contactos/a%20b%2Fc");
  });

  test("reporte devuelve la URL del catálogo tal cual", () => {
    expect(rutaDeResultado({ entidad: "reporte", id: "/dashboard/reportes/ventas" })).toBe(
      "/dashboard/reportes/ventas",
    );
  });

  test("navegación devuelve la URL del menú tal cual", () => {
    expect(rutaDeResultado({ entidad: "navegacion", id: "/dashboard/compras" })).toBe("/dashboard/compras");
  });

  test("reporte o navegación sin URL no enlazan a una cadena vacía", () => {
    expect(rutaDeResultado({ entidad: "reporte", id: "" })).toBeNull();
    expect(rutaDeResultado({ entidad: "navegacion", id: "" })).toBeNull();
  });

  test("documento todavía no tiene ruta (fase 4)", () => {
    expect(rutaDeResultado({ entidad: "documento", id: "d-1" })).toBeNull();
  });

  test("toda entidad del catálogo resuelve ruta y solo documento devuelve null", () => {
    for (const entidad of ENTIDADES) {
      const id = entidad === "reporte" || entidad === "navegacion" ? "/dashboard/prueba" : "x-1";
      const ruta = rutaDeResultado({ entidad, id });

      if (entidad === "documento") {
        expect(ruta).toBeNull();
      } else {
        expect(ruta ?? "sin-ruta").toMatch(/^\/dashboard\//);
      }
    }
  });
});
