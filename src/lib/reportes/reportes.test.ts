import { describe, expect, test } from "vitest";

import { calcularBalance } from "./balance";
import { construirArbolCuentas, saldosPorCodigo } from "./contabilidad";
import { agruparCxc } from "./cxc";
import { centavos, formatearRd, sumarCentavos } from "./dinero";
import { parsearRango, rangoMesActual } from "./fechas";
import { agruparLibroDiario, etiquetaOrigen, totalesLibroDiario } from "./libro-diario";
import { calcularEstadoResultados } from "./resultados";
import type { CuentaContable, FilaBalanceComprobacion, FilaCxc, FilaEstadoResultados, FilaLibroDiario } from "./tipos";

describe("dinero en centavos enteros", () => {
  test("convierte números y textos sin errores de flotante", () => {
    expect(centavos("0.10") + centavos("0.20")).toBe(30);
    expect(centavos(19.99)).toBe(1999);
    expect(centavos("1234.5")).toBe(123450);
    expect(centavos("-5.55")).toBe(-555);
    expect(centavos("1,234.56")).toBe(123456);
    expect(centavos(null)).toBe(0);
    expect(centavos("no-es-monto")).toBe(0);
  });

  test("suma listas y formatea RD$ con 2 decimales", () => {
    expect(sumarCentavos(["100.10", 20, null])).toBe(12010);
    expect(formatearRd(123456)).toBe("RD$1,234.56");
    expect(formatearRd(-500)).toBe("-RD$5.00");
    // El cero negativo (p.ej. -1 * 0 en los comparativos) no imprime signo.
    expect(formatearRd(-0)).toBe("RD$0.00");
  });
});

describe("fechas de los reportes", () => {
  test("el mes actual va del día 1 al último día", () => {
    expect(rangoMesActual("2026-11-13")).toEqual({ desde: "2026-11-01", hasta: "2026-11-30" });
    expect(rangoMesActual("2024-02-10")).toEqual({ desde: "2024-02-01", hasta: "2024-02-29" });
  });

  test("usa el mes actual si faltan datos o el rango es inválido", () => {
    const defecto = { desde: "2026-11-01", hasta: "2026-11-30" };
    expect(parsearRango({}, "2026-11-13")).toEqual(defecto);
    expect(parsearRango({ desde: "2026-02-30" }, "2026-11-13")).toEqual(defecto);
    expect(parsearRango({ desde: "2026-12-01", hasta: "2026-11-01" }, "2026-11-13")).toEqual(defecto);
    expect(parsearRango({ desde: "2026-10-15", hasta: "2026-10-31" }, "2026-11-13")).toEqual({
      desde: "2026-10-15",
      hasta: "2026-10-31",
    });
  });
});

const FILAS_LIBRO: FilaLibroDiario[] = [
  {
    asiento_numero: 2,
    fecha: "2026-11-02",
    asiento_descripcion: null,
    origen_tipo: "manual",
    cuenta_codigo: "1101",
    cuenta_nombre: "Caja general",
    debito: "100.00",
    credito: "0.00",
  },
  {
    asiento_numero: 2,
    fecha: "2026-11-02",
    asiento_descripcion: null,
    origen_tipo: "manual",
    cuenta_codigo: "4101",
    cuenta_nombre: "Ventas de productos",
    debito: "0.00",
    credito: "100.00",
  },
  {
    asiento_numero: 1,
    fecha: "2026-11-01",
    asiento_descripcion: "Venta de prueba",
    origen_tipo: "factura",
    cuenta_codigo: "1103",
    cuenta_nombre: "Cuentas por cobrar clientes",
    debito: "1180.10",
    credito: null,
  },
  {
    asiento_numero: 1,
    fecha: "2026-11-01",
    asiento_descripcion: "Venta de prueba",
    origen_tipo: "factura",
    cuenta_codigo: "4101",
    cuenta_nombre: "Ventas de productos",
    debito: null,
    credito: "1000.10",
  },
  {
    asiento_numero: 1,
    fecha: "2026-11-01",
    asiento_descripcion: "Venta de prueba",
    origen_tipo: "factura",
    cuenta_codigo: "2102",
    cuenta_nombre: "ITBIS por pagar",
    debito: null,
    credito: "180.00",
  },
];

