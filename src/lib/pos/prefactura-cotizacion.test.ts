import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const PANEL = readFileSync(join(SRC, "app/(pos)/pos/_components/vender/panel-factura.tsx"), "utf8");
const VENDER = readFileSync(join(SRC, "app/(pos)/pos/_components/vender/vender-pos.tsx"), "utf8");
const PAGINA_COTIZACION = readFileSync(join(SRC, "app/(main)/dashboard/cotizaciones/[id]/page.tsx"), "utf8");
const PROHIBIDOS = [/Generado en Alegra POS/, /OXYMAT/i, /Fiel Ferreteria/i];

describe("impresión de prefactura y cotización (POS 10)", () => {
  it("el icono de impresora del panel abre «Imprimir vista previa», no el historial", () => {
    expect(PANEL).toContain('title="Imprimir vista previa"');
    expect(PANEL).toContain('aria-label="Imprimir vista previa"');
    expect(PANEL).toContain("armarTicketPrefactura");
    // La prefactura es solo presentación: nada de venta, NCF ni RPC aquí.
    expect(PANEL).not.toContain("completarVenta");
    expect(PANEL).not.toContain("venderPOS");
  });

  it("el portal de impresión vive en vender-pos, no dentro del panel condicional", () => {
    // matchMedia("(min-width: 1024px)") se evalúa con el ancho del papel al
    // imprimir: esEscritorio pasa a falso y un ImpresionPos dentro de
    // PanelFactura se desmontaría a mitad de window.print() (PDF en blanco).
    expect(PANEL).not.toContain("ImpresionPos");
    expect(PANEL).toContain("onImprimir");
    expect(VENDER).toContain("ImpresionPos");
    expect(VENDER).toContain("onImprimir={setImpresionDoc}");
  });

  it("el menú «más funciones» ofrece «Imprimir cotización» solo con cotización cargada", () => {
    expect(PANEL).toContain("Imprimir cotización");
    expect(PANEL).toContain("armarTicketCotizacionDocumento");
    expect(PANEL).toContain("disabled={cotizacion === null}");
  });

  it("la cotización guardada imprime el ticket de 80 mm sin quitar la Carta", () => {
    expect(PAGINA_COTIZACION).toContain("armarTicketCotizacionVista");
    expect(PAGINA_COTIZACION).toContain("TicketPos");
    expect(PAGINA_COTIZACION).toContain("DocumentoPapel");
  });

  it("los tres documentos nunca llevan marca de Alegra ni de otra empresa", () => {
    for (const patron of PROHIBIDOS) {
      expect(PANEL, `${patron} en panel-factura`).not.toMatch(patron);
      expect(PAGINA_COTIZACION, `${patron} en cotizaciones/[id]`).not.toMatch(patron);
    }
  });
});
