"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { usePathname } from "next/navigation";

import {
  guardarSnapshotPantalla,
  hidratarSnapshotPantalla,
  hidratarTodasPantallasPos,
  leerSnapshotPantallaMemoria,
  type MapaSnapshotsPos,
  precargarPantallasPos,
  refrescarPantallaPos,
  type VistaSecundariaPos,
} from "@/lib/pos/cache-pantallas-pos";

import { useOfflinePOS } from "./offline-pos-provider";

export const RUTAS_POS = ["/pos", "/pos/historial", "/pos/pagos", "/pos/turnos", "/pos/devoluciones"] as const;

export type RutaPos = (typeof RUTAS_POS)[number];

type RegistroVistas<T> = Partial<Record<VistaSecundariaPos, T>>;

export interface PosSpaContextoValor {
  rutaActiva: RutaPos;
  navegacionSpa: boolean;
  venderMontado: boolean;
  snapshots: Partial<MapaSnapshotsPos>;
  cargando: RegistroVistas<boolean>;
  errores: RegistroVistas<string>;
  navegarPos: (href: string) => boolean;
  registrarSnapshotInicial: <V extends VistaSecundariaPos>(vista: V, datos: MapaSnapshotsPos[V]) => void;
  marcarVenderMontado: () => void;
  terminarNavegacionSpa: () => void;
  reintentarVista: (vista: VistaSecundariaPos) => void;
}

const ContextoPosSpa = createContext<PosSpaContextoValor | null>(null);

const MENSAJE_SIN_SNAPSHOT = "No se pudo cargar esta pantalla. Revisa tu conexión e inténtalo de nuevo.";

export function esRutaPos(valor: string): valor is RutaPos {
  return (RUTAS_POS as readonly string[]).includes(valor);
}

export function rutaPosDesdePathname(pathname: string): RutaPos | null {
  return esRutaPos(pathname) ? pathname : null;
}

export function vistaDesdeRutaPos(ruta: RutaPos): VistaSecundariaPos | null {
  if (ruta === "/pos/historial") return "historial";
  if (ruta === "/pos/pagos") return "pagos";
  if (ruta === "/pos/turnos") return "turnos";
  if (ruta === "/pos/devoluciones") return "devoluciones";
  return null;
}

export function analizarDestinoPos(href: string): { ruta: RutaPos; tieneQuery: boolean } | null {
  const sinHash = href.split("#")[0] ?? "";
  const indiceConsulta = sinHash.indexOf("?");
  const ruta = indiceConsulta === -1 ? sinHash : sinHash.slice(0, indiceConsulta);
  if (!esRutaPos(ruta)) return null;
  return { ruta, tieneQuery: indiceConsulta !== -1 };
}

function snapshotsIniciales(ambito: string): Partial<MapaSnapshotsPos> {
  const iniciales: Partial<MapaSnapshotsPos> = {};
  const historial = leerSnapshotPantallaMemoria(ambito, "historial");
  const pagos = leerSnapshotPantallaMemoria(ambito, "pagos");
  const turnos = leerSnapshotPantallaMemoria(ambito, "turnos");
  const devoluciones = leerSnapshotPantallaMemoria(ambito, "devoluciones");
  if (historial) iniciales.historial = historial;
  if (pagos) iniciales.pagos = pagos;
  if (turnos) iniciales.turnos = turnos;
  if (devoluciones) iniciales.devoluciones = devoluciones;
  return iniciales;
}

function conSnapshot<V extends VistaSecundariaPos>(
  anterior: Partial<MapaSnapshotsPos>,
  vista: V,
  datos: MapaSnapshotsPos[V],
): Partial<MapaSnapshotsPos> {
  const actual = anterior[vista];
  if (actual && actual.actualizadoEn > datos.actualizadoEn) return anterior;
  if (actual === datos) return anterior;
  return { ...anterior, [vista]: datos } as Partial<MapaSnapshotsPos>;
}

function fusionarMapaSnapshots(
  anterior: Partial<MapaSnapshotsPos>,
  recibidos: Partial<MapaSnapshotsPos>,
): Partial<MapaSnapshotsPos> {
  let siguiente = anterior;
  if (recibidos.historial) siguiente = conSnapshot(siguiente, "historial", recibidos.historial);
  if (recibidos.pagos) siguiente = conSnapshot(siguiente, "pagos", recibidos.pagos);
  if (recibidos.turnos) siguiente = conSnapshot(siguiente, "turnos", recibidos.turnos);
  if (recibidos.devoluciones) siguiente = conSnapshot(siguiente, "devoluciones", recibidos.devoluciones);
  return siguiente;
}

