import { z } from "zod";

import { parsearMonto } from "@/lib/productos/productos";

import {
  CATEGORIAS_EMPRESA,
  CLASES_CONCEPTO,
  type ClaseConcepto,
  ESTADOS_EMPLEADO,
  ESTADOS_NOMINA,
  FRECUENCIAS_PAGO,
  METODOS_PAGO,
  RIESGOS_LABORALES,
  SEGMENTOS_CONTABLES,
  TIPOS_CONTRATO,
  TIPOS_CUENTA_BANCO,
  TIPOS_IDENTIFICACION,
} from "./tipos";

/**
 * Esquemas de entrada de la capa de nómina.
 *
 * Los montos y cantidades se validan como texto decimal (2 decimales para
 * dinero, 3 para cantidades, tasas y días) para que el payload llegue a la RPC
 * como string y nunca como float. Las reglas duplican a propósito las de la
 * base: la pantalla avisa antes de llamar y la RPC sigue siendo la autoridad.
 */

const DECIMAL_2 = /^\d+(?:\.\d{1,2})?$/;
const DECIMAL_3 = /^\d+(?:\.\d{1,3})?$/;
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const idSchema = z.uuid("El identificador no es válido.");

/** Quita guiones, espacios y puntos de una cédula: `001-1234567-8` → `00112345678`. */
export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Acepta ``1,500.25`` o ``1250,50`` con el mismo criterio que las pantallas. */
function textoDecimal(valor: unknown): string {
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor !== "string") return "";

  const numero = parsearMonto(valor);
  return numero === null ? valor.trim() : String(numero);
}

function decimal2(mensajeFormato: string) {
  return z.preprocess(textoDecimal, z.string().regex(DECIMAL_2, { message: mensajeFormato }));
}

function decimal3(mensajeFormato: string) {
  return z.preprocess(textoDecimal, z.string().regex(DECIMAL_3, { message: mensajeFormato }));
}

function textoObligatorio(maximo: number, mensaje: string) {
  return z
    .string({ message: mensaje })
    .trim()
    .min(1, { message: mensaje })
    .max(maximo, { message: `El texto no puede pasar de ${maximo} caracteres.` });
}

function textoOpcional(maximo: number, mensaje: string) {
  return z.preprocess((valor) => {
    if (valor === null || valor === undefined) return undefined;
    const texto = String(valor).trim();
    return texto === "" ? undefined : texto;
  }, z.string().max(maximo, { message: mensaje }).optional());
}

function uuidOpcional(mensaje: string) {
  return z.preprocess((valor) => (valor === "" || valor === null ? undefined : valor), z.uuid(mensaje).optional());
}

/** Ausente = no cambiar; vacío = borrar (null). */
function uuidCambio(mensaje: string) {
  return z.preprocess((valor) => (valor === "" ? null : valor), z.uuid(mensaje).nullable().optional());
}

function fechaOpcional(mensaje: string) {
  return z.preprocess(
    (valor) => (valor === "" || valor === null ? undefined : valor),
    z.iso.date({ message: mensaje }).optional(),
  );
}

// ---------------------------------------------------------------------------
// Empleado
// ---------------------------------------------------------------------------

