import { describe, expect, it } from "vitest";

import {
  CASOS_PRUEBA_DGII,
  CHECKLIST_MIGRACION_ALEGRA,
  calcularProgresoHabilitacion,
  calcularSiguienteDesdeEncf,
  esTipoEncf,
  nombreCertificadoDigitalValido,
  PASOS_HABILITACION,
  urlsServiciosEcf,
} from "./pasos-habilitacion";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CARPETA = join(process.cwd(), "src", "app", "(main)", "dashboard", "configuracion");
const PORTAL = readFileSync(join(CARPETA, "facturacion-electronica", "_components", "portal-ecf-cliente.tsx"), "utf8");
const PAGINA = readFileSync(join(CARPETA, "facturacion-electronica", "page.tsx"), "utf8");
const CONFIGURACION = readFileSync(join(CARPETA, "page.tsx"), "utf8");

describe("pasos de habilitación e-CF", () => {
  it("mantiene los 6 pasos oficiales en orden", () => {
    expect(PASOS_HABILITACION.map((paso) => paso.id)).toEqual([
      "certificado",
      "pruebas",
      "representaciones",
      "urls",
      "declaracion",
      "roles",
    ]);
    expect(PASOS_HABILITACION.map((paso) => paso.titulo)).toEqual([
      "Certificado digital y postulación",
      "Pruebas de simulación e-CF",
      "Representaciones impresas",
      "URL Servicios de Producción",
      "Declaración jurada",
      "Asignación de roles y e-NCF",
    ]);
    expect(PASOS_HABILITACION.map((paso) => paso.numero)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("mantiene los 9 casos del set de simulación DGII", () => {
    expect(CASOS_PRUEBA_DGII).toHaveLength(9);
    expect(CASOS_PRUEBA_DGII.map((caso) => caso.tipo)).toEqual([
      "E31",
      "E32 ≥ 250k",
      "E32 < 250k + RFCE",
      "E33",
      "E34",
      "E41",
      "E43",
      "E44",
      "E45",
    ]);
  });

  it("mantiene la guía de migración desde Alegra en 5 pasos", () => {
    expect(CHECKLIST_MIGRACION_ALEGRA).toHaveLength(5);
    expect(CHECKLIST_MIGRACION_ALEGRA.map((paso) => paso.id)).toEqual([
      "certificado-vigente",
      "postulacion-desarrollo-propio",
      "set-pruebas-aprobado",
      "urls-declaracion-roles",
      "corte-secuencias",
    ]);
    expect(CHECKLIST_MIGRACION_ALEGRA[4]?.descripcion).toContain("último + 1");
  });

  it("calcula las 4 URLs de servicios sin doble slash final", () => {
    const urls = urlsServiciosEcf("https://ejemplo.test/");
    expect(urls).toHaveLength(4);
    expect(urls.map((servicio) => servicio.url)).toEqual([
      "https://ejemplo.test/api/ecf/fe/autenticacion/api/semilla",
      "https://ejemplo.test/api/ecf/fe/autenticacion/api/validarcertificado",
      "https://ejemplo.test/api/ecf/fe/recepcion/api/ecf",
      "https://ejemplo.test/api/ecf/fe/aprobacioncomercial/api/ecf",
    ]);
  });

  it("valida certificados solo por extensión .p12 o .pfx", () => {
    expect(nombreCertificadoDigitalValido("certificado.p12")).toBe(true);
    expect(nombreCertificadoDigitalValido("CERTIFICADO.PFX")).toBe(true);
    expect(nombreCertificadoDigitalValido("certificado.pdf")).toBe(false);
    expect(nombreCertificadoDigitalValido(" .p12 ")).toBe(false);
    expect(nombreCertificadoDigitalValido("")).toBe(false);
  });

  it("detecta series electrónicas E31–E47 sin confundir las B", () => {
    expect(esTipoEncf("31", "E31")).toBe(true);
    expect(esTipoEncf("47", "E47")).toBe(true);
    expect(esTipoEncf("31", "E")).toBe(true);
    expect(esTipoEncf("02", "B02")).toBe(false);
    expect(esTipoEncf("30", "E30")).toBe(false);
  });

  it("calcula el siguiente e-NCF del corte preservando 10 dígitos", () => {
    expect(calcularSiguienteDesdeEncf(" e310000000123 ")).toBe("E310000000124");
    expect(calcularSiguienteDesdeEncf("E470000000009")).toBe("E470000000010");
    expect(calcularSiguienteDesdeEncf("B310000000123")).toBeNull();
    expect(calcularSiguienteDesdeEncf("E3100000123")).toBeNull();
    expect(calcularSiguienteDesdeEncf("E319999999999")).toBeNull();
  });

  it("arranca en ambiente de preparación, nunca en producción", () => {
    expect(calcularProgresoHabilitacion("migracion")).toBe(8);
    expect(calcularProgresoHabilitacion("primera")).toBe(8);
  });
});

describe("candados estructurales del portal e-CF", () => {
  it("la tarjeta queda en Configuración solo para admin y contador", () => {
    expect(CONFIGURACION).toContain('id: "facturacion-electronica"');
    expect(CONFIGURACION).toContain('titulo: "Facturación electrónica"');
    expect(CONFIGURACION).toContain('url: "/dashboard/configuracion/facturacion-electronica"');
    expect(CONFIGURACION).toMatch(/rol === "admin" \|\| rol === "contador"[\s\S]{0,420}facturacion-electronica/);
  });

  it("la página es Server Component con EncabezadoPagina y migas correctas", () => {
    expect(PAGINA.startsWith('"use client"')).toBe(false);
    expect(PAGINA).toContain("<EncabezadoPagina");
    expect(PAGINA).toContain('etiqueta: "Configuración", href: "/dashboard/configuracion"');
    expect(PAGINA).toContain('etiqueta: "Facturación electrónica"');
    expect(PAGINA).toContain('.eq("activa", true)');
  });

  it("el portal deja el handler del motor sin tocar src/lib/ecf", () => {
    expect(PORTAL).toContain("onEjecutarPruebas?: () => void | Promise<void>");
    expect(PORTAL).not.toContain("@/lib/ecf");
  });

  it("protege certificado, contraseña y secretos en el cliente", () => {
    expect(PORTAL).toContain('accept=".p12,.pfx"');
    expect(PORTAL).toContain('type="password"');
    expect(PORTAL).toContain("AES-256-GCM");
    expect(PORTAL).not.toMatch(/dangerouslySetInnerHTML|service_role|SUPABASE_SERVICE/);
  });

  it("no usa controles nativos prohibidos ni teal de Alegra", () => {
    expect(PORTAL).not.toMatch(/<select[\s>]|NativeSelect|type=["']date["']/);
    expect(PORTAL).not.toContain("#00b19d");
    expect(PORTAL).not.toContain("#0a9e9a");
    expect(PAGINA).not.toMatch(/<h1[\s>]|text-3xl/);
  });
});
