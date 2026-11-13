import { describe, expect, test } from "vitest";

import type { CuentaContable } from "../tipos";
import { calcularAgrupado } from "./agrupado";
import { calcularAuxiliar } from "./auxiliar";
import { calcularBalanza } from "./balance";
import { calcularBalanzaTercero } from "./balanza-tercero";
import { signoNeto } from "./comun";
import { calcularLibroDiario } from "./libro-diario";
import { calcularMovimientosCuenta } from "./movimientos";
import type { FilaMovimiento, FilaSaldoCuenta, FilaSaldoTercero } from "./tipos";

function movimiento(cambios: Partial<FilaMovimiento>): FilaMovimiento {
  return {
    asiento_id: "asiento",
    asiento_numero: 1,
    fecha: "2026-11-01",
    estado: "Contabilizado",
    origen_tipo: "factura",
    documento: "B0200000001",
    contacto_id: "contacto-a",
    tercero: "Cliente A",
    cuenta_id: "cuenta-4101",
    cuenta_codigo: "4101",
    cuenta_nombre: "Ventas de productos",
    cuenta_naturaleza: "credito",
    debito: "0.00",
    credito: "0.00",
    ...cambios,
  };
}

function saldoTercero(cambios: Partial<FilaSaldoTercero>): FilaSaldoTercero {
  return {
    cuenta_id: "cuenta-4101",
    cuenta_codigo: "4101",
    cuenta_nombre: "Ventas de productos",
    cuenta_tipo: "ingreso",
    cuenta_naturaleza: "credito",
    contacto_id: "contacto-a",
    tercero: "Cliente A",
    saldo_inicial: "0.00",
    debitos: "0.00",
    creditos: "0.00",
    ...cambios,
  };
}

function saldoCuenta(cambios: Partial<FilaSaldoCuenta>): FilaSaldoCuenta {
  return {
    cuenta_id: "cuenta-4101",
    cuenta_codigo: "4101",
    cuenta_nombre: "Ventas de productos",
    cuenta_tipo: "ingreso",
    cuenta_naturaleza: "credito",
    padre_id: null,
    saldo_inicial: "0.00",
    debitos: "0.00",
    creditos: "0.00",
    ...cambios,
  };
}

function cuenta(
  id: string,
  codigo: string,
  nombre: string,
  tipo: string,
  naturaleza: string,
  padreId: string | null,
): CuentaContable {
  return {
    id,
    codigo,
    nombre,
    tipo,
    naturaleza,
    padre_id: padreId,
    acepta_movimientos: padreId !== null,
    activa: true,
  };
}

describe("neto según la naturaleza", () => {
  test("una cuenta de crédito resta los débitos", () => {
    expect(signoNeto("credito", 0, 1850000)).toBe(1850000);
    expect(signoNeto("credito", 100, 500)).toBe(400);
  });

  test("una cuenta de débito resta los créditos", () => {
    expect(signoNeto("debito", 118000, 50000)).toBe(68000);
  });
});

describe("libro diario paginado", () => {
  const filas = Array.from({ length: 21 }, (_, indice) =>
    movimiento({
      asiento_id: `asiento-${indice + 1}`,
      asiento_numero: indice + 1,
      fecha: "2026-11-01",
      debito: "100.00",
      credito: "0.00",
    }),
  );

  test("muestra la primera página con el rango de Alegra", () => {
    const libro = calcularLibroDiario(filas, { pagina: 1, porPagina: 10 });

    expect(libro.filas).toHaveLength(10);
    expect(libro.totalFilas).toBe(21);
    expect(libro.totalPaginas).toBe(3);
    expect(libro.rangoTexto).toBe("1–10 de 21");
    expect(libro.totales).toEqual({ debitos: 210000, creditos: 0 });
  });

  test("la última página muestra solo el sobrante", () => {
    const libro = calcularLibroDiario(filas, { pagina: 3, porPagina: 10 });

    expect(libro.filas).toHaveLength(1);
    expect(libro.rangoTexto).toBe("21–21 de 21");
  });

  test("sin filas el rango queda en cero", () => {
    const libro = calcularLibroDiario([], { pagina: 1, porPagina: 25 });

    expect(libro.filas).toEqual([]);
    expect(libro.rangoTexto).toBe("0 de 0");
  });
});

