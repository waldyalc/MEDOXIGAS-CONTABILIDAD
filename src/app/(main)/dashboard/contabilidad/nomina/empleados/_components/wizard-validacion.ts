import { parsearMonto } from "@/lib/productos/productos";
import { digitoVerificadorValido, MENSAJE_CEDULA_INVALIDA } from "@/lib/validacion/cedula";

/**
 * Validación por paso del wizard de empleado (espejo de `empleadoSchema`).
 *
 * La pantalla avisa antes de llamar y marca el paso incompleto; la RPC sigue
 * siendo la autoridad. La cédula se valida aquí por longitud y por el dígito
 * verificador DGII, con el mismo algoritmo que `_rnc_digito_valido`.
 */

export type PasoEmpleado = 1 | 2 | 3;

export interface ValoresEmpleado {
  tipo_identificacion: string;
  identificacion: string;
  primer_nombre: string;
  primer_apellido: string;
  correo: string;
  tipo_contrato: string;
  fecha_ingreso: string;
  fecha_fin: string;
  frecuencia_pago: string;
  salario_mensual: string;
  segmento_contable: string;
  metodo_pago: string;
  banco_nombre: string;
  tipo_cuenta_banco: string;
  numero_cuenta_banco: string;
  clave_tss: string;
}

export interface ErrorPaso {
  campo: string;
  mensaje: string;
}

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function vacio(valor: string): boolean {
  return valor.trim() === "";
}

function validarPasoUno(valores: ValoresEmpleado): ErrorPaso[] {
  const errores: ErrorPaso[] = [];
  const esCedula = valores.tipo_identificacion === "cedula";
  const identificacion = valores.identificacion.trim();

  if (vacio(identificacion)) {
    errores.push({ campo: "identificacion", mensaje: "La identificación es obligatoria." });
  } else if (esCedula && !/^\d{11}$/.test(identificacion)) {
    errores.push({ campo: "identificacion", mensaje: "La cédula debe tener 11 dígitos." });
  } else if (esCedula && !digitoVerificadorValido(identificacion)) {
    errores.push({ campo: "identificacion", mensaje: MENSAJE_CEDULA_INVALIDA });
  }

  if (vacio(valores.primer_nombre))
    errores.push({ campo: "primer_nombre", mensaje: "El primer nombre es obligatorio." });
  if (vacio(valores.primer_apellido)) {
    errores.push({ campo: "primer_apellido", mensaje: "El primer apellido es obligatorio." });
  }

  if (!vacio(valores.correo) && !CORREO.test(valores.correo.trim())) {
    errores.push({ campo: "correo", mensaje: "El correo no tiene un formato válido." });
  }

  return errores;
}

export function salarioValido(valor: string): boolean {
  if (vacio(valor)) return false;
  const numero = parsearMonto(valor);
  return numero !== null && numero > 0;
}

function validarFechas(valores: ValoresEmpleado): ErrorPaso[] {
  const errores: ErrorPaso[] = [];

  if (vacio(valores.fecha_ingreso)) {
    errores.push({ campo: "fecha_ingreso", mensaje: "La fecha de ingreso es obligatoria." });
  }
  if (valores.tipo_contrato === "definido" && vacio(valores.fecha_fin)) {
    errores.push({ campo: "fecha_fin", mensaje: "El contrato definido necesita una fecha de fin." });
  }
  if (!vacio(valores.fecha_fin) && !vacio(valores.fecha_ingreso) && valores.fecha_fin < valores.fecha_ingreso) {
    errores.push({ campo: "fecha_fin", mensaje: "La fecha de fin no puede ser anterior a la fecha de ingreso." });
  }

  return errores;
}