export const empleadoSchema = z.preprocess(
  (valor) => {
    if (typeof valor !== "object" || valor === null) return valor;

    const datos: Record<string, unknown> = { ...valor };
    if (datos.tipo_identificacion === "cedula" && typeof datos.identificacion === "string") {
      datos.identificacion = soloDigitos(datos.identificacion);
    }
    return datos;
  },
  z
    .object({
      tipo_identificacion: z.enum(TIPOS_IDENTIFICACION, { message: "El tipo de identificación no es válido." }),
      identificacion: z
        .string({ message: "La identificación es obligatoria." })
        .trim()
        .max(40, { message: "La identificación no puede pasar de 40 caracteres." }),
      primer_nombre: textoObligatorio(80, "El primer nombre es obligatorio."),
      segundo_nombre: textoOpcional(80, "El segundo nombre es demasiado largo."),
      primer_apellido: textoObligatorio(80, "El primer apellido es obligatorio."),
      segundo_apellido: textoOpcional(80, "El segundo apellido es demasiado largo."),
      correo: z.preprocess(
        (valor) => (valor === "" || valor === null ? undefined : String(valor).trim()),
        z
          .string()
          .max(160, { message: "El correo es demasiado largo." })
          .regex(CORREO, { message: "El correo no tiene un formato válido." })
          .optional(),
      ),
      telefono: textoOpcional(40, "El teléfono es demasiado largo."),
      municipio: textoOpcional(120, "El municipio es demasiado largo."),
      direccion: textoOpcional(300, "La dirección es demasiado larga."),
      cargo: textoOpcional(120, "El cargo es demasiado largo."),
      area: textoOpcional(120, "El área es demasiado larga."),
      segmento_contable: z.enum(SEGMENTOS_CONTABLES, { message: "El segmento contable no es válido." }),
      centro_costo_id: uuidOpcional("El centro de costo no es válido."),
      tipo_contrato: z.enum(TIPOS_CONTRATO, { message: "El tipo de contrato no es válido." }).default("indefinido"),
      fecha_ingreso: z.iso.date({ message: "La fecha de ingreso no es válida." }),
      fecha_fin: fechaOpcional("La fecha de fin no es válida."),
      frecuencia_pago: z.enum(FRECUENCIAS_PAGO, { message: "La frecuencia de pago no es válida." }),
      salario_mensual: decimal2("El salario mensual debe ser un número de hasta 2 decimales.").refine(
        (valor) => Number(valor) > 0,
        { message: "El salario mensual debe ser mayor que cero." },
      ),
      metodo_pago: z.enum(METODOS_PAGO, { message: "El método de pago no es válido." }).default("transferencia"),
      banco_nombre: textoOpcional(120, "El banco es demasiado largo."),
      tipo_cuenta_banco: z.preprocess(
        (valor) => (valor === "" || valor === null ? undefined : valor),
        z.enum(TIPOS_CUENTA_BANCO, { message: "El tipo de cuenta no es válido." }).optional(),
      ),
      numero_cuenta_banco: textoOpcional(40, "El número de cuenta es demasiado largo."),
      clave_tss: z.preprocess(
        (valor) => (valor === "" || valor === null ? undefined : String(valor).trim()),
        z
          .string()
          .regex(/^\d{3}$/, { message: "La clave TSS debe tener 3 dígitos." })
          .optional(),
      ),
    })
    .superRefine((datos, ctx) => {
      const esCedula = datos.tipo_identificacion === "cedula";

      if (esCedula && !/^\d{11}$/.test(datos.identificacion)) {
        ctx.addIssue({
          code: "custom",
          message: "La cédula debe tener 11 dígitos.",
          path: ["identificacion"],
        });
      }
      if (!esCedula && datos.identificacion === "") {
        ctx.addIssue({
          code: "custom",
          message: "La identificación es obligatoria.",
          path: ["identificacion"],
        });
      }

      if (datos.tipo_contrato === "definido" && !datos.fecha_fin) {
        ctx.addIssue({
          code: "custom",
          message: "El contrato definido necesita una fecha de fin.",
          path: ["fecha_fin"],
        });
      }
      if (datos.fecha_fin && datos.fecha_fin < datos.fecha_ingreso) {
        ctx.addIssue({
          code: "custom",
          message: "La fecha de fin no puede ser anterior a la fecha de ingreso.",
          path: ["fecha_fin"],
        });
      }

      if (datos.metodo_pago === "transferencia") {
        if (!datos.banco_nombre) {
          ctx.addIssue({
            code: "custom",
            message: "Si el pago es por transferencia, indica el banco, el tipo y el número de cuenta.",
            path: ["banco_nombre"],
          });
        }
        if (!datos.tipo_cuenta_banco) {
          ctx.addIssue({
            code: "custom",
            message: "Si el pago es por transferencia, indica el banco, el tipo y el número de cuenta.",
            path: ["tipo_cuenta_banco"],
          });
        }
        if (!datos.numero_cuenta_banco) {
          ctx.addIssue({
            code: "custom",
            message: "Si el pago es por transferencia, indica el banco, el tipo y el número de cuenta.",
            path: ["numero_cuenta_banco"],
          });
        }
      }
    }),
);

export type EmpleadoEntrada = z.infer<typeof empleadoSchema>;

// ---------------------------------------------------------------------------
// Novedad recurrente del empleado
// ---------------------------------------------------------------------------

