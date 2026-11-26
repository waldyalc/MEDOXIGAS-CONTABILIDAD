import { z } from "zod";

import { TIPOS_COMPROBANTE } from "@/lib/facturacion/tipos";
import { busquedaCodigoBarraSchema, filtroCatalogoPosSchema, idSchema } from "@/lib/inventario/ferreteria/esquemas";
import { TAMANO_PAGINA_DEFECTO, TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { parsearMonto } from "@/lib/productos/productos";

import { calcularLineaPOS, compararMontos, sumarMontos } from "./calculo";
import {
  ANCHOS_TICKET,
  ESTADOS_FACTURA_POS,
  ESTILOS_TICKET,
  FUENTES_TICKET,
  INTERLINEADOS_TICKET,
  METODOS_POS,
  MOTIVOS_MOVIMIENTO_POS,
  TAMANOS_LETRA_TICKET,
  TIPOS_MOVIMIENTO_POS,
  TIPOS_REEMBOLSO_POS,
} from "./tipos";

/**
 * Esquemas Zod de la capa del POS. Validan lo que la UI envía antes de tocar
 * la RPC y replican las reglas que el dominio puede comprobar sin base
 * (pago combinado, cambio solo sobre efectivo, crédito a Consumidor Final,
 * base negativa). La base sigue siendo la autoridad final.
 */

const DECIMAL_2 = /^-?\d+(?:\.\d{1,2})?$/;

export { idSchema };

/** Acepta ``1,500.25`` o ``1250,50`` con el mismo criterio que las pantallas. */
function textoDecimal(valor: unknown): string {
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor !== "string") return "";

  const numero = parsearMonto(valor);
  return numero === null ? valor.trim() : String(numero);
}

function decimal2(mensaje: string) {
  return z.preprocess(textoDecimal, z.string().regex(DECIMAL_2, { message: mensaje }));
}

function decimal2Opcional(mensaje: string) {
  return z.preprocess(
    (valor) => (valor === "" || valor === null || valor === undefined ? undefined : textoDecimal(valor)),
    z.string().regex(DECIMAL_2, { message: mensaje }).optional(),
  );
}

function montoPositivo(mensajeCero: string, mensajeFormato: string) {
  return decimal2(mensajeFormato).refine((valor) => Number(valor) > 0, { message: mensajeCero });
}

function montoNoNegativo(mensaje: string) {
  return decimal2(mensaje).refine((valor) => Number(valor) >= 0, { message: mensaje });
}

function porcentaje(mensaje: string) {
  return decimal2(mensaje).refine((valor) => Number(valor) >= 0 && Number(valor) <= 100, { message: mensaje });
}

function uuidNulo(mensaje: string) {
  return z.preprocess((valor) => (valor === "" ? null : valor), z.uuid(mensaje).nullable().optional());
}

function uuidOpcional(mensaje: string) {
  return z.preprocess((valor) => (valor === "" || valor === null ? undefined : valor), z.uuid(mensaje).optional());
}

function textoOpcional(maximo: number, mensaje: string) {
  return z.preprocess(
    (valor) => (valor === null || valor === undefined ? undefined : String(valor).trim()),
    z.string().max(maximo, { message: mensaje }).optional(),
  );
}

function textoRequerido(maximo: number, mensaje: string) {
  return z.string({ message: mensaje }).trim().min(1, { message: mensaje }).max(maximo, { message: mensaje });
}

export function mensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

// ---------------------------------------------------------------------------
// Plantilla del ticket
// ---------------------------------------------------------------------------

const CLAVES_PLANTILLA_TICKET = new Set<string>([
  "estilo",
  "ancho_mm",
  "fuente",
  "tamano_letra",
  "interlineado",
  "mostrar_logo",
  "mostrar_vendedor",
  "mostrar_descripcion",
  "mostrar_referencia",
  "mostrar_precio_unitario",
  "mostrar_unidad",
  "precios_con_impuestos",
  "pie_ticket",
]);

