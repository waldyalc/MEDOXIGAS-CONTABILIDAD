import { describe, expect, it } from "vitest";

import { prepararCierre } from "./impresion-cierre";
import { cierreEjemplo } from "./pruebas/ejemplos";
import { readFileSync } from "node:fs";

const leer = (ruta: string) => readFileSync(new URL(`../../${ruta}`, import.meta.url), "utf8");

describe("presentación del cierre POS", () => {
  it("separa tarjetas por cuentas distintas y conciliadas sin duplicar el total", () => {
    const datos = cierreEjemplo();
    datos.resumen.ventas.por_metodo.tarjeta = "30.30";
    datos.resumen.ventas.por_cuenta = [
      { cuenta_id: "debito", cuenta_nombre: null, metodo: "tarjeta", monto: "10.10" },
      { cuenta_id: "debito", cuenta_nombre: null, metodo: "tarjeta", monto: "5.05" },
      { cuenta_id: "credito", cuenta_nombre: null, metodo: "tarjeta", monto: "15.15" },
    ];
    const terminal = {
      id: datos.turno.terminal_id,
      cuenta_tarjeta_debito_id: "debito",
      cuenta_tarjeta_credito_id: "credito",
    };
    expect(prepararCierre(datos, [terminal]).tarjetas).toEqual({ debito: "RD$15.15", credito: "RD$15.15" });
    expect(prepararCierre(datos, [{ ...terminal, cuenta_tarjeta_credito_id: "debito" }]).tarjetas).toBeNull();
    expect(prepararCierre(datos, []).tarjeta).toBe("RD$30.30");
    datos.resumen.ventas.por_metodo.tarjeta = "31.00";
    expect(prepararCierre(datos, [terminal]).tarjetas).toBeNull();
  });

  it("presenta retiros negativos entre paréntesis y conserva contado, esperado y observaciones", () => {
    const datos = cierreEjemplo();
    datos.turno.abierto_en = "2026-11-21T13:23:00Z";
    datos.turno.cerrado_en = "2026-11-22T22:21:00Z";
    datos.turno.observaciones = "Conteo verificado";
    datos.resumen.retiros.total = "500.00";
    datos.resumen.efectivo.efectivo_real = "2100.00";
    datos.resumen.efectivo.efectivo_esperado = "2141.60";
    expect(prepararCierre(datos, [])).toMatchObject({
      inicio: "21/11/2026 9:23 am",
      fin: "22/11/2026 6:21 pm",
      retiros: "(-RD$500.00)",
      contado: "RD$2,100.00",
      movimientos: "RD$2,141.60",
      observaciones: "Conteo verificado",
    });
    datos.resumen.efectivo.efectivo_real = null;
    datos.turno.observaciones = " ";
    expect(prepararCierre(datos, [])).toMatchObject({ contado: "RD$2,141.60", observaciones: "-" });
  });
  it("pide el efectivo contado sin precargar el esperado ni mostrar diferencias prematuras", () => {
    const formulario = leer("app/(pos)/pos/_components/turnos/dialogo-cerrar-turno.tsx");
    expect(formulario).toContain('setReal("")');
    expect(formulario).not.toContain("setReal(esperado)");
    expect(formulario).toContain("realValido !== null");
    expect(formulario).toContain("Dinero en efectivo del cierre");
  });

  it("mantiene el cierre independiente de la plantilla de ventas, en una hoja de 57 × 250 mm", () => {
    const ticket = leer("components/pos/ticket-cierre-pos.tsx");
    for (const texto of [
      "Cierre No",
      "Total de ventas",
      "Base inicial",
      "Ventas en efectivo",
      "Ventas por tarjeta de débito",
      "Ventas por tarjeta de crédito",
      "Ventas por transferencias",
      "Devolución de dinero",
      "Retiros en efectivo",
      "Total de movimientos",
      "Dinero en efectivo",
      "Observaciones",
    ]) {
      expect(ticket).toContain(texto);
    }
    expect(ticket).toMatch(/@page\s*\{\s*size:\s*57mm 250mm;\s*margin:\s*0;/);
    expect(ticket).not.toMatch(/Generado en Alegra POS|OXYMAT/);
  });
});
