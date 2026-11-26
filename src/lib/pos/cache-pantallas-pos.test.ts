import type { ComponentProps } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DevolucionesPos } from "@/app/(pos)/pos/_components/devoluciones/devoluciones-pos";
import type { HistorialPos } from "@/app/(pos)/pos/_components/historial/historial-pos";
import type { PagosPos } from "@/app/(pos)/pos/_components/pagos/pagos-pos";
import type { TurnosPos } from "@/app/(pos)/pos/_components/turnos/turnos-pos";
import type { ResumenPagina } from "@/lib/listas/parametros";

import {
  guardarSnapshotPantalla,
  hidratarSnapshotPantalla,
  hidratarTodasPantallasPos,
  leerSnapshotPantallaMemoria,
  limpiarMemoriaPantallasPos,
  precargarPantallasPos,
  RUTA_A_VISTA_SECUNDARIA,
  refrescarPantallaPos,
  type SnapshotDevolucionesPos,
  type SnapshotHistorialPos,
  type SnapshotPagosPos,
  type SnapshotTurnosPos,
  type TerminalConTicketSnapshotPos,
  VISTAS_SECUNDARIAS_POS,
} from "./cache-pantallas-pos";
import { PLANTILLA_TICKET_DEFECTO } from "./tipos";

const mocks = vi.hoisted(() => {
  const datos = new Map<string, unknown>();

  return {
    datos,
    leerOffline: vi.fn(async (_store: string, clave: string) => datos.get(clave)),
    guardarOffline: vi.fn(async (_store: string, clave: string, valor: unknown) => {
      datos.set(clave, valor);
    }),
  };
});

vi.mock("./almacen-offline", () => ({
  leerOffline: mocks.leerOffline,
  guardarOffline: mocks.guardarOffline,
}));

type Igual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type SinMarcaDeTiempo<T> = Omit<T, "actualizadoEn">;

function afirmarContratosExactos() {
  const historial: Igual<SinMarcaDeTiempo<SnapshotHistorialPos>, ComponentProps<typeof HistorialPos>> = true;
  const pagos: Igual<SinMarcaDeTiempo<SnapshotPagosPos>, ComponentProps<typeof PagosPos>> = true;
  const turnos: Igual<SinMarcaDeTiempo<SnapshotTurnosPos>, ComponentProps<typeof TurnosPos>> = true;
  const devoluciones: Igual<SinMarcaDeTiempo<SnapshotDevolucionesPos>, ComponentProps<typeof DevolucionesPos>> = true;
  return [historial, pagos, turnos, devoluciones] as const;
}

function resumen(): ResumenPagina {
  return { pagina: 1, totalPaginas: 1, inicio: 0, fin: 0, total: 0 };
}

function terminal(): TerminalConTicketSnapshotPos {
  return {
    id: "terminal-1",
    nombre: "Caja 1",
    cuenta_efectivo_id: "cuenta-efectivo",
    plantilla_ticket: PLANTILLA_TICKET_DEFECTO,
  };
}

function snapshotHistorial(cambios: Partial<SnapshotHistorialPos> = {}): SnapshotHistorialPos {
  return {
    filas: [],
    resumen: resumen(),
    params: {},
    terminales: [],
    desde: "2026-11-01",
    hasta: "2026-11-26",
    empresa: null,
    plantillaTicket: PLANTILLA_TICKET_DEFECTO,
    plantillaFactura: { mostrarLogo: true, notas: "", terminos: "" },
    puedeEscribir: true,
    hayFiltros: false,
    error: null,
    actualizadoEn: 1_000,
    ...cambios,
  };
}

function snapshotPagos(cambios: Partial<SnapshotPagosPos> = {}): SnapshotPagosPos {
  return {
    terminal: terminal(),
    turnoAbierto: false,
    vista: null,
    cuentas: [],
    filas: [],
    resumenPagina: resumen(),
    params: {},
    tipo: "ingreso",
    puedeEscribir: true,
    error: null,
    actualizadoEn: 1_100,
    ...cambios,
  };
}

function snapshotTurnos(cambios: Partial<SnapshotTurnosPos> = {}): SnapshotTurnosPos {
  return {
    terminal: terminal(),
    vistaInicial: null,
    turnoAbierto: false,
    cuentas: [],
    cierres: [],
    resumenPagina: resumen(),
    terminales: [],
    todas: false,
    params: {},
    puedeEscribir: true,
    error: null,
    actualizadoEn: 1_200,
    ...cambios,
  };
}