export const novedadRecurrenteSchema = z
  .object({
    id: uuidOpcional("La novedad recurrente no es válida."),
    empleado_id: z.uuid({ message: "Selecciona un empleado válido." }),
    concepto_id: z.uuid({ message: "Selecciona un concepto válido." }),
    monto: z.preprocess(
      (valor) => (valor === "" || valor === null ? undefined : valor),
      decimal2("El monto debe ser un número de hasta 2 decimales.").optional(),
    ),
    porcentaje: z.preprocess(
      (valor) => (valor === "" || valor === null ? undefined : valor),
      decimal3("El porcentaje debe ser un número de hasta 3 decimales.").optional(),
    ),
    fecha_inicio: z.iso.date({ message: "La fecha de inicio no es válida." }),
    fecha_fin: fechaOpcional("La fecha de fin no es válida."),
    activa: z.boolean({ message: "El estado de la novedad no es válido." }).default(true),
    notas: textoOpcional(500, "Las notas son demasiado largas."),
  })
  .superRefine((datos, ctx) => {
    const tieneMonto = datos.monto !== undefined;
    const tienePorcentaje = datos.porcentaje !== undefined;

    if (tieneMonto === tienePorcentaje) {
      ctx.addIssue({
        code: "custom",
        message: tieneMonto
          ? "Indica un monto o un porcentaje, no ambos."
          : "Indica un monto o un porcentaje mayor que cero.",
        path: ["monto"],
      });
    }
    if (datos.monto !== undefined && Number(datos.monto) <= 0) {
      ctx.addIssue({ code: "custom", message: "El monto debe ser mayor que cero.", path: ["monto"] });
    }
    if (datos.porcentaje !== undefined && (Number(datos.porcentaje) <= 0 || Number(datos.porcentaje) > 100)) {
      ctx.addIssue({
        code: "custom",
        message: "El porcentaje debe ser mayor que cero y máximo 100.",
        path: ["porcentaje"],
      });
    }
    if (datos.fecha_fin && datos.fecha_fin < datos.fecha_inicio) {
      ctx.addIssue({
        code: "custom",
        message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
        path: ["fecha_fin"],
      });
    }
  });

export type NovedadRecurrenteEntrada = z.infer<typeof novedadRecurrenteSchema>;

// ---------------------------------------------------------------------------
// Periodo de nómina
// ---------------------------------------------------------------------------

function partesFecha(fecha: string): { anio: number; mes: number; dia: number } {
  const [anio = 0, mes = 0, dia = 0] = fecha.split("-").map(Number);
  return { anio, mes, dia };
}

function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export const periodoSchema = z
  .object({
    frecuencia: z.enum(FRECUENCIAS_PAGO, { message: "La frecuencia debe ser quincenal o mensual." }),
    fecha_inicio: z.iso.date({ message: "La fecha de inicio no es válida." }),
    fecha_fin: z.iso.date({ message: "La fecha de fin no es válida." }),
    fecha_pago: fechaOpcional("La fecha de pago no es válida."),
    observaciones: textoOpcional(2000, "Las observaciones son demasiado largas."),
  })
  .superRefine((datos, ctx) => {
    if (datos.fecha_fin < datos.fecha_inicio) {
      ctx.addIssue({
        code: "custom",
        message: "La fecha fin no puede ser anterior a la fecha inicio.",
        path: ["fecha_fin"],
      });
      return;
    }

    const inicio = partesFecha(datos.fecha_inicio);
    const fin = partesFecha(datos.fecha_fin);

    if (inicio.anio !== fin.anio) {
      ctx.addIssue({ code: "custom", message: "El periodo no puede cruzar de año.", path: ["fecha_fin"] });
      return;
    }

    const ultimoDia = ultimoDiaDelMes(fin.anio, fin.mes);

    if (datos.frecuencia === "mensual") {
      if (inicio.dia !== 1 || fin.dia !== ultimoDia) {
        ctx.addIssue({
          code: "custom",
          message: "El periodo mensual debe ir del primer al último día del mes.",
          path: ["fecha_fin"],
        });
      }
      return;
    }

    if (inicio.dia === 1) {
      if (fin.dia !== 15) {
        ctx.addIssue({
          code: "custom",
          message: "La primera quincena debe ir del día 1 al 15.",
          path: ["fecha_fin"],
        });
      }
      return;
    }

    if (inicio.dia === 16) {
      if (fin.dia !== ultimoDia) {
        ctx.addIssue({
          code: "custom",
          message: "La segunda quincena debe ir del día 16 al último del mes.",
          path: ["fecha_fin"],
        });
      }
      return;
    }

    ctx.addIssue({
      code: "custom",
      message: "La quincena debe empezar el día 1 o el día 16.",
      path: ["fecha_inicio"],
    });
  });

