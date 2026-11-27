import { describe, expect, it } from "vitest";

import { configuracionEcfPublicaDesdeFila } from "./ecf-portal-tipos";
import {
  CASOS_PRUEBA_DGII,
  CHECKLIST_MIGRACION_ALEGRA,
  calcularProgresoHabilitacion,
  calcularSiguienteDesdeEncf,
  EMPRESAS_PILOTO_ECF,
  esTipoEncf,
  nombreCertificadoDigitalValido,
  PASOS_HABILITACION,
  urlsServiciosEcf,
} from "./pasos-habilitacion";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CARPETA = join(process.cwd(), "src", "app", "(main)", "dashboard", "configuracion");
const PORTAL = readFileSync(join(CARPETA, "facturacion-electronica", "_components", "portal-ecf-cliente.tsx"), "utf8");
const SET_EXCEL = readFileSync(join(CARPETA, "facturacion-electronica", "_components", "set-excel-dgii.tsx"), "utf8");
const PAGINA = readFileSync(join(CARPETA, "facturacion-electronica", "page.tsx"), "utf8");
const CONFIGURACION = readFileSync(join(CARPETA, "page.tsx"), "utf8");
const API_CERTIFICADO = readFileSync(
  join(process.cwd(), "src", "app", "api", "ecf", "config", "certificado", "route.ts"),
  "utf8",
);
const API_PLANTILLA = readFileSync(
  join(process.cwd(), "src", "app", "api", "ecf", "pruebas", "plantilla", "route.ts"),
  "utf8",
);
const API_RUNNER_EXCEL = readFileSync(
  join(process.cwd(), "src", "app", "api", "ecf", "pruebas", "ejecutar-excel", "route.ts"),
  "utf8",
);

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

  it("incluye OXYMAT como piloto DGII y Medoxigas como operación principal", () => {
    expect(EMPRESAS_PILOTO_ECF.oxymat).toEqual({
      id: "oxymat",
      nombre: "OXYMAT SRL",
      alias: "Ferretería (Piloto DGII)",
      rnc: "131488791",
    });
    expect(EMPRESAS_PILOTO_ECF.medoxigas).toEqual({
      id: "medoxigas",
      nombre: "MEDOXIGAS ALC, SRL",
      alias: "Operación principal",
      rnc: "130893489",
    });
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

  it("calcula las 4 URLs de servicios sin doble slash final y con soporte multi-RNC", () => {
    const urls = urlsServiciosEcf("https://ejemplo.test/");
    expect(urls).toHaveLength(4);
    expect(urls.map((servicio) => servicio.url)).toEqual([
      "https://ejemplo.test/api/ecf/fe/autenticacion/api/semilla",
      "https://ejemplo.test/api/ecf/fe/autenticacion/api/validacioncertificado",
      "https://ejemplo.test/api/ecf/fe/recepcion/api/ecf",
      "https://ejemplo.test/api/ecf/fe/aprobacioncomercial/api/ecf",
    ]);
    const urlsRnc = urlsServiciosEcf("https://app.medoxigas.com/", "131-99999-9");
    expect(urlsRnc.map((servicio) => servicio.url)).toEqual([
      "https://app.medoxigas.com/api/ecf/131999999/fe/autenticacion/api/semilla",
      "https://app.medoxigas.com/api/ecf/131999999/fe/autenticacion/api/validacioncertificado",
      "https://app.medoxigas.com/api/ecf/131999999/fe/recepcion/api/ecf",
      "https://app.medoxigas.com/api/ecf/131999999/fe/aprobacioncomercial/api/ecf",
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

  it("convierte metadatos públicos de ecf_config sin exponer secretos", () => {
    const config = configuracionEcfPublicaDesdeFila(
      {
        rnc: "131488791",
        razon_social: "OXYMAT SRL",
        ambiente: "certecf",
        activo: true,
        dominio_base: "https://app.medoxigas.com",
        cert_titular: "OXYMAT SRL",
        cert_numero_serie: "ABC123",
        cert_valido_hasta: "2027-01-10T04:00:00.000Z",
        cert_huella_sha256: "AA:BB",
      },
      new Date("2026-11-27T12:00:00.000Z"),
    );
    expect(config).toMatchObject({
      rnc: "131488791",
      razonSocial: "OXYMAT SRL",
      ambiente: "certecf",
      activo: true,
      certTitular: "OXYMAT SRL",
      certNumeroSerie: "ABC123",
      certHuellaSha256: "AA:BB",
      vigente: true,
    });
    expect(config.diasRestantes).toBeGreaterThan(40);
    expect(config).not.toHaveProperty("cert_cifrado");
    expect(config).not.toHaveProperty("cert_pass_cifrada");
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

  it("el portal ejecuta el motor solo vía Server Action sin importar node:crypto en cliente", () => {
    expect(PORTAL).toContain("ejecutarSimulacionEcfAction");
    expect(PORTAL).not.toContain("@/lib/ecf");
    expect(PORTAL).not.toContain("node:crypto");
  });

  it("protege certificado, contraseña y secretos en el cliente", () => {
    expect(PORTAL).toContain('accept=".p12,.pfx"');
    expect(PORTAL).toContain('type="password"');
    expect(PORTAL).toContain("AES-256-GCM");
    expect(PORTAL).not.toMatch(/dangerouslySetInnerHTML|service_role|SUPABASE_SERVICE/);
  });

  it("el selector de piloto alimenta simulación y URLs multi-RNC", () => {
    expect(PORTAL).toContain('useState<EmpresaPilotoEcfId>("oxymat")');
    expect(PORTAL).toContain("EMPRESAS_PILOTO_ECF");
    expect(PORTAL).toContain("rnc: pilotoActivo.rnc");
    expect(PORTAL).toContain("razonSocial: pilotoActivo.nombre");
    expect(PORTAL).toContain("empresa={emisorActivo}");
    expect(PORTAL).toContain("DOMINIO_BASE_ECF_PROPIO");
  });

  it("conecta el Paso 1 con la API real del certificado y elimina la simulación de subida", () => {
    expect(PORTAL).toContain('"/api/ecf/config/certificado"');
    expect(PORTAL).toContain("Validar y guardar certificado");
    expect(PORTAL).toContain("Estado real guardado en ecf_config");
    expect(PORTAL).toContain("Activar emisión e-CF");
    expect(PORTAL).not.toContain("todavía no se sube al servidor");
    expect(PORTAL).not.toContain("Solo se valida el nombre y la extensión en esta fase");
    expect(API_CERTIFICADO).toContain("leerCertificadoPkcs12");
    expect(API_CERTIFICADO).toContain("cifrarSecretoEcf");
    expect(API_CERTIFICADO).toContain('.upsert(insertar, { onConflict: "rnc" })');
    expect(API_CERTIFICADO).toContain('rol !== "admin"');
    expect(API_CERTIFICADO).toContain("ECF_ENCRYPTION_KEY");
  });

  it("conecta el Paso 2 con plantilla, validación local y envío real a TesteCF/CerteCF", () => {
    expect(SET_EXCEL).toContain('"/api/ecf/pruebas/ejecutar-excel"');
    expect(SET_EXCEL).toContain("Descargar plantilla Excel piloto");
    expect(SET_EXCEL).toContain("Validar Excel (local)");
    expect(SET_EXCEL).toContain("Enviar set real");
    expect(SET_EXCEL).toContain("certificadoP12");
    expect(API_PLANTILLA).toContain("generarPlantillaExcelPruebasPiloto");
    expect(API_RUNNER_EXCEL).toContain("parsearExcelPruebasDgii");
    expect(API_RUNNER_EXCEL).toContain("validarXmlContraEsquemaDgii");
    expect(API_RUNNER_EXCEL).toContain("obtenerTokenDgii");
    expect(API_RUNNER_EXCEL).toContain("enviarEcfDgii");
    expect(API_RUNNER_EXCEL).toContain("consultarResultadoDgii");
    expect(API_RUNNER_EXCEL).toContain('documento_tipo: "prueba"');
  });

  it("mantiene el candado absoluto contra Producción en el runner Excel", () => {
    expect(API_RUNNER_EXCEL).toContain('ambienteTexto === "ecf"');
    expect(API_RUNNER_EXCEL).toContain('ambienteTexto === "produccion"');
    expect(API_RUNNER_EXCEL).toContain("nunca puede apuntar a Producción");
    expect(API_RUNNER_EXCEL).toContain("confirmarProduccion: false");
    expect(API_RUNNER_EXCEL).not.toContain("confirmarProduccion: true");
    expect(SET_EXCEL).toContain("Producción bloqueada para el runner");
  });

  it("no usa controles nativos prohibidos ni teal de Alegra", () => {
    expect(PORTAL).not.toMatch(/<select[\s>]|NativeSelect|type=["']date["']/);
    expect(SET_EXCEL).not.toMatch(/<select[\s>]|NativeSelect|type=["']date["']/);
    for (const contenido of [PORTAL, SET_EXCEL, PAGINA]) {
      expect(contenido).not.toContain("#00b19d");
      expect(contenido).not.toContain("#0a9e9a");
    }
    expect(PAGINA).not.toMatch(/<h1[\s>]|text-3xl/);
  });
});
