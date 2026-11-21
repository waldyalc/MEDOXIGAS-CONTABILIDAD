import { differenceInCalendarDays, format, parse } from "date-fns";
import { es } from "date-fns/locale";

import type { TonoPill } from "@/components/listas/tabla-lista";
import type { OpcionSelect } from "@/components/select-campo";
import type {
  EstadoEmpleado,
  EstadoNomina,
  FrecuenciaPago,
  MetodoPago,
  SegmentoContable,
  TipoContrato,
  TipoCuentaBanco,
  TipoIdentificacion,
} from "@/lib/nomina/tipos";

/**
 * Etiquetas, rutas y formateadores presentacionales de Nómina RD.
 *
 * No calcula dinero: solo da formato a los valores que devuelven las consultas
 * (`Decimal` como texto) y a fechas. La aritmética de fechas del periodo
 * sugerido es presentacional y la valida el servidor.
 */

export const RUTA_NOMINA = "/dashboard/contabilidad/nomina";
export const RUTA_EMPLEADOS = `${RUTA_NOMINA}/empleados`;
export const RUTA_PERIODOS = `${RUTA_NOMINA}/periodos`;
export const RUTA_REPORTES = `${RUTA_NOMINA}/reportes`;
export const RUTA_PAGOS = `${RUTA_NOMINA}/pagos`;
export const RUTA_ENVIOS = `${RUTA_NOMINA}/envios`;
export const RUTA_PARAMETROS = "/dashboard/configuracion/nomina/parametros";

export function rutaEmpleado(id: string): string {
  return `${RUTA_EMPLEADOS}/${encodeURIComponent(id)}`;
}

export function rutaEditarEmpleado(id: string): string {
  return `${rutaEmpleado(id)}/editar`;
}

export function rutaNuevoEmpleado(): string {
  return `${RUTA_EMPLEADOS}/nuevo`;
}

export function rutaPeriodo(id: string): string {
  return `${RUTA_PERIODOS}/${encodeURIComponent(id)}`;
}

export function rutaReciboNomina(id: string): string {
  return `${RUTA_NOMINA}/recibos/${encodeURIComponent(id)}`;
}

export function rutaAsientoNomina(id: string): string {
  return `/dashboard/contabilidad/asientos/${encodeURIComponent(id)}`;
}

export const ETIQUETA_FRECUENCIA: Record<FrecuenciaPago, string> = {
  quincenal: "Quincenal",
  mensual: "Mensual",
};

export const ETIQUETA_SEGMENTO: Record<SegmentoContable, string> = {
  administrativa: "Administrativa",
  operativa: "Operativa",
  ventas: "Ventas",
};

export const ETIQUETA_ESTADO_EMPLEADO: Record<EstadoEmpleado, string> = {
  activo: "Activo",
  suspendido: "Suspendido",
  inactivo: "Inactivo",
};

export const TONO_ESTADO_EMPLEADO: Record<EstadoEmpleado, TonoPill> = {
  activo: "exito",
  suspendido: "pendiente",
  inactivo: "neutro",
};

export const ETIQUETA_ESTADO_NOMINA: Record<EstadoNomina, string> = {
  borrador: "Borrador",
  calculado: "Calculado",
  contabilizado: "Contabilizado",
  pagado: "Pagado",
  anulado: "Anulado",
};

export const TONO_ESTADO_NOMINA: Record<EstadoNomina, TonoPill> = {
  borrador: "neutro",
  calculado: "pendiente",
  contabilizado: "info",
  pagado: "exito",
  anulado: "peligro",
};

export const ETIQUETA_TIPO_CONTRATO: Record<TipoContrato, string> = {
  indefinido: "Indefinido",
  definido: "Definido",
};

export const ETIQUETA_METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
};

export const ETIQUETA_TIPO_CUENTA: Record<TipoCuentaBanco, string> = {
  ahorros: "Ahorros",
  corriente: "Corriente",
};

export const ETIQUETA_TIPO_IDENTIFICACION: Record<TipoIdentificacion, string> = {
  cedula: "Cédula",
  pasaporte: "Pasaporte",
  residencia: "Residencia",
};

export const OPCIONES_FRECUENCIA: readonly OpcionSelect[] = [
  { value: "quincenal", label: ETIQUETA_FRECUENCIA.quincenal },
  { value: "mensual", label: ETIQUETA_FRECUENCIA.mensual },
];