export type PeriodoEntrada = z.infer<typeof periodoSchema>;

// ---------------------------------------------------------------------------
// Novedad manual de un recibo
// ---------------------------------------------------------------------------

export const novedadReciboSchema = z
  .object({
    id: uuidOpcional("La novedad del recibo no es válida."),
    recibo_id: z.uuid({ message: "Selecciona un recibo válido." }),
    concepto_id: z.uuid({ message: "Selecciona un concepto válido." }),
    cantidad: z.preprocess(
      (valor) => (valor === "" || valor === null ? undefined : valor),
      decimal3("La cantidad debe ser un número de hasta 3 decimales.").optional(),
    ),
    monto: z.preprocess(
      (valor) => (valor === "" || valor === null ? undefined : valor),
      decimal2("El monto debe ser un número de hasta 2 decimales.").optional(),
    ),
    porcentaje: z.preprocess(
      (valor) => (valor === "" || valor === null ? undefined : valor),
      decimal3("El porcentaje debe ser un número de hasta 3 decimales.").optional(),
    ),
    notas: textoOpcional(500, "Las notas son demasiado largas."),
  })
  .superRefine((datos, ctx) => {
    const indicados = [datos.cantidad, datos.monto, datos.porcentaje].filter((valor) => valor !== undefined).length;

    if (indicados !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Indica una cantidad de horas, un monto o un porcentaje (solo uno).",
        path: ["monto"],
      });
      return;
    }
    if (datos.cantidad !== undefined && Number(datos.cantidad) <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Las horas extra requieren una cantidad mayor que cero.",
        path: ["cantidad"],
      });
    }
    if (datos.monto !== undefined && Number(datos.monto) <= 0) {
      ctx.addIssue({ code: "custom", message: "El monto debe ser mayor que cero.", path: ["monto"] });
    }
    if (datos.porcentaje !== undefined && (Number(datos.porcentaje) <= 0 || Number(datos.porcentaje) > 100)) {
      ctx.addIssue({
        code: "custom",
        message: "El porcentaje debe ser mayor que cero y máximo 100.",
        path: ["porcentaje"],
      });
    }
  });

export type NovedadReciboEntrada = z.infer<typeof novedadReciboSchema>;

// ---------------------------------------------------------------------------
// Pago de recibo o de periodo
// ---------------------------------------------------------------------------

export const pagoReciboSchema = z.object({
  recibo_id: z.uuid({ message: "Selecciona un recibo válido." }),
  fecha: fechaOpcional("La fecha de pago no es válida."),
  cuenta_pago_id: z.uuid({ message: "Selecciona la cuenta con la que se paga la nómina." }),
});

export type PagoReciboEntrada = z.infer<typeof pagoReciboSchema>;

export const pagoPeriodoSchema = z.object({
  periodo_id: z.uuid({ message: "Selecciona un periodo válido." }),
  fecha: fechaOpcional("La fecha de pago no es válida."),
  cuenta_pago_id: z.uuid({ message: "Selecciona la cuenta con la que se paga la nómina." }),
});

export type PagoPeriodoEntrada = z.infer<typeof pagoPeriodoSchema>;

// ---------------------------------------------------------------------------
// Agregar empleados a un periodo
// ---------------------------------------------------------------------------

export const agregarEmpleadosPeriodoSchema = z.object({
  periodo_id: z.uuid({ message: "Selecciona un periodo válido." }),
  empleado_ids: z
    .array(z.uuid({ message: "Uno de los empleados no es válido." }))
    .min(1, { message: "Indica al menos un empleado para agregar." })
    .max(500, { message: "No se agregan más de 500 empleados a la vez." }),
});

export type AgregarEmpleadosPeriodoEntrada = z.infer<typeof agregarEmpleadosPeriodoSchema>;

// ---------------------------------------------------------------------------
// Envío de colillas
// ---------------------------------------------------------------------------