const formaPlantillaTicket = z.object({
  estilo: z.enum(ESTILOS_TICKET, { message: "El estilo del ticket no es válido." }).optional(),
  ancho_mm: z
    .union([z.literal(ANCHOS_TICKET[0]), z.literal(ANCHOS_TICKET[1])], {
      message: "El ancho del ticket debe ser 80 o 57 mm.",
    })
    .optional(),
  fuente: z.enum(FUENTES_TICKET, { message: "La fuente del ticket no es válida." }).optional(),
  tamano_letra: z.enum(TAMANOS_LETRA_TICKET, { message: "El tamaño de letra no es válido." }).optional(),
  interlineado: z.enum(INTERLINEADOS_TICKET, { message: "El interlineado no es válido." }).optional(),
  mostrar_logo: z.boolean({ message: "El indicador del logo no es válido." }).optional(),
  mostrar_vendedor: z.boolean({ message: "El indicador del vendedor no es válido." }).optional(),
  mostrar_descripcion: z.boolean({ message: "El indicador de la descripción no es válido." }).optional(),
  mostrar_referencia: z.boolean({ message: "El indicador de la referencia no es válido." }).optional(),
  mostrar_precio_unitario: z.boolean({ message: "El indicador del precio unitario no es válido." }).optional(),
  mostrar_unidad: z.boolean({ message: "El indicador de la unidad no es válido." }).optional(),
  precios_con_impuestos: z.boolean({ message: "El indicador de precios con impuestos no es válido." }).optional(),
  pie_ticket: z.preprocess((valor) => {
    if (valor === undefined) return undefined;
    if (valor === null) return null;
    const texto = String(valor).trim();
    return texto === "" ? null : texto;
  }, z.string().max(500, { message: "El pie del ticket no puede pasar de 500 caracteres." }).nullable().optional()),
});

/**
 * La plantilla que se envía a `pos_crear_terminal`/`pos_actualizar_terminal`:
 * parcial (se mezcla sobre el default o el valor actual) y estricta (una clave
 * desconocida se rechaza para detectar errores de tipeo).
 */
export const esquemaPlantillaTicket = z
  .custom<Record<string, unknown>>((valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor), {
    message: "La plantilla del ticket debe ser un objeto.",
  })
  .superRefine((valor, ctx) => {
    for (const clave of Object.keys(valor)) {
      if (!CLAVES_PLANTILLA_TICKET.has(clave)) {
        ctx.addIssue({
          code: "custom",
          message: `La plantilla del ticket tiene un campo desconocido: ${clave}.`,
        });
      }
    }
  })
  .pipe(formaPlantillaTicket);

export type PlantillaTicketEntrada = z.infer<typeof esquemaPlantillaTicket>;

// ---------------------------------------------------------------------------
// Terminales
// ---------------------------------------------------------------------------

export const esquemaTerminal = z.object({
  nombre: textoRequerido(80, "El nombre de la terminal es obligatorio."),
  almacen_id: z.uuid("Selecciona un almacén válido."),
  cuenta_efectivo_id: z.uuid("Selecciona la cuenta de efectivo de la terminal."),
  cuenta_tarjeta_debito_id: uuidNulo("La cuenta de tarjeta de débito no es válida."),
  cuenta_tarjeta_credito_id: uuidNulo("La cuenta de tarjeta de crédito no es válida."),
  cuenta_transferencia_id: uuidNulo("La cuenta de transferencia no es válida."),
  numeracion_defecto_id: z.uuid("Selecciona la numeración de la terminal."),
  lista_precio_defecto_id: uuidNulo("La lista de precios no es válida."),
  contacto_defecto_id: z.uuid("Selecciona el contacto por defecto de la terminal."),
  centro_costo_id: uuidNulo("El centro de costo no es válido."),
  plantilla_ticket: esquemaPlantillaTicket.optional(),
  activa: z.boolean({ message: "El estado de la terminal no es válido." }).optional(),
});

export type TerminalEntrada = z.infer<typeof esquemaTerminal>;

/** La edición acepta cualquier subconjunto de claves, pero nunca un objeto vacío. */
export const esquemaTerminalEdicion = esquemaTerminal.partial().refine((datos) => Object.keys(datos).length > 0, {
  message: "No hay cambios para guardar.",
});

