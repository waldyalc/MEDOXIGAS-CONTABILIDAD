"use client";

import {
  type FormEvent as ReactFormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { usePathname, useSearchParams } from "next/navigation";

import { EsqueletoFiltros, EsqueletoTabla, EsqueletoTarjetas } from "@/components/carga/esqueletos";
import { Loader2 } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cambioRutaCierraCarga,
  decidirCargaClickReporte,
  decidirCargaFormularioGet,
  EVENTO_CARGA_REPORTE,
  esNavegacionInternaReporte,
  type ModoCargaReporte,
  modoDesdeEventoCarga,
} from "@/lib/reportes/carga-transicion";

export const TIEMPO_MAXIMO_CARGA_REPORTE_MS = 15_000;

interface EstadoCarga {
  cargando: boolean;
  modo: ModoCargaReporte;
}

interface RutaActual {
  pathname: string;
  search: string;
}

const ESTADO_INACTIVO: EstadoCarga = { cargando: false, modo: "tabla" };

function claveRuta({ pathname, search }: RutaActual): string {
  return `${pathname}?${search}`;
}

function ObservadorRuta({ alCambiarRuta }: { alCambiarRuta: (pathname: string, search: string) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    alCambiarRuta(pathname, search);
  }, [alCambiarRuta, pathname, search]);

  return null;
}

function ContenidoEsqueletoPagina() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <EsqueletoFiltros campos={4} />
      <EsqueletoTarjetas cantidad={4} />
      <EsqueletoTabla filas={10} columnas={6} />
    </div>
  );
}

function ContenidoEsqueletoTabla() {
  return (
    <div className="sticky top-[86px] mx-auto w-full max-w-6xl px-3 md:px-6">
      <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-primary h-0.5 animate-pulse" />
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <Loader2 className="text-primary size-4 animate-spin" aria-hidden="true" />
          <p className="text-muted-foreground text-sm" role="status">
            Actualizando reporte…
          </p>
        </div>
        <div className="p-3 md:p-4">
          <EsqueletoTabla filas={8} columnas={6} />
        </div>
      </div>
    </div>
  );
}

export function CapaCargaReporte({ modo }: { modo: ModoCargaReporte }) {
  if (modo === "pagina") {
    return (
      <div data-testid="skeleton-carga-reporte" aria-busy="true">
        <ContenidoEsqueletoPagina />
      </div>
    );
  }

  return (
    <div
      data-testid="skeleton-carga-reporte"
      aria-busy="true"
      className="bg-background/85 absolute inset-0 z-30 backdrop-blur-[1px]"
    >
      <ContenidoEsqueletoTabla />
    </div>
  );
}

export function ProveedorCargaReportes({ children }: { children: ReactNode }) {
  const [carga, setCarga] = useState<EstadoCarga>(ESTADO_INACTIVO);
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rutaRef = useRef<RutaActual | null>(null);

  const limpiarTemporizador = useCallback(() => {
    if (temporizadorRef.current === null) return;
    clearTimeout(temporizadorRef.current);
    temporizadorRef.current = null;
  }, []);

  const cerrarCarga = useCallback(() => {
    limpiarTemporizador();
    setCarga((actual) => (actual.cargando ? ESTADO_INACTIVO : actual));
  }, [limpiarTemporizador]);

  const activarCarga = useCallback(
    (modo: ModoCargaReporte) => {
      limpiarTemporizador();
      setCarga({ cargando: true, modo });
      temporizadorRef.current = setTimeout(() => {
        temporizadorRef.current = null;
        setCarga(ESTADO_INACTIVO);
      }, TIEMPO_MAXIMO_CARGA_REPORTE_MS);
    },
    [limpiarTemporizador],
  );

  useEffect(() => limpiarTemporizador, [limpiarTemporizador]);

  const alCambiarRuta = useCallback(
    (pathname: string, search: string) => {
      const anterior = rutaRef.current;
      const nueva = { pathname, search };
      rutaRef.current = nueva;

      if (cambioRutaCierraCarga(anterior === null ? null : claveRuta(anterior), claveRuta(nueva))) {
        cerrarCarga();
      }
    },
    [cerrarCarga],
  );

  useEffect(() => {
    const alEventoCarga = (evento: Event) => {
      activarCarga(modoDesdeEventoCarga(evento));
    };
    const alPopstate = () => {
      const actual = rutaRef.current;
      if (actual === null) {
        cerrarCarga();
        return;
      }

      const destino = `${window.location.pathname}${window.location.search}`;
      const decision = esNavegacionInternaReporte(destino, actual.pathname, actual.search);
      if (decision.navegar) {
        activarCarga(decision.modo);
      } else {
        cerrarCarga();
      }
    };

    window.addEventListener(EVENTO_CARGA_REPORTE, alEventoCarga);
    window.addEventListener("popstate", alPopstate);
    return () => {
      window.removeEventListener(EVENTO_CARGA_REPORTE, alEventoCarga);
      window.removeEventListener("popstate", alPopstate);
    };
  }, [activarCarga, cerrarCarga]);

  function manejarEnvio(evento: ReactFormEvent<HTMLDivElement>) {
    if (!(evento.target instanceof HTMLFormElement)) return;

    const modo = decidirCargaFormularioGet(evento.target.getAttribute("method"), evento.defaultPrevented);
    if (modo !== null) activarCarga(modo);
  }

  function manejarClick(evento: ReactMouseEvent<HTMLDivElement>) {
    if (!(evento.target instanceof Element)) return;

    const enlace = evento.target.closest("a[href]");
    if (!(enlace instanceof HTMLAnchorElement)) return;

    const modo = decidirCargaClickReporte({
      href: enlace.getAttribute("href"),
      pathnameActual: window.location.pathname,
      searchActual: window.location.search,
      boton: evento.button,
      ctrlKey: evento.ctrlKey,
      metaKey: evento.metaKey,
      shiftKey: evento.shiftKey,
      altKey: evento.altKey,
      download: enlace.hasAttribute("download"),
      target: enlace.getAttribute("target"),
      defaultPrevented: evento.defaultPrevented,
    });
    if (modo !== null) activarCarga(modo);
  }

  const ocultarPagina = carga.cargando && carga.modo === "pagina";

  return (
    <div className="relative" onSubmitCapture={manejarEnvio} onClickCapture={manejarClick}>
      <Suspense fallback={null}>
        <ObservadorRuta alCambiarRuta={alCambiarRuta} />
      </Suspense>
      {carga.cargando ? (
        <div
          className="bg-primary pointer-events-none absolute -inset-x-4 -top-4 z-40 h-0.5 animate-pulse md:-inset-x-6 md:-top-6"
          aria-hidden="true"
        />
      ) : null}
      <div className={ocultarPagina ? "hidden" : undefined} aria-hidden={ocultarPagina ? true : undefined}>
        {children}
      </div>
      {carga.cargando ? <CapaCargaReporte modo={carga.modo} /> : null}
    </div>
  );
}