export const envioColillasSchema = z.object({
  periodo_id: z.uuid({ message: "Selecciona un periodo válido." }),
  recibo_ids: z
    .array(z.uuid({ message: "Uno de los recibos no es válido." }))
    .min(1, { message: "Indica al menos un recibo para registrar el envío." })
    .max(500, { message: "No se registran más de 500 colillas en un envío." }),
  enviado_a: textoOpcional(160, "El destinatario es demasiado largo."),
});

export type EnvioColillasEntrada = z.infer<typeof envioColillasSchema>;

// ---------------------------------------------------------------------------
// Cambio de estado del empleado
// ---------------------------------------------------------------------------

export const cambioEstadoEmpleadoSchema = z.object({
  estado: z.enum(ESTADOS_EMPLEADO, { message: "El estado del empleado no es válido." }),
  fecha_fin: fechaOpcional("La fecha de fin no es válida."),
});

export type CambioEstadoEmpleadoEntrada = z.infer<typeof cambioEstadoEmpleadoSchema>;

// ---------------------------------------------------------------------------
// Configuración de la empresa (actualización parcial)
// ---------------------------------------------------------------------------

export const configNominaSchema = z.object({
  riesgo_laboral: z.enum(RIESGOS_LABORALES, { message: "El riesgo laboral no es válido." }).optional(),
  categoria_empresa: z.enum(CATEGORIAS_EMPRESA, { message: "La categoría de la empresa no es válida." }).optional(),
  aplica_infotep: z.boolean({ message: "El indicador de INFOTEP no es válido." }).optional(),
  frecuencia_defecto: z.enum(FRECUENCIAS_PAGO, { message: "La frecuencia por defecto no es válida." }).optional(),
  cuenta_pago_defecto_id: uuidCambio("La cuenta de pago por defecto no es válida."),
  cuenta_salarios_por_pagar_id: uuidCambio("La cuenta de salarios por pagar no es válida."),
  registrar_provisiones: z.boolean({ message: "El indicador de provisiones no es válido." }).optional(),
  contacto_tss_id: uuidCambio("El contacto de TSS no es válido."),
  contacto_infotep_id: uuidCambio("El contacto de INFOTEP no es válido."),
  contacto_dgii_id: uuidCambio("El contacto de DGII no es válido."),
});

export type ConfigNominaEntrada = z.infer<typeof configNominaSchema>;

// ---------------------------------------------------------------------------
// Mapeo contable por segmento
// ---------------------------------------------------------------------------

interface MapeoFila {
  clase?: ClaseConcepto;
  cuenta_gasto_id?: string | null;
  cuenta_pasivo_id?: string | null;
}

function validarObligacionMapeo(fila: MapeoFila, ctx: z.RefinementCtx) {
  if (!fila.clase) {
    if (fila.cuenta_gasto_id === undefined && fila.cuenta_pasivo_id === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Indica al menos una cuenta para el concepto.",
        path: ["cuenta_gasto_id"],
      });
    }
    return;
  }

  if (fila.clase === "ingreso") {
    validarMapeoIngreso(fila, ctx);
    return;
  }

  if (fila.clase === "deduccion") {
    validarMapeoDeduccion(fila, ctx);
    return;
  }

  if (!fila.cuenta_gasto_id || !fila.cuenta_pasivo_id) {
    ctx.addIssue({
      code: "custom",
      message: "El aporte o la provisión necesitan cuenta de gasto y de pasivo.",
      path: ["cuenta_gasto_id"],
    });
  }
}

function validarMapeoIngreso(fila: MapeoFila, ctx: z.RefinementCtx) {
  if (!fila.cuenta_gasto_id) {
    ctx.addIssue({ code: "custom", message: "El ingreso necesita cuenta de gasto.", path: ["cuenta_gasto_id"] });
  }
  if (fila.cuenta_pasivo_id) {
    ctx.addIssue({ code: "custom", message: "El ingreso no lleva cuenta de pasivo.", path: ["cuenta_pasivo_id"] });
  }
}

function validarMapeoDeduccion(fila: MapeoFila, ctx: z.RefinementCtx) {
  if (!fila.cuenta_pasivo_id) {
    ctx.addIssue({ code: "custom", message: "La deducción necesita cuenta de pasivo.", path: ["cuenta_pasivo_id"] });
  }
  if (fila.cuenta_gasto_id) {
    ctx.addIssue({ code: "custom", message: "La deducción no lleva cuenta de gasto.", path: ["cuenta_gasto_id"] });
  }
}