export type TerminalEdicionEntrada = z.infer<typeof esquemaTerminalEdicion>;

// ---------------------------------------------------------------------------
// Turnos
// ---------------------------------------------------------------------------

export const esquemaAbrirTurno = z.object({
  terminal_id: z.uuid("Selecciona la terminal del turno."),
  base_inicial: montoNoNegativo("La base inicial no puede ser negativa.").default("0"),
  observaciones: textoOpcional(500, "Las observaciones no pueden pasar de 500 caracteres."),
});

export type AbrirTurnoEntrada = z.infer<typeof esquemaAbrirTurno>;

const formaMovimientoTurno = z.object({
  turno_id: z.uuid("El turno no es válido."),
  tipo: z.enum(TIPOS_MOVIMIENTO_POS, { message: "El tipo de movimiento no es válido." }),
  motivo: z.enum(MOTIVOS_MOVIMIENTO_POS, { message: "El motivo del movimiento no es válido." }),
  monto: montoPositivo("El monto del movimiento debe ser mayor a cero.", "El monto debe ser un número de 2 decimales."),
  cuenta_contrapartida_id: uuidNulo("La cuenta de contrapartida no es válida."),
  contacto_id: uuidNulo("El contacto no es válido."),
  factura_id: uuidNulo("La factura no es válida."),
  cuenta_gasto_id: uuidNulo("La cuenta de gasto no es válida."),
  subtotal: decimal2Opcional("El subtotal debe ser un número de 2 decimales."),
  itbis_tasa: porcentaje("La tasa de ITBIS debe estar entre 0 y 100.").optional(),
  descripcion: textoOpcional(200, "La descripción no puede pasar de 200 caracteres."),
  notas: textoOpcional(500, "Las notas no pueden pasar de 500 caracteres."),
});

type MovimientoTurnoDatos = z.infer<typeof formaMovimientoTurno>;

function validarMotivoYCuentas(datos: MovimientoTurnoDatos, ctx: z.RefinementCtx): void {
  const esIngreso = datos.motivo === "fondo_caja" || datos.motivo === "cobro_factura";
  const esRetiro =
    datos.motivo === "retiro_caja" || datos.motivo === "gasto_menor" || datos.motivo === "deposito_banco";

  if ((esIngreso && datos.tipo !== "ingreso") || (esRetiro && datos.tipo !== "retiro")) {
    ctx.addIssue({
      code: "custom",
      message: "El motivo del movimiento no corresponde al tipo.",
      path: ["tipo"],
    });
  }

  if (datos.motivo === "cobro_factura" && !datos.factura_id) {
    ctx.addIssue({
      code: "custom",
      message: "El cobro de factura requiere la factura.",
      path: ["factura_id"],
    });
  }

  if (datos.motivo !== "cobro_factura" && datos.factura_id) {
    ctx.addIssue({
      code: "custom",
      message: "Solo el cobro de factura puede llevar una factura.",
      path: ["factura_id"],
    });
  }
}

function validarGastoMenor(datos: MovimientoTurnoDatos, ctx: z.RefinementCtx): void {
  if (!datos.cuenta_gasto_id) {
    ctx.addIssue({
      code: "custom",
      message: "La cuenta de gasto es obligatoria.",
      path: ["cuenta_gasto_id"],
    });
  }
  if (!datos.descripcion) {
    ctx.addIssue({
      code: "custom",
      message: "La descripción del gasto es obligatoria.",
      path: ["descripcion"],
    });
  }

  const subtotal = datos.subtotal ?? datos.monto;
  const itbis = calcularLineaPOS({
    cantidad: "1",
    precio: subtotal,
    itbis_tasa: datos.itbis_tasa ?? "0",
    descuento_pct: "0",
  }).itbis;

  if (compararMontos(sumarMontos([subtotal, itbis]), datos.monto) !== 0) {
    ctx.addIssue({
      code: "custom",
      message: "El ITBIS del gasto no cuadra con el monto.",
      path: ["monto"],
    });
  }
}

