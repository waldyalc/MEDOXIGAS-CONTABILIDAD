import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cambioRutaCierraCarga,
  type DatosClickEnlaceReporte,
  decidirCargaClickReporte,
  decidirCargaFormularioGet,
  EVENTO_CARGA_REPORTE,
  esNavegacionInternaReporte,
  modoDesdeEventoCarga,
  notificarCargaReporte,
} from "@/lib/reportes/carga-transicion";

import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/reportes/ventas-generales",
  useSearchParams: () => new URLSearchParams("desde=2026-11-01&hasta=2026-11-30"),
}));

const { CapaCargaReporte } = await import("./proveedor-carga-reportes");

function htmlCapa(modo: "tabla" | "pagina"): string {
  return renderToStaticMarkup(<CapaCargaReporte modo={modo} />);
}

function eventoNotificado(modo: "tabla" | "pagina"): Event {
  const eventos: Event[] = [];
  vi.stubGlobal("window", {
    dispatchEvent: (evento: Event) => {
      eventos.push(evento);
      return true;
    },
  });

  notificarCargaReporte(modo);

  const evento = eventos[0];
  if (evento === undefined) throw new Error("notificarCargaReporte no despachó el evento");
  return evento;
}

function datosClick(cambios: Partial<DatosClickEnlaceReporte> = {}): DatosClickEnlaceReporte {
  return {
    href: "/dashboard/reportes/cxc",
    pathnameActual: "/dashboard/reportes/ventas-generales",
    searchActual: "?desde=2026-11-01&hasta=2026-11-30",
    boton: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    download: false,
    target: null,
    defaultPrevented: false,
    ...cambios,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("esNavegacionInternaReporte", () => {
  it("cambia a modo página al navegar a otro reporte", () => {
    expect(esNavegacionInternaReporte("/dashboard/reportes/cxc", "/dashboard/reportes/ventas-generales", "")).toEqual({
      navegar: true,
      modo: "pagina",
    });
  });

  it("cambia a modo tabla cuando solo cambian las fechas, la vista, el filtro o la página", () => {
    expect(
      esNavegacionInternaReporte(
        "/dashboard/reportes/ventas-generales?desde=2026-11-01&hasta=2026-11-30&pagina=2",
        "/dashboard/reportes/ventas-generales",
        "?desde=2026-10-01&hasta=2026-10-31&pagina=1",
      ),
    ).toEqual({ navegar: true, modo: "tabla" });
  });

  it("no activa carga para el mismo URL exacto", () => {
    expect(
      esNavegacionInternaReporte(
        "/dashboard/reportes/ventas-generales?desde=2026-11-01",
        "/dashboard/reportes/ventas-generales",
        "?desde=2026-11-01",
      ),
    ).toEqual({ navegar: false, modo: "tabla" });
  });

  it("no activa carga para URLs externas, hashes ni rutas fuera de reportes", () => {
    expect(esNavegacionInternaReporte("https://example.com/dashboard/reportes/cxc", "/dashboard/reportes", "")).toEqual(
      {
        navegar: false,
        modo: "tabla",
      },
    );
    expect(esNavegacionInternaReporte("#resumen", "/dashboard/reportes/cxc", "")).toEqual({
      navegar: false,
      modo: "tabla",
    });
    expect(esNavegacionInternaReporte("/dashboard/contactos/123", "/dashboard/reportes/cxc", "")).toEqual({
      navegar: false,
      modo: "tabla",
    });
    expect(esNavegacionInternaReporte(null, "/dashboard/reportes/cxc", "")).toEqual({ navegar: false, modo: "tabla" });
  });
});

describe("carga instantánea de reportes", () => {
  it("al disparar notificarCargaReporte('tabla') aparece inmediatamente el skeleton de tabla", () => {
    const evento = eventoNotificado("tabla");

    expect(evento.type).toBe(EVENTO_CARGA_REPORTE);
    const modo = modoDesdeEventoCarga(evento);
    expect(modo).toBe("tabla");

    const html = htmlCapa(modo);
    expect(html).toContain('data-testid="skeleton-carga-reporte"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Actualizando reporte…");
    expect((html.match(/<tr/g) ?? []).length).toBe(9);
  });

  it("al disparar notificarCargaReporte('pagina') aparece inmediatamente el skeleton completo", () => {
    const evento = eventoNotificado("pagina");

    expect(modoDesdeEventoCarga(evento)).toBe("pagina");
    const html = htmlCapa("pagina");
    expect(html).toContain('data-testid="skeleton-carga-reporte"');
    expect(html).toContain('aria-busy="true"');
    expect((html.match(/<tr/g) ?? []).length).toBe(11);
  });

  it("al enviar un formulario GET aparece inmediatamente el skeleton de tabla", () => {
    for (const metodo of [null, "get", "GET"]) {
      expect(decidirCargaFormularioGet(metodo, false)).toBe("tabla");
    }

    const html = htmlCapa("tabla");
    expect(html).toContain('data-testid="skeleton-carga-reporte"');
    expect(html).toContain("Actualizando reporte…");
  });

  it("ignora formularios POST o ya prevenidos", () => {
    expect(decidirCargaFormularioGet("post", false)).toBeNull();
    expect(decidirCargaFormularioGet("get", true)).toBeNull();
  });

  it("al hacer clic en otro reporte aparece inmediatamente el skeleton de página", () => {
    const modo = decidirCargaClickReporte(datosClick());

    expect(modo).toBe("pagina");
    const html = htmlCapa(modo ?? "tabla");
    expect(html).toContain('data-testid="skeleton-carga-reporte"');
    expect((html.match(/<tr/g) ?? []).length).toBe(11);
  });

  it("al hacer clic en otra fecha, pestaña o página del mismo reporte usa skeleton de tabla", () => {
    expect(
      decidirCargaClickReporte(
        datosClick({
          href: "/dashboard/reportes/ventas-generales?desde=2026-11-01&hasta=2026-11-30&pagina=2",
        }),
      ),
    ).toBe("tabla");
  });

  it("no dispara carga con Ctrl, botón secundario, download, target blank o clic prevenido", () => {
    expect(decidirCargaClickReporte(datosClick({ ctrlKey: true }))).toBeNull();
    expect(decidirCargaClickReporte(datosClick({ metaKey: true }))).toBeNull();
    expect(decidirCargaClickReporte(datosClick({ boton: 1 }))).toBeNull();
    expect(decidirCargaClickReporte(datosClick({ download: true }))).toBeNull();
    expect(decidirCargaClickReporte(datosClick({ target: "_blank" }))).toBeNull();
    expect(decidirCargaClickReporte(datosClick({ defaultPrevented: true }))).toBeNull();
  });

  it("al cambiar searchParams o pathname se cierra el skeleton", () => {
    expect(
      cambioRutaCierraCarga(
        "/dashboard/reportes/ventas-generales?desde=2026-10-01",
        "/dashboard/reportes/ventas-generales?desde=2026-11-01",
      ),
    ).toBe(true);
    expect(cambioRutaCierraCarga("/dashboard/reportes/ventas-generales?", "/dashboard/reportes/cxc?")).toBe(true);
    expect(
      cambioRutaCierraCarga(
        "/dashboard/reportes/ventas-generales?desde=2026-11-01",
        "/dashboard/reportes/ventas-generales?desde=2026-11-01",
      ),
    ).toBe(false);
    expect(cambioRutaCierraCarga(null, "/dashboard/reportes/ventas-generales?")).toBe(false);
  });
});

describe("candados del proveedor", () => {
  const fuente = readFileSync(
    join(process.cwd(), "src", "app", "(main)", "dashboard", "reportes", "_components", "proveedor-carga-reportes.tsx"),
    "utf8",
  );

  it("mantiene cableados los disparadores automáticos y el cierre seguro", () => {
    expect(fuente).toContain("onSubmitCapture={manejarEnvio}");
    expect(fuente).toContain("onClickCapture={manejarClick}");
    expect(fuente).toContain("window.addEventListener(EVENTO_CARGA_REPORTE, alEventoCarga)");
    expect(fuente).toContain('window.addEventListener("popstate", alPopstate)');
    expect(fuente).toContain("TIEMPO_MAXIMO_CARGA_REPORTE_MS");
    expect(fuente).toContain("<Suspense fallback={null}>");
  });

  it("no desmonta los hijos al cambiar de reporte y mantiene accesible el skeleton", () => {
    expect(fuente).toContain("{children}");
    expect(fuente).toContain('className={ocultarPagina ? "hidden" : undefined}');
    expect(fuente).toContain('data-testid="skeleton-carga-reporte"');
    expect(fuente).toContain('aria-busy="true"');
  });
});