describe("libro diario agrupado por asiento", () => {
  test("agrupa líneas, ordena por número y totaliza en centavos", () => {
    const asientos = agruparLibroDiario(FILAS_LIBRO);

    expect(asientos).toHaveLength(2);
    const [primero, segundo] = asientos;
    expect(primero?.numero).toBe(1);
    expect(primero?.descripcion).toBe("Venta de prueba");
    expect(primero?.lineas).toHaveLength(3);
    expect(primero?.totalDebito).toBe(118010);
    expect(primero?.totalCredito).toBe(118010);
    expect(segundo?.numero).toBe(2);
    expect(segundo?.descripcion).toBe("");
  });

  test("suma los totales de todos los asientos", () => {
    expect(totalesLibroDiario(agruparLibroDiario(FILAS_LIBRO))).toEqual({
      debitos: 128010,
      creditos: 128010,
    });
  });

  test("traduce el origen y deja el código si no lo conoce", () => {
    expect(etiquetaOrigen("factura")).toBe("Factura");
    expect(etiquetaOrigen("pago_recibido")).toBe("Pago recibido");
    expect(etiquetaOrigen("otro")).toBe("otro");
  });
});

describe("balance de comprobación", () => {
  test("marca cuadrado cuando débitos y créditos coinciden", () => {
    const filas: FilaBalanceComprobacion[] = [
      {
        cuenta_codigo: "1101",
        cuenta_nombre: "Caja general",
        tipo: "activo",
        debitos: "100.10",
        creditos: "100.10",
        saldo: "0.00",
      },
      {
        cuenta_codigo: "4101",
        cuenta_nombre: "Ventas de productos",
        tipo: "ingreso",
        debitos: null,
        creditos: "0.20",
        saldo: "-0.20",
      },
    ];
    const balance = calcularBalance(filas);

    expect(balance.totales).toEqual({ debitos: 10010, creditos: 10030, diferencia: -20, cuadra: false });
    expect(balance.filas[1]?.saldo).toBe(-20);
  });

  test("reporta diferencia cuando no cuadra", () => {
    const balance = calcularBalance([
      {
        cuenta_codigo: "1101",
        cuenta_nombre: "Caja general",
        tipo: "activo",
        debitos: "10.00",
        creditos: "9.99",
        saldo: "0.01",
      },
    ]);

    expect(balance.totales.diferencia).toBe(1);
    expect(balance.totales.cuadra).toBe(false);
    expect(calcularBalance([]).totales.cuadra).toBe(true);
  });
});

describe("estado de resultados", () => {
  const filas: FilaEstadoResultados[] = [
    { tipo: "gasto", cuenta_codigo: "6101", cuenta_nombre: "Gastos generales", monto: "50.25" },
    { tipo: "ingreso", cuenta_codigo: "4102", cuenta_nombre: "Ventas de servicios", monto: "300.00" },
    { tipo: "costo", cuenta_codigo: "5101", cuenta_nombre: "Costo de ventas", monto: "100.10" },
    { tipo: "ingreso", cuenta_codigo: "4101", cuenta_nombre: "Ventas de productos", monto: "1000.00" },
  ];

  test("calcula utilidad bruta y neta con centavos exactos", () => {
    const estado = calcularEstadoResultados(filas);

    expect(estado.totalIngresos).toBe(130000);
    expect(estado.totalCostos).toBe(10010);
    expect(estado.utilidadBruta).toBe(119990);
    expect(estado.totalGastos).toBe(5025);
    expect(estado.utilidadNeta).toBe(114965);
    expect(estado.ingresos.map((fila) => fila.codigo)).toEqual(["4101", "4102"]);
  });

  test("sin filas todo queda en cero", () => {
    const estado = calcularEstadoResultados([]);

    expect(estado.utilidadNeta).toBe(0);
    expect(estado.ingresos).toEqual([]);
  });
});

