import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";

import type { Database } from "@/lib/supabase/types";

import {
  BUCKET_IMAGENES_PRODUCTO,
  extensionImagenProducto,
  mensajeSubidaImagen,
  urlFirmadaImagenProducto,
  validarImagenProducto,
} from "./imagen";

function archivo(tipo: string, bytes: number) {
  return new File([new Uint8Array(bytes)], "imagen", { type: tipo });
}

describe("imagen del producto", () => {
  test("extensión según el tipo permitido", () => {
    expect(extensionImagenProducto("image/png")).toBe("png");
    expect(extensionImagenProducto("image/webp")).toBe("webp");
    expect(extensionImagenProducto("image/jpeg")).toBe("jpg");
  });

  test("valida tipo, tamaño y archivo vacío", () => {
    expect(validarImagenProducto(archivo("image/png", 10))).toBeNull();
    expect(validarImagenProducto(archivo("image/gif", 10))).toBe("La imagen debe ser PNG, JPG o WebP.");
    expect(validarImagenProducto(archivo("image/png", 0))).toBe("La imagen está vacía.");
    expect(validarImagenProducto(archivo("image/png", 5 * 1024 * 1024 + 1))).toBe(
      "La imagen no puede pesar más de 5 MB.",
    );
  });

  test("traduce los errores del bucket a mensajes en español", () => {
    expect(mensajeSubidaImagen("Bucket not found")).toContain("No se encontró el almacenamiento");
    expect(mensajeSubidaImagen("Payload too large")).toContain("5 MB");
    expect(mensajeSubidaImagen("new row violates row-level security policy")).toContain("administrador o contador");
    expect(mensajeSubidaImagen("otra cosa")).toBe("No se pudo subir la imagen. Intenta de nuevo.");
  });

  test("firma la URL del bucket privado o devuelve null", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.local/productos/foto.png?token=abc" },
      error: null,
    });
    const from = vi.fn().mockReturnValue({ createSignedUrl });
    const cliente = { storage: { from } } as unknown as SupabaseClient<Database>;

    await expect(urlFirmadaImagenProducto(cliente, "foto.png")).resolves.toBe(
      "https://storage.local/productos/foto.png?token=abc",
    );
    expect(from).toHaveBeenCalledWith(BUCKET_IMAGENES_PRODUCTO);

    const sinRuta = await urlFirmadaImagenProducto(cliente, "  ");
    expect(sinRuta).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);

    createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "sin permiso" } });
    await expect(urlFirmadaImagenProducto(cliente, "foto.png")).resolves.toBeNull();
  });
});
