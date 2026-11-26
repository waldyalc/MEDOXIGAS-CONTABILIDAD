import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const VENDER = join(process.cwd(), "src", "app", "(pos)", "pos", "_components", "vender");
const PANEL = readFileSync(join(VENDER, "panel-factura.tsx"), "utf8");
const OVERLAY = readFileSync(join(VENDER, "mas-opciones-pos.tsx"), "utf8");

function bloqueOpciones(): string {
  const inicio = PANEL.indexOf("const opcionesMas");
  if (inicio < 0) return "";
  return PANEL.slice(inicio, PANEL.indexOf("];", inicio));
}

/**
 * Candado de MSG-34 (decisión de Waldy, 23-11-2026): el botón ⋯ de la barra
 * de cobro abre un panel grande que tapa todo el carrito, no una listita.
 * Abrir y cerrar solo cambia la vista; la venta se conserva.
 */
describe("panel «Más opciones» del carrito POS", () => {
  it("las tres acciones salen de un arreglo de configuración con etiqueta e ícono", () => {
    const bloque = bloqueOpciones();

    expect(bloque, "No existe el arreglo opcionesMas en panel-factura.tsx").not.toBe("");

    const etiquetas = [...bloque.matchAll(/etiqueta: "([^"]+)"/g)].map((coincidencia) => coincidencia[1]);
    expect(
      etiquetas,
      "El panel ⋯ tiene que ofrecer «Guardar cotización», «Cargar cotización» e «Historial de ventas», en ese orden; sumar una opción es sumar una línea al arreglo.",
    ).toEqual(["Guardar cotización", "Cargar cotización", "Historial de ventas"]);

    for (const icono of ["FileText", "FolderOpen", "Receipt"]) {
      expect(bloque, `Falta el ícono ${icono} en opcionesMas: cada cuadro lleva su ícono encima del nombre.`).toContain(
        `Icono: ${icono}`,
      );
    }

    expect(
      PANEL,
      "La listita del DropdownMenu se reemplazó por el panel grande: no vuelvas a «Guardar como cotización» como item de menú",
    ).not.toContain("Guardar como cotización");
    expect(
      PANEL,
      "El botón ⋯ ya no se llama «Más funciones»: el panel que abre se titula «Más opciones»",
    ).not.toContain("Más funciones");
  });

  it("el panel tapa todo el carrito con cuadros grandes en cuadrícula y tokens del POS", () => {
    const aside = PANEL.slice(PANEL.indexOf("<aside"), PANEL.indexOf(">", PANEL.indexOf("<aside")));
    expect(aside, "El aside del carrito necesita `relative` para que el panel absoluto lo tape completo").toContain(
      "relative",
    );
    expect(PANEL, "El panel del carrito debe renderizar MasOpcionesPos dentro del mismo aside").toContain(
      "<MasOpcionesPos",
    );

    expect(OVERLAY, "El panel de opciones debe cubrir todo el carrito: absolute inset-0, no un dropdown").toContain(
      "absolute inset-0",
    );
    expect(OVERLAY, "Los cuadros van en cuadrícula de 2–3 columnas").toContain("grid-cols-2");
    expect(OVERLAY, "En escritorio la cuadrícula es de 3 columnas").toContain("sm:grid-cols-3");
    expect(OVERLAY, "Cada cuadro debe ser cómodo al tacto (mínimo 116 px de alto)").toContain("min-h-[116px]");
    expect(OVERLAY, "El cuerpo va sobre --pos-panel, como el resto del carrito").toContain("bg-pos-panel");
    expect(OVERLAY, "El encabezado debe decir «Más opciones»").toContain("Más opciones");
    expect(OVERLAY, "El panel debe usar los tokens --pos-* de marca, no --primary directo").not.toMatch(
      /#1e56c7|(?:bg|text|border|ring)-primary\b/,
    );
  });

  it("la X y Esc cierran el panel sin tocar la venta", () => {
    expect(OVERLAY, "La X debe llamarse «Volver al carrito» para lectores de pantalla").toContain(
      'aria-label="Volver al carrito"',
    );
    expect(OVERLAY, "Esc debe cerrar el panel").toContain('evento.key !== "Escape"');
    expect(OVERLAY, "El panel no conoce el carrito: no puede vaciar ni editar líneas al abrir o cerrar").not.toContain(
      "useCarritoPOS",
    );

    const inicio = PANEL.indexOf("const cerrarMasOpciones");
    const cierre = PANEL.slice(inicio, PANEL.indexOf("}, []);", inicio));
    expect(inicio, "No existe cerrarMasOpciones en panel-factura.tsx").toBeGreaterThan(-1);
    expect(cierre, "Cerrar el panel solo cambia la vista y devuelve el foco al botón ⋯").toContain(
      "setMasOpciones(false)",
    );
    expect(cierre, "Cerrar el panel no debe tocar el carrito (ni vaciarPestana ni setContacto…)").not.toContain(
      "carrito",
    );
  });
});
