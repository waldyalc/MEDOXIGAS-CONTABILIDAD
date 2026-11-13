import { describe, expect, test } from "vitest";

import { esquemaEmpresa, esquemaTerminoPago, extensionLogo, LIMITE_LOGO_BYTES, validarLogo } from "./validacion";

describe("esquemaEmpresa", () => {
  test("normaliza los campos y deja null los opcionales vacíos", () => {
    const resultado = esquemaEmpresa.parse({
      nombre: "  Medoxigas   ALC, SRL ",
      rnc: " ",
      direccion: "",
      telefono: " 809-555-0000 ",
      correo: "  ",
      logo_url: "",
    });

    expect(resultado).toEqual({
      nombre: "Medoxigas ALC, SRL",
      rnc: null,
      direccion: null,
      telefono: "809-555-0000",
      correo: null,
      logo_url: null,
    });
  });

  test("exige el nombre", () => {
    const resultado = esquemaEmpresa.safeParse({ nombre: "   " });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe("El nombre de la empresa es obligatorio");
  });

  test("rechaza un correo mal formado", () => {
    const resultado = esquemaEmpresa.safeParse({ nombre: "Medoxigas", correo: "correo" });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe("El correo de la empresa no es válido");
  });

  test("acepta el logo del bucket y también la ruta local", () => {
    expect(
      esquemaEmpresa.parse({ nombre: "Medoxigas", logo_url: "https://ejemplo.local/logos/logo.png" }).logo_url,
    ).toBe("https://ejemplo.local/logos/logo.png");
    expect(esquemaEmpresa.parse({ nombre: "Medoxigas", logo_url: "/marca/logo-medoxigas.png" }).logo_url).toBe(
      "/marca/logo-medoxigas.png",
    );
  });
});

describe("esquemaTerminoPago", () => {
  test("convierte los días a número entero", () => {
    const resultado = esquemaTerminoPago.parse({ nombre: " 30  días ", dias: "30" });

    expect(resultado).toEqual({ nombre: "30 días", dias: 30 });
  });

  test("rechaza días negativos y decimales", () => {
    expect(esquemaTerminoPago.safeParse({ nombre: "Contado", dias: "-1" }).success).toBe(false);
    expect(esquemaTerminoPago.safeParse({ nombre: "Contado", dias: "7.5" }).success).toBe(false);
  });
});

describe("validarLogo", () => {
  test("acepta PNG, JPG y WebP dentro del límite", () => {
    for (const tipo of ["image/png", "image/jpeg", "image/webp"]) {
      expect(validarLogo({ type: tipo, size: 1024 })).toBeNull();
    }
  });

  test("rechaza otros tipos y archivos mayores a 2 MB", () => {
    expect(validarLogo({ type: "image/gif", size: 1024 })).toBe("El logo debe ser una imagen PNG, JPG o WebP.");
    expect(validarLogo({ type: "image/png", size: LIMITE_LOGO_BYTES + 1 })).toBe("El logo no puede pesar más de 2 MB.");
  });

  test("deduce la extensión del archivo", () => {
    expect(extensionLogo("image/png")).toBe("png");
    expect(extensionLogo("image/jpeg")).toBe("jpg");
    expect(extensionLogo("image/webp")).toBe("webp");
  });
});