function validarMovimiento(datos: MovimientoTurnoDatos, ctx: z.RefinementCtx): void {
  validarMotivoYCuentas(datos, ctx);

  if (datos.motivo === "gasto_menor") {
    validarGastoMenor(datos, ctx);
    return;
  }

  if (datos.motivo !== "cobro_factura" && !datos.cuenta_contrapartida_id) {
    ctx.addIssue({
      code: "custom",
      message: "La cuenta de contrapartida es obligatoria.",
      path: ["cuenta_contrapartida_id"],
    });
  }
}

export const esquemaMovimientoTurno = formaMovimientoTurno.superRefine(validarMovimiento);

export type MovimientoTurnoEntrada = z.infer<typeof esquemaMovimientoTurno>;

export const esquemaCerrarTurno = z.object({
  turno_id: z.uuid("El turno no es válido."),
  efectivo_real: z.preprocess(
    (valor) => (valor === "" || valor === null || valor === undefined ? "" : textoDecimal(valor)),
    z
      .string({ message: "El efectivo real es obligatorio." })
      .min(1, { message: "El efectivo real es obligatorio." })
      .regex(DECIMAL_2, { message: "El efectivo real debe ser un número de 2 decimales." })
      .refine((valor) => Number(valor) >= 0, { message: "El efectivo real no puede ser negativo." }),
  ),
  observaciones: textoOpcional(500, "Las observaciones no pueden pasar de 500 caracteres."),
  registrar_diferencia: z.boolean({ message: "El indicador de la diferencia no es válido." }).default(true),
});

export type CerrarTurnoEntrada = z.infer<typeof esquemaCerrarTurno>;

// ---------------------------------------------------------------------------
// Venta y cotización
// ---------------------------------------------------------------------------

const esquemaLineaVenta = z
  .object({
    producto_id: uuidNulo("El producto no es válido."),
    descripcion: textoOpcional(500, "La descripción de la línea es demasiado larga."),
    cantidad: decimal2("La cantidad debe ser un número de hasta 2 decimales.").refine((valor) => Number(valor) > 0, {
      message: "La cantidad debe ser mayor a cero.",
    }),
    unidad_id: uuidNulo("La unidad de medida no es válida."),
    precio: decimal2Opcional("El precio debe ser un número de hasta 2 decimales.").refine(
      (valor) => valor === undefined || Number(valor) >= 0,
      { message: "El precio no puede ser negativo." },
    ),
    descuento_pct: porcentaje("El descuento debe estar entre 0 y 100.").default("0"),
    itbis_tasa: porcentaje("La tasa de ITBIS debe estar entre 0 y 100.").optional(),
    impuesto_id: uuidNulo("El impuesto no es válido."),
  })
  .superRefine((datos, ctx) => {
    if (!datos.producto_id) {
      if (!datos.descripcion) {
        ctx.addIssue({
          code: "custom",
          message: "La línea libre requiere una descripción.",
          path: ["descripcion"],
        });
      }
      if (datos.unidad_id) {
        ctx.addIssue({
          code: "custom",
          message: "La línea libre no admite unidad de medida.",
          path: ["unidad_id"],
        });
      }
      if (datos.precio === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "La línea libre requiere un precio.",
          path: ["precio"],
        });
      }
    }
  });

const esquemaVentaSimple = z.object({
  descripcion: textoRequerido(200, "La venta simple requiere una descripción."),
  monto: montoPositivo(
    "El monto de la venta simple debe ser mayor a cero.",
    "El monto debe ser un número de 2 decimales.",
  ),
  itbis_tasa: porcentaje("La tasa de ITBIS debe estar entre 0 y 100.").optional(),
});

