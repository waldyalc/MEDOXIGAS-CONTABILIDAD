import { describe, expect, test, vi } from "vitest";

import type { ResultadoConsultaDgii, TipoDocumentoDgii } from "./consulta";

/**
 * Prueba real contra el portal de la DGII. No corre en el suite normal porque
 * depende de un servicio externo: se pide a mano con
 *
 *   DGII_LIVE=1 pnpm exec vitest run src/lib/dgii/consulta.live.test.ts
 *
 * Comprueba los dos RNC de Medoxigas (17/11/2026). El portal falla de forma
 * intermitente, así que la prueba reintenta la consulta completa con la caché
 * en blanco: lo que se verifica es que el flujo real de la app devuelve el dato.
 */
const EN_VIVO = process.env.DGII_LIVE === "1";

async function consultarEnVivo(tipo: TipoDocumentoDgii, numero: string): Promise<ResultadoConsultaDgii> {
  let ultimo: ResultadoConsultaDgii = { ok: false, error: "sin_respuesta" };

  for (let ronda = 1; ronda <= 3; ronda++) {
    vi.resetModules();
    const { consultarDgii } = await import("./consulta");
    ultimo = await consultarDgii(tipo, numero);
    if (ultimo.ok) return ultimo;
    // "no encontrado" es justo la respuesta falsa que se corrigió: no se reintenta.
    if (ultimo.error === "no_encontrado" || ultimo.error === "documento_invalido") return ultimo;
  }

  return ultimo;
}

describe.skipIf(!EN_VIVO)("consulta real a la DGII", () => {
  test("131488791 devuelve OXYMAT SRL activo", { timeout: 120_000 }, async () => {
    const resultado = await consultarEnVivo("rnc", "131488791");
    expect(resultado.ok, JSON.stringify(resultado)).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.datos.nombre).toBe("OXYMAT SRL");
    expect(resultado.datos.nombreComercial).toBe("OXYMAT");
    expect(resultado.datos.estado).toBe("ACTIVO");
  });

  test("130893489 devuelve MEDOXIGAS ALC SRL activo", { timeout: 120_000 }, async () => {
    const resultado = await consultarEnVivo("rnc", "130893489");
    expect(resultado.ok, JSON.stringify(resultado)).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.datos.nombre).toBe("MEDOXIGAS ALC SRL");
    expect(resultado.datos.estado).toBe("ACTIVO");
  });

  test("un RNC que no existe se reporta como no encontrado", { timeout: 120_000 }, async () => {
    const resultado = await consultarEnVivo("rnc", "131488792");
    expect(resultado).toEqual({ ok: false, error: "no_encontrado" });
  });
});