function validarPasoDos(valores: ValoresEmpleado): ErrorPaso[] {
  const errores: ErrorPaso[] = [];

  if (vacio(valores.tipo_contrato))
    errores.push({ campo: "tipo_contrato", mensaje: "El tipo de contrato es obligatorio." });
  errores.push(...validarFechas(valores));
  if (vacio(valores.frecuencia_pago)) {
    errores.push({ campo: "frecuencia_pago", mensaje: "La frecuencia de pago es obligatoria." });
  }
  if (!salarioValido(valores.salario_mensual)) {
    errores.push({ campo: "salario_mensual", mensaje: "El salario mensual debe ser mayor que cero." });
  }
  if (vacio(valores.segmento_contable)) {
    errores.push({ campo: "segmento_contable", mensaje: "El segmento contable es obligatorio." });
  }

  return errores;
}

function validarTransferencia(valores: ValoresEmpleado): ErrorPaso[] {
  if (valores.metodo_pago !== "transferencia") return [];

  const errores: ErrorPaso[] = [];
  const mensaje = "Si el pago es por transferencia, indica el banco, el tipo y el número de cuenta.";

  if (vacio(valores.banco_nombre)) errores.push({ campo: "banco_nombre", mensaje });
  if (vacio(valores.tipo_cuenta_banco)) errores.push({ campo: "tipo_cuenta_banco", mensaje });
  if (vacio(valores.numero_cuenta_banco)) errores.push({ campo: "numero_cuenta_banco", mensaje });

  return errores;
}

function validarPasoCompleto(valores: ValoresEmpleado): ErrorPaso[] {
  const errores = [...validarPasoUno(valores), ...validarPasoDos(valores), ...validarTransferencia(valores)];

  if (!vacio(valores.clave_tss) && !/^\d{3}$/.test(valores.clave_tss)) {
    errores.push({ campo: "clave_tss", mensaje: "La clave TSS debe tener 3 dígitos." });
  }

  if (valores.metodo_pago === "transferencia" && !vacio(valores.numero_cuenta_banco)) {
    const cuenta = valores.numero_cuenta_banco.replace(/\s/g, "");
    if (!/^[\d-]+$/.test(cuenta)) {
      errores.push({
        campo: "numero_cuenta_banco",
        mensaje: "El número de cuenta solo admite dígitos y guiones.",
      });
    }
  }

  return errores;
}

/** Errores del paso, en el orden en que aparecen en pantalla. */
export function validarPasoEmpleado(paso: PasoEmpleado, valores: ValoresEmpleado): ErrorPaso[] {
  if (paso === 1) return validarPasoUno(valores);
  if (paso === 2) return validarPasoDos(valores);
  return validarPasoCompleto(valores);
}

/** Campos del formulario a los que pertenece un mensaje de error del servidor. */
export function camposConMensaje(mensaje: string): Record<string, string> {
  const texto = mensaje.toLowerCase();
  if (texto.includes("cédula") || texto.includes("cedula") || texto.includes("identificaci")) {
    return { identificacion: mensaje };
  }
  if (texto.includes("correo")) return { correo: mensaje };
  if (texto.includes("transferencia")) {
    return { banco_nombre: mensaje, tipo_cuenta_banco: mensaje, numero_cuenta_banco: mensaje };
  }
  if (texto.includes("fecha de fin")) return { fecha_fin: mensaje };
  if (texto.includes("salario")) return { salario_mensual: mensaje };
  return {};
}

/** Paso al que pertenece el primer campo con error del servidor. */
export function pasoDeError(campos: Record<string, string>): PasoEmpleado | null {
  const paso1 = ["identificacion", "correo", "primer_nombre", "primer_apellido"];
  if (paso1.some((campo) => campo in campos)) return 1;

  const paso2 = ["fecha_ingreso", "fecha_fin", "salario_mensual"];
  if (paso2.some((campo) => campo in campos)) return 2;

  const paso3 = ["banco_nombre", "tipo_cuenta_banco", "numero_cuenta_banco", "clave_tss"];
  if (paso3.some((campo) => campo in campos)) return 3;

  return null;
}
