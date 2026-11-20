import { describe, expect, test } from "vitest";

import {
  esquemasRpcPOS,
  mapearCierreTurno,
  mapearCotizacionPOS,
  mapearDevolucionPOS,
  mapearHistorialPOS,
  mapearTerminal,
  mapearTurno,
  mapearVentaPOS,
  normalizarPlantilla,
} from "./mapeo";
import {
  cierreJson,
  cotizacionJson,
  devolucionJson,
  ID_CONTACTO,
  ID_CUENTA,
  ID_FACTURA,
  ID_TERMINAL,
  ID_TURNO,
  ventaJson,
} from "./pruebas/ejemplos";
import { PLANTILLA_TICKET_DEFECTO } from "./tipos";

describe("normalizarPlantilla", () => {
  test("devuelve una plantilla completa tal cual", () => {
    expect(normalizarPlantilla({ ...PLANTILLA_TICKET_DEFECTO, ancho_mm: 57 })).toEqual({
      ...PLANTILLA_TICKET_DEFECTO,
      ancho_mm: 57,
    });
  });

  test("completa una plantilla parcial con el default", () => {
    const plantilla = normalizarPlantilla({ estilo: "minimalista", pie_ticket: "  Hasta luego  " });

    expect(plantilla.estilo).toBe("minimalista");
    expect(plantilla.ancho_mm).toBe(80);
    expect(plantilla.mostrar_precio_unitario).toBe(true);
    expect(plantilla.pie_ticket).toBe("Hasta luego");
  });

  test("una plantilla inválida o ausente cae al default", () => {
    expect(normalizarPlantilla({ estilo: "inventado" })).toEqual(PLANTILLA_TICKET_DEFECTO);
    expect(normalizarPlantilla(null)).toEqual(PLANTILLA_TICKET_DEFECTO);
    expect(normalizarPlantilla("texto")).toEqual(PLANTILLA_TICKET_DEFECTO);
  });
});

describe("mapearTerminal", () => {
  test("convierte la plantilla de la fila y conserva las cuentas nulas", () => {
    const terminal = mapearTerminal({
      id: ID_TERMINAL,
      nombre: "Caja 1",
      almacen_id: "99999999-9999-4999-8999-999999999999",
      cuenta_efectivo_id: ID_CUENTA,
      cuenta_tarjeta_debito_id: null,
      cuenta_tarjeta_credito_id: null,
      cuenta_transferencia_id: null,
      numeracion_defecto_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      lista_precio_defecto_id: null,
      contacto_defecto_id: ID_CONTACTO,
      centro_costo_id: null,
      plantilla_ticket: { ancho_mm: 57 },
      activa: true,
      creado_en: "2026-11-20T10:00:00-04:00",
      actualizado_en: "2026-11-20T10:00:00-04:00",
    });

    expect(terminal.plantilla_ticket.ancho_mm).toBe(57);
    expect(terminal.plantilla_ticket.estilo).toBe("clasico");
    expect(terminal.cuenta_tarjeta_debito_id).toBeNull();
  });
});

describe("mapearTurno", () => {
  test("expone los montos como texto y normaliza el estado", () => {
    const turno = mapearTurno({
      id: ID_TURNO,
      numero: 4,
      terminal_id: ID_TERMINAL,
      abierto_por: "12121212-1212-4212-8212-121212121212",
      cerrado_por: "13131313-1313-4313-8313-131313131313",
      abierto_en: "2026-11-20T14:05:00-04:00",
      cerrado_en: "2026-11-20T20:00:00-04:00",
      estado: "cerrado",
      base_inicial: 100,
      efectivo_esperado: 306.5,
      efectivo_real: 300,
      diferencia: -6.5,
      asiento_diferencia_id: null,
      observaciones: "  Cierre del día  ",
    });

    expect(turno.base_inicial).toBe("100");
    expect(turno.efectivo_esperado).toBe("306.5");
    expect(turno.diferencia).toBe("-6.5");
    expect(turno.estado).toBe("cerrado");
    expect(turno.observaciones).toBe("Cierre del día");
  });
});

