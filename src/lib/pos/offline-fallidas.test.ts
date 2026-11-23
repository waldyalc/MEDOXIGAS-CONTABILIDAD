import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");

describe("bandeja de ventas con problema del POS", () => {
  it("muestra el error, reintentar y descartar con confirmación en la sincronización", () => {
    const provider = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    for (const texto of [
      "Ventas con problema",
      "Reintentar",
      "Descartar",
      "¿Descartar esta venta?",
      "Sí, descartar",
      "no se podrá recuperar",
    ]) {
      expect(provider, `Falta «${texto}» en la bandeja de ventas con problema`).toContain(texto);
    }
    expect(provider).toContain("programarReintentoOffline");
    expect(provider).toContain("almacenColaOffline.eliminar");
    expect(provider).toContain("revisionCierreOffline");
  });

  it("solo permite descartar operaciones fallidas y conserva las pendientes", () => {
    const provider = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    expect(provider.match(/fila\?\.estado !== "fallida"/g)?.length ?? 0).toBe(2);
    expect(provider).toContain('operacion.estado === "fallida"');
  });

  it("el estado de la barra inferior cuenta las fallidas y abre la bandeja", () => {
    const provider = leer("src/app/(pos)/pos/_components/offline-pos-provider.tsx");
    expect(provider).toContain("venta con problema");
    expect(provider).toContain("ventas con problema");
    expect(provider).toContain("abrirPanel");
  });

  it("el cierre no se bloquea por fallidas y muestra el aviso antes y después de cerrar", () => {
    const dialogo = leer("src/app/(pos)/pos/_components/turnos/dialogo-cerrar-turno.tsx");
    expect(dialogo).toContain("offline.porSubir > 0");
    expect(dialogo).not.toContain("offline.pendientes > 0");
    expect(dialogo).toContain("avisoCierreOffline(offline.fallidas)");
    expect(dialogo).toContain("no se sumarán al cuadre");

    const turnos = leer("src/app/(pos)/pos/_components/turnos/turnos-pos.tsx");
    expect(turnos).toContain("avisoCierreOffline(offline.fallidas)");
  });
});