function ponerEstadoVista<T>(anterior: RegistroVistas<T>, vista: VistaSecundariaPos, valor: T): RegistroVistas<T> {
  return { ...anterior, [vista]: valor };
}

function quitarEstadoVista<T>(anterior: RegistroVistas<T>, vista: VistaSecundariaPos): RegistroVistas<T> {
  const siguiente = { ...anterior };
  delete siguiente[vista];
  return siguiente;
}

type EscribirSnapshot = <V extends VistaSecundariaPos>(vista: V, datos: MapaSnapshotsPos[V]) => void;

async function cargarDatosVista(
  ambito: string,
  vista: VistaSecundariaPos,
  escribirSnapshot: EscribirSnapshot,
): Promise<boolean> {
  const hidratado = await hidratarSnapshotPantalla(ambito, vista);
  if (hidratado) escribirSnapshot(vista, hidratado);

  if (navigator.onLine) {
    const fresco = await refrescarPantallaPos(ambito, vista);
    if (fresco) escribirSnapshot(vista, fresco);
  }

  return leerSnapshotPantallaMemoria(ambito, vista) !== null;
}

function puedeAbrirRutaPos(vista: VistaSecundariaPos | null, venderMontado: boolean, rutaActiva: RutaPos): boolean {
  if (vista !== null) return true;
  if (venderMontado) return true;
  return rutaActiva === "/pos";
}

function copiarVistaMemoria(
  ambito: string,
  vista: VistaSecundariaPos | null,
  escribirSnapshot: EscribirSnapshot,
): void {
  if (vista === null) return;
  const enMemoria = leerSnapshotPantallaMemoria(ambito, vista);
  if (enMemoria) escribirSnapshot(vista, enMemoria);
}

function refrescarVistaSiCorresponde(
  vista: VistaSecundariaPos | null,
  cargarVista: (vista: VistaSecundariaPos) => void,
): void {
  if (vista !== null) cargarVista(vista);
}