describe("mapearHistorialPOS", () => {
  test("calcula el saldo exacto y deduplica los métodos", () => {
    const fila = mapearHistorialPOS(
      {
        id: ID_FACTURA,
        numero: 15,
        ncf: "B0200000015",
        tipo_comprobante: "02",
        fecha: "2026-11-20",
        creado_en: null,
        contacto_id: ID_CONTACTO,
        turno_id: ID_TURNO,
        estado: "abierta",
        total: 236,
        pagado: 100,
        retenido: 0,
        credito: 20,
        contactos: { nombre: "Consumidor Final" },
        pos_turnos: { numero: 4, pos_terminales: { id: ID_TERMINAL, nombre: "Caja 1" } },
      },
      ["efectivo", "efectivo", "tarjeta"],
    );

    expect(fila.saldo).toBe("116.00");
    expect(fila.cliente_nombre).toBe("Consumidor Final");
    expect(fila.terminal_nombre).toBe("Caja 1");
    expect(fila.turno_numero).toBe(4);
    expect(fila.metodos).toEqual(["efectivo", "tarjeta"]);
  });
});

describe("mapeo de las RPC", () => {
  test("la venta expone montos como texto y conserva el método del POS", () => {
    const resultado = esquemasRpcPOS.venta.safeParse(ventaJson());
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    const venta = mapearVentaPOS(resultado.data);

    expect(venta.factura.total).toBe("236");
    expect(venta.factura.saldo).toBe("0");
    expect(venta.lineas[0]?.precio).toBe("100");
    expect(venta.pagos[0]?.metodo_pos).toBe("efectivo");
    expect(venta.pagos[0]?.cambio).toBe("14");
    expect(venta.turno.base_inicial).toBe("0");
    expect(venta.empresa?.nombre).toBe("Medoxigas ALC, SRL");
  });

  test("una respuesta sin factura no pasa el esquema", () => {
    const { factura, ...sinFactura } = ventaJson();
    void factura;
    expect(esquemasRpcPOS.venta.safeParse(sinFactura).success).toBe(false);
  });

  test("la cotización trae su plantilla y puede no tener turno", () => {
    const resultado = esquemasRpcPOS.cotizacion.safeParse(cotizacionJson());
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    const cotizacion = mapearCotizacionPOS(resultado.data);

    expect(cotizacion.cotizacion.numero).toBe(12);
    expect(cotizacion.cotizacion.total).toBe("236");
    expect(cotizacion.plantilla_ticket.ancho_mm).toBe(80);
    expect(cotizacion.turno?.numero).toBe(4);
    expect(cotizacion.lista_precio?.nombre).toBe("General");
  });

  test("la devolución mapea el reembolso y la factura origen", () => {
    const resultado = esquemasRpcPOS.devolucion.safeParse(devolucionJson());
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    const devolucion = mapearDevolucionPOS(resultado.data);

    expect(devolucion.nota.ncf).toBe("B0400000004");
    expect(devolucion.nota.tipo_reembolso).toBe("efectivo");
    expect(devolucion.factura.ncf).toBe("B0200000015");
    expect(devolucion.reembolso.efectivo).toBe("59");
    expect(devolucion.reembolso.cuenta_nombre).toBe("Caja general");
    expect(devolucion.lineas[0]?.cantidad).toBe("0.5");
    expect(devolucion.resumen.efectivo.efectivo_esperado).toBe("306");
  });

  test("el cierre congela el esperado y expone la diferencia negativa", () => {
    const resultado = esquemasRpcPOS.cierre.safeParse(cierreJson());
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    const turnoCerrado = mapearCierreTurno(resultado.data);

    expect(turnoCerrado.turno.estado).toBe("cerrado");
    expect(turnoCerrado.turno.diferencia).toBe("-6");
    expect(turnoCerrado.resumen.efectivo.congelado).toBe(true);
    expect(turnoCerrado.asiento_diferencia?.total).toBe("6");
  });
});
