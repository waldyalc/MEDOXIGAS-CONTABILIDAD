import { differenceInCalendarDays, format, parse } from "date-fns";
import { es } from "date-fns/locale";

import type { TonoPill } from "@/components/listas/tabla-lista";
import type { OpcionSelect } from "@/components/select-campo";
import type { DatosContribuyenteDgii } from "@/lib/dgii/consulta";
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

// ---------------------------------------------------------------------------
// Máscara de la cédula con cursor estable
// ---------------------------------------------------------------------------

/** Dígitos a la izquierda de una posición del texto mostrado en el input. */
export function digitosAntesDeCursor(texto: string, posicion: number): number {
  let cuenta = 0;
  for (let i = 0; i < posicion && i < texto.length; i += 1) {
    if (texto.charCodeAt(i) >= 48 && texto.charCodeAt(i) <= 57) cuenta += 1;
  }
  return cuenta;
}

/**
 * Posición del cursor en el texto formateado cuando hay `digitos` dígitos a
 * su izquierda. Salta los separadores de la máscara que siguen al dígito:
 * con «402-» el cursor queda tras el guion, no antes de él.
 */
export function posicionDespuesDeDigitos(texto: string, digitos: number): number {
  if (digitos <= 0) return 0;
  let cuenta = 0;
  for (let i = 0; i < texto.length; i += 1) {
    if (texto.charCodeAt(i) >= 48 && texto.charCodeAt(i) <= 57) {
      cuenta += 1;
      if (cuenta === digitos) {
        let posicion = i + 1;
        while (texto.charAt(posicion) === "-" || texto.charAt(posicion) === " ") posicion += 1;
        return posicion;
      }
    }
  }
  return texto.length;
}

export interface EdicionCedula {
  /** Solo dígitos, máximo 11. */
  digitos: string;
  /** Dígitos a la izquierda del cursor tras la edición. */
  cursor: number;
}

/**
 * Lee una edición del input con máscara: el texto del navegador se sanea a
 * dígitos (pegar con guiones o espacios no trunca porque el corte se hace
 * después de limpiar) y el cursor se mide en dígitos para restaurarlo sobre el
 * valor ya formateado.
 */
export function editarCedula(textoNuevo: string, cursorNuevo: number): EdicionCedula {
  const digitos = textoNuevo.replace(/\D/g, "").slice(0, 11);
  return { digitos, cursor: Math.min(digitosAntesDeCursor(textoNuevo, cursorNuevo), digitos.length) };
}

/**
 * Backspace/Delete pegado a un guion de la máscara. El navegador borraría solo
 * el guion, el saneado a dígitos no cambiaría y React volvería a escribir el
 * mismo texto: parecía que la tecla no hacía nada. Aquí se borra el dígito
 * vecino del guion y el cursor queda donde el usuario espera.
 */
