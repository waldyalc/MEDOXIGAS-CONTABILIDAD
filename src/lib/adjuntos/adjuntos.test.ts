import { describe, expect, test } from "vitest";

import {
  etiquetaTipoAdjunto,
  extensionAdjunto,
  formatoTamanoAdjunto,
  mensajeSubidaAdjunto,
  rutaAdjunto,
  validarAdjunto,
} from "./adjuntos";

function archivo(tipo: string, bytes: number) {
  return new File([new Uint8Array(bytes)], "documento", { type: tipo });
}

describe("adjuntos", () => {
  test("extensión según el tipo permitido", () => {
    expect(extensionAdjunto("image/png")).toBe("png");
    expect(extensionAdjunto("application/pdf")).toBe("pdf");
    expect(extensionAdjunto("image/jpeg")).toBe("jpg");
  });

  test("la ruta lleva el prefijo de la entidad que exige la RPC", () => {
    const ruta = rutaAdjunto("contacto", "a1b2c3d4-0000-4000-8000-000000000001", "application/pdf");
    expect(ruta.startsWith("contacto/a1b2c3d4-0000-4000-8000-000000000001/")).toBe(true);
    expect(ruta.endsWith(".pdf")).toBe(true);
  });

  test("valida tipo, tamaño y archivo vacío", () => {
    expect(validarAdjunto(archivo("application/pdf", 10))).toBeNull();
    expect(validarAdjunto(archivo("image/jpeg", 10))).toBeNull();
    expect(validarAdjunto(archivo("image/gif", 10))).toBe("El archivo debe ser PNG, JPG o PDF.");
    expect(validarAdjunto(archivo("application/pdf", 0))).toBe("El archivo está vacío.");
    expect(validarAdjunto(archivo("application/pdf", 10 * 1024 * 1024 + 1))).toBe(
      "El archivo no puede pesar más de 10 MB.",
    );
  });

  test("traduce los errores del bucket a mensajes en español", () => {
    expect(mensajeSubidaAdjunto("Bucket not found")).toContain("No se encontró el almacenamiento");
    expect(mensajeSubidaAdjunto("Payload too large")).toContain("10 MB");
    expect(mensajeSubidaAdjunto("new row violates row-level security policy")).toContain("administrador o contador");
    expect(mensajeSubidaAdjunto("otra cosa")).toBe("No se pudo subir el archivo. Intenta de nuevo.");
  });

  test("etiqueta el tipo de adjunto según el mime", () => {
    expect(etiquetaTipoAdjunto("application/pdf")).toBe("PDF");
    expect(etiquetaTipoAdjunto("image/png")).toBe("Imagen");
    expect(etiquetaTipoAdjunto("image/jpeg")).toBe("Imagen");
    expect(etiquetaTipoAdjunto("text/plain")).toBe("Archivo");
  });

  test("formatea el tamaño del archivo", () => {
    expect(formatoTamanoAdjunto(512)).toBe("512 B");
    expect(formatoTamanoAdjunto(2048)).toBe("2 KB");
    expect(formatoTamanoAdjunto(2.4 * 1024 * 1024)).toBe("2.4 MB");
    expect(formatoTamanoAdjunto(-1)).toBe("—");
  });
});
