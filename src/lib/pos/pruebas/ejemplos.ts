/**
 * Payloads de ejemplo con la forma exacta que devuelven las RPC del POS
 * (`docs/dominio-pos.md` §3). Solo los usan los tests y las vistas previas de
 * impresión; no se importan desde una pantalla de producción.
 */

import {
  esquemasRpcPOS,
  mapearCierreTurno,
  mapearCotizacionPOS,
  mapearDevolucionPOS,
  mapearMovimientoResultado,
  mapearVentaPOS,
} from "../mapeo";
import type {
  CierreTurnoPOS,
  CotizacionPOSResultado,
  DevolucionPOSResultado,
  MovimientoTurnoPOSResultado,
  VentaPOSResultado,
} from "../tipos";

export const ID_TERMINAL = "11111111-1111-4111-8111-111111111111";
export const ID_TURNO = "22222222-2222-4222-8222-222222222222";
export const ID_FACTURA = "33333333-3333-4333-8333-333333333333";
export const ID_CONTACTO = "44444444-4444-4444-8444-444444444444";
export const ID_CUENTA = "55555555-5555-4555-8555-555555555555";
export const ID_LINEA = "66666666-6666-4666-8666-666666666666";
export const ID_PAGO = "77777777-7777-4777-8777-777777777777";
export const ID_NOTA = "88888888-8888-4888-8888-888888888888";

const plantilla = {
  estilo: "clasico",
  ancho_mm: 80,
  fuente: "clasica",
  tamano_letra: "mediana",
  interlineado: "normal",
  mostrar_logo: true,
  mostrar_vendedor: true,
  mostrar_descripcion: true,
  mostrar_referencia: false,
  mostrar_precio_unitario: true,
  mostrar_unidad: true,
  precios_con_impuestos: true,
  pie_ticket: "Gracias por su compra",
};

const empresa = {
  id: 1,
  nombre: "Medoxigas ALC, SRL",
  rnc: "131234567",
  direccion: "Av. Duarte 125, Santiago",
  telefono: "809-555-0101",
  correo: "ventas@medoxigas.test",
  logo_url: "https://cdn.test/logo.png",
};

const contacto = {
  id: ID_CONTACTO,
  nombre: "Consumidor Final",
  rnc_cedula: "22222222222",
  direccion: null,
  telefono: null,
  correo: null,
  tipo_identificacion: "rnc",
  lista_precio_id: null,
  limite_credito: null,
};

const terminal = {
  id: ID_TERMINAL,
  nombre: "Caja 1",
  almacen_id: "99999999-9999-4999-8999-999999999999",
  cuenta_efectivo_id: ID_CUENTA,
  plantilla_ticket: plantilla,
};

const turnoVenta = {
  id: ID_TURNO,
  numero: 4,
  abierto_en: "2026-11-20T14:05:00-04:00",
  base_inicial: 0,
  efectivo_esperado_actual: 236,
};

const linea = {
  id: ID_LINEA,
  producto_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  producto_nombre: "Destornillador Phillips",
  referencia: "DEST-01",
  descripcion: "Destornillador Phillips",
  cantidad: 2,
  unidad_id: null,
  unidad_nombre: "Unidad",
  factor_base: 1,
  precio: 100,
  descuento_pct: 0,
  itbis_tasa: 18,
  impuesto_id: null,
  subtotal: 200,
  itbis: 36,
  total: 236,
  costo_unitario: 40,
};

const pago = {
  id: ID_PAGO,
  numero: 8,
  fecha: "2026-11-20",
  metodo: "efectivo",
  metodo_pos: "efectivo",
  cuenta_id: ID_CUENTA,
  cuenta_nombre: "Caja general",
  monto: 236,
  monto_recibido: 250,
  cambio: 14,
  estado: "activo",
};

const impuesto = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  codigo: "itbis-18",
  nombre: "ITBIS",
  tipo: "itbis",
  tarifa: 18,
  cuenta_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  activo: true,
  orden: 10,
};

const factura = {
  id: ID_FACTURA,
  numero: 15,
  ncf: "B0200000015",
  tipo_comprobante: "02",
  fecha: "2026-11-20",
  vencimiento: "2026-11-20",
  estado: "pagada",
  subtotal: 200,
  descuento: 0,
  itbis: 36,
  otros_impuestos: 0,
  propina: 0,
  total: 236,
  pagado: 236,
  retenido: 0,
  credito: 0,
  saldo: 0,
  monto_recibido: 250,
  cambio: 14,
  notas: null,
  terminos: null,
  pie: null,
  origen: "pos",
  turno_id: ID_TURNO,
  almacen_id: "99999999-9999-4999-8999-999999999999",
  vendedor_id: null,
  centro_costo_id: null,
  asiento_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  creado_en: "2026-11-20T15:10:00-04:00",
};