describe("auxiliar por tercero", () => {
  test("calcula saldo anterior, neto por naturaleza y saldo final", () => {
    const filas = calcularAuxiliar([
      saldoTercero({
        cuenta_codigo: "4101",
        saldo_inicial: "0.00",
        debitos: "0.00",
        creditos: "18500.00",
      }),
      saldoTercero({
        cuenta_id: "cuenta-1103",
        cuenta_codigo: "1103",
        cuenta_nombre: "Cuentas por cobrar clientes",
        cuenta_tipo: "activo",
        cuenta_naturaleza: "debito",
        saldo_inicial: "1534.00",
        debitos: "1180.00",
        creditos: "500.00",
      }),
    ]);

    expect(filas.map((fila) => fila.cuentaCodigo)).toEqual(["1103", "4101"]);
    expect(filas[0]?.neto).toBe(68000);
    expect(filas[0]?.saldoFinal).toBe(221400);
    expect(filas[1]?.neto).toBe(1850000);
    expect(filas[1]?.saldoFinal).toBe(1850000);
  });
});

describe("movimientos por cuenta contable", () => {
  test("arrastra el saldo corrido y totaliza según la naturaleza", () => {
    const resultado = calcularMovimientosCuenta(
      [
        movimiento({ asiento_numero: 1, contacto_id: "a", tercero: "Juan Pérez", credito: "4400.00" }),
        movimiento({ asiento_numero: 2, contacto_id: "b", tercero: "Constructora", credito: "14100.00" }),
      ],
      { saldoInicial: 0, buscarAsiento: "" },
    );

    expect(resultado.filas.map((fila) => fila.saldoFinal)).toEqual([440000, 1850000]);
    expect(resultado.filas.map((fila) => fila.neto)).toEqual([440000, 1410000]);
    expect(resultado.totales).toEqual({
      saldoInicial: 0,
      debitos: 0,
      creditos: 1850000,
      neto: 1850000,
      saldoFinal: 1850000,
    });
  });

  test("filtra por número de asiento sin perder el saldo inicial", () => {
    const resultado = calcularMovimientosCuenta(
      [movimiento({ asiento_numero: 1, credito: "4400.00" }), movimiento({ asiento_numero: 2, credito: "14100.00" })],
      { saldoInicial: 50000, buscarAsiento: "2" },
    );

    expect(resultado.filas).toHaveLength(1);
    expect(resultado.filas[0]?.asientoNumero).toBe(2);
    expect(resultado.filas[0]?.saldoInicial).toBe(50000);
    expect(resultado.filas[0]?.saldoFinal).toBe(1460000);
  });
});

