import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/types";

import {
  cargarCredencialesEcfServidor,
  claveCifradoEcf,
  guardarCertificadoP12EnConfig,
  leerConfigEcf,
} from "./config-servidor";
import { generarCertificadoPruebaAutocontenido } from "./firma";
import { leerCertificadoPkcs12 } from "./pkcs12";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RNC_OXYMAT = "131488791";
const CLAVE_P12 = "ClavePrueba-Oxymat-123";
const CLAVE_MAESTRA = "clave-maestra-ecf-solo-vitest";
const CLAVES_ENV = ["ECF_ENCRYPTION_KEY", `ECF_CERT_PEM_${RNC_OXYMAT}`, `ECF_KEY_PEM_${RNC_OXYMAT}`] as const;

interface FilaConfigPrueba {
  rnc: string;
  razon_social: string;
  ambiente: string;
  activo: boolean;
  dominio_base: string | null;
  cert_titular: string | null;
  cert_numero_serie: string | null;
  cert_valido_hasta: string | null;
  cert_huella_sha256: string | null;
}

type RespuestaRpc = { data: unknown; error: null };
type RpcMock = (fn: string, args: Record<string, unknown>) => Promise<RespuestaRpc>;

const valoresEnvOriginales = new Map<string, string | undefined>();
let carpetaTemporal = "";
let p12Oxymat: Buffer;

function filaConfig(activo = true): FilaConfigPrueba {
  return {
    rnc: RNC_OXYMAT,
    razon_social: "OXYMAT SRL",
    ambiente: "testecf",
    activo,
    dominio_base: null,
    cert_titular: "OXYMAT SRL",
    cert_numero_serie: "1234567890",
    cert_valido_hasta: null,
    cert_huella_sha256: "AA:BB:CC",
  };
}

function rpcInesperada(fn: string): Promise<RespuestaRpc> {
  return Promise.reject(new Error(`RPC inesperada en la prueba: ${fn}`));
}

function clientePrueba(
  fila: FilaConfigPrueba | null,
  rpc: RpcMock = rpcInesperada,
  alVerColumnas?: (columnas: string) => void,
): SupabaseClient<Database> {
  return {
    from: (_tabla: string) => ({
      select: (columnas: string) => {
        alVerColumnas?.(columnas);
        return {
          eq: (_columna: string, _valor: string) => ({
            maybeSingle: () => Promise.resolve({ data: fila, error: null }),
          }),
        };
      },
    }),
    rpc,
  } as unknown as SupabaseClient<Database>;
}

function crearP12Oxymat(carpeta: string): Buffer {
  const clave = join(carpeta, "oxymat-key.pem");
  const certificado = join(carpeta, "oxymat-cert.pem");
  const p12 = join(carpeta, "oxymat.p12");
  const env = { ...process.env, P12_TEST_PASS: CLAVE_P12 };
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-keyout",
      clave,
      "-out",
      certificado,
      "-days",
      "2",
      "-nodes",
      "-subj",
      `/C=DO/O=OXYMAT SRL/CN=OXYMAT SRL/serialNumber=${RNC_OXYMAT}`,
    ],
    { env, stdio: "pipe" },
  );
  execFileSync(
    "openssl",
    ["pkcs12", "-export", "-out", p12, "-inkey", clave, "-in", certificado, "-passout", "env:P12_TEST_PASS"],
    { env, stdio: "pipe" },
  );
  return readFileSync(p12);
}

function textoSecreto(valor: unknown): string {
  if (typeof valor !== "string" || valor === "") throw new Error("La RPC no recibió un secreto cifrado de prueba");
  return valor;
}

beforeAll(() => {
  for (const clave of CLAVES_ENV) valoresEnvOriginales.set(clave, process.env[clave]);
  carpetaTemporal = mkdtempSync(join(tmpdir(), "ecf-config-servidor-test-"));
  p12Oxymat = crearP12Oxymat(carpetaTemporal);
});

beforeEach(() => {
  delete process.env[`ECF_CERT_PEM_${RNC_OXYMAT}`];
  delete process.env[`ECF_KEY_PEM_${RNC_OXYMAT}`];
  process.env.ECF_ENCRYPTION_KEY = CLAVE_MAESTRA;
});

