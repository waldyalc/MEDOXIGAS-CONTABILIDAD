import { describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("next/navigation", () => ({
  usePathname: () => "/pos",
}));

vi.mock("./offline-pos-provider", () => ({
  useOfflinePOS: () => ({ ambito: "zztest/terminal" }),
}));

import { analizarDestinoPos, esRutaPos, rutaPosDesdePathname, vistaDesdeRutaPos } from "./pos-spa-provider";

const POS = join(process.cwd(), "src", "app", "(pos)", "pos");

function leer(ruta: string): string {
  return readFileSync(join(POS, ruta), "utf8");
}

describe("rutas del shell SPA del POS", () => {
  it("reconoce exactamente las cinco pantallas internas", () => {
    for (const ruta of ["/pos", "/pos/historial", "/pos/pagos", "/pos/turnos", "/pos/devoluciones"]) {
      expect(esRutaPos(ruta)).toBe(true);
      expect(rutaPosDesdePathname(ruta)).toBe(ruta);
    }

    expect(esRutaPos("/dashboard")).toBe(false);
    expect(rutaPosDesdePathname("/dashboard")).toBeNull();
  });

  it("mapea las cuatro rutas secundarias a su vista y separa las URLs con query", () => {
    expect(vistaDesdeRutaPos("/pos/historial")).toBe("historial");
    expect(vistaDesdeRutaPos("/pos/pagos")).toBe("pagos");
    expect(vistaDesdeRutaPos("/pos/turnos")).toBe("turnos");
    expect(vistaDesdeRutaPos("/pos/devoluciones")).toBe("devoluciones");
    expect(vistaDesdeRutaPos("/pos")).toBeNull();

    expect(analizarDestinoPos("/pos/turnos")).toEqual({ ruta: "/pos/turnos", tieneQuery: false });
    expect(analizarDestinoPos("/pos/devoluciones?factura=abc")).toEqual({
      ruta: "/pos/devoluciones",
      tieneQuery: true,
    });
    expect(analizarDestinoPos("/dashboard/contactos")).toBeNull();
  });
});

describe("PosSpaProvider local-first", () => {
  it("arranca leyendo RAM síncrona, hidrata IndexedDB y precarga en segundo plano", () => {
    const provider = leer("_components/pos-spa-provider.tsx");

    expect(provider).toContain('leerSnapshotPantallaMemoria(ambito, "historial")');
    expect(provider).toContain("useState<Partial<MapaSnapshotsPos>>(() => snapshotsIniciales(ambito))");
    expect(provider).toContain("hidratarTodasPantallasPos(ambito)");
    expect(provider).toContain("window.setTimeout(precargar, 600)");
    expect(provider).toContain("if (!navigator.onLine) return;");
    expect(provider).toContain("precargarPantallasPos(ambito)");
  });

  it("navega con pushState, escucha popstate y nunca espera un RSC al cambiar de pestaña", () => {
    const provider = leer("_components/pos-spa-provider.tsx");

    expect(provider).toContain('window.history.pushState(null, "", href)');
    expect(provider).toContain('window.addEventListener("popstate", sincronizarConHistorial)');
    expect(provider).toContain("refrescarPantallaPos(ambito, vista)");
    expect(provider).toContain("setRutaActiva(ruta);");
    expect(provider).not.toContain("useRouter");
    expect(provider).not.toContain("router.push");
  });

  it("conserva la excepción segura: query compleja o Facturar nunca montado vuelven al Link normal", () => {
    const provider = leer("_components/pos-spa-provider.tsx");

    expect(provider).toContain("if (!destino || destino.tieneQuery) return false;");
    expect(provider).toContain("if (!puedeAbrirRutaPos(vista, venderMontado, rutaActiva)) return false;");
    expect(provider).toContain("if (vista !== null) return true;");
    expect(provider).toContain("if (venderMontado) return true;");
    expect(provider).toContain('return rutaActiva === "/pos";');
  });

  it("registra el SSR en RAM/IndexedDB sin pisar una copia más nueva ni convertir filtros en vista base", () => {
    const provider = leer("_components/pos-spa-provider.tsx");

    expect(provider).toContain("if (Object.keys(datos.params).length > 0) return;");
    expect(provider).toContain("enMemoria.actualizadoEn > datos.actualizadoEn");
    expect(provider).toContain("guardarSnapshotPantalla(ambito, vista, datos)");
  });
});

describe("PosSpaShell", () => {
  it("conserva VenderPos montado y lo oculta con display none, sin desmontar carrito ni scroll", () => {
    const shell = leer("_components/pos-spa-shell.tsx");

    expect(shell).toContain("const [venderNode, setVenderNode] = useState<ReactNode | null>");
    expect(shell).toContain('cn("contents", rutaActiva !== "/pos" && "hidden")');
    expect(shell).toContain("setVenderNode(children);");
    expect(shell).toContain("marcarVenderMontado();");
  });

  it("pinta las cuatro vistas secundarias directamente desde sus snapshots", () => {
    const shell = leer("_components/pos-spa-shell.tsx");

    expect(shell).toContain("<HistorialPos {...snapshots.historial} />");
    expect(shell).toContain("<PagosPos {...snapshots.pagos} />");
    expect(shell).toContain("<TurnosPos {...snapshots.turnos} />");
    expect(shell).toContain("<DevolucionesPos {...snapshots.devoluciones} />");
  });

  it("conserva el SSR inicial y adopta la respuesta real cuando cambian filtros o paginación", () => {
    const shell = leer("_components/pos-spa-shell.tsx");

    expect(shell).toContain("const [rutaServidor, setRutaServidor] = useState<RutaPos>");
    expect(shell).toContain("if (childrenAnterior.current === children) return;");
    expect(shell).toContain("setRutaServidor(ruta);");
    expect(shell).toContain("if (ruta === rutaActiva) terminarNavegacionSpa();");
    expect(shell).toContain("if (mostrarServidorSecundario) return children;");
  });

  it("usa esqueletos solo cuando todavía no existe copia local y ofrece fallback limpio sin red", () => {
    const shell = leer("_components/pos-spa-shell.tsx");

    expect(shell).toContain("<EsqueletoPagosPOS />");
    expect(shell).toContain("<EsqueletoTurnosPOS />");
    expect(shell).toContain("<EsqueletoListaDetallePOS");
    expect(shell).toContain("no tiene una copia local todavía");
    expect(shell).toContain("Reintentar");
  });
});

describe("integración del shell en el POS", () => {
  it("el layout envuelve el contenido una sola vez con provider y shell", () => {
    const layout = leer("layout.tsx");

    expect(layout).toContain("<PosSpaProvider>");
    expect(layout).toContain("<PosSpaShell>{children}</PosSpaShell>");
    expect(layout.indexOf("<PosSpaProvider>")).toBeLessThan(layout.indexOf("<PosSpaShell>{children}</PosSpaShell>"));
  });

  it("EnlacePos corta la navegación normal solo cuando navegarPos confirma el cambio instantáneo", () => {
    const enlace = leer("_components/enlace-pos.tsx");

    expect(enlace).toContain("spa?.navegarPos(href)");
    expect(enlace).toContain("evento.preventDefault();");
    expect(enlace).toContain("limpiarNavegacionInternaPos();");
    expect(enlace.indexOf("marcarNavegacionInternaPos();")).toBeLessThan(enlace.indexOf("spa?.navegarPos(href)"));
    expect(enlace.indexOf("evento.preventDefault();")).toBeLessThan(enlace.indexOf("onClick?.(evento);"));
  });

  it("el menú marca activo con rutaActiva para que el clic se vea en el mismo tick", () => {
    const menu = leer("_components/menu-pos.tsx");

    expect(menu).toContain("const rutaActiva = spa?.rutaActiva ?? pathname;");
    expect(menu).toContain("esActivo(rutaActiva, item.href)");
  });

  it("las cuatro páginas secundarias alimentan su snapshot SSR al hidratarse", () => {
    const paginas = [
      ["historial/page.tsx", "historial"],
      ["pagos/page.tsx", "pagos"],
      ["turnos/page.tsx", "turnos"],
      ["devoluciones/page.tsx", "devoluciones"],
    ] as const;

    for (const [ruta, vista] of paginas) {
      const pagina = leer(ruta);
      expect(pagina).toContain("HidratadorSnapshotPos");
      expect(pagina).toContain(`vista="${vista}"`);
      expect(pagina).toContain("actualizadoEn: Date.now()");
    }
  });
});
