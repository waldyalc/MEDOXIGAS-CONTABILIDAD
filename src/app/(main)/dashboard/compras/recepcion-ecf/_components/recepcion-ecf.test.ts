import { describe, expect, it } from "vitest";

import { parsearXmlEcfRecibido } from "./parser-xml-recibido";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const XML_E31 = `<?xml version="1.0" encoding="utf-8"?>
<ECF>
  <Encabezado>
    <Version>1.0</Version>
    <IdDoc>
      <TipoeCF>31</TipoeCF>
      <eNCF>E310015053237</eNCF>
      <FechaVencimientoSecuencia>31-12-2026</FechaVencimientoSecuencia>
      <TipoIngresos>01</TipoIngresos>
      <TipoPago>1</TipoPago>
    </IdDoc>
    <Emisor>
      <RNCEmisor>131999999</RNCEmisor>
      <RazonSocialEmisor>Proveedor Industrial &amp; CIA</RazonSocialEmisor>
      <CorreoEmisor>ventas@proveedor.test</CorreoEmisor>
      <DireccionEmisor>Av. Principal 10</DireccionEmisor>
      <FechaEmision>25-11-2026</FechaEmision>
    </Emisor>
    <Comprador>
      <RNCComprador>131488791</RNCComprador>
      <RazonSocialComprador>OXYMAT SRL</RazonSocialComprador>
    </Comprador>
    <Totales>
      <MontoGravadoTotal>1000.00</MontoGravadoTotal>
      <MontoGravadoI1>1000.00</MontoGravadoI1>
      <MontoGravadoI2>0.00</MontoGravadoI2>
      <MontoExento>0.00</MontoExento>
      <ITBIS1>18</ITBIS1>
      <TotalITBIS>180.00</TotalITBIS>
      <TotalITBIS1>180.00</TotalITBIS1>
      <TotalITBIS2>0.00</TotalITBIS2>
      <MontoTotal>1180.00</MontoTotal>
    </Totales>
  </Encabezado>
  <DetallesItems>
    <Item>
      <NumeroLinea>1</NumeroLinea>
      <IndicadorFacturacion>1</IndicadorFacturacion>
      <NombreItem>Cilindro de oxígeno</NombreItem>
      <IndicadorBienoServicio>1</IndicadorBienoServicio>
      <CantidadItem>2.00</CantidadItem>
      <PrecioUnitarioItem>300.00</PrecioUnitarioItem>
      <MontoItem>600.00</MontoItem>
    </Item>
    <Item>
      <NumeroLinea>2</NumeroLinea>
      <IndicadorFacturacion>1</IndicadorFacturacion>
      <NombreItem>Servicio de entrega</NombreItem>
      <IndicadorBienoServicio>2</IndicadorBienoServicio>
      <CantidadItem>1.00</CantidadItem>
      <PrecioUnitarioItem>400.00</PrecioUnitarioItem>
      <MontoItem>400.00</MontoItem>
    </Item>
  </DetallesItems>
  <FechaHoraFirma>25-11-2026 10:30:00</FechaHoraFirma>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignatureValue>
      ABCDEF1234567890
    </SignatureValue>
  </Signature>
</ECF>`;

const CARPETA = join(process.cwd(), "src", "app", "(main)", "dashboard", "compras", "recepcion-ecf");
const PAGINA = readFileSync(join(CARPETA, "page.tsx"), "utf8");
const CLIENTE = readFileSync(join(CARPETA, "_components", "recepcion-ecf-cliente.tsx"), "utf8");
const SIDEBAR = readFileSync(join(process.cwd(), "src", "navigation", "sidebar", "sidebar-items.ts"), "utf8");