export function resumenJson() {
  return {
    ventas: {
      total: 236,
      cantidad: 1,
      cobrado: 236,
      por_metodo: { efectivo: 236, tarjeta: 0, transferencia: 0, credito: 0 },
      por_cuenta: [{ cuenta_id: ID_CUENTA, cuenta_nombre: "Caja general", metodo: "efectivo", monto: 236 }],
    },
    ingresos: {
      total: 100,
      cantidad: 1,
      por_motivo: { fondo_caja: 100, cobro_factura: 0, otro: 0 },
    },
    retiros: {
      total: 30,
      cantidad: 1,
      por_motivo: { retiro_caja: 0, gasto_menor: 30, deposito_banco: 0, otro: 0 },
    },
    devoluciones: { cantidad: 0, total: 0, efectivo: 0, credito: 0 },
    efectivo: {
      base_inicial: 0,
      ventas_efectivo: 236,
      ingresos_efectivo: 100,
      retiros_efectivo: 30,
      devoluciones_efectivo: 0,
      efectivo_esperado: 306,
      efectivo_real: null,
      diferencia: null,
      congelado: false,
    },
    movimientos: [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        numero: 10,
        turno_id: ID_TURNO,
        tipo: "ingreso",
        motivo: "fondo_caja",
        monto: 100,
        cuenta_contrapartida_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        cuenta_nombre: "Caja chica",
        contacto_id: null,
        factura_id: null,
        factura_numero: null,
        pago_recibido_id: null,
        gasto_menor_id: null,
        asiento_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        notas: null,
        creado_en: "2026-11-20T15:20:00-04:00",
        creado_por: "12121212-1212-4212-8212-121212121212",
        vigente: true,
      },
    ],
  };
}

export function ventaJson() {
  return {
    factura,
    contacto,
    empresa,
    terminal,
    turno: turnoVenta,
    cajero: "Waldy Alcántara",
    vendedor: null,
    almacen: { id: "99999999-9999-4999-8999-999999999999", nombre: "Principal" },
    lista_precio: { id: "abababab-abab-4bab-8bab-abababababab", nombre: "General" },
    lineas: [linea],
    pagos: [pago],
    impuestos: [impuesto],
    totales: {
      subtotal: 200,
      descuento: 0,
      itbis: 36,
      otros_impuestos: 0,
      propina: 0,
      total: 236,
      pagado: 236,
      retenido: 0,
      credito: 0,
      saldo: 0,
      monto_recibido: 250,
      cambio: 14,
    },
    ncf_vence: null,
  };
}

export function ventaEjemplo(): VentaPOSResultado {
  return mapearVentaPOS(esquemasRpcPOS.venta.parse(ventaJson()));
}

export function cotizacionJson() {
  return {
    cotizacion: {
      id: "13131313-1313-4313-8313-131313131313",
      numero: 12,
      contacto_id: ID_CONTACTO,
      fecha: "2026-11-20",
      vencimiento: "2026-12-20",
      estado: "abierta",
      subtotal: 200,
      descuento: 0,
      itbis: 36,
      otros_impuestos: 0,
      propina: 0,
      total: 236,
      notas: null,
      terminos: null,
      vendedor_id: null,
      centro_costo_id: null,
      origen: "pos",
      turno_id: ID_TURNO,
    },
    contacto,
    empresa,
    terminal,
    turno: turnoVenta,
    vendedor: null,
    lineas: [linea],
    impuestos: [impuesto],
    totales: { subtotal: 200, descuento: 0, itbis: 36, otros_impuestos: 0, propina: 0, total: 236 },
    plantilla_ticket: plantilla,
    lista_precio: { id: "abababab-abab-4bab-8bab-abababababab", nombre: "General" },
  };
}

export function cotizacionEjemplo(): CotizacionPOSResultado {
  return mapearCotizacionPOS(esquemasRpcPOS.cotizacion.parse(cotizacionJson()));
}

