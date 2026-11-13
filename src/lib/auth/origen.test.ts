import { describe, expect, test } from "vitest";

import { origenDesdeHeaders } from "./origen";

describe("origenDesdeHeaders", () => {
  test("usa x-forwarded-host y x-forwarded-proto", () => {
    const headers = new Headers({
      "x-forwarded-host": "app.medoxigas.com",
      "x-forwarded-proto": "https",
    });
    expect(origenDesdeHeaders(headers)).toBe("https://app.medoxigas.com");
  });

  test("cae al host y usa https fuera de localhost", () => {
    expect(origenDesdeHeaders(new Headers({ host: "medoxigas-contabilidad.vercel.app" }))).toBe(
      "https://medoxigas-contabilidad.vercel.app",
    );
    expect(origenDesdeHeaders(new Headers({ host: "medoxigas-contabilidad-prueba.vercel.app" }))).toBe(
      "https://medoxigas-contabilidad-prueba.vercel.app",
    );
  });

  test("localhost usa http", () => {
    expect(origenDesdeHeaders(new Headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(origenDesdeHeaders(new Headers({ host: "127.0.0.1:3000" }))).toBe("http://127.0.0.1:3000");
  });

  test("toma el primer valor de una lista y prefiere x-forwarded-host", () => {
    const headers = new Headers({
      host: "interno:3000",
      "x-forwarded-host": "medoxigas-contabilidad-prueba.vercel.app",
      "x-forwarded-proto": "https,http",
    });
    expect(origenDesdeHeaders(headers)).toBe("https://medoxigas-contabilidad-prueba.vercel.app");
  });

  test("sin host devuelve vacío", () => {
    expect(origenDesdeHeaders(new Headers())).toBe("");
  });
});