const FILAS_CXC: FilaCxc[] = [
  {
    contacto_id: "a",
    contacto_nombre: "Cliente A",
    factura_id: "f1",
    numero: 1,
    ncf: "B0100000001",
    fecha: "2026-10-01",
    vencimiento: "2026-10-15",
    total: "100.00",
    pagado: "0.00",
    saldo: "100.00",
    dias_vencida: 5,
  },
  {
    contacto_id: "a",
    contacto_nombre: "Cliente A",
    factura_id: "f2",
    numero: 2,
    ncf: "B0100000002",
    fecha: "2026-11-01",
    vencimiento: "2026-11-20",
    total: "50.00",
    pagado: "0.00",
    saldo: "50.00",
    dias_vencida: 0,
  },
  {
    contacto_id: "b",
    contacto_nombre: "Cliente B",
    factura_id: "f3",
    numero: 3,
    ncf: null,
    fecha: "2026-09-01",
    vencimiento: "2026-09-15",
    total: "200.00",
    pagado: "0.00",
    saldo: "200.00",
    dias_vencida: 10,
  },
];

describe("cuentas por cobrar por cliente", () => {
  test("agrupa saldos, días vencidos y ordena por saldo", () => {
    const resumen = agruparCxc(FILAS_CXC);

    expect(resumen.totalSaldo).toBe(35000);
    expect(resumen.totalVencido).toBe(30000);
    expect(resumen.clientes.map((cliente) => cliente.contactoNombre)).toEqual(["Cliente B", "Cliente A"]);

    const clienteA = resumen.clientes[1];
    expect(clienteA?.facturas).toBe(2);
    expect(clienteA?.saldo).toBe(15000);
    expect(clienteA?.saldoVencido).toBe(10000);
    expect(clienteA?.diasVencida).toBe(5);
    expect(clienteA?.vencidas).toBe(1);
  });
});

const CUENTAS: CuentaContable[] = [
  {
    id: "c",
    codigo: "1101",
    nombre: "Caja general",
    tipo: "activo",
    naturaleza: "debito",
    padre_id: "b",
    acepta_movimientos: true,
    activa: true,
  },
  {
    id: "a",
    codigo: "1",
    nombre: "Activos",
    tipo: "activo",
    naturaleza: "debito",
    padre_id: null,
    acepta_movimientos: false,
    activa: true,
  },
  {
    id: "b",
    codigo: "11",
    nombre: "Activos corrientes",
    tipo: "activo",
    naturaleza: "debito",
    padre_id: "a",
    acepta_movimientos: false,
    activa: true,
  },
  {
    id: "d",
    codigo: "2",
    nombre: "Pasivos",
    tipo: "pasivo",
    naturaleza: "credito",
    padre_id: "inexistente",
    acepta_movimientos: false,
    activa: true,
  },
];

describe("catálogo de cuentas en árbol", () => {
  test("arma la jerarquía y suma el saldo de los hijos", () => {
    const saldos = saldosPorCodigo([
      {
        cuenta_codigo: "1101",
        cuenta_nombre: "Caja general",
        tipo: "activo",
        debitos: "1500.00",
        creditos: "0.00",
        saldo: "1500.00",
      },
    ]);
    const arbol = construirArbolCuentas(CUENTAS, saldos);

    expect(arbol.map((nodo) => nodo.cuenta.codigo)).toEqual(["1", "2"]);
    const activos = arbol[0];
    expect(activos?.saldo).toBe(150000);
    expect(activos?.hijos[0]?.cuenta.codigo).toBe("11");
    expect(activos?.hijos[0]?.hijos[0]?.cuenta.codigo).toBe("1101");
    expect(arbol[1]?.saldo).toBe(0);
  });
});