export const OPCIONES_SEGMENTO: readonly OpcionSelect[] = [
  { value: "administrativa", label: ETIQUETA_SEGMENTO.administrativa },
  { value: "operativa", label: ETIQUETA_SEGMENTO.operativa },
  { value: "ventas", label: ETIQUETA_SEGMENTO.ventas },
];

export const OPCIONES_TIPO_CONTRATO: readonly OpcionSelect[] = [
  { value: "indefinido", label: ETIQUETA_TIPO_CONTRATO.indefinido },
  { value: "definido", label: ETIQUETA_TIPO_CONTRATO.definido },
];

export const OPCIONES_METODO_PAGO: readonly OpcionSelect[] = [
  { value: "efectivo", label: ETIQUETA_METODO_PAGO.efectivo },
  { value: "transferencia", label: ETIQUETA_METODO_PAGO.transferencia },
  { value: "cheque", label: ETIQUETA_METODO_PAGO.cheque },
];

export const OPCIONES_TIPO_CUENTA: readonly OpcionSelect[] = [
  { value: "ahorros", label: ETIQUETA_TIPO_CUENTA.ahorros },
  { value: "corriente", label: ETIQUETA_TIPO_CUENTA.corriente },
];

export const OPCIONES_TIPO_IDENTIFICACION: readonly OpcionSelect[] = [
  { value: "cedula", label: ETIQUETA_TIPO_IDENTIFICACION.cedula },
  { value: "pasaporte", label: ETIQUETA_TIPO_IDENTIFICACION.pasaporte },
  { value: "residencia", label: ETIQUETA_TIPO_IDENTIFICACION.residencia },
];

/** Bancos de RD que se ofrecen como atajo; el nombre se guarda como texto libre. */
export const BANCOS_RD: readonly OpcionSelect[] = [
  { value: "Banco Popular Dominicano", label: "Banco Popular Dominicano" },
  { value: "Banreservas", label: "Banreservas" },
  { value: "Banco BHD", label: "Banco BHD" },
  { value: "Scotiabank", label: "Scotiabank" },
  { value: "Banco Santa Cruz", label: "Banco Santa Cruz" },
  { value: "Banco Caribe", label: "Banco Caribe" },
  { value: "Banco Vimenca", label: "Banco Vimenca" },
  { value: "Banco Promerica", label: "Banco Promerica" },
  { value: "Banco Atlántico", label: "Banco Atlántico" },
  { value: "Banco Agrícola", label: "Banco Agrícola" },
  { value: "APAP", label: "APAP" },
  { value: "Banco ADOPEM", label: "Banco ADOPEM" },
  { value: "Banco López de Haro", label: "Banco López de Haro" },
  { value: "Citibank", label: "Citibank" },
  { value: "OTRA_ENTIDAD", label: "Otra entidad" },
];

const dias = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 3 });
const diasLaborados = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 });
const porcentaje = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

/** Días trabajados con hasta 3 decimales (`11.915`, `23.83`). */
export function formatoDias(valor: string | null | undefined): string {
  if (valor == null) return "—";
  const numero = Number(valor);
  return Number.isFinite(numero) ? dias.format(numero) : "—";
}

/** Porcentaje de 2–3 decimales (`3.04 %`, `1.10 %`). No usa `formatoPct`. */
export function formatoPorcentaje(valor: string | null | undefined): string {
  if (valor == null) return "—";
  const numero = Number(valor);
  return Number.isFinite(numero) ? `${porcentaje.format(numero)} %` : "—";
}

/** Fecha ISO → `dd/mm/aaaa` sin pasar por `Date` (evita corrimientos de zona). */
export function formatoFecha(valor: string | null | undefined): string {
  if (!valor) return "—";
  const [anio, mes, dia] = valor.slice(0, 10).split("-");
  if (!anio || !mes || !dia) return valor;
  return `${dia}/${mes}/${anio}`;
}

function aFecha(iso: string): Date {
  return parse(iso, "yyyy-MM-dd", new Date());
}