const esquemaPagoVenta = z
  .object({
    metodo: z.enum(METODOS_POS, { message: "El método de pago no es válido." }),
    monto: montoPositivo("El monto del pago debe ser mayor a cero.", "El monto debe ser un número de 2 decimales."),
    cuenta_id: uuidNulo("La cuenta del pago no es válida."),
    monto_recibido: decimal2Opcional("El monto recibido debe ser un número de 2 decimales."),
    notas: textoOpcional(500, "Las notas no pueden pasar de 500 caracteres."),
  })
  .superRefine((datos, ctx) => {
    if (datos.metodo !== "efectivo") {
      if (datos.monto_recibido !== undefined && compararMontos(datos.monto_recibido, datos.monto) !== 0) {
        ctx.addIssue({
          code: "custom",
          message: "Solo el efectivo admite monto recibido y cambio.",
          path: ["monto_recibido"],
        });
      }
      return;
    }

    if (datos.monto_recibido !== undefined && compararMontos(datos.monto_recibido, datos.monto) < 0) {
      ctx.addIssue({
        code: "custom",
        message: "El monto recibido en efectivo no puede ser menor al monto del pago.",
        path: ["monto_recibido"],
      });
    }
  });

/** Total estimado de la venta; `null` si el servidor debe resolver algún precio o tasa. */
function totalEstimadoVenta(
  lineas: readonly z.infer<typeof esquemaLineaVenta>[] | undefined,
  simple: z.infer<typeof esquemaVentaSimple> | undefined,
): string | null {
  if (simple) {
    return calcularLineaPOS({
      cantidad: "1",
      precio: simple.monto,
      itbis_tasa: simple.itbis_tasa ?? "0",
      descuento_pct: "0",
    }).total;
  }

  if (!lineas || lineas.length === 0) return null;

  const completa = lineas.every(
    (linea) => linea.precio !== undefined && (linea.itbis_tasa !== undefined || !linea.producto_id),
  );
  if (!completa) return null;

  return sumarMontos(
    lineas.map(
      (linea) =>
        calcularLineaPOS({
          cantidad: linea.cantidad,
          precio: linea.precio ?? "0",
          descuento_pct: linea.descuento_pct,
          itbis_tasa: linea.itbis_tasa ?? "0",
        }).total,
    ),
  );
}

function contarFuentes(datos: {
  lineas?: readonly unknown[];
  venta_simple?: unknown;
  cotizacion_id?: string | null;
}): number {
  let fuentes = 0;
  if (datos.lineas && datos.lineas.length > 0) fuentes += 1;
  if (datos.venta_simple) fuentes += 1;
  if (datos.cotizacion_id) fuentes += 1;
  return fuentes;
}

/**
 * Tope de pagos de una venta POS. Los métodos pueden repetirse (dos efectivos,
 * dos transferencias de bancos distintos), así que el límite es de filas, no de
 * métodos distintos.
 */
export const MAXIMO_PAGOS_VENTA = 10;

export const esquemaVenta = z
  .object({
    terminal_id: z.uuid("La terminal no es válida."),
    /** Solo contexto de la UI: no se envía a la RPC. */
    contacto_defecto_id: uuidNulo("El contacto por defecto no es válido."),
    contacto_id: uuidNulo("El contacto no es válido."),
    lista_precio_id: uuidNulo("La lista de precios no es válida."),
    numeracion_id: uuidNulo("La numeración no es válida."),
    tipo_comprobante: z.enum(TIPOS_COMPROBANTE, { message: "El tipo de comprobante no es válido." }).optional(),
    fecha: z.iso.date({ message: "La fecha de la venta no es válida." }).optional(),
    vencimiento: z.iso.date({ message: "El vencimiento no es válido." }).optional(),
    vendedor_id: uuidNulo("El vendedor no es válido."),
    notas: textoOpcional(500, "Las notas no pueden pasar de 500 caracteres."),
    terminos: textoOpcional(1000, "Los términos no pueden pasar de 1,000 caracteres."),
    pie: textoOpcional(500, "El pie no puede pasar de 500 caracteres."),
    lineas: z.array(esquemaLineaVenta).max(500, { message: "La venta no puede pasar de 500 líneas." }).optional(),
    venta_simple: esquemaVentaSimple.optional(),
    cotizacion_id: uuidNulo("La cotización no es válida."),
    pagos: z
      .array(esquemaPagoVenta)
      .max(MAXIMO_PAGOS_VENTA, { message: `La venta admite hasta ${MAXIMO_PAGOS_VENTA} pagos.` })
      .default([]),
  })
  .superRefine((datos, ctx) => {
    if (contarFuentes(datos) !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Indica líneas, venta simple o una cotización, no varias a la vez.",
        path: ["lineas"],
      });
      return;
    }

    if (datos.fecha && datos.vencimiento && datos.vencimiento < datos.fecha) {
      ctx.addIssue({
        code: "custom",
        message: "El vencimiento no puede ser anterior a la fecha.",
        path: ["vencimiento"],
      });
    }

    if (datos.cotizacion_id) return;

    const total = totalEstimadoVenta(datos.lineas, datos.venta_simple);
    if (total === null) return;

    const aplicado = sumarMontos(datos.pagos.map((pago) => pago.monto));
    if (compararMontos(aplicado, total) > 0) {
      ctx.addIssue({
        code: "custom",
        message: "La suma de los pagos no puede exceder el total de la venta.",
        path: ["pagos"],
      });
      return;
    }

    if (compararMontos(aplicado, total) >= 0) return;

    const efectivoConCambio = datos.pagos.some(
      (pago) =>
        pago.metodo === "efectivo" &&
        pago.monto_recibido !== undefined &&
        compararMontos(pago.monto_recibido, pago.monto) > 0,
    );
    if (efectivoConCambio) {
      ctx.addIssue({
        code: "custom",
        message: "No se puede dar cambio en una venta que queda a crédito.",
        path: ["pagos"],
      });
    }

    const contacto = datos.contacto_id ?? datos.contacto_defecto_id;
    if (contacto && datos.contacto_defecto_id && contacto === datos.contacto_defecto_id) {
      ctx.addIssue({
        code: "custom",
        message: "No se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total.",
        path: ["contacto_id"],
      });
    }
  });