export function devolucionJson() {
  return {
    nota: {
      id: ID_NOTA,
      numero: 4,
      ncf: "B0400000004",
      factura_id: ID_FACTURA,
      contacto_id: ID_CONTACTO,
      fecha: "2026-11-20",
      subtotal: 50,
      itbis: 9,
      total: 59,
      estado: "activa",
      devuelve_inventario: true,
      tipo_reembolso: "efectivo",
      monto_reembolso_efectivo: 59,
      cuenta_reembolso_id: ID_CUENTA,
      turno_id: ID_TURNO,
      notas: null,
      asiento_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      asiento_reembolso_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    },
    factura: {
      id: ID_FACTURA,
      numero: 15,
      ncf: "B0200000015",
      total: 236,
      pagado: 236,
      credito: 0,
      estado: "pagada",
      saldo: 0,
    },
    contacto,
    empresa,
    terminal,
    turno: { id: ID_TURNO, numero: 4, estado: "abierto", base_inicial: 0 },
    lineas: [
      {
        factura_linea_id: ID_LINEA,
        producto_id: linea.producto_id,
        descripcion: "Destornillador Phillips",
        cantidad: 0.5,
        unidad_nombre: "Unidad",
        factor_base: 1,
        precio: 100,
        descuento_pct: 0,
        itbis_tasa: 18,
        subtotal: 50,
        itbis: 9,
        total: 59,
        costo_unitario: 40,
      },
    ],
    reembolso: {
      tipo: "efectivo",
      efectivo: 59,
      credito: 0,
      cuenta_id: ID_CUENTA,
      cuenta_nombre: "Caja general",
    },
    totales: { subtotal: 50, itbis: 9, total: 59, efectivo: 59, credito: 0 },
    resumen: resumenJson(),
  };
}

export function devolucionEjemplo(): DevolucionPOSResultado {
  return mapearDevolucionPOS(esquemasRpcPOS.devolucion.parse(devolucionJson()));
}

export function cierreJson() {
  return {
    turno: {
      id: ID_TURNO,
      numero: 4,
      terminal_id: ID_TERMINAL,
      abierto_por: "12121212-1212-4212-8212-121212121212",
      cerrado_por: "12121212-1212-4212-8212-121212121212",
      abierto_en: "2026-11-20T14:05:00-04:00",
      cerrado_en: "2026-11-20T20:00:00-04:00",
      estado: "cerrado",
      base_inicial: 0,
      efectivo_esperado: 306,
      efectivo_real: 300,
      diferencia: -6,
      asiento_diferencia_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      observaciones: "Faltó cambio",
    },
    terminal,
    empresa,
    resumen: {
      ...resumenJson(),
      efectivo: {
        ...resumenJson().efectivo,
        efectivo_real: 300,
        diferencia: -6,
        congelado: true,
      },
    },
    asiento_diferencia: {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      numero: 34,
      fecha: "2026-11-20",
      descripcion: "Diferencia de cierre del turno 4",
      total: 6,
    },
  };
}

export function cierreEjemplo(): CierreTurnoPOS {
  return mapearCierreTurno(esquemasRpcPOS.cierre.parse(cierreJson()));
}

export function movimientoJson() {
  return {
    movimiento: {
      id: "14141414-1414-4414-8414-141414141414",
      numero: 10,
      turno_id: ID_TURNO,
      tipo: "ingreso",
      motivo: "fondo_caja",
      monto: 100,
      cuenta_contrapartida_id: "15151515-1515-4515-8515-151515151515",
      cuenta_nombre: "Caja chica",
      contacto_id: null,
      factura_id: null,
      factura_numero: null,
      pago_recibido_id: null,
      gasto_menor_id: null,
      asiento_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      notas: "Fondo para cambio",
      creado_en: "2026-11-20T15:20:00-04:00",
      creado_por: "12121212-1212-4212-8212-121212121212",
      factura_ncf: null,
      cajero: "Waldy Alcántara",
    },
    turno: { id: ID_TURNO, numero: 4, estado: "abierto", base_inicial: 0 },
    terminal,
    empresa,
    asiento: {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      numero: 34,
      fecha: "2026-11-20",
      descripcion: "Movimiento de caja 10 · fondo_caja",
      total: 100,
    },
    plantilla_ticket: plantilla,
    resumen: resumenJson(),
  };
}

export function movimientoEjemplo(): MovimientoTurnoPOSResultado {
  return mapearMovimientoResultado(esquemasRpcPOS.movimiento.parse(movimientoJson()));
}

export function aperturaJson() {
  return {
    turno: {
      id: ID_TURNO,
      numero: 4,
      terminal_id: ID_TERMINAL,
      abierto_por: "12121212-1212-4212-8212-121212121212",
      abierto_en: "2026-11-20T14:05:00-04:00",
      estado: "abierto",
      base_inicial: 0,
    },
    terminal,
    empresa,
    resumen: resumenJson(),
  };
}
