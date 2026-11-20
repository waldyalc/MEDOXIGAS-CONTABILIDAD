import { hoyRD } from "@/lib/facturacion/formato";
import { calcularLineaPOS, centavosATexto, centavosDeDecimal, sumarTotalesLineasPOS } from "@/lib/pos/calculo";
import { armarTicketFactura, type TicketPOSPayload } from "@/lib/pos/impresion";
import type { EmpresaPOS, FacturaPOS, LineaVenta, PlantillaTicket, VentaPOSResultado } from "@/lib/pos/tipos";

/**
 * Ticket de muestra para la vista previa del editor de plantilla.
 *
 * Arma un `VentaPOSResultado` con montos fijos y lo pasa por
 * `armarTicketFactura` de `@/lib/pos/impresion`, que es el mismo armador que
 * usará el POS al cobrar. Así la vista previa respeta los toggles, el ancho y
 * el estilo exactamente como lo hará el ticket real; la empresa y el nombre de
 * la terminal sí son datos reales de la configuración.
 */

interface LineaMuestra {
  descripcion: string;
  referencia: string | null;
  cantidad: string;
  precio: string;
  descuento_pct: string;
  itbis_tasa: string;
  unidad_nombre: string | null;
}

const LINEAS_MUESTRA: readonly LineaMuestra[] = [
  {
    descripcion: "Producto de muestra",
    referencia: "REF-001",
    cantidad: "2",
    precio: "250.00",
    descuento_pct: "0",
    itbis_tasa: "18",
    unidad_nombre: null,
  },
  {
    descripcion: "Producto con unidad y descuento",
    referencia: "REF-002",
    cantidad: "1",
    precio: "100.00",
    descuento_pct: "5",
    itbis_tasa: "18",
    unidad_nombre: "Caja 50 lb",
  },
  {
    descripcion: "Servicio de muestra",
    referencia: null,
    cantidad: "1",
    precio: "450.00",
    descuento_pct: "0",
    itbis_tasa: "0",
    unidad_nombre: null,
  },
];

const EFECTIVO_RECIBIDO = "1200.00";

function lineaDeMuestra(
  indice: number,
  muestra: LineaMuestra,
  calculo: ReturnType<typeof calcularLineaPOS>,
): LineaVenta {
  return {
    id: `muestra-${indice}`,
    producto_id: null,
    producto_nombre: muestra.descripcion,
    referencia: muestra.referencia,
    descripcion: muestra.descripcion,
    cantidad: muestra.cantidad,
    unidad_id: null,
    unidad_nombre: muestra.unidad_nombre,
    factor_base: null,
    precio: muestra.precio,
    descuento_pct: muestra.descuento_pct,
    itbis_tasa: muestra.itbis_tasa,
    impuesto_id: null,
    subtotal: calculo.subtotal,
    itbis: calculo.itbis,
    total: calculo.total,
  };
}

export function armarTicketDeMuestra(entrada: {
  empresa: EmpresaPOS | null;
  plantilla: PlantillaTicket;
  terminal: string;
}): TicketPOSPayload {
  const lineas = LINEAS_MUESTRA.map((muestra, indice) => {
    const calculo = calcularLineaPOS({
      cantidad: muestra.cantidad,
      precio: muestra.precio,
      descuento_pct: muestra.descuento_pct,
      itbis_tasa: muestra.itbis_tasa,
    });

    return { linea: lineaDeMuestra(indice, muestra, calculo), calculo };
  });
  const totales = sumarTotalesLineasPOS(lineas.map(({ calculo }) => calculo));
  const cambio = centavosATexto((centavosDeDecimal(EFECTIVO_RECIBIDO) ?? 0) - (centavosDeDecimal(totales.total) ?? 0));
  const fecha = hoyRD();
  const creadoEn = new Date().toISOString();

  const factura: FacturaPOS = {
    id: "muestra",
    numero: 12,
    ncf: "B0200000015",
    tipo_comprobante: "02",
    fecha,
    vencimiento: fecha,
    estado: "pagada",
    subtotal: totales.subtotal,
    descuento: totales.descuento,
    itbis: totales.itbis,
    otros_impuestos: "0.00",
    propina: "0.00",
    total: totales.total,
    pagado: totales.total,
    retenido: "0.00",
    credito: "0.00",
    saldo: "0.00",
    monto_recibido: EFECTIVO_RECIBIDO,
    cambio,
    notas: null,
    terminos: null,
    pie: null,
    origen: "pos",
    turno_id: "muestra",
    almacen_id: null,
    vendedor_id: "muestra",
    centro_costo_id: null,
    asiento_id: null,
    creado_en: creadoEn,
  };

  const resultado: VentaPOSResultado = {
    factura,
    contacto: {
      id: "muestra",
      nombre: "Consumidor Final",
      rnc_cedula: "22222222222",
      direccion: null,
      telefono: null,
      correo: null,
      tipo_identificacion: "rnc",
      lista_precio_id: null,
      limite_credito: null,
    },
    empresa: entrada.empresa,
    terminal: {
      id: "muestra",
      nombre: entrada.terminal,
      almacen_id: null,
      cuenta_efectivo_id: null,
      plantilla_ticket: entrada.plantilla,
    },
    turno: {
      id: "muestra",
      numero: 4,
      abierto_en: creadoEn,
      base_inicial: "0.00",
      efectivo_esperado_actual: null,
      estado: "abierto",
    },
    cajero: null,
    vendedor: { id: "muestra", nombre: "Vendedor de muestra" },
    almacen: null,
    lista_precio: null,
    lineas: lineas.map(({ linea }) => linea),
    pagos: [
      {
        id: "muestra-pago",
        numero: 1,
        fecha,
        metodo: "efectivo",
        metodo_pos: "efectivo",
        cuenta_id: "muestra",
        cuenta_nombre: "Efectivo",
        monto: totales.total,
        monto_recibido: EFECTIVO_RECIBIDO,
        cambio,
        estado: "activo",
      },
    ],
    impuestos: [],
    totales: {
      ...totales,
      otros_impuestos: "0.00",
      propina: "0.00",
      pagado: totales.total,
      retenido: "0.00",
      credito: "0.00",
      saldo: "0.00",
      monto_recibido: EFECTIVO_RECIBIDO,
      cambio,
    },
    ncf_vence: null,
  };

  return armarTicketFactura(resultado, entrada.plantilla);
}