describe("balanza de comprobación", () => {
  const cuentas = [
    cuenta("1", "1", "Activos", "activo", "debito", null),
    cuenta("11", "11", "Activos corrientes", "activo", "debito", "1"),
    cuenta("1101", "1101", "Caja general", "activo", "debito", "11"),
    cuenta("1103", "1103", "Cuentas por cobrar clientes", "activo", "debito", "11"),
    cuenta("2", "2", "Pasivos", "pasivo", "credito", null),
    cuenta("2101", "2101", "Cuentas por pagar proveedores", "pasivo", "credito", "2"),
    cuenta("4", "4", "Ingresos", "ingreso", "credito", null),
    cuenta("4101", "4101", "Ventas de productos", "ingreso", "credito", "4"),
    cuenta("1102", "1102", "Banco principal", "activo", "debito", "11"),
  ];

  const saldos = [
    saldoCuenta({
      cuenta_id: "1101",
      cuenta_codigo: "1101",
      cuenta_nombre: "Caja general",
      cuenta_tipo: "activo",
      cuenta_naturaleza: "debito",
      padre_id: "11",
      saldo_inicial: "0.00",
      debitos: "1000.00",
      creditos: "0.00",
    }),
    saldoCuenta({
      cuenta_id: "1103",
      cuenta_codigo: "1103",
      cuenta_nombre: "Cuentas por cobrar clientes",
      cuenta_tipo: "activo",
      cuenta_naturaleza: "debito",
      padre_id: "11",
      saldo_inicial: "1534.00",
      debitos: "1180.00",
      creditos: "500.00",
    }),
    saldoCuenta({
      cuenta_id: "2101",
      cuenta_codigo: "2101",
      cuenta_nombre: "Cuentas por pagar proveedores",
      cuenta_tipo: "pasivo",
      cuenta_naturaleza: "credito",
      padre_id: "2",
      saldo_inicial: "1534.00",
      debitos: "500.00",
      creditos: "1180.00",
    }),
    saldoCuenta({
      cuenta_id: "4101",
      cuenta_codigo: "4101",
      cuenta_nombre: "Ventas de productos",
      cuenta_tipo: "ingreso",
      cuenta_naturaleza: "credito",
      padre_id: "4",
      saldo_inicial: "0.00",
      debitos: "0.00",
      creditos: "1000.00",
    }),
  ];

  test("arma la jerarquía, subtotales y un total cuadrado", () => {
    const balance = calcularBalanza(saldos, cuentas, { buscar: "", incluirCero: false });

    expect(balance.filas.map((fila) => fila.codigo)).toEqual(["1", "11", "1101", "1103", "2", "2101", "4", "4101"]);
    expect(balance.filas[0]).toMatchObject({
      esGrupo: true,
      nivel: 0,
      saldoInicialDebito: 153400,
      saldoInicialCredito: 0,
      debitos: 218000,
      creditos: 50000,
      saldoFinalDebito: 321400,
      saldoFinalCredito: 0,
    });
    expect(balance.totales).toEqual({
      saldoInicialDebito: 153400,
      saldoInicialCredito: 153400,
      debitos: 268000,
      creditos: 268000,
      saldoFinalDebito: 321400,
      saldoFinalCredito: 321400,
      cuadra: true,
    });
  });

  test("oculta cuentas en cero salvo que se pidan", () => {
    const sinCeros = calcularBalanza(saldos, cuentas, { buscar: "", incluirCero: false });
    const conCeros = calcularBalanza(saldos, cuentas, { buscar: "", incluirCero: true });

    expect(sinCeros.filas.some((fila) => fila.codigo === "1102")).toBe(false);
    expect(conCeros.filas.some((fila) => fila.codigo === "1102")).toBe(true);
  });

  test("buscar una cuenta conserva sus ancestros y ajusta el total", () => {
    const balance = calcularBalanza(saldos, cuentas, { buscar: "1103", incluirCero: false });

    expect(balance.filas.map((fila) => fila.codigo)).toEqual(["1", "11", "1103"]);
    expect(balance.totales.debitos).toBe(118000);
    expect(balance.totales.creditos).toBe(50000);
  });
});