export const mapeoContableFilaSchema = z
  .object({
    segmento: z.enum(SEGMENTOS_CONTABLES, { message: "El segmento contable no es válido." }),
    concepto_id: z.uuid({ message: "Selecciona un concepto válido." }),
    /** Contexto del formulario para validar la obligación por clase antes de llamar. */
    clase: z.enum(CLASES_CONCEPTO, { message: "La clase del concepto no es válida." }).optional(),
    cuenta_gasto_id: uuidCambio("La cuenta de gasto no es válida."),
    cuenta_pasivo_id: uuidCambio("La cuenta de pasivo no es válida."),
  })
  .superRefine((fila, ctx) => validarObligacionMapeo(fila, ctx));

export const mapeoContableSchema = z.object({
  mapeos: z
    .array(mapeoContableFilaSchema)
    .min(1, { message: "Indica al menos un mapeo." })
    .max(200, { message: "No se guardan más de 200 mapeos de una vez." }),
});

export type MapeoContableEntrada = z.infer<typeof mapeoContableSchema>;

// ---------------------------------------------------------------------------
// Parámetros legales RD por año
// ---------------------------------------------------------------------------

export const escalaIsrTramoSchema = z.object({
  desde: decimal2("El desde de la escala debe ser un número de hasta 2 decimales."),
  hasta: z.preprocess(
    (valor) => (valor === "" || valor === undefined ? null : valor),
    z.union([z.string().regex(DECIMAL_2, { message: "El hasta debe ser un número de hasta 2 decimales." }), z.null()]),
  ),
  tasa: decimal3("La tasa de la escala debe ser un número de hasta 3 decimales.").refine(
    (valor) => Number(valor) >= 0 && Number(valor) <= 100,
    { message: "La tasa de la escala debe estar entre 0 y 100." },
  ),
  monto_fijo: decimal2("El monto fijo de la escala debe ser un número de hasta 2 decimales."),
});

type TramoEscala = z.infer<typeof escalaIsrTramoSchema>;

interface DatosParametros {
  tasa_sfs_empleado: string;
  tasa_sfs_empleador: string;
  tasa_afp_empleado: string;
  tasa_afp_empleador: string;
  tasa_srl_tipo_1: string;
  tasa_srl_tipo_2: string;
  tasa_srl_tipo_3: string;
  tasa_srl_tipo_4: string;
  tasa_infotep: string;
  dias_mes_laboral: string;
  horas_dia_laboral: string;
  escala_isr_anual: TramoEscala[];
}

function validarTasasNomina(datos: DatosParametros, ctx: z.RefinementCtx) {
  const tasas: { campo: keyof DatosParametros & string; valor: string }[] = [
    { campo: "tasa_sfs_empleado", valor: datos.tasa_sfs_empleado },
    { campo: "tasa_sfs_empleador", valor: datos.tasa_sfs_empleador },
    { campo: "tasa_afp_empleado", valor: datos.tasa_afp_empleado },
    { campo: "tasa_afp_empleador", valor: datos.tasa_afp_empleador },
    { campo: "tasa_srl_tipo_1", valor: datos.tasa_srl_tipo_1 },
    { campo: "tasa_srl_tipo_2", valor: datos.tasa_srl_tipo_2 },
    { campo: "tasa_srl_tipo_3", valor: datos.tasa_srl_tipo_3 },
    { campo: "tasa_srl_tipo_4", valor: datos.tasa_srl_tipo_4 },
    { campo: "tasa_infotep", valor: datos.tasa_infotep },
  ];

  for (const tasa of tasas) {
    if (Number(tasa.valor) > 100) {
      ctx.addIssue({ code: "custom", message: "Las tasas deben estar entre 0 y 100.", path: [tasa.campo] });
    }
  }
}

function validarJornadaNomina(datos: DatosParametros, ctx: z.RefinementCtx) {
  const dias = Number(datos.dias_mes_laboral);
  if (dias <= 0 || dias > 31) {
    ctx.addIssue({
      code: "custom",
      message: "Los días del mes laboral deben ser mayores que cero y máximo 31.",
      path: ["dias_mes_laboral"],
    });
  }

  const horas = Number(datos.horas_dia_laboral);
  if (horas <= 0 || horas > 24) {
    ctx.addIssue({
      code: "custom",
      message: "Las horas del día laboral deben ser mayores que cero y máximo 24.",
      path: ["horas_dia_laboral"],
    });
  }
}