export function PosSpaProvider({ children }: { children: ReactNode }) {
  const { ambito } = useOfflinePOS();
  const pathname = usePathname();
  const [rutaActiva, setRutaActiva] = useState<RutaPos>(() => rutaPosDesdePathname(pathname) ?? "/pos");
  const [navegacionSpa, setNavegacionSpa] = useState(false);
  const [venderMontado, setVenderMontado] = useState(() => rutaPosDesdePathname(pathname) === "/pos");
  const [snapshots, setSnapshots] = useState<Partial<MapaSnapshotsPos>>(() => snapshotsIniciales(ambito));
  const [cargando, setCargando] = useState<RegistroVistas<boolean>>({});
  const [errores, setErrores] = useState<RegistroVistas<string>>({});
  const secuenciasCarga = useRef<RegistroVistas<number>>({});

  const escribirSnapshot = useCallback(<V extends VistaSecundariaPos>(vista: V, datos: MapaSnapshotsPos[V]): void => {
    setSnapshots((anterior) => conSnapshot(anterior, vista, datos));
  }, []);

  const fusionarRecibidos = useCallback((recibidos: Partial<MapaSnapshotsPos>): void => {
    setSnapshots((anterior) => fusionarMapaSnapshots(anterior, recibidos));
  }, []);

  const marcarVenderMontado = useCallback((): void => {
    setVenderMontado(true);
  }, []);

  const terminarNavegacionSpa = useCallback((): void => {
    setNavegacionSpa(false);
  }, []);

  useEffect(() => {
    let vigente = true;
    void hidratarTodasPantallasPos(ambito)
      .then((recibidos) => {
        if (vigente) fusionarRecibidos(recibidos);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [ambito, fusionarRecibidos]);

  useEffect(() => {
    let vigente = true;

    function precargar() {
      if (!navigator.onLine) return;
      void precargarPantallasPos(ambito)
        .then((recibidos) => {
          if (vigente) fusionarRecibidos(recibidos);
        })
        .catch(() => undefined);
    }

    const temporizador = window.setTimeout(precargar, 600);
    window.addEventListener("online", precargar);
    return () => {
      vigente = false;
      window.clearTimeout(temporizador);
      window.removeEventListener("online", precargar);
    };
  }, [ambito, fusionarRecibidos]);

  useEffect(() => {
    const ruta = rutaPosDesdePathname(pathname);
    if (!ruta) return;
    setRutaActiva((actual) => (actual === ruta ? actual : ruta));
    if (ruta === "/pos") setVenderMontado(true);
  }, [pathname]);

  useEffect(() => {
    function sincronizarConHistorial() {
      const ruta = rutaPosDesdePathname(window.location.pathname);
      if (ruta) setRutaActiva((actual) => (actual === ruta ? actual : ruta));
    }

    window.addEventListener("popstate", sincronizarConHistorial);
    return () => window.removeEventListener("popstate", sincronizarConHistorial);
  }, []);

  const cargarVista = useCallback(
    (vista: VistaSecundariaPos): void => {
      const secuencia = (secuenciasCarga.current[vista] ?? 0) + 1;
      secuenciasCarga.current[vista] = secuencia;
      setCargando((anterior) => ponerEstadoVista(anterior, vista, true));
      setErrores((anterior) => quitarEstadoVista(anterior, vista));

      const vigente = () => secuenciasCarga.current[vista] === secuencia;
      void cargarDatosVista(ambito, vista, escribirSnapshot)
        .then((hayDatos) => {
          if (!vigente() || hayDatos) return;
          setErrores((anterior) => ponerEstadoVista(anterior, vista, MENSAJE_SIN_SNAPSHOT));
        })
        .catch(() => {
          if (!vigente() || leerSnapshotPantallaMemoria(ambito, vista)) return;
          setErrores((anterior) => ponerEstadoVista(anterior, vista, MENSAJE_SIN_SNAPSHOT));
        })
        .finally(() => {
          if (vigente()) setCargando((anterior) => quitarEstadoVista(anterior, vista));
        });
    },
    [ambito, escribirSnapshot],
  );

  const navegarPos = useCallback(
    (href: string): boolean => {
      const destino = analizarDestinoPos(href);
      if (!destino || destino.tieneQuery) return false;

      const ruta = destino.ruta;
      const vista = vistaDesdeRutaPos(ruta);
      if (!puedeAbrirRutaPos(vista, venderMontado, rutaActiva)) return false;

      copiarVistaMemoria(ambito, vista, escribirSnapshot);
      const urlActual = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const yaEsLaRuta = ruta === rutaActiva && urlActual === href;

      if (!yaEsLaRuta) {
        setRutaActiva(ruta);
        setNavegacionSpa(true);
        if (urlActual !== href) window.history.pushState(null, "", href);
      }

      refrescarVistaSiCorresponde(vista, cargarVista);
      return true;
    },
    [ambito, cargarVista, escribirSnapshot, rutaActiva, venderMontado],
  );

  const registrarSnapshotInicial = useCallback(
    <V extends VistaSecundariaPos>(vista: V, datos: MapaSnapshotsPos[V]): void => {
      if (Object.keys(datos.params).length > 0) return;

      const enMemoria = leerSnapshotPantallaMemoria(ambito, vista);
      if (enMemoria && enMemoria.actualizadoEn > datos.actualizadoEn) {
        escribirSnapshot(vista, enMemoria);
        return;
      }

      escribirSnapshot(vista, datos);
      setErrores((anterior) => quitarEstadoVista(anterior, vista));
      void guardarSnapshotPantalla(ambito, vista, datos).catch(() => undefined);
    },
    [ambito, escribirSnapshot],
  );

  const valor = useMemo<PosSpaContextoValor>(
    () => ({
      rutaActiva,
      navegacionSpa,
      venderMontado,
      snapshots,
      cargando,
      errores,
      navegarPos,
      registrarSnapshotInicial,
      marcarVenderMontado,
      terminarNavegacionSpa,
      reintentarVista: cargarVista,
    }),
    [
      rutaActiva,
      navegacionSpa,
      venderMontado,
      snapshots,
      cargando,
      errores,
      navegarPos,
      registrarSnapshotInicial,
      marcarVenderMontado,
      terminarNavegacionSpa,
      cargarVista,
    ],
  );

  return <ContextoPosSpa.Provider value={valor}>{children}</ContextoPosSpa.Provider>;
}

export function usePosSpa(): PosSpaContextoValor {
  const contexto = useContext(ContextoPosSpa);
  if (!contexto) throw new Error("Falta PosSpaProvider.");
  return contexto;
}

export function usePosSpaOpcional(): PosSpaContextoValor | null {
  return useContext(ContextoPosSpa);
}