export function borrarSobreGuion(
  digitos: string,
  texto: string,
  cursor: number,
  tecla: "Backspace" | "Delete",
): EdicionCedula | null {
  if (tecla === "Backspace" && texto.charAt(cursor - 1) === "-") {
    const antes = digitosAntesDeCursor(texto, cursor);
    return { digitos: digitos.slice(0, antes - 1) + digitos.slice(antes), cursor: antes - 1 };
  }
  if (tecla === "Delete" && texto.charAt(cursor) === "-") {
    const antes = digitosAntesDeCursor(texto, cursor);
    return { digitos: digitos.slice(0, antes) + digitos.slice(antes + 1), cursor: antes };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Nombre de la DGII → campos del empleado
// ---------------------------------------------------------------------------

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e"]);

function aNombrePropio(texto: string): string {
  return texto
    .split(" ")
    .map((palabra) => {
      const minuscula = palabra.toLocaleLowerCase("es-DO");
      if (PARTICULAS.has(minuscula)) return minuscula;
      return minuscula.charAt(0).toLocaleUpperCase("es-DO") + minuscula.slice(1);
    })
    .join(" ");
}

export interface PartesNombreDgii {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
}

/**
 * Reparte el nombre que devuelve la DGII en los cuatro campos del empleado.
 * El portal la registra en mayúsculas como «NOMBRES APELLIDOS» (la mayoría:
 * dos nombres y dos apellidos) o «APELLIDOS, NOMBRES». La repartición de casos
 * ambiguos (un solo nombre, apellidos compuestos) es razonable, no exacta:
 * queda a revisión del usuario.
 */
export function repartirNombreDgii(nombre: string): PartesNombreDgii {
  const partes: PartesNombreDgii = { primerNombre: "", segundoNombre: "", primerApellido: "", segundoApellido: "" };
  const limpio = nombre.replace(/\s+/g, " ").trim();
  if (limpio === "") return partes;

  let nombres: string[] = [];
  let apellidos: string[] = [];
  const coma = limpio.indexOf(",");

  if (coma >= 0) {
    apellidos = limpio.slice(0, coma).trim().split(" ").filter(Boolean);
    nombres = limpio
      .slice(coma + 1)
      .trim()
      .split(" ")
      .filter(Boolean);
  } else {
    const tokens = limpio.split(" ").filter(Boolean);
    if (tokens.length <= 2) {
      nombres = tokens.slice(0, 1);
      apellidos = tokens.slice(1);
    } else if (tokens.length === 3) {
      // Un nombre y los dos apellidos: lo más común en la cédula dominicana.
      nombres = tokens.slice(0, 1);
      apellidos = tokens.slice(1);
    } else {
      // 4+ tokens: dos nombres; si el segundo empieza con partícula («de los
      // Angeles», «del Carmen») se extiende hasta su núcleo.
      let corte = 2;
      if (PARTICULAS.has(tokens[1]?.toLocaleLowerCase("es-DO") ?? "")) {
        corte = tokens.length;
        for (let i = 1; i < tokens.length; i += 1) {
          const token = tokens[i]?.toLocaleLowerCase("es-DO") ?? "";
          if (!PARTICULAS.has(token)) {
            corte = i + 1;
            break;
          }
        }
      }
      nombres = tokens.slice(0, corte);
      apellidos = tokens.slice(corte);
    }
  }

  partes.primerNombre = aNombrePropio(nombres[0] ?? "");
  partes.segundoNombre = aNombrePropio(nombres.slice(1).join(" "));

  if (apellidos.length > 0 && PARTICULAS.has(apellidos[0]?.toLocaleLowerCase("es-DO") ?? "")) {
    // «de los Santos» completo es el primer apellido.
    partes.primerApellido = aNombrePropio(apellidos.join(" "));
  } else {
    partes.primerApellido = aNombrePropio(apellidos[0] ?? "");
    partes.segundoApellido = aNombrePropio(apellidos.slice(1).join(" "));
  }

  return partes;
}

const CAMPOS_NOMBRE = ["primerNombre", "segundoNombre", "primerApellido", "segundoApellido"] as const;

/**
 * Decide qué campos del empleado se completan con la respuesta de la DGII.
 * Nunca pisa lo que el usuario escribió: solo rellena campos vacíos o los que
 * puso una consulta anterior (`rellenos`), como hace el formulario de
 * contactos con el RNC.
 */
export function completarEmpleadoConDgii(
  datos: DatosContribuyenteDgii,
  escritos: PartesNombreDgii,
  rellenos: PartesNombreDgii,
): { campos: Partial<PartesNombreDgii>; mensaje: string } {
  const propuestos = repartirNombreDgii(datos.nombre);
  const campos: Partial<PartesNombreDgii> = {};

  for (const clave of CAMPOS_NOMBRE) {
    if (propuestos[clave] === "") continue;
    if (escritos[clave].trim() === "" || escritos[clave] === rellenos[clave]) {
      campos[clave] = propuestos[clave];
    }
  }

  if (Object.keys(campos).length === 0) {
    const coincide = CAMPOS_NOMBRE.every((clave) => propuestos[clave] === "" || escritos[clave] === propuestos[clave]);
    if (coincide) {
      return { campos, mensaje: "El nombre ya coincide con el de la DGII." };
    }
    return {
      campos,
      mensaje: `La DGII encontró ${aNombrePropio(datos.nombre)}; no se cambió lo que ya tenías escrito.`,
    };
  }

  return { campos, mensaje: "Datos de la DGII: se completó el nombre." };
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