function validarEscalaNomina(escala: TramoEscala[], ctx: z.RefinementCtx) {
  const primerTramo = escala[0];
  if (primerTramo && Number(primerTramo.desde) !== 0) {
    ctx.addIssue({
      code: "custom",
      message: "La escala de ISR debe empezar en 0.",
      path: ["escala_isr_anual", 0, "desde"],
    });
  }

  for (const [indice, tramo] of escala.entries()) {
    validarTramoEscala(escala, indice, tramo, ctx);
  }
}

function validarTramoEscala(escala: TramoEscala[], indice: number, tramo: TramoEscala, ctx: z.RefinementCtx) {
  const anterior = indice > 0 ? escala[indice - 1] : undefined;
  const esUltimo = indice === escala.length - 1;

  if (anterior && anterior.hasta !== tramo.desde) {
    ctx.addIssue({
      code: "custom",
      message: "Cada tramo debe empezar donde termina el anterior.",
      path: ["escala_isr_anual", indice, "desde"],
    });
  }
  if (esUltimo && tramo.hasta !== null) {
    ctx.addIssue({
      code: "custom",
      message: "El último tramo de la escala debe quedar abierto (sin hasta).",
      path: ["escala_isr_anual", indice, "hasta"],
    });
  }
  if (!esUltimo && tramo.hasta === null) {
    ctx.addIssue({
      code: "custom",
      message: "Solo el último tramo de la escala queda abierto.",
      path: ["escala_isr_anual", indice, "hasta"],
    });
  }

  const esperado =
    anterior?.hasta != null
      ? Number(anterior.monto_fijo) + (Number(anterior.tasa) / 100) * (Number(anterior.hasta) - Number(anterior.desde))
      : 0;

  if (Math.abs(Number(tramo.monto_fijo) - esperado) > 0.005) {
    ctx.addIssue({
      code: "custom",
      message: "El monto fijo del tramo no coincide con el impuesto acumulado del tramo anterior.",
      path: ["escala_isr_anual", indice, "monto_fijo"],
    });
  }
}

export const parametrosNominaSchema = z
  .object({
    anio: z.coerce
      .number({ message: "El año debe ser un número." })
      .int({ message: "El año debe ser un entero." })
      .min(2000, { message: "El año debe estar entre 2000 y 2100." })
      .max(2100, { message: "El año debe estar entre 2000 y 2100." }),
    salario_minimo: decimal2("El salario mínimo debe ser un número de hasta 2 decimales.").refine(
      (valor) => Number(valor) > 0,
      { message: "El salario mínimo debe ser mayor que cero." },
    ),
    tasa_sfs_empleado: decimal3("La tasa de SFS del empleado debe ser un número de hasta 3 decimales."),
    tasa_sfs_empleador: decimal3("La tasa de SFS del empleador debe ser un número de hasta 3 decimales."),
    tope_sfs_mensual: decimal2("El tope de SFS debe ser un número de hasta 2 decimales."),
    tasa_afp_empleado: decimal3("La tasa de AFP del empleado debe ser un número de hasta 3 decimales."),
    tasa_afp_empleador: decimal3("La tasa de AFP del empleador debe ser un número de hasta 3 decimales."),
    tope_afp_mensual: decimal2("El tope de AFP debe ser un número de hasta 2 decimales."),
    tope_srl_mensual: decimal2("El tope de SRL debe ser un número de hasta 2 decimales."),
    tasa_srl_tipo_1: decimal3("La tasa SRL tipo 1 debe ser un número de hasta 3 decimales."),
    tasa_srl_tipo_2: decimal3("La tasa SRL tipo 2 debe ser un número de hasta 3 decimales."),
    tasa_srl_tipo_3: decimal3("La tasa SRL tipo 3 debe ser un número de hasta 3 decimales."),
    tasa_srl_tipo_4: decimal3("La tasa SRL tipo 4 debe ser un número de hasta 3 decimales."),
    tasa_infotep: decimal3("La tasa de INFOTEP debe ser un número de hasta 3 decimales."),
    dias_mes_laboral: decimal3("Los días del mes laboral deben ser un número de hasta 3 decimales."),
    horas_dia_laboral: decimal3("Las horas del día laboral deben ser un número de hasta 3 decimales."),
    escala_isr_anual: z
      .array(escalaIsrTramoSchema)
      .min(1, { message: "La escala de ISR debe tener al menos un tramo." })
      .max(10, { message: "La escala de ISR no puede pasar de 10 tramos." }),
  })
  .superRefine((datos, ctx) => {
    validarTasasNomina(datos, ctx);
    validarJornadaNomina(datos, ctx);
    validarEscalaNomina(datos.escala_isr_anual, ctx);
  });

