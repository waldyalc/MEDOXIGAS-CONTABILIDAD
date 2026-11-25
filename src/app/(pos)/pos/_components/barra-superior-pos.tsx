"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";

import { CheckCircle2, CircleAlert, Clock, Loader2, RefreshCw, Wifi, WifiOff } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { estadoPopoverSincronizacion } from "@/lib/pos/conexion-offline";

import { useOfflinePOS } from "./offline-pos-provider";

type EstadoCachePOS = "al-dia" | "sincronizando" | "pendiente" | "error";

/**
 * Barra superior del shell POS, como Alegra: a la derecha el estado de la red
 * («Disponible» / «Sin conexión») y el de sincronización con su popover de tres
 * filas (Ventas, Productos y Clientes). Solo usa tokens `--pos-*` y colores
 * semánticos; nunca el azul de Medoxigas.
 */
export function BarraSuperiorPos() {
  const pathname = usePathname();
  const offline = useOfflinePOS();
  const [redAbierta, setRedAbierta] = useState(false);
  const [syncAbierta, setSyncAbierta] = useState(false);
  const avisado = useRef(false);

  const sinConexion = offline.estado === "offline";
  const sincronizando = offline.estado === "sincronizando";
  const hayPendientes = offline.porSubir > 0 || offline.fallidas > 0;
  const enCaja = pathname === "/pos";
  const sinConexionPrevio = useRef(sinConexion);
  const resumen = estadoPopoverSincronizacion({
    estado: offline.estado,
    porSubir: offline.porSubir,
    fallidas: offline.fallidas,
  });

  // En modo local-first, cada venta normal pasa ~300 ms por «pendiente» mientras
  // sube en segundo plano: no abrimos el popover en ese destello ni tapamos los
  // botones de acción en /pos/turnos o /pos/historial. Solo se abre automático
  // en la caja (/pos) al reconectar con pendientes, ante errores reales o si algo
  // lleva más de 4 s esperando sin terminar de subir.
  useEffect(() => {
    const acabaDeReconectar = sinConexionPrevio.current && !sinConexion;
    sinConexionPrevio.current = sinConexion;

    if (!hayPendientes) {
      avisado.current = false;
      return;
    }
    if (!enCaja || !offline.preparado || sinConexion || avisado.current) return;

    if (offline.fallidas > 0 || acabaDeReconectar) {
      avisado.current = true;
      setSyncAbierta(true);
      return;
    }

    const temporizador = window.setTimeout(() => {
      avisado.current = true;
      setSyncAbierta(true);
    }, 4_000);
    return () => window.clearTimeout(temporizador);
  }, [enCaja, hayPendientes, offline.fallidas, offline.preparado, sinConexion]);

  return (
    <div className="border-pos-linea dark:bg-card flex h-12 shrink-0 items-center justify-end gap-2 border-b bg-white px-4 print:hidden">
      {offline.sesionRequerida ? (
        <div
          role="status"
          className="mr-auto flex h-8 min-w-0 items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Tu sesión expiró; tus ventas siguen guardadas.</span>
          <a href="/login" className="shrink-0 font-semibold underline underline-offset-2">
            Iniciar sesión
          </a>
        </div>
      ) : null}
      <Popover open={redAbierta} onOpenChange={setRedAbierta}>
        <PopoverTrigger
          className={cn(
            "flex h-8 items-center gap-2 rounded-full border pr-3 pl-1 transition-colors",
            sinConexion
              ? "border-rose-300 bg-rose-50 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:hover:bg-rose-500/20"
              : "border-pos-primario/30 bg-pos-acento/40 hover:bg-pos-acento/70",
          )}
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-white",
              sinConexion ? "bg-rose-600" : "bg-pos-primario",
            )}
          >
            {sinConexion ? (
              <WifiOff className="size-3.5" aria-hidden="true" />
            ) : (
              <Wifi className="size-3.5" aria-hidden="true" />
            )}
          </span>
          <span
            className={cn(
              "text-xs font-medium",
              sinConexion ? "text-rose-700 dark:text-rose-300" : "text-pos-primario",
            )}
          >
            {sinConexion ? "Sin conexión" : "Disponible"}
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-72 border-0 bg-slate-900 p-3 text-white shadow-lg">
          <p className="text-sm font-semibold">{sinConexion ? "Sin conexión" : "Punto de venta disponible"}</p>
          <p className="mt-1 text-xs text-slate-300">
            {sinConexion
              ? "Puedes seguir registrando ventas. Se sincronizarán cuando vuelva la conexión."
              : "Tienes conexión y todas las funciones están disponibles."}
          </p>
        </PopoverContent>
      </Popover>

      <Popover open={syncAbierta} onOpenChange={setSyncAbierta}>
        <PopoverTrigger
          aria-label="Estado de sincronización"
          className="text-pos-texto hover:bg-pos-panel focus-visible:ring-pos-primario/40 relative flex size-9 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {sincronizando ? (
            <RefreshCw className="text-pos-primario size-5 animate-spin" aria-hidden="true" />
          ) : offline.fallidas > 0 ? (
            <>
              <CircleAlert className="size-5 text-rose-600" aria-hidden="true" />
              <ContadorBadge cantidad={offline.fallidas} clase="bg-rose-600" />
            </>
          ) : offline.porSubir > 0 ? (
            <>
              <Clock className="size-5 text-amber-600" aria-hidden="true" />
              <ContadorBadge cantidad={offline.porSubir} clase="bg-amber-500" />
            </>
          ) : (
            <RefreshCw className="size-5" aria-hidden="true" />
          )}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="border-pos-linea dark:bg-card w-80 rounded-xl border bg-white p-0 shadow-lg"
        >
          <div className="border-pos-linea flex items-start justify-between gap-3 border-b p-4">
            <div className="min-w-0">
              <p className="text-pos-texto text-sm font-semibold">{resumen.titulo}</p>
              <p className="text-pos-texto-suave mt-0.5 text-xs">{resumen.descripcion}</p>
            </div>
            <button
              type="button"
              aria-label="Sincronizar ahora"
              className="bg-pos-primario hover:bg-pos-primario-hover flex size-9 shrink-0 items-center justify-center rounded-lg text-white transition-colors"
              onClick={() => void offline.recargarManual()}
            >
              <RefreshCw className={cn("size-4", sincronizando && "animate-spin")} aria-hidden="true" />
            </button>
          </div>

          {hayPendientes ? (
            <div className="border-pos-linea border-b p-3">
              {sinConexion ? (
                <a
                  href="/pos/historial"
                  onClick={() => setSyncAbierta(false)}
                  className="bg-pos-primario hover:bg-pos-primario-hover flex h-9 items-center justify-center rounded-lg text-sm font-medium text-white transition-colors"
                >
                  Revisar pendientes
                </a>
              ) : (
                <Link
                  href="/pos/historial"
                  onClick={() => setSyncAbierta(false)}
                  className="bg-pos-primario hover:bg-pos-primario-hover flex h-9 items-center justify-center rounded-lg text-sm font-medium text-white transition-colors"
                >
                  Revisar pendientes
                </Link>
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-1 p-2">
            <FilaEstado
              icono={
                <IconoVentas sincronizando={sincronizando} porSubir={offline.porSubir} fallidas={offline.fallidas} />
              }
              titulo="Ventas"
              detalle={`${detalleVentas({ sincronizando, porSubir: offline.porSubir, fallidas: offline.fallidas })}`}
            />
            <FilaEstado
              icono={<IconoCache estado={offline.estadoProductos} />}
              titulo="Productos"
              detalle={detalleCache(offline.estadoProductos)}
            />
            <FilaEstado
              icono={<IconoCache estado={offline.estadoClientes} />}
              titulo="Clientes"
              detalle={detalleCache(offline.estadoClientes)}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ContadorBadge({ cantidad, clase }: { cantidad: number; clase: string }) {
  return (
    <span
      className={cn(
        "absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold text-white",
        clase,
      )}
    >
      {cantidad}
    </span>
  );
}

function FilaEstado({ icono, titulo, detalle }: { icono: ReactNode; titulo: string; detalle: string }) {
  return (
    <div className="flex items-center gap-3 px-2 py-2">
      <span className="flex size-6 shrink-0 items-center justify-center">{icono}</span>
      <div className="min-w-0">
        <p className="text-pos-texto text-sm font-medium">{titulo}</p>
        <p className="text-pos-texto-suave truncate text-xs">{detalle}</p>
      </div>
    </div>
  );
}

function IconoVentas({
  sincronizando,
  porSubir,
  fallidas,
}: {
  sincronizando: boolean;
  porSubir: number;
  fallidas: number;
}) {
  if (porSubir === 0 && fallidas === 0) return <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />;
  if (sincronizando) return <Loader2 className="text-pos-primario size-5 animate-spin" aria-hidden="true" />;
  if (fallidas > 0) return <CircleAlert className="size-5 text-rose-600" aria-hidden="true" />;
  return <CircleAlert className="size-5 text-amber-600" aria-hidden="true" />;
}

function IconoCache({ estado }: { estado: EstadoCachePOS }) {
  if (estado === "sincronizando")
    return <Loader2 className="text-pos-primario size-5 animate-spin" aria-hidden="true" />;
  if (estado === "al-dia") return <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />;
  return (
    <CircleAlert className={cn("size-5", estado === "error" ? "text-rose-600" : "text-amber-600")} aria-hidden="true" />
  );
}

function detalleVentas({
  sincronizando,
  porSubir,
  fallidas,
}: {
  sincronizando: boolean;
  porSubir: number;
  fallidas: number;
}): string {
  if (sincronizando) return "Sincronizando…";
  if (fallidas > 0) {
    const etiqueta = fallidas === 1 ? "venta con problema" : "ventas con problema";
    return porSubir > 0 ? `${fallidas} ${etiqueta} · ${porSubir} por subir` : `${fallidas} ${etiqueta}`;
  }
  if (porSubir > 0) return `${porSubir} ${porSubir === 1 ? "venta" : "ventas"} por subir`;
  return "Todo sincronizado";
}

function detalleCache(estado: EstadoCachePOS): string {
  if (estado === "al-dia") return "Al día";
  if (estado === "sincronizando") return "Sincronizando…";
  if (estado === "error") return "No se pudo actualizar";
  return "Pendiente de descargar";
}