afterAll(() => {
  for (const clave of CLAVES_ENV) {
    const valor = valoresEnvOriginales.get(clave);
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
  rmSync(carpetaTemporal, { recursive: true, force: true });
});

describe("configuración e-CF en servidor", () => {
  it("lee la clave maestra solo desde ECF_ENCRYPTION_KEY", () => {
    expect(claveCifradoEcf()).toBe(CLAVE_MAESTRA);
    delete process.env.ECF_ENCRYPTION_KEY;
    expect(claveCifradoEcf()).toBeNull();
  });

  it("leerConfigEcf consulta metadatos sin tocar las columnas secretas", async () => {
    let columnasConsultadas = "";
    const cliente = clientePrueba(filaConfig(), rpcInesperada, (columnas) => {
      columnasConsultadas = columnas;
    });

    const estado = await leerConfigEcf(cliente, RNC_OXYMAT);

    expect(columnasConsultadas).not.toContain("cert_cifrado");
    expect(columnasConsultadas).not.toContain("cert_pass_cifrada");
    expect(estado?.rnc).toBe(RNC_OXYMAT);
    expect(estado?.tieneCertificado).toBe(true);
    expect(estado?.claveMaestraConfigurada).toBe(true);
  });

  it("guarda un .p12 real cifrado y lo recupera descifrado en un round-trip completo", async () => {
    let certCifradoGuardado = "";
    let passCifradaGuardada = "";
    const rpc: RpcMock = (fn, args) => {
      if (fn === "guardar_ecf_certificado") {
        certCifradoGuardado = textoSecreto(args.p_cert_cifrado);
        passCifradaGuardada = textoSecreto(args.p_cert_pass_cifrada);
        return Promise.resolve({
          data: {
            rnc: RNC_OXYMAT,
            razon_social: "OXYMAT SRL",
            ambiente: "testecf",
            activo: true,
            dominio_base: null,
            cert_titular: "OXYMAT SRL",
            cert_numero_serie: "1234567890",
            cert_valido_hasta: null,
            cert_huella_sha256: "AA:BB:CC",
            tiene_certificado: true,
            updated_at: new Date().toISOString(),
          },
          error: null,
        });
      }
      if (fn === "obtener_ecf_secreto_firma") {
        return Promise.resolve({
          data: [
            {
              rnc: RNC_OXYMAT,
              razon_social: "OXYMAT SRL",
              ambiente: "testecf",
              activo: true,
              cert_cifrado: certCifradoGuardado,
              cert_pass_cifrada: passCifradaGuardada,
            },
          ],
          error: null,
        });
      }
      return rpcInesperada(fn);
    };
    const cliente = clientePrueba(filaConfig(), rpc);

    const guardado = await guardarCertificadoP12EnConfig(cliente, {
      rnc: RNC_OXYMAT,
      razonSocial: "OXYMAT SRL",
      ambiente: "testecf",
      activo: true,
      p12Buffer: p12Oxymat,
      contrasena: CLAVE_P12,
    });

    if (!guardado.ok) throw new Error(guardado.error);
    expect(guardado.estado.tieneCertificado).toBe(true);
    expect(certCifradoGuardado).toMatch(/^v1:/);
    expect(passCifradaGuardada).toMatch(/^v1:/);
    expect(certCifradoGuardado).not.toBe(p12Oxymat.toString("base64"));
    expect(passCifradaGuardada).not.toBe(CLAVE_P12);

    const cargado = await cargarCredencialesEcfServidor(cliente, RNC_OXYMAT);
    if (!cargado.ok) throw new Error(cargado.error);
    const esperado = await leerCertificadoPkcs12(p12Oxymat, CLAVE_P12);
    expect(cargado.origen).toBe("base_datos");
    expect(cargado.ambiente).toBe("testecf");
    expect(cargado.activo).toBe(true);
    expect(cargado.credenciales.certificadoPem).toBe(esperado.certificadoPem);
    expect(cargado.credenciales.clavePrivadaPem).toBe(esperado.clavePrivadaPem);
    expect(cargado.metadatos.huellaSha256).toBe(esperado.metadatos.huellaSha256);
  }, 30000);

  it("rechaza una contraseña incorrecta sin llamar la RPC ni filtrar el secreto", async () => {
    let llamadasRpc = 0;
    const rpc: RpcMock = (fn, _args) => {
      llamadasRpc += 1;
      return rpcInesperada(fn);
    };
    const cliente = clientePrueba(filaConfig(), rpc);

    const resultado = await guardarCertificadoP12EnConfig(cliente, {
      rnc: RNC_OXYMAT,
      razonSocial: "OXYMAT SRL",
      p12Buffer: p12Oxymat,
      contrasena: "contraseña-incorrecta",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/contraseña/i);
    expect(llamadasRpc).toBe(0);
  }, 30000);

  it("devuelve un error claro cuando falta ECF_ENCRYPTION_KEY al guardar o cargar", async () => {
    delete process.env.ECF_ENCRYPTION_KEY;
    const cliente = clientePrueba(filaConfig());

    const guardado = await guardarCertificadoP12EnConfig(cliente, {
      rnc: RNC_OXYMAT,
      razonSocial: "OXYMAT SRL",
      p12Buffer: p12Oxymat,
      contrasena: CLAVE_P12,
    });
    expect(guardado.ok).toBe(false);
    if (!guardado.ok) expect(guardado.error).toContain("ECF_ENCRYPTION_KEY");

    const cargado = await cargarCredencialesEcfServidor(cliente, RNC_OXYMAT);
    expect(cargado.ok).toBe(false);
    if (!cargado.ok) {
      expect(cargado.motivo).toBe("sin_clave_maestra");
      expect(cargado.error).toContain("ECF_ENCRYPTION_KEY");
    }
  });

  it("usa primero ECF_CERT_PEM_<RNC> y ECF_KEY_PEM_<RNC> sin llamar la RPC de secretos", async () => {
    const par = generarCertificadoPruebaAutocontenido(RNC_OXYMAT, "OXYMAT SRL");
    process.env[`ECF_CERT_PEM_${RNC_OXYMAT}`] = par.certificadoPem;
    process.env[`ECF_KEY_PEM_${RNC_OXYMAT}`] = par.clavePrivadaPem;
    let llamadasRpc = 0;
    const rpc: RpcMock = (fn, _args) => {
      llamadasRpc += 1;
      return rpcInesperada(fn);
    };
    const cliente = clientePrueba(filaConfig(false), rpc);

    const resultado = await cargarCredencialesEcfServidor(cliente, RNC_OXYMAT);

    if (!resultado.ok) throw new Error(resultado.error);
    expect(resultado.origen).toBe("env");
    expect(resultado.credenciales.certificadoPem).toBe(par.certificadoPem.trim());
    expect(resultado.credenciales.clavePrivadaPem).toBe(par.clavePrivadaPem.trim());
    expect(resultado.ambiente).toBe("testecf");
    expect(resultado.activo).toBe(false);
    expect(llamadasRpc).toBe(0);
  });
});