export type VentaEntrada = z.infer<typeof esquemaVenta>;

export const esquemaCotizacionPOS = z
  .object({
    terminal_id: z.uuid("La terminal no es válida."),
    contacto_id: uuidNulo("El contacto no es válido."),
    lista_precio_id: uuidNulo("La lista de precios no es válida."),
    fecha: z.iso.date({ message: "La fecha de la cotización no es válida." }).optional(),
    vencimiento: z.iso.date({ message: "El vencimiento no es válido." }).optional(),
    vendedor_id: uuidNulo("El vendedor no es válido."),
    notas: textoOpcional(500, "Las notas no pueden pasar de 500 caracteres."),
    terminos: textoOpcional(1000, "Los términos no pueden pasar de 1,000 caracteres."),
    lineas: z.array(esquemaLineaVenta).max(500, { message: "La cotización no puede pasar de 500 líneas." }).optional(),
    venta_simple: esquemaVentaSimple.optional(),
  })
  .superRefine((datos, ctx) => {
    if (contarFuentes(datos) !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Indica líneas, venta simple o una cotización, no varias a la vez.",
        path: ["lineas"],
      });
    }

    if (datos.fecha && datos.vencimiento && datos.vencimiento < datos.fecha) {
      ctx.addIssue({
        code: "custom",
        message: "El vencimiento no puede ser anterior a la fecha.",
        path: ["vencimiento"],
      });
    }
  });

export type CotizacionEntrada = z.infer<typeof esquemaCotizacionPOS>;

// ---------------------------------------------------------------------------
// Devolución
// ---------------------------------------------------------------------------