function snapshotDevoluciones(cambios: Partial<SnapshotDevolucionesPos> = {}): SnapshotDevolucionesPos {
  return {
    filas: [],
    resumen: resumen(),
    params: {},
    desde: "2026-11-01",
    hasta: "2026-11-26",
    terminal: { id: "terminal-1", nombre: "Caja 1", cuenta_efectivo_id: "cuenta-efectivo" },
    cuentaEfectivoNombre: "Caja",
    sinCaja: false,
    turno: null,
    efectivoEsperado: "0.00",
    facturaInicial: null,
    plantilla: PLANTILLA_TICKET_DEFECTO,
    puedeEscribir: true,
    hayFiltros: false,
    error: null,
    actualizadoEn: 1_300,
    ...cambios,
  };
}

function pantallasCompletas() {
  return {
    historial: snapshotHistorial(),
    pagos: snapshotPagos(),
    turnos: snapshotTurnos(),
    devoluciones: snapshotDevoluciones(),
  };
}

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mocks.datos.clear();
  mocks.leerOffline.mockClear();
  mocks.guardarOffline.mockClear();
  limpiarMemoriaPantallasPos();
});

describe("caché RAM/IndexedDB de las pantallas del POS", () => {
  it("mantiene los snapshots exactamente alineados con los props de las cuatro pantallas", () => {
    expect(afirmarContratosExactos()).toEqual([true, true, true, true]);
  });

  it("mapea las cuatro rutas secundarias a su vista", () => {
    expect(RUTA_A_VISTA_SECUNDARIA).toEqual({
      "/pos/historial": "historial",
      "/pos/pagos": "pagos",
      "/pos/turnos": "turnos",
      "/pos/devoluciones": "devoluciones",
    });
  });

  it("lee síncronamente desde RAM después de guardar y aísla cada ámbito", async () => {
    const snapshot = snapshotHistorial({ actualizadoEn: 2_000 });

    await guardarSnapshotPantalla("usuario-a/terminal-1", "historial", snapshot);

    const lectura = leerSnapshotPantallaMemoria("usuario-a/terminal-1", "historial");
    expect(lectura).toBe(snapshot);
    expect(lectura).not.toBeInstanceOf(Promise);
    expect(leerSnapshotPantallaMemoria("usuario-b/terminal-1", "historial")).toBeNull();
    expect(mocks.guardarOffline).toHaveBeenCalledWith("config", "usuario-a/terminal-1/pantalla/historial", snapshot);
  });

  it("hidrata desde IndexedDB cuando RAM está vacía y calienta las cuatro vistas en paralelo", async () => {
    const ambito = "usuario-a/terminal-2";
    const pantallas = pantallasCompletas();
    for (const vista of VISTAS_SECUNDARIAS_POS) {
      mocks.datos.set(`${ambito}/pantalla/${vista}`, pantallas[vista]);
    }

    const pagos = await hidratarSnapshotPantalla(ambito, "pagos");
    expect(pagos).toEqual(pantallas.pagos);
    expect(leerSnapshotPantallaMemoria(ambito, "pagos")).toEqual(pantallas.pagos);

    const todas = await hidratarTodasPantallasPos(ambito);
    expect(todas).toEqual(pantallas);
    for (const vista of VISTAS_SECUNDARIAS_POS) {
      expect(leerSnapshotPantallaMemoria(ambito, vista)).toEqual(pantallas[vista]);
    }
  });

  it("devuelve null limpiamente si IndexedDB falla al hidratar", async () => {
    mocks.leerOffline.mockRejectedValueOnce(new Error("IndexedDB bloqueada"));

    await expect(hidratarSnapshotPantalla("ambito-falla", "historial")).resolves.toBeNull();
    expect(leerSnapshotPantallaMemoria("ambito-falla", "historial")).toBeNull();
  });
});

