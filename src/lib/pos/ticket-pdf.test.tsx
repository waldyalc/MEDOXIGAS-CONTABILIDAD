import { chromium } from "@playwright/test";
import tailwind from "@tailwindcss/postcss";
import postcss from "postcss";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { TicketCierrePos } from "@/components/pos/ticket-cierre-pos";
import { TicketPos } from "@/components/pos/ticket-pos";

import { armarTicketCotizacion, armarTicketFactura, armarTicketPrefactura } from "./impresion";
import { prepararCierre } from "./impresion-cierre";
import { cierreEjemplo, cotizacionEjemplo, ventaEjemplo } from "./pruebas/ejemplos";
import { PLANTILLA_TICKET_DEFECTO } from "./tipos";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const FACTOR_CAJA_ARIAL = 1.1171875;

function comprobarPalabra(xml: string, palabra: string, puntos: number) {
  const cajas = [
    ...xml.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]+)<\/word>/g),
  ];
  const candidatas = cajas.filter((caja) => caja[5] === palabra);
  expect(candidatas.length, `Falta ${palabra}: el PDF no puede estar vacío`).toBeGreaterThan(0);
  expect(
    candidatas.some((caja) => Math.abs((Number(caja[4]) - Number(caja[2])) / FACTOR_CAJA_ARIAL - puntos) <= 0.3),
    `${palabra} debe medir ${puntos} pt ±0.3. Ajustar la plantilla, nunca el PDF ni el factor métrico de Arial.`,
  ).toBe(true);
}

test("MSG-22: genera cuatro PDFs reales con tipografía exacta y papel térmico", async () => {
  const directorio = mkdtempSync(path.join(tmpdir(), "pos-pdf-"));
  const navegador = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const css = await postcss([tailwind()]).process('@import "tailwindcss"; @source "./src/components/pos";', {
      from: path.resolve("ticket-test.css"),
    });
    const venta = ventaEjemplo();
    const empresa = {
      ...venta.empresa,
      id: 1,
      nombre: "EMPRESA",
      rnc: "130893489",
      sucursal: "Principal",
      regimen: "General",
      direccion: "DIRECCION",
      telefono: "8090000000",
      correo: "empresa@example.test",
      logo_url:
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="698" height="209"><rect width="698" height="209" fill="black"/></svg>',
    };
    const contacto = { ...venta.contacto, nombre: "CLIENTE", direccion: "DOMICILIO" };
    const lineas = venta.lineas.map((linea) => ({ ...linea, descripcion: "PRODUCTO" }));
    const configurada = { ...venta, empresa, contacto, lineas };
    const presentacion = { empresa, contacto, lineas, totales: venta.totales, fecha: "2026-11-23" };
    const cierre = { ...prepararCierre(cierreEjemplo(), []), tarjetas: { debito: "RD$0.00", credito: "RD$0.00" } };
    const plantilla = { ...PLANTILLA_TICKET_DEFECTO, pie_ticket: "PIE" };
    const documentos = [
      { nombre: "factura", ancho: 80, elemento: <TicketPos payload={armarTicketFactura(configurada, plantilla)} /> },
      {
        nombre: "prefactura",
        ancho: 80,
        elemento: <TicketPos payload={armarTicketPrefactura(presentacion, plantilla)} />,
      },
      {
        nombre: "cotizacion",
        ancho: 80,
        elemento: (
          <TicketPos
            payload={armarTicketCotizacion({ ...cotizacionEjemplo(), empresa, contacto, lineas }, plantilla)}
          />
        ),
      },
      { nombre: "cierre", ancho: 57, elemento: <TicketCierrePos datos={cierre} /> },
    ];
    const pagina = await navegador.newPage();
    for (const documento of documentos) {
      await pagina.setContent(
        `<html><head><style>${css.css}</style></head><body style="margin:0"><div data-print-root data-print-pos="ticket-${documento.ancho}">${renderToStaticMarkup(documento.elemento)}</div></body></html>`,
      );
      await pagina.emulateMedia({ media: "print" });
      const archivo = path.join(directorio, `${documento.nombre}.pdf`);
      await pagina.pdf({ path: archivo, preferCSSPageSize: true, printBackground: true });
      const fuentes = execFileSync("pdffonts", [archivo], { encoding: "utf8" });
      expect(fuentes).toMatch(/LiberationSans|Arial/);
      expect(fuentes).toMatch(/Bold/);
      expect(fuentes).not.toMatch(/DejaVu|Geist/);
      const bbox = path.join(directorio, `${documento.nombre}.html`);
      execFileSync("pdftotext", ["-bbox", archivo, bbox]);
      const xml = readFileSync(bbox, "utf8");
      const paginas = [...xml.matchAll(/<page width="([\d.]+)" height="([\d.]+)">/g)];
      expect(paginas).toHaveLength(1);
      expect(Math.abs((Number(paginas[0]?.[1]) * 25.4) / 72 - documento.ancho)).toBeLessThan(0.2);
      expect(Math.abs((Number(paginas[0]?.[2]) * 25.4) / 72 - 250)).toBeLessThan(0.2);
      if (documento.nombre === "cierre") {
        comprobarPalabra(xml, "Cierre", 26.25);
        comprobarPalabra(xml, "Base", 7.5);
        comprobarPalabra(xml, "Dinero", 9);
        const titulo = await pagina.locator(".cierre-titulo").evaluate((elemento) => {
          const rango = document.createRange();
          rango.selectNodeContents(elemento);
          return {
            lineas: rango.getClientRects().length,
            ancho: rango.getBoundingClientRect().width,
            disponible: elemento.getBoundingClientRect().width,
          };
        });
        expect(titulo.lineas).toBe(1);
        expect(titulo.ancho).toBeLessThanOrEqual(titulo.disponible);
      } else {
        comprobarPalabra(xml, "EMPRESA", 13.5);
        comprobarPalabra(xml, "CLIENTE", 13.5);
        comprobarPalabra(xml, "DIRECCION", 9);
        comprobarPalabra(xml, "DOMICILIO", 9);
        comprobarPalabra(xml, "Item", 8.1);
        comprobarPalabra(xml, "PRODUCTO", 7.29);
        comprobarPalabra(xml, "x", 6.55);
        comprobarPalabra(xml, "Subtotal:", 9);
        comprobarPalabra(xml, "Total:", 13.5);
        comprobarPalabra(xml, "236.00", 7.29);
        comprobarPalabra(xml, "productos:", 9);
        comprobarPalabra(xml, "PIE", 9);
        comprobarPalabra(
          xml,
          documento.nombre === "factura" ? "Factura" : documento.nombre === "prefactura" ? "Prefactura" : "Cotización",
          9,
        );
        const logo = await pagina.locator(".ticket-pos img").boundingBox();
        expect(Math.abs(((logo?.width ?? 0) * 25.4) / 96 - 69.8)).toBeLessThan(0.1);
        expect(Math.abs(((logo?.height ?? 0) * 25.4) / 96 - 20.9)).toBeLessThan(0.1);
        for (const selector of [
          "header > p:first-of-type",
          ".bloque-totales > div:last-child > span",
          ".ticket-pos section p:first-child",
        ]) {
          expect(
            await pagina
              .locator(selector)
              .first()
              .evaluate((elemento) => getComputedStyle(elemento).fontWeight),
          ).toBe("700");
        }
      }
    }
  } finally {
    await navegador.close();
    rmSync(directorio, { recursive: true, force: true });
  }
}, 60000);