describe("movimientos por cuenta contable agrupado", () => {
  const filas = [
    movimiento({ asiento_id: "a1", asiento_numero: 1, contacto_id: "a", tercero: "Juan Pérez", credito: "4400.00" }),
    movimiento({
      asiento_id: "a2",
      asiento_numero: 2,
      contacto_id: "b",
      tercero: "Constructora",
      credito: "14100.00",
    }),
    movimiento({
      asiento_id: "a3",
      asiento_numero: 3,
      origen_tipo: "pago_recibido",
      contacto_id: "a",
      tercero: "Juan Pérez",
      cuenta_id: "cuenta-1103",
      cuenta_codigo: "1103",
      cuenta_nombre: "Cuentas por cobrar clientes",
      cuenta_naturaleza: "debito",
      debito: "0.00",
      credito: "500.00",
    }),
  ];

  const saldosCuenta = [
    saldoCuenta({ cuenta_codigo: "4101", saldo_inicial: "0.00" }),
    saldoCuenta({
      cuenta_id: "cuenta-1103",
      cuenta_codigo: "1103",
      cuenta_nombre: "Cuentas por cobrar clientes",
      cuenta_tipo: "activo",
      cuenta_naturaleza: "debito",
      saldo_inicial: "1534.00",
    }),
  ];

  const saldosTercero = [
    saldoTercero({ contacto_id: "a", tercero: "Juan Pérez", saldo_inicial: "1000.00" }),
    saldoTercero({
      cuenta_id: "cuenta-1103",
      cuenta_codigo: "1103",
      cuenta_nombre: "Cuentas por cobrar clientes",
      cuenta_tipo: "activo",
      cuenta_naturaleza: "debito",
      contacto_id: "a",
      tercero: "Juan Pérez",
      saldo_inicial: "1534.00",
    }),
    saldoTercero({
      contacto_id: "b",
      tercero: "Constructora",
      saldo_inicial: "0.00",
      creditos: "14100.00",
    }),
  ];

  test("agrupa por cuenta y conserva el detalle", () => {
    const agrupado = calcularAgrupado(filas, saldosCuenta, saldosTercero, "cuenta");

    expect(agrupado.grupos.map((grupo) => grupo.etiqueta)).toEqual([
      "1103 · Cuentas por cobrar clientes",
      "4101 · Ventas de productos",
    ]);
    const ventas = agrupado.grupos[1];
    expect(ventas?.debito).toBe(0);
    expect(ventas?.credito).toBe(1850000);
    expect(ventas?.neto).toBe(1850000);
    expect(ventas?.saldoFinal).toBe(1850000);
    expect(ventas?.detalles).toHaveLength(2);
    expect(agrupado.total).toEqual({
      saldoInicial: 153400,
      debito: 0,
      credito: 1900000,
      neto: 1800000,
      saldoFinal: 1953400,
    });
  });

  test("agrupa por tercero sumando sus cuentas", () => {
    const agrupado = calcularAgrupado(filas, saldosCuenta, saldosTercero, "tercero");

    expect(agrupado.grupos.map((grupo) => grupo.etiqueta)).toEqual(["Constructora", "Juan Pérez"]);
    const juan = agrupado.grupos[1];
    expect(juan?.saldoInicial).toBe(253400);
    expect(juan?.neto).toBe(390000);
    expect(juan?.saldoFinal).toBe(643400);
    expect(juan?.detalles).toHaveLength(2);
  });
});

describe("balanza de comprobación por tercero", () => {
  const filas = [
    saldoTercero({
      cuenta_id: "cuenta-1103",
      cuenta_codigo: "1103",
      cuenta_nombre: "Cuentas por cobrar clientes",
      cuenta_tipo: "activo",
      cuenta_naturaleza: "debito",
      saldo_inicial: "1534.00",
      debitos: "1180.00",
      creditos: "500.00",
    }),
    saldoTercero({
      cuenta_id: "cuenta-2101",
      cuenta_codigo: "2101",
      cuenta_nombre: "Cuentas por pagar proveedores",
      cuenta_tipo: "pasivo",
      cuenta_naturaleza: "credito",
      contacto_id: "b",
      tercero: "Proveedor B",
      saldo_inicial: "0.00",
      debitos: "0.00",
      creditos: "4602.00",
    }),
    saldoTercero({
      contacto_id: "c",
      tercero: "Cliente C",
      saldo_inicial: "0.00",
      debitos: "0.00",
      creditos: "0.00",
    }),
  ];

  test("separa débitos y créditos y suma totales", () => {
    const balanza = calcularBalanzaTercero(filas, false);

    expect(balanza.filas).toHaveLength(2);
    expect(balanza.filas[0]).toMatchObject({
      cuentaCodigo: "1103",
      saldoInicialDebito: 153400,
      saldoFinalDebito: 221400,
    });
    expect(balanza.filas[1]).toMatchObject({
      cuentaCodigo: "2101",
      saldoFinalCredito: 460200,
    });
    expect(balanza.totales).toEqual({
      saldoInicialDebito: 153400,
      saldoInicialCredito: 0,
      debitos: 118000,
      creditos: 510200,
      saldoFinalDebito: 221400,
      saldoFinalCredito: 460200,
    });
  });

  test("incluye filas en cero cuando se pide", () => {
    expect(calcularBalanzaTercero(filas, true).filas).toHaveLength(3);
  });
});
