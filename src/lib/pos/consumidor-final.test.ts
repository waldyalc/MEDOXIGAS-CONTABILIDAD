import { describe, expect, it } from "vitest";

import {
  contactoDePestanaRestaurada,
  contactoInicialPOS,
  esComprobanteCreditoFiscal,
  esConsumidorFinalPOS,
  esConsumidorFinalPorRnc,
  etiquetaContactoPOS,
  normalizarRnc,
  RNC_CONSUMIDOR_FINAL,
} from "./consumidor-final";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Candado de MSG-33 (decisión de Waldy): cada venta nueva del POS arranca con
 * «Consumidor final», como Alegra. Se busca por su RNC normalizado, sin
 * migraciones ni ids fijos; la X lo quita y la siguiente venta lo vuelve a
 * poner. El comprobante 01 (Crédito fiscal) avisa que necesita un cliente con
 * RNC.
 *
 * Candado de MSG-44: el selector pinta al Consumidor final solo con su nombre,
 * nunca «Consumidor Final (22222222222)»; los demás clientes conservan
 * «Nombre (RNC)».
 */

const POS = join(process.cwd(), "src", "app", "(pos)", "pos");
const CONSUMIDOR = "a2021d74-9462-4cbf-8951-45e1bada4159";

function leer(...partes: string[]): string {
  return readFileSync(join(...partes), "utf8");
}

describe("cliente inicial del POS", () => {
  it("normaliza el RNC para encontrar el mismo contacto escrito con guiones", () => {
    expect(normalizarRnc("22222222222")).toBe(RNC_CONSUMIDOR_FINAL);
    expect(normalizarRnc("222-2222222-2")).toBe(RNC_CONSUMIDOR_FINAL);
    expect(normalizarRnc(null)).toBe("");
    expect(normalizarRnc("")).toBe("");
  });

  it("una venta nueva arranca con el Consumidor final y cae a la terminal si no existe", () => {
    expect(contactoInicialPOS(CONSUMIDOR, "contacto-terminal")).toBe(CONSUMIDOR);
    expect(contactoInicialPOS(null, "contacto-terminal")).toBe("contacto-terminal");
  });

  it("solo el comprobante 01 es Crédito fiscal", () => {
    expect(esComprobanteCreditoFiscal("01")).toBe(true);
    expect(esComprobanteCreditoFiscal("02")).toBe(false);
    expect(esComprobanteCreditoFiscal("14")).toBe(false);
    expect(esComprobanteCreditoFiscal(undefined)).toBe(false);
  });

  it("reconoce al Consumidor final sin confundirlo con otro cliente", () => {
    expect(esConsumidorFinalPOS(CONSUMIDOR, CONSUMIDOR)).toBe(true);
    expect(esConsumidorFinalPOS("otro-cliente", CONSUMIDOR)).toBe(false);
    expect(esConsumidorFinalPOS(CONSUMIDOR, null)).toBe(false);
  });

  it("reconoce al Consumidor final por su RNC normalizado", () => {
    expect(esConsumidorFinalPorRnc("22222222222")).toBe(true);
    expect(esConsumidorFinalPorRnc("222-2222222-2")).toBe(true);
    expect(esConsumidorFinalPorRnc("130999888")).toBe(false);
    expect(esConsumidorFinalPorRnc(null)).toBe(false);
    expect(esConsumidorFinalPorRnc("")).toBe(false);
  });

  it("una pestaña restaurada sin líneas vuelve al Consumidor final, no a la anterior", () => {
    const vacia = { contactoId: "", lineas: [], cotizacion: null };
    const conLineas = { contactoId: "", lineas: ["Cilindro"], cotizacion: null };
    const conCotizacion = { contactoId: "", lineas: [], cotizacion: { id: "cotizacion" } };

    expect(contactoDePestanaRestaurada(vacia, CONSUMIDOR)).toBe(CONSUMIDOR);
    expect(contactoDePestanaRestaurada(conLineas, CONSUMIDOR)).toBe("");
    expect(contactoDePestanaRestaurada(conCotizacion, CONSUMIDOR)).toBe("");
  });
});

describe("etiqueta del cliente en el selector del POS", () => {
  it("el Consumidor final se pinta solo con su nombre, sin el RNC genérico entre paréntesis", () => {
    expect(etiquetaContactoPOS({ nombre: "Consumidor Final", rnc_cedula: RNC_CONSUMIDOR_FINAL }, true)).toBe(
      "Consumidor Final",
    );
    expect(etiquetaContactoPOS({ nombre: "Consumidor Final", rnc_cedula: "222-2222222-2" }, true)).toBe(
      "Consumidor Final",
    );
    expect(etiquetaContactoPOS({ nombre: "Consumidor Final", rnc_cedula: RNC_CONSUMIDOR_FINAL }, true)).not.toContain(
      "(",
    );
  });

  it("los demás clientes siguen con «Nombre (RNC)» y sin la bandera se muestra solo el nombre", () => {
    expect(etiquetaContactoPOS({ nombre: "Clínica Unión", rnc_cedula: "130999888" }, true)).toBe(
      "Clínica Unión (130999888)",
    );
    expect(etiquetaContactoPOS({ nombre: "Clínica Unión", rnc_cedula: "130999888" }, false)).toBe("Clínica Unión");
    expect(etiquetaContactoPOS({ nombre: "Juan Pérez", rnc_cedula: null }, true)).toBe("Juan Pérez");
    expect(etiquetaContactoPOS({ nombre: "Juan Pérez", rnc_cedula: null }, false)).toBe("Juan Pérez");
  });
});

