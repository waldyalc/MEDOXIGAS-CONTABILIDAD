import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Enlace } from "@/components/enlace";

import type { ColumnaLista } from "./tabla-lista";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const { TablaLista } = await import("./tabla-lista");
const { extraerTextoPlano } = await import("./texto-truncado");

const NOMBRE_LARGO = "SERVICIOS TRANSPORTE Y CONSTRUCCIONES LA BATALLA SRL";

type FilaPrueba = { id: string };

function atributosCeldas(html: string): string[] {
  return [...html.matchAll(/<td\b([^>]*)>/g)].map((coincidencia) => coincidencia[1] ?? "");
}

function tablaPrueba(columnas: readonly ColumnaLista<FilaPrueba>[]) {
  return renderToStaticMarkup(
    <TablaLista
      columnas={columnas}
      filas={[{ id: "fila-1" }]}
      claveFila={(fila) => fila.id}
      vacio={{ titulo: "Sin datos" }}
    />,
  );
}

describe("extraerTextoPlano", () => {
  it("extrae texto de strings, números, spans y Enlace anidados", () => {
    expect(extraerTextoPlano("Texto directo")).toBe("Texto directo");
    expect(extraerTextoPlano(764)).toBe("764");
    expect(extraerTextoPlano(<span>SERVICIOS TRANSPORTE</span>)).toBe("SERVICIOS TRANSPORTE");
    expect(
      extraerTextoPlano(
        <Enlace href="/dashboard/contactos/1">
          <span>SERVICIOS</span> TRANSPORTE <strong>LA BATALLA SRL</strong>
        </Enlace>,
      ),
    ).toBe("SERVICIOS TRANSPORTE LA BATALLA SRL");
  });
});

describe("TablaLista con columnas de texto largo", () => {
  it("acota proveedor en dos líneas, conserva el texto completo y no lo deja en nowrap", () => {
    const html = tablaPrueba([
      {
        clave: "proveedor",
        encabezado: "Proveedor",
        celda: () => <Enlace href="/dashboard/contactos/1">{NOMBRE_LARGO}</Enlace>,
      },
      {
        clave: "total",
        encabezado: "Total",
        alineacion: "derecha",
        celda: () => "RD$ 76,523.60",
      },
    ]);
    const [proveedor, total] = atributosCeldas(html);

    expect(proveedor).toContain("whitespace-normal");
    expect(proveedor).toContain("max-w-[210px]");
    expect(proveedor).not.toContain("whitespace-nowrap");
    expect(html).toContain("line-clamp-2");
    expect(html).toContain("wrap-anywhere");
    expect(html).toContain(`title="${NOMBRE_LARGO}"`);
    expect(html).toContain("/dashboard/contactos/1");
    expect(html).not.toContain("<button");
    expect(total).toContain("whitespace-nowrap");
  });

  it("acota un NCF largo en una línea con tooltip accesible", () => {
    const ncf = "B0100022646-ALEGRA-754";
    const html = tablaPrueba([
      {
        clave: "ncf",
        encabezado: "No. / NCF",
        celda: () => <span className="font-mono text-xs">{ncf}</span>,
      },
    ]);
    const [celdaNcf] = atributosCeldas(html);

    expect(celdaNcf).toContain("max-w-[165px]");
    expect(celdaNcf).toContain("whitespace-normal");
    expect(html).toContain("truncate");
    expect(html).toContain(`title="${ncf}"`);
    expect(html).not.toContain("<button");
  });

  it("permite desactivar el acotado automático y forzarlo en otra columna", () => {
    const sinTruncar = tablaPrueba([
      {
        clave: "proveedor",
        encabezado: "Proveedor",
        truncar: false,
        celda: () => NOMBRE_LARGO,
      },
    ]);
    const forzado = tablaPrueba([
      {
        clave: "observaciones",
        encabezado: "Observaciones",
        truncar: "1",
        celda: () => NOMBRE_LARGO,
      },
    ]);

    expect(atributosCeldas(sinTruncar)[0]).toContain("whitespace-nowrap");
    expect(sinTruncar).not.toContain("line-clamp-2");
    expect(atributosCeldas(forzado)[0]).toContain("max-w-[210px]");
    expect(forzado).toContain("truncate");
  });
});