/** Rango de un periodo en tabla: `16–30 nov 2026`. */
export function etiquetaPeriodoCorta(inicio: string, fin: string): string {
  const desde = aFecha(inicio);
  const hasta = aFecha(fin);
  if (format(desde, "yyyy-MM") === format(hasta, "yyyy-MM")) {
    return `${format(desde, "d")}–${format(hasta, "d MMM yyyy", { locale: es })}`;
  }
  return `${format(desde, "d MMM yyyy", { locale: es })} – ${format(hasta, "d MMM yyyy", { locale: es })}`;
}

/** Rango de un periodo en encabezados: `16–30 de noviembre de 2026`. */
export function etiquetaPeriodoLarga(inicio: string, fin: string): string {
  const desde = aFecha(inicio);
  const hasta = aFecha(fin);
  if (format(desde, "yyyy-MM") === format(hasta, "yyyy-MM")) {
    return `${format(desde, "d")}–${format(hasta, "d")} de ${format(hasta, "MMMM 'de' yyyy", { locale: es })}`;
  }
  return `${format(desde, "d 'de' MMMM 'de' yyyy", { locale: es })} – ${format(hasta, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
}

/** Días desde `fecha_ingreso` hasta hoy o hasta `fecha_fin` (presentacional). */
export function diasLaboradosDesde(ingreso: string, fin: string | null, hoy: string): string {
  const hasta = fin && fin < hoy ? fin : hoy;
  const diferencia = differenceInCalendarDays(aFecha(hasta), aFecha(ingreso));
  return diasLaborados.format(Math.max(0, diferencia));
}

/** `4100123456789` → `•••• 6789`; nunca se muestra la cuenta completa en la ficha. */
export function enmascararCuenta(numero: string | null): string {
  if (!numero) return "—";
  const limpio = numero.replace(/\s/g, "");
  if (limpio.length <= 4) return `•••• ${limpio}`;
  return `•••• ${limpio.slice(-4)}`;
}

/** Cédula de 11 dígitos con la máscara `000-0000000-0`; el resto se deja tal cual. */
export function formatearIdentificacion(tipo: TipoIdentificacion, valor: string): string {
  if (tipo !== "cedula") return valor;
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length !== 11) return valor;
  return `${digitos.slice(0, 3)}-${digitos.slice(3, 10)}-${digitos.slice(10)}`;
}

/** Máscara progresiva mientras se escribe una cédula (máximo 11 dígitos). */
export function formatearCedulaParcial(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 10) return `${digitos.slice(0, 3)}-${digitos.slice(3)}`;
  return `${digitos.slice(0, 3)}-${digitos.slice(3, 10)}-${digitos.slice(10)}`;
}

export interface PeriodoSugerido {
  frecuencia: FrecuenciaPago;
  inicio: string;
  fin: string;
  codigo: string;
}

function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Periodo que corresponde a hoy según la frecuencia (quincena en curso o mes
 * en curso). Solo arma fechas y el código; los montos los calcula la RPC.
 */
export function sugerirPeriodo(frecuencia: FrecuenciaPago, hoy: string): PeriodoSugerido {
  const [anio = 0, mes = 1, dia = 1] = hoy.slice(0, 10).split("-").map(Number);
  const mesTexto = String(mes).padStart(2, "0");
  const base = `${anio}-${mesTexto}`;
  const ultimo = ultimoDiaDelMes(anio, mes);

  if (frecuencia === "mensual") {
    return { frecuencia, inicio: `${base}-01`, fin: `${base}-${String(ultimo).padStart(2, "0")}`, codigo: `${base}-M` };
  }

  if (dia <= 15) {
    return { frecuencia, inicio: `${base}-01`, fin: `${base}-15`, codigo: `${base}-Q1` };
  }

  return { frecuencia, inicio: `${base}-16`, fin: `${base}-${String(ultimo).padStart(2, "0")}`, codigo: `${base}-Q2` };
}

/** Periodos cuyo rango se cruza (la regla de "sin doble pago" es del servidor). */
export function periodosQueSeCruzan<T extends { fecha_inicio: string; fecha_fin: string; estado: string }>(
  periodos: readonly T[],
  sugerido: PeriodoSugerido,
): T[] {
  return periodos.filter(
    (periodo) =>
      periodo.estado !== "anulado" && periodo.fecha_inicio <= sugerido.fin && periodo.fecha_fin >= sugerido.inicio,
  );
}
