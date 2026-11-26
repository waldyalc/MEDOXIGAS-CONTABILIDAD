"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { usePathname } from "next/navigation";

import { cn } from "cn";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MapaSnapshotsPos, VistaSecundariaPos } from "@/lib/pos/cache-pantallas-pos";

import { DevolucionesPos } from "./devoluciones/devoluciones-pos";
import { EsqueletoListaDetallePOS, EsqueletoPagosPOS, EsqueletoTurnosPOS, EsqueletoVenderPOS } from "./esqueletos-pos";
import { HistorialPos } from "./historial/historial-pos";
import { PagosPos } from "./pagos/pagos-pos";
import { type RutaPos, rutaPosDesdePathname, usePosSpa, vistaDesdeRutaPos } from "./pos-spa-provider";
import { TurnosPos } from "./turnos/turnos-pos";

type HidratadorSnapshotPosProps = {
  [V in VistaSecundariaPos]: { vista: V; datos: MapaSnapshotsPos[V] };
}[VistaSecundariaPos];

export function HidratadorSnapshotPos({ vista, datos }: HidratadorSnapshotPosProps) {
  const { registrarSnapshotInicial } = usePosSpa();

  useEffect(() => {
    registrarSnapshotInicial(vista, datos);
  }, [datos, registrarSnapshotInicial, vista]);

  return null;
}

function EsqueletoSecundarioPos({ vista }: { vista: VistaSecundariaPos }) {
  if (vista === "pagos") return <EsqueletoPagosPOS />;
  if (vista === "turnos") return <EsqueletoTurnosPOS />;
  if (vista === "devoluciones") {
    return (
      <EsqueletoListaDetallePOS titulo="Devoluciones" descripcion="Notas de crédito creadas desde el punto de venta." />
    );
  }
  return <EsqueletoListaDetallePOS titulo="Ventas" descripcion="Facturas cobradas desde el punto de venta." />;
}

const NOMBRE_VISTA: Record<VistaSecundariaPos, string> = {
  historial: "Ventas",
  pagos: "Pagos",
  turnos: "Turnos",
  devoluciones: "Devoluciones",
};

function EstadoSinSnapshotPos({ vista, onReintentar }: { vista: VistaSecundariaPos; onReintentar: () => void }) {
  const nombre = NOMBRE_VISTA[vista];

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 p-4">
      <Alert variant="destructive">
        <AlertDescription>
          {nombre} no tiene una copia local todavía y no pudimos cargarla. Revisa tu conexión e inténtalo de nuevo.
        </AlertDescription>
      </Alert>
      <Button
        type="button"
        variant="outline"
        className="border-pos-primario text-pos-primario hover:bg-pos-primario/10 w-fit"
        onClick={onReintentar}
      >
        Reintentar
      </Button>
    </div>
  );
}

function VistaSecundariaSpa({
  vista,
  snapshots,
  errores,
  reintentarVista,
}: {
  vista: VistaSecundariaPos;
  snapshots: Partial<MapaSnapshotsPos>;
  errores: Partial<Record<VistaSecundariaPos, string>>;
  reintentarVista: (vista: VistaSecundariaPos) => void;
}) {
  if (vista === "historial" && snapshots.historial) return <HistorialPos {...snapshots.historial} />;
  if (vista === "pagos" && snapshots.pagos) return <PagosPos {...snapshots.pagos} />;
  if (vista === "turnos" && snapshots.turnos) return <TurnosPos {...snapshots.turnos} />;
  if (vista === "devoluciones" && snapshots.devoluciones) return <DevolucionesPos {...snapshots.devoluciones} />;

  if (errores[vista]) return <EstadoSinSnapshotPos vista={vista} onReintentar={() => reintentarVista(vista)} />;
  return <EsqueletoSecundarioPos vista={vista} />;
}

function ContenidoRutaSpa({
  rutaActiva,
  vistaActiva,
  mostrarServidorSecundario,
  children,
  nodoVender,
  snapshots,
  errores,
  reintentarVista,
}: {
  rutaActiva: RutaPos;
  vistaActiva: VistaSecundariaPos | null;
  mostrarServidorSecundario: boolean;
  children: ReactNode;
  nodoVender: ReactNode;
  snapshots: Partial<MapaSnapshotsPos>;
  errores: Partial<Record<VistaSecundariaPos, string>>;
  reintentarVista: (vista: VistaSecundariaPos) => void;
}) {
  if (rutaActiva === "/pos") return nodoVender ? null : <EsqueletoVenderPOS />;
  if (mostrarServidorSecundario) return children;
  if (!vistaActiva) return null;
  return (
    <VistaSecundariaSpa vista={vistaActiva} snapshots={snapshots} errores={errores} reintentarVista={reintentarVista} />
  );
}

export function PosSpaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { rutaActiva, navegacionSpa, snapshots, errores, reintentarVista, marcarVenderMontado, terminarNavegacionSpa } =
    usePosSpa();
  const [rutaServidor, setRutaServidor] = useState<RutaPos>(() => rutaPosDesdePathname(pathname) ?? "/pos");
  const [venderNode, setVenderNode] = useState<ReactNode | null>(() =>
    rutaPosDesdePathname(pathname) === "/pos" ? children : null,
  );
  const childrenAnterior = useRef(children);

  useEffect(() => {
    if (childrenAnterior.current === children) return;
    childrenAnterior.current = children;

    const ruta = rutaPosDesdePathname(pathname);
    if (!ruta) return;
    setRutaServidor(ruta);
    if (ruta === "/pos") {
      marcarVenderMontado();
      setVenderNode(children);
    }
    if (ruta === rutaActiva) terminarNavegacionSpa();
  }, [children, marcarVenderMontado, pathname, rutaActiva, terminarNavegacionSpa]);

  const vistaActiva = vistaDesdeRutaPos(rutaActiva);
  const mostrarServidorSecundario = !navegacionSpa && vistaActiva !== null && rutaServidor === rutaActiva;
  const nodoVender = venderNode;

  return (
    <>
      {nodoVender ? <div className={cn("contents", rutaActiva !== "/pos" && "hidden")}>{nodoVender}</div> : null}
      <ContenidoRutaSpa
        rutaActiva={rutaActiva}
        vistaActiva={vistaActiva}
        mostrarServidorSecundario={mostrarServidorSecundario}
        nodoVender={nodoVender}
        snapshots={snapshots}
        errores={errores}
        reintentarVista={reintentarVista}
      >
        {children}
      </ContenidoRutaSpa>
    </>
  );
}
