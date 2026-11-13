import { describe, expect, test } from "vitest";

import {
  rutaCompra,
  rutaContacto,
  rutaFactura,
  rutaGasto,
  rutaPagoProveedor,
  rutaPagoRecibido,
  rutaProducto,
} from "@/lib/enlaces";

import {
  clasificarVista,
  diasEntre,
  diasVencida,
  filtrarCartera,
  saldoCartera,
  totalCartera,
  totalesPorVista,
} from "./antiguedad";
import { filtrarCompras, totalesCompras } from "./compras";
import { tablaCompras, tablaCuentasPorCobrar, tablaCuentasPorPagar, tablaInventario } from "./exportar";
import { calcularTotalLinea, cantidadALaFecha, filtrarInventario, totalInventario } from "./inventario";
import { leerFechaParametro, leerPagina, leerVista, paginar, urlConParametros } from "./parametros";
import type { FilaCartera, FilaCompra, FilaInventario, FiltrosCartera } from "./tipos";

function cartera(overrides: Partial<FilaCartera> = {}): FilaCartera {
  return {
    id: "f1",
    numero: 1,
    ncf: "B0100000001",
    tipoDocumento: "Factura",
    contactoId: "c1",
    contactoNombre: "Constructora Prueba SRL",
    creado: "2026-11-13",
    vencimiento: "2026-12-13",
    total: 1663800,
    pagado: 800000,
    saldo: 863800,
    diasVencida: 0,
    vista: "no-vencidas",
    ...overrides,
  };
}

const FILTROS: FiltrosCartera = {
  vista: "todas",
  ncf: "",
  contacto: "",
  creacionDesde: null,
  creacionHasta: null,
  vencimientoDesde: null,
  vencimientoHasta: null,
};

describe("antigüedad de la cartera", () => {
  test("calcula días entre fechas y días vencidos", () => {
    expect(diasEntre("2026-11-13", "2026-11-30")).toBe(17);
    expect(diasEntre("2026-11-30", "2026-11-13")).toBe(-17);
    expect(diasVencida("2026-11-10", "2026-11-13")).toBe(3);
    expect(diasVencida("2026-11-20", "2026-11-13")).toBe(0);
  });

  test("el saldo por pagar resta pagos y créditos de la factura", () => {
    expect(saldoCartera(236000, 50000, 94400)).toBe(91600);
    expect(saldoCartera(236000, 50000)).toBe(186000);
  });

  test("clasifica los tramos de 30, 60, 90 y 91+ días", () => {
    expect(clasificarVista(0)).toBe("no-vencidas");
    expect(clasificarVista(1)).toBe("vencidas-30");
    expect(clasificarVista(30)).toBe("vencidas-30");
    expect(clasificarVista(31)).toBe("vencidas-31-60");
    expect(clasificarVista(60)).toBe("vencidas-31-60");
    expect(clasificarVista(61)).toBe("vencidas-61-90");
    expect(clasificarVista(90)).toBe("vencidas-61-90");
    expect(clasificarVista(91)).toBe("vencidas-91");
  });

  test("filtra por NCF, cliente, creación, vencimiento y vista", () => {
    const filas = [
      cartera(),
      cartera({
        id: "f2",
        numero: 2,
        ncf: "B0200000002",
        contactoNombre: "Cliente Pequeño",
        creado: "2026-10-01",
        vencimiento: "2026-10-15",
        saldo: 100000,
        diasVencida: 29,
        vista: "vencidas-30",
      }),
    ];

    expect(filtrarCartera(filas, FILTROS)).toHaveLength(2);
    expect(filtrarCartera(filas, { ...FILTROS, ncf: "b0200" }).map((fila) => fila.id)).toEqual(["f2"]);
    expect(filtrarCartera(filas, { ...FILTROS, ncf: "#2" }).map((fila) => fila.id)).toEqual(["f2"]);
    expect(filtrarCartera(filas, { ...FILTROS, contacto: "constructora" }).map((fila) => fila.id)).toEqual(["f1"]);
    expect(filtrarCartera(filas, { ...FILTROS, creacionDesde: "2026-11-01" }).map((fila) => fila.id)).toEqual(["f1"]);
    expect(filtrarCartera(filas, { ...FILTROS, vencimientoHasta: "2026-10-31" }).map((fila) => fila.id)).toEqual([
      "f2",
    ]);
    expect(filtrarCartera(filas, { ...FILTROS, vista: "no-vencidas" }).map((fila) => fila.id)).toEqual(["f1"]);
  });

  test("suma el saldo total y el de cada vista", () => {
    const filas = [cartera(), cartera({ id: "f2", saldo: 100000, vista: "vencidas-91", diasVencida: 100 })];

    expect(totalCartera(filas)).toBe(963800);
    expect(totalesPorVista(filas)).toMatchObject({
      "vencidas-91": 100000,
      "no-vencidas": 863800,
    });
  });
});