export type ParametrosNominaEntrada = z.infer<typeof parametrosNominaSchema>;

// ---------------------------------------------------------------------------
// Filtros de lectura
// ---------------------------------------------------------------------------

export const filtroEmpleadoSchema = z.object({
  estado: z.enum(ESTADOS_EMPLEADO, { message: "El estado del empleado no es válido." }).optional(),
  frecuencia: z.enum(FRECUENCIAS_PAGO, { message: "La frecuencia de pago no es válida." }).optional(),
  segmento: z.enum(SEGMENTOS_CONTABLES, { message: "El segmento contable no es válido." }).optional(),
  busqueda: textoOpcional(80, "La búsqueda es demasiado larga."),
});

export type FiltroEmpleadoEntrada = z.infer<typeof filtroEmpleadoSchema>;

export const filtroPeriodoSchema = z.object({
  anio: z.coerce
    .number({ message: "El año debe ser un número." })
    .int({ message: "El año debe ser un entero." })
    .min(2000, { message: "El año debe estar entre 2000 y 2100." })
    .max(2100, { message: "El año debe estar entre 2000 y 2100." })
    .optional(),
  frecuencia: z.enum(FRECUENCIAS_PAGO, { message: "La frecuencia de pago no es válida." }).optional(),
  estado: z.enum(ESTADOS_NOMINA, { message: "El estado del periodo no es válido." }).optional(),
});

export type FiltroPeriodoEntrada = z.infer<typeof filtroPeriodoSchema>;

export const filtroReciboSchema = z.object({
  periodo_id: z.uuid({ message: "El periodo no es válido." }).optional(),
  empleado_id: z.uuid({ message: "El empleado no es válido." }).optional(),
  estado: z.enum(ESTADOS_NOMINA, { message: "El estado del recibo no es válido." }).optional(),
});

export type FiltroReciboEntrada = z.infer<typeof filtroReciboSchema>;

export const filtroConceptoSchema = z.object({
  clase: z.enum(CLASES_CONCEPTO, { message: "La clase del concepto no es válida." }).optional(),
  activo: z.boolean({ message: "El estado del concepto no es válido." }).optional(),
  busqueda: textoOpcional(80, "La búsqueda es demasiado larga."),
});

export type FiltroConceptoEntrada = z.infer<typeof filtroConceptoSchema>;

export const anioSchema = z.coerce
  .number({ message: "El año debe ser un número." })
  .int({ message: "El año debe ser un entero." })
  .min(2000, { message: "El año debe estar entre 2000 y 2100." })
  .max(2100, { message: "El año debe estar entre 2000 y 2100." });

export const segmentoSchema = z.enum(SEGMENTOS_CONTABLES, { message: "El segmento contable no es válido." });

export const filtroNovedadSchema = z.object({
  solo_activas: z.boolean({ message: "El filtro de novedades no es válido." }).default(false),
});

export type FiltroNovedadEntrada = z.infer<typeof filtroNovedadSchema>;

export const reporteTssSchema = z.object({
  anio: z.coerce
    .number({ message: "El año debe ser un número." })
    .int({ message: "El año debe ser un entero." })
    .min(2000, { message: "El año debe estar entre 2000 y 2100." })
    .max(2100, { message: "El año debe estar entre 2000 y 2100." }),
  mes: z.coerce
    .number({ message: "El mes debe ser un número." })
    .int({ message: "El mes debe ser un entero." })
    .min(1, { message: "El mes debe estar entre 1 y 12." })
    .max(12, { message: "El mes debe estar entre 1 y 12." }),
});

export type ReporteTssEntrada = z.infer<typeof reporteTssSchema>;

export function mensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}