export const esquemaDevolucion = z
  .object({
    terminal_id: z.uuid("La terminal no es válida."),
    turno_id: uuidNulo("El turno no es válido."),
    factura_id: z.uuid("La factura no es válida."),
    fecha: z.iso.date({ message: "La fecha de la devolución no es válida." }).optional(),
    lineas: z
      .array(
        z.object({
          factura_linea_id: z.uuid("La línea de la factura no es válida."),
          cantidad: montoPositivo(
            "La cantidad a devolver debe ser mayor a cero.",
            "La cantidad debe ser un número de 2 decimales.",
          ),
        }),
      )
      .min(1, { message: "La devolución requiere al menos una línea." }),
    tipo_reembolso: z.enum(TIPOS_REEMBOLSO_POS, { message: "El tipo de reembolso no es válido." }),
    monto_reembolso_efectivo: decimal2Opcional("El monto en efectivo debe ser un número de 2 decimales."),
    cuenta_reembolso_id: uuidNulo("La cuenta de reembolso no es válida."),
    notas: textoOpcional(500, "Las notas no pueden pasar de 500 caracteres."),
  })
  .superRefine((datos, ctx) => {
    const vistos = new Set<string>();
    for (const [indice, linea] of datos.lineas.entries()) {
      if (vistos.has(linea.factura_linea_id)) {
        ctx.addIssue({
          code: "custom",
          message: "Repetiste una línea en la devolución.",
          path: ["lineas", indice, "factura_linea_id"],
        });
      }
      vistos.add(linea.factura_linea_id);
    }

    const efectivo = datos.monto_reembolso_efectivo;

    if (datos.tipo_reembolso === "credito_factura") {
      if (efectivo !== undefined && compararMontos(efectivo, "0") > 0) {
        ctx.addIssue({
          code: "custom",
          message: "El reembolso con crédito a factura no puede incluir efectivo.",
          path: ["monto_reembolso_efectivo"],
        });
      }
      if (datos.cuenta_reembolso_id) {
        ctx.addIssue({
          code: "custom",
          message: "El reembolso con crédito a factura no lleva cuenta de reembolso.",
          path: ["cuenta_reembolso_id"],
        });
      }
      return;
    }

    if (datos.tipo_reembolso === "combinado" && (efectivo === undefined || compararMontos(efectivo, "0") <= 0)) {
      ctx.addIssue({
        code: "custom",
        message: "El reembolso combinado requiere efectivo y crédito mayores a cero.",
        path: ["monto_reembolso_efectivo"],
      });
    }
  });

export type DevolucionEntrada = z.infer<typeof esquemaDevolucion>;

// ---------------------------------------------------------------------------
// Filtros de lectura
// ---------------------------------------------------------------------------

export const esquemaFiltrosHistorial = z
  .object({
    q: textoOpcional(80, "La búsqueda es demasiado larga."),
    desde: z.iso.date({ message: "La fecha desde no es válida." }).optional(),
    hasta: z.iso.date({ message: "La fecha hasta no es válida." }).optional(),
    estado: z.enum(ESTADOS_FACTURA_POS, { message: "El estado de la factura no es válido." }).optional(),
    terminal_id: uuidOpcional("La terminal del filtro no es válida."),
    pagina: z.coerce
      .number({ message: "La página debe ser un número." })
      .int({ message: "La página debe ser un entero." })
      .min(1, { message: "La página debe ser mayor a cero." })
      .default(1),
    tamano: z.coerce
      .number({ message: "El tamaño de página debe ser un número." })
      .int({ message: "El tamaño de página debe ser un entero." })
      .refine((valor) => TAMANOS_PAGINA.some((tamano) => tamano === valor), {
        message: "El tamaño de página no está disponible.",
      })
      .default(TAMANO_PAGINA_DEFECTO),
  })
  .refine((datos) => !datos.desde || !datos.hasta || datos.desde <= datos.hasta, {
    message: "La fecha desde no puede ser mayor que la fecha hasta.",
    path: ["desde"],
  });

export type FiltrosHistorialEntrada = z.infer<typeof esquemaFiltrosHistorial>;

export const esquemaCotizacionesAbiertas = z.object({
  q: textoOpcional(80, "La búsqueda es demasiado larga."),
  contacto_id: uuidOpcional("El cliente del filtro no es válido."),
});

/** Catálogo del POS: los filtros de la fase 1 más la terminal que los resuelve. */
export const esquemaCatalogoPOS = filtroCatalogoPosSchema.extend({
  terminal_id: uuidOpcional("La terminal no es válida."),
});

export type CatalogoPOSEntrada = z.infer<typeof esquemaCatalogoPOS>;

export const esquemaBusquedaCodigoPOS = busquedaCodigoBarraSchema.extend({
  terminal_id: uuidOpcional("La terminal no es válida."),
});

export type BusquedaCodigoPOSEntrada = z.infer<typeof esquemaBusquedaCodigoPOS>;