describe("refresco de red de las pantallas del POS", () => {
  it("con un 200 válido actualiza RAM e IndexedDB sin pisar el ámbito vecino", async () => {
    const snapshot = snapshotHistorial({ actualizadoEn: 3_000 });
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      respuestaJson({ ok: true, vista: "historial", datos: snapshot }),
    );

    const resultado = await refrescarPantallaPos("ambito-red", "historial", { fetchFn });

    expect(resultado).toEqual(snapshot);
    expect(leerSnapshotPantallaMemoria("ambito-red", "historial")).toEqual(snapshot);
    expect(leerSnapshotPantallaMemoria("otro-ambito", "historial")).toBeNull();
    expect(mocks.datos.get("ambito-red/pantalla/historial")).toEqual(snapshot);

    const llamada = fetchFn.mock.calls[0];
    expect(llamada?.[0]).toBe("/api/pos/estado-pantallas?vista=historial");
    expect(llamada?.[1]).toMatchObject({ cache: "no-store" });
    expect(llamada?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("devuelve un snapshot filtrado pero no pisa la vista por defecto cuando recibe query", async () => {
    const original = snapshotHistorial({ actualizadoEn: 3_100 });
    const filtrado = snapshotHistorial({ actualizadoEn: 3_200, hayFiltros: true, params: { q: "B02" } });
    await guardarSnapshotPantalla("ambito-filtro", "historial", original);
    mocks.guardarOffline.mockClear();

    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      respuestaJson({ ok: true, vista: "historial", datos: filtrado }),
    );

    const resultado = await refrescarPantallaPos("ambito-filtro", "historial", { query: "q=B02", fetchFn });

    expect(resultado).toEqual(filtrado);
    expect(leerSnapshotPantallaMemoria("ambito-filtro", "historial")).toEqual(original);
    expect(mocks.datos.get("ambito-filtro/pantalla/historial")).toEqual(original);
    expect(mocks.guardarOffline).not.toHaveBeenCalled();
    expect(fetchFn.mock.calls[0]?.[0]).toBe("/api/pos/estado-pantallas?vista=historial&q=B02");
  });

  it("devuelve null sin lanzar ante 500, red caída o timeout", async () => {
    const fetch500 = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      respuestaJson({ ok: false, error: "fallo" }, 500),
    );
    await expect(refrescarPantallaPos("ambito-500", "pagos", { fetchFn: fetch500 })).resolves.toBeNull();

    const fetchRedCaida = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      throw new TypeError("fetch failed");
    });
    await expect(refrescarPantallaPos("ambito-sin-red", "pagos", { fetchFn: fetchRedCaida })).resolves.toBeNull();

    const fetchLento = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          if (!init?.signal) {
            reject(new Error("La prueba necesita la señal de timeout"));
            return;
          }
          init.signal.addEventListener(
            "abort",
            () => reject(new DOMException("The operation timed out", "TimeoutError")),
            { once: true },
          );
        }),
    );
    await expect(
      refrescarPantallaPos("ambito-lento", "pagos", { fetchFn: fetchLento, timeoutMs: 5 }),
    ).resolves.toBeNull();
  });

  it("no guarda un cuerpo inválido aunque la respuesta sea 200", async () => {
    const fetchInvalido = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      respuestaJson({ ok: true, vista: "turnos", datos: { sinActualizadoEn: true } }),
    );

    await expect(refrescarPantallaPos("ambito-invalido", "turnos", { fetchFn: fetchInvalido })).resolves.toBeNull();
    expect(leerSnapshotPantallaMemoria("ambito-invalido", "turnos")).toBeNull();
    expect(mocks.guardarOffline).not.toHaveBeenCalled();
  });
});

describe("precarga silenciosa de las cuatro pantallas", () => {
  it("guarda historial, pagos, turnos y devoluciones con vista=todas", async () => {
    const pantallas = pantallasCompletas();
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      respuestaJson({ ok: true, vista: "todas", pantallas }),
    );

    const resultado = await precargarPantallasPos("ambito-precarga", { fetchFn });

    expect(resultado).toEqual(pantallas);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("/api/pos/estado-pantallas?vista=todas");
    for (const vista of VISTAS_SECUNDARIAS_POS) {
      expect(leerSnapshotPantallaMemoria("ambito-precarga", vista)).toEqual(pantallas[vista]);
      expect(mocks.datos.get(`ambito-precarga/pantalla/${vista}`)).toEqual(pantallas[vista]);
    }
  });

  it("deduplica llamadas simultáneas del mismo ámbito en una sola petición", async () => {
    const resolvers: Array<(respuesta: Response) => void> = [];
    const fetchFn = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const primera = precargarPantallasPos("ambito-dedupe", { fetchFn });
    const segunda = precargarPantallasPos("ambito-dedupe", { fetchFn });

    expect(segunda).toBe(primera);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const resolver = resolvers[0];
    if (!resolver) throw new Error("La precarga no quedó registrada");
    resolver(respuestaJson({ ok: true, vista: "todas", pantallas: pantallasCompletas() }));

    const resultado = await primera;
    expect(Object.keys(resultado).sort()).toEqual(["devoluciones", "historial", "pagos", "turnos"]);
  });

  it("devuelve un mapa vacío sin lanzar si la precarga falla", async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      throw new TypeError("fetch failed");
    });

    await expect(precargarPantallasPos("ambito-precarga-falla", { fetchFn })).resolves.toEqual({});
  });
});