describe("parsearXmlEcfRecibido", () => {
  it("extrae cabecera, totales, ítems y código de seguridad de un E31 real", () => {
    const resultado = parsearXmlEcfRecibido(XML_E31);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.ecf).toMatchObject({
      rncEmisor: "131999999",
      razonSocialEmisor: "Proveedor Industrial & CIA",
      correoEmisor: "ventas@proveedor.test",
      rncComprador: "131488791",
      tipoEcf: "31",
      encf: "E310015053237",
      fechaEmision: "25-11-2026",
      montoGravado: 1000,
      montoExento: 0,
      totalItbis: 180,
      montoTotal: 1180,
      codigoSeguridad: "ABCDEF",
    });
    expect(resultado.ecf.items).toEqual([
      { numeroLinea: 1, nombre: "Cilindro de oxígeno", cantidad: 2, precioUnitario: 300, monto: 600 },
      { numeroLinea: 2, nombre: "Servicio de entrega", cantidad: 1, precioUnitario: 400, monto: 400 },
    ]);
  });

  it("rechaza XML que no sea un e-CF y explica el motivo en español", () => {
    const resultado = parsearXmlEcfRecibido("<factura><total>10</total></factura>");

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("no es un XML e-CF válido");
    expect(resultado.error).toContain("<ECF>");
  });

  it("rechaza un e-CF incompleto sin romper la bandeja", () => {
    const resultado = parsearXmlEcfRecibido("<ECF><Encabezado></Encabezado></ECF>");

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("falta o es inválido");
  });
});

describe("candados estructurales de recepción e-CF", () => {
  it("la página es Server Component con EncabezadoPagina, migas y lectura tolerante", () => {
    expect(PAGINA.startsWith('"use client"')).toBe(false);
    expect(PAGINA).toContain("<EncabezadoPagina");
    expect(PAGINA).toContain('titulo="Recepción de comprobantes electrónicos"');
    expect(PAGINA).toContain('etiqueta: "Compras", href: "/dashboard/compras"');
    expect(PAGINA).toContain('etiqueta: "Recepción de comprobantes"');
    expect(PAGINA).toContain('if (rol === "lector") redirect("/dashboard/compras")');
    expect(PAGINA).toContain("leerRecibidosTolerante");
    expect(PAGINA).toContain("tablaDisponible: false");
  });

  it("el menú de Compras enlaza la bandeja solo para admin y contador", () => {
    expect(SIDEBAR).toContain('id: "recepcion-ecf"');
    expect(SIDEBAR).toContain('title: "Recepción e-CF"');
    expect(SIDEBAR).toContain('url: "/dashboard/compras/recepcion-ecf"');
    expect(SIDEBAR).toContain('roles: ["admin", "contador"]');
    expect(SIDEBAR).toContain("TablerInbox");
  });

  it("la bandeja copia las columnas y acciones de Alegra sin datos inventados", () => {
    expect(CLIENTE).toContain('placeholder="Buscar proveedor o e-NCF"');
    expect(CLIENTE).toContain("Proveedor / Correo");
    expect(CLIENTE).toContain("Documento / Número");
    expect(CLIENTE).toContain("Fecha de emisión");
    expect(CLIENTE).toContain("Evento DGII");
    expect(CLIENTE).toContain("Registrar compra");
    expect(CLIENTE).toContain("Ver detalle del XML");
    expect(CLIENTE).toContain("Descargar XML");
    expect(CLIENTE).toContain("Copiar e-NCF");
    expect(CLIENTE).toContain('accept=".xml"');
    expect(CLIENTE).toContain("Importar XML de proveedor");
    expect(CLIENTE).not.toMatch(/_EJEMPLO|datos ficticios|Ana García|Luis Peña/);
  });

  it("no usa controles nativos prohibidos ni teal de Alegra", () => {
    expect(CLIENTE).not.toMatch(/<select[\s>]|NativeSelect|type=["']date["']/);
    expect(CLIENTE).not.toContain("#00b19d");
    expect(CLIENTE).not.toContain("#0a9e9a");
    expect(PAGINA).not.toMatch(/<h1[\s>]|text-3xl/);
  });
});