describe("candados de la venta nueva con Consumidor final", () => {
  it("la venta principal y las pestañas nuevas se crean con los defaults del POS", () => {
    const provider = leer(POS, "_components", "carrito-pos-provider.tsx");

    expect(provider, "La primera pestaña debe crearse con los defaults (que ya traen el Consumidor final)").toContain(
      'crearPestana("Venta principal", defaults, ID_PESTANA_PRINCIPAL)',
    );
    expect(provider, "Cada pestaña nueva debe crearse con los mismos defaults").toContain(
      "crearPestana(siguienteNombre(pestanas), defaults)",
    );
    expect(provider, "Al vaciar o cobrar una venta, el contacto debe volver al default (Consumidor final)").toMatch(
      /vaciarPestana[\s\S]*?contactoId: defaults\.contactoId/,
    );
    expect(provider, "Al cobrar, el contacto debe volver al default (Consumidor final)").toMatch(
      /reiniciarTrasVenta[\s\S]*?contactoId: defaults\.contactoId/,
    );
    expect(provider, "Una venta restaurada sin líneas debe volver al contacto inicial").toContain(
      "contactoDePestanaRestaurada(restaurada, defaults.contactoId)",
    );
  });

  it("el layout resuelve el Consumidor final por RNC y lo usa como contacto inicial", () => {
    const layout = leer(POS, "layout.tsx");
    const consultas = leer("src", "lib", "pos", "consultas.ts");

    expect(layout, "El layout debe pedir el Consumidor final por RNC").toContain("getConsumidorFinalId()");
    expect(layout, "El default del carrito debe ser el Consumidor final, con la terminal como respaldo").toContain(
      "contactoId: contactoInicialPOS(consumidorFinalId, terminal.contacto_defecto_id)",
    );
    expect(consultas, "La búsqueda debe ser idempotente por el RNC normalizado, no por un id fijo").toContain(
      '.eq("rnc_cedula", RNC_CONSUMIDOR_FINAL)',
    );
  });

  it("el panel muestra lápiz y X junto a la flecha, con el RNC de los clientes normales", () => {
    const panel = leer(POS, "_components", "vender", "panel-factura.tsx");
    const selector = leer("src", "components", "contactos", "selector-contacto.tsx");

    expect(panel, "El selector del POS debe mostrar «Nombre (RNC)» a los clientes normales").toContain(
      "mostrarRncEnValor",
    );
    expect(panel, "El lápiz abre la ficha del cliente").toContain('aria-label="Editar cliente"');
    expect(panel, "La X quita el cliente sin ocultar la flecha").toContain('aria-label="Quitar cliente"');
    expect(panel, "La X limpia el contacto del carrito").toContain('carrito.setContacto("")');
    expect(selector, "El selector debe aceptar acciones junto a la flecha").toContain("acciones?:");
    expect(
      selector,
      "La etiqueta debe salir de etiquetaContactoPOS; pegarla a mano devuelve «Consumidor Final (22222222222)»",
    ).toContain("etiquetaContactoPOS(contacto, mostrarRncEnValor)");
    expect(
      selector,
      "No vuelvas a pegar el RNC con paréntesis: el Consumidor final debe verse solo «Consumidor Final»",
    ).not.toContain("contacto.nombre} (");
    expect(selector, "El desplegable tampoco debe repetir el RNC genérico bajo «Consumidor Final»").toContain(
      "!(mostrarRncEnValor && esConsumidorFinalPorRnc(contacto.rnc_cedula))",
    );
  });

  it("avisa cuando se elige Crédito fiscal (01) con Consumidor final", () => {
    const panel = leer(POS, "_components", "vender", "panel-factura.tsx");

    expect(panel, "El aviso debe salir al elegir la numeración 01").toContain("esComprobanteCreditoFiscal");
    expect(panel, "El aviso debe comprobar que el cliente es el Consumidor final").toContain(
      "esConsumidorFinalPOS(activa.contactoId, consumidorFinalId)",
    );
    expect(panel, "El mensaje debe explicar que el Crédito fiscal (01) necesita un cliente con RNC").toContain(
      "El Crédito fiscal (01) necesita un cliente con RNC. Elige un cliente o cambia la numeración.",
    );
  });

  it("el cobro compara contra el Consumidor final resuelto por RNC", () => {
    const checkout = leer(POS, "_components", "vender", "checkout-pos.tsx");

    expect(checkout, "El cobro debe usar el mismo Consumidor final que la venta").toContain(
      "esConsumidorFinalPOS(activa.contactoId, consumidorFinalId)",
    );
    expect(checkout, "El aviso de crédito sigue saliendo antes de completarVenta").toContain(
      "if (porCobrarVisible && esConsumidorFinal)",
    );
    expect(checkout, "El contexto de la venta debe llevar el Consumidor final para validar el crédito").toContain(
      "contacto_defecto_id: cotizacion ? null : (consumidorFinalId ?? terminal.contacto_defecto_id)",
    );
  });
});