describe("parámetros de URL", () => {
  test("lee la vista, la página y pagina los resultados", () => {
    expect(leerVista({ vista: "vencidas-31-60" })).toBe("vencidas-31-60");
    expect(leerVista({ vista: "otra" })).toBe("todas");
    expect(leerPagina({ pagina: "2" }, 3)).toBe(2);
    expect(leerPagina({ pagina: "99" }, 3)).toBe(3);
    expect(leerPagina({}, 3)).toBe(1);
    expect(leerFechaParametro({ hasta: "2026-11-30" }, "hasta")).toBe("2026-11-30");
    expect(leerFechaParametro({ hasta: "2026-02-30" }, "hasta")).toBeNull();

    const pagina = paginar([1, 2, 3, 4, 5], 2, 2);
    expect(pagina.filas).toEqual([3, 4]);
    expect(pagina).toMatchObject({ pagina: 2, totalPaginas: 3, inicio: 3, fin: 4, total: 5 });
  });

  test("conserva filtros y quita parámetros al pedir otra página o vista", () => {
    const params = { desde: "2026-11-01", hasta: "2026-11-30", ncf: "B01", pagina: "2", vacio: "" };

    expect(urlConParametros("/ruta", params, { pagina: "3" })).toBe(
      "/ruta?desde=2026-11-01&hasta=2026-11-30&ncf=B01&pagina=3",
    );
    expect(urlConParametros("/ruta", params, { pagina: null, vista: null })).toBe(
      "/ruta?desde=2026-11-01&hasta=2026-11-30&ncf=B01",
    );
  });
});

describe("enlaces canónicos", () => {
  test("arma las URL de fichas y documentos", () => {
    expect(rutaContacto("c1")).toBe("/dashboard/contactos/c1");
    expect(rutaProducto("p1")).toBe("/dashboard/productos/p1");
    expect(rutaFactura("f1")).toBe("/dashboard/facturacion/f1");
    expect(rutaCompra("f2")).toBe("/dashboard/compras/f2");
    expect(rutaPagoProveedor("pp1")).toBe("/dashboard/compras/pagos/pp1");
    expect(rutaPagoRecibido("pr1")).toBe("/dashboard/pagos-recibidos/pr1");
    expect(rutaGasto("g1")).toBe("/dashboard/gastos/g1");
  });
});

describe("compras", () => {
  const filas: FilaCompra[] = [
    {
      id: "f1",
      numero: 50,
      ncf: "B0100000050",
      contactoId: "p1",
      contactoNombre: "Distribuidora Central",
      fecha: "2026-11-13",
      subtotal: 3900000,
      total: 4602000,
    },
    {
      id: "f2",
      numero: 51,
      ncf: null,
      contactoId: "p2",
      contactoNombre: "Ferretería del Norte",
      fecha: "2026-11-14",
      subtotal: 100000,
      total: 118000,
    },
  ];

  test("filtra por proveedor y suma antes y después de impuestos", () => {
    expect(filtrarCompras(filas, { proveedor: "central" }).map((fila) => fila.id)).toEqual(["f1"]);
    expect(totalesCompras(filas)).toEqual({ antesDeImpuestos: 4000000, despuesDeImpuestos: 4720000 });
  });
});

describe("valor de inventario", () => {
  const filas: FilaInventario[] = [
    {
      id: "p1",
      nombre: "Cemento gris 42.5kg",
      referencia: "CEM-42",
      descripcion: "Saco",
      cantidad: 140,
      unidad: "Unidad",
      activo: true,
      costo: 39000,
      total: 5460000,
    },
    {
      id: "p2",
      nombre: "Tubo PVC 1/2",
      referencia: null,
      descripcion: null,
      cantidad: 40,
      unidad: "Unidad",
      activo: false,
      costo: 9000,
      total: 360000,
    },
  ];

  test("reconstruye la cantidad a una fecha y calcula el total", () => {
    expect(cantidadALaFecha(100, 20, 30)).toBe(90);
    expect(calcularTotalLinea(50, 7200)).toBe(360000);
    expect(totalInventario(filas)).toBe(5820000);
    expect(filtrarInventario(filas, { producto: "cemento", referencia: "" }).map((fila) => fila.id)).toEqual(["p1"]);
    expect(filtrarInventario(filas, { producto: "", referencia: "cem" }).map((fila) => fila.id)).toEqual(["p1"]);
  });
});

describe("tablas de exportación", () => {
  test("cuentas por cobrar incluye columnas de Alegra y fila de total", () => {
    const tabla = tablaCuentasPorCobrar([cartera()], "Hasta: 2026-11-30");

    expect(tabla.columnas.map((columna) => columna.titulo)).toEqual([
      "NCF/Número",
      "Tipo de documento",
      "Cliente",
      "Creación",
      "Vencimiento",
      "Total",
      "Cobrado",
      "Por cobrar",
    ]);
    expect(tabla.filas.at(-1)?.celdas).toMatchObject({ numero: "Total por cobrar", saldo: 863800 });
  });

  test("cuentas por pagar cambia el orden y la etiqueta del total", () => {
    const tabla = tablaCuentasPorPagar([cartera({ tipoDocumento: "Factura de proveedor" })], "Del 01 al 30");

    expect(tabla.columnas[0]?.titulo).toBe("Tipo de documento");
    expect(tabla.filas.at(-1)?.celdas).toMatchObject({ tipo: "Total por pagar", saldo: 863800 });
  });

  test("compras e inventario suman sus totales", () => {
    const compras = tablaCompras(
      [
        {
          id: "f1",
          numero: 50,
          ncf: "B0100000050",
          contactoId: "p1",
          contactoNombre: "Proveedor",
          fecha: "2026-11-13",
          subtotal: 3900000,
          total: 4602000,
        },
      ],
      "Del 01 al 30",
    );
    expect(compras.filas.at(-1)?.celdas).toMatchObject({ subtotal: 3900000, total: 4602000 });

    const inventario = tablaInventario(
      [
        {
          id: "p1",
          nombre: "Cemento",
          referencia: null,
          descripcion: null,
          cantidad: 10,
          unidad: "Unidad",
          activo: true,
          costo: 100,
          total: 1000,
        },
      ],
      "Hasta: hoy",
    );
    expect(inventario.filas.at(-1)?.celdas).toMatchObject({ producto: "Total general", total: 1000 });
  });
});
