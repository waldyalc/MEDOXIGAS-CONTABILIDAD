import { describe, expect, it } from "vitest";

import { type ValoresEmpleado, validarPasoEmpleado } from "./wizard-validacion";

const BASE: ValoresEmpleado = {
  tipo_identificacion: "cedula",
  identificacion: "00112345678",
  primer_nombre: "Ana",
  primer_apellido: "Pérez",
  correo: "",
  tipo_contrato: "indefinido",
  fecha_ingreso: "2026-11-02",
  fecha_fin: "",
  frecuencia_pago: "quincenal",
  salario_mensual: "60000",
  segmento_contable: "administrativa",
  metodo_pago: "efectivo",
  banco_nombre: "",
  tipo_cuenta_banco: "",
  numero_cuenta_banco: "",
  clave_tss: "",
};

function campos(errores: readonly { campo: string }[]): string[] {
  return errores.map((error) => error.campo);
}

describe("validación del wizard de empleado", () => {
  it("el paso 1 exige cédula de 11 dígitos", () => {
    const errores = validarPasoEmpleado(1, { ...BASE, identificacion: "0011234567" });
    expect(campos(errores)).toContain("identificacion");
    expect(errores[0]?.mensaje).toBe("La cédula debe tener 11 dígitos.");
  });

  it("un pasaporte no se valida como cédula pero sí exige texto", () => {
    expect(validarPasoEmpleado(1, { ...BASE, tipo_identificacion: "pasaporte", identificacion: "AB123" })).toEqual([]);
    expect(campos(validarPasoEmpleado(1, { ...BASE, tipo_identificacion: "pasaporte", identificacion: "" }))).toContain(
      "identificacion",
    );
  });

  it("el correo opcional debe tener formato si viene", () => {
    expect(campos(validarPasoEmpleado(1, { ...BASE, correo: "ana@" }))).toEqual(["correo"]);
  });

  it("el contrato definido exige fecha de fin y no puede ser anterior al ingreso", () => {
    expect(campos(validarPasoEmpleado(2, { ...BASE, tipo_contrato: "definido" }))).toEqual(["fecha_fin"]);
    expect(
      campos(
        validarPasoEmpleado(2, {
          ...BASE,
          tipo_contrato: "definido",
          fecha_fin: "2026-10-30",
        }),
      ),
    ).toEqual(["fecha_fin"]);
  });

  it("el salario debe ser mayor que cero", () => {
    expect(campos(validarPasoEmpleado(2, { ...BASE, salario_mensual: "0" }))).toEqual(["salario_mensual"]);
    expect(validarPasoEmpleado(2, { ...BASE, salario_mensual: "60,000.00" })).toEqual([]);
  });

  it("la transferencia exige banco, tipo y número de cuenta", () => {
    const errores = validarPasoEmpleado(3, { ...BASE, metodo_pago: "transferencia" });
    expect(campos(errores)).toEqual(["banco_nombre", "tipo_cuenta_banco", "numero_cuenta_banco"]);
  });

  it("un pago en efectivo no exige datos bancarios", () => {
    expect(validarPasoEmpleado(3, BASE)).toEqual([]);
  });

  it("la clave TSS, si viene, tiene exactamente 3 dígitos", () => {
    expect(campos(validarPasoEmpleado(3, { ...BASE, clave_tss: "12" }))).toEqual(["clave_tss"]);
    expect(validarPasoEmpleado(3, { ...BASE, clave_tss: "123" })).toEqual([]);
  });

  it("el paso 3 revalida los pasos anteriores antes de guardar", () => {
    expect(campos(validarPasoEmpleado(3, { ...BASE, primer_nombre: "" }))).toEqual(["primer_nombre"]);
  });
});
