import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPORTES = join(process.cwd(), "src", "app", "(main)", "dashboard", "reportes");

const REPORTES_CON_TAMANO = [
  "cxc/page.tsx",
  "cxp/page.tsx",
  "compras/page.tsx",
  "valor-inventario/page.tsx",
  "ventas-cliente/page.tsx",
  "ventas-generales/page.tsx",
  "ventas-almacen/page.tsx",
  "ventas-producto/page.tsx",
  "rentabilidad-producto/page.tsx",
  "transacciones/page.tsx",
  "libro-diario/page.tsx",
];

const REPORTES_CON_PAGINADOR_DIRECTO = [
  "ventas-cliente/page.tsx",
  "ventas-producto/page.tsx",
  "rentabilidad-producto/page.tsx",
  "transacciones/page.tsx",
  "libro-diario/page.tsx",
  "ventas-generales/_components/tabla-ventas.tsx",
];

const REPORTES_CON_WRAPPER_CARTERA = ["cxc/page.tsx", "cxp/page.tsx", "compras/page.tsx", "valor-inventario/page.tsx"];

function fuente(ruta: string): string {
  return readFileSync(join(REPORTES, ruta), "utf8");
}

function listarTsx(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) return listarTsx(ruta);
    return entrada.name.endsWith(".tsx") && !entrada.name.includes(".test.") ? [ruta] : [];
  });
}

describe("paginación global de reportes estilo Alegra", () => {
  it("todos los reportes paginados leen el tamaño global de la URL", () => {
    for (const ruta of REPORTES_CON_TAMANO) {
      expect(fuente(ruta), ruta).toContain("leerTamanoConDefecto");
    }
    expect(fuente("ventas-cliente/page.tsx")).toContain("const TAMANO_DEFECTO = 30");
    expect(fuente("transacciones/page.tsx")).toContain("leerTamanoConDefecto(parametros, 25)");
  });

  it("los reportes renderizan PaginadorLista dentro del pie de la tarjeta", () => {
    for (const ruta of REPORTES_CON_PAGINADOR_DIRECTO) {
      const codigo = fuente(ruta);
      const paginador = codigo.indexOf("<PaginadorLista");
      expect(paginador, ruta).toBeGreaterThanOrEqual(0);
      expect(codigo.lastIndexOf("</CardContent>"), ruta).toBeGreaterThan(paginador);
      expect(codigo, ruta).toContain("resumirPagina");
      expect(codigo, ruta).toContain("opciones={TAMANOS_PAGINA}");
      expect(codigo, ruta).toContain('className="print:hidden"');
    }

    const wrapper = fuente("cxc/_components/paginador.tsx");
    expect(wrapper).toContain("<PaginadorLista");
    expect(wrapper).toContain("opciones={TAMANOS_PAGINA}");
    for (const ruta of REPORTES_CON_WRAPPER_CARTERA) {
      const codigo = fuente(ruta);
      const paginador = codigo.indexOf("<Paginador");
      expect(paginador, ruta).toBeGreaterThanOrEqual(0);
      expect(codigo, ruta).toContain("tamano={tamano}");
    }
  });

  it("no queda ningún paginador viejo hecho a mano en reportes", () => {
    const prohibidos = ["Página" + " {", "PaginacionReporte", "PaginacionLibro", "PaginacionTransacciones"];

    for (const ruta of listarTsx(REPORTES)) {
      const codigo = readFileSync(ruta, "utf8");
      for (const prohibido of prohibidos) {
        expect(codigo, `${ruta} conserva ${prohibido}`).not.toContain(prohibido);
      }
    }
  });
});
