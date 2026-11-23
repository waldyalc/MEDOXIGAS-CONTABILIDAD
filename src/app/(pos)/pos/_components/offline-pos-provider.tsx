"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import { AlertTriangle, RefreshCw, Trash2 } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { almacenColaOffline, conBloqueoOffline, siguienteSecuenciaOffline } from "@/lib/pos/almacen-offline";
import {
  nuevaOperacionOffline,
  type OperacionOffline,
  programarReintentoOffline,
  type RevisionCierreOffline,
  resumenConfirmacionOffline,
  resumenSnapshotOffline,
  revisionCierreOffline,
  sincronizarColaOffline,
} from "@/lib/pos/cola-offline";
import { transportarOperacionOffline } from "@/lib/pos/transporte-offline";
import { createClient } from "@/lib/supabase/client";

type EstadoConexion = "online" | "offline" | "sincronizando" | "error";

interface ContextoOffline {
  ambito: string;
  estado: EstadoConexion;
  pendientes: number;
  porSubir: number;
  fallidas: number;
  operaciones: OperacionOffline[];
  error: string | null;
  preparado: boolean;
  abrirPanel: () => void;
  encolar: (tipo: OperacionOffline["tipo"], payload: unknown, snapshot: unknown) => Promise<OperacionOffline>;
  reintentarOperacion: (uuid: string) => Promise<void>;
  descartarOperacion: (uuid: string) => Promise<void>;
  comprobarCierre: () => Promise<RevisionCierreOffline>;
  conCierreSeguro: <T>(accion: () => Promise<T>) => Promise<T>;
}

function hayProblema(actuales: OperacionOffline[]): boolean {
  return actuales.some((fila) => fila.estado === "fallida" || (fila.estado === "pendiente" && fila.error !== null));
}

const Contexto = createContext<ContextoOffline | null>(null);

export function OfflinePosProvider({
  ambito,
  terminalId,
  turnoId,
  children,
}: {
  ambito: string;
  terminalId: string;
  turnoId: string | null;
  children: ReactNode;
}) {
  const [estado, setEstado] = useState<EstadoConexion>("online");
  const [operaciones, setOperaciones] = useState<OperacionOffline[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preparado, setPreparado] = useState(false);
  const [panel, setPanel] = useState(false);
  const [descartando, setDescartando] = useState<OperacionOffline | null>(null);
  const [recargaLista, setRecargaLista] = useState(false);
  const conectado = useRef(false);
  const ocupado = useRef(false);
  const canal = useRef<BroadcastChannel | null>(null);

  const refrescar = useCallback(async () => {
    const filas = await almacenColaOffline.listar(ambito);
    setOperaciones(filas.sort((a, b) => a.secuencia - b.secuencia));
    setPreparado(true);
    return filas;
  }, [ambito]);

  const sincronizar = useCallback(async () => {
    if (ocupado.current || !conectado.current) return;
    ocupado.current = true;
    try {
      await conBloqueoOffline(ambito, async () => {
        const filas = await refrescar();
        if (!filas.some((fila) => fila.estado === "pendiente")) {
          setEstado(hayProblema(filas) ? "error" : "online");
          return;
        }
        setEstado("sincronizando");
        await sincronizarColaOffline(almacenColaOffline, ambito, (operacion) =>
          transportarOperacionOffline(operacion, terminalId),
        );
        const actuales = await refrescar();
        setEstado(hayProblema(actuales) ? "error" : "online");
        canal.current?.postMessage("actualizado");
      });
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo leer la cola local.");
      setEstado("error");
    } finally {
      ocupado.current = false;
    }
  }, [ambito, refrescar, terminalId]);

  useEffect(() => {
    let vigente = true;
    const controlador = new AbortController();
    async function sondear() {
      if (!navigator.onLine) {
        conectado.current = false;
        setEstado("offline");
        return;
      }
      try {
        const respuesta = await fetch("/login", {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.any([controlador.signal, AbortSignal.timeout(5_000)]),
        });
        if (!vigente) return;
        conectado.current = respuesta.ok;
        if (!respuesta.ok) {
          setEstado("offline");
          return;
        }
        setEstado((actual) => (actual === "sincronizando" ? actual : "online"));
        await sincronizar();
      } catch {
        if (!vigente) return;
        conectado.current = false;
        setEstado("offline");
      }
    }
    void refrescar().catch(() => {
      setError("No se puede guardar en este navegador. No cobres offline hasta habilitar IndexedDB.");
      setEstado("error");
    });
    void sondear();
    const intervalo = window.setInterval(() => void sondear(), 15_000);
    window.addEventListener("online", sondear);
    window.addEventListener("offline", sondear);
    const broadcast = new BroadcastChannel(`pos-offline:${ambito}`);
    canal.current = broadcast;
    broadcast.onmessage = () => void refrescar().catch(() => setEstado("error"));
    return () => {
      vigente = false;
      controlador.abort();
      window.clearInterval(intervalo);
      window.removeEventListener("online", sondear);
      window.removeEventListener("offline", sondear);
      broadcast.close();
      canal.current = null;
    };
  }, [ambito, refrescar, sincronizar]);

  const pendientes = operaciones.filter((operacion) => operacion.estado !== "sincronizada").length;
  const porSubir = operaciones.filter((operacion) => operacion.estado === "pendiente").length;
  const fallidas = operaciones.filter((operacion) => operacion.estado === "fallida").length;

  useEffect(() => {
    if (!pendientes) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [pendientes]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let vigente = true;
    function recibir(evento: MessageEvent) {
      if (!vigente || evento.data?.ambito !== ambito) return;
      if (evento.data.tipo === "POS_CACHE_LISTO") setRecargaLista(true);
      if (evento.data.tipo === "POS_CACHE_ERROR") {
        setRecargaLista(false);
        setError("La recarga offline no está preparada. Mantén esta pestaña abierta hasta recuperar conexión.");
      }
    }
    navigator.serviceWorker.addEventListener("message", recibir);
    async function prepararWorker() {
      if (!navigator.onLine) {
        navigator.serviceWorker.controller?.postMessage({ tipo: "COMPROBAR", ambito });
        return;
      }
      await navigator.serviceWorker.register("/pos-sw.js", { scope: "/pos" });
      const registro = await navigator.serviceWorker.ready;
      if (vigente)
        registro.active?.postMessage({
          tipo: "PREPARAR",
          ambito,
          recursos: [
            ...performance.getEntriesByType("resource").map((recurso) => recurso.name),
            ...Array.from(document.scripts, (script) => script.src),
          ],
        });
    }
    void prepararWorker().catch(() => setError("No se pudo preparar la recarga offline. Mantén esta pestaña abierta."));
    const { data } = createClient().auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") navigator.serviceWorker.controller?.postMessage({ tipo: "LIMPIAR" });
    });
    return () => {
      vigente = false;
      navigator.serviceWorker.removeEventListener("message", recibir);
      data.subscription.unsubscribe();
    };
  }, [ambito]);

  async function encolar(tipo: OperacionOffline["tipo"], payload: unknown, snapshot: unknown) {
    if (!turnoId || !preparado) throw new Error("Prepara el POS con un turno abierto antes de cobrar offline.");
    return conBloqueoOffline(ambito, async () => {
      const operacion = nuevaOperacionOffline({
        ambito,
        turnoId,
        tipo,
        payload,
        snapshot,
        secuencia: await siguienteSecuenciaOffline(ambito),
      });
      await almacenColaOffline.guardar(operacion);
      setOperaciones((actuales) => [...actuales.filter((fila) => fila.uuid !== operacion.uuid), operacion]);
      canal.current?.postMessage("actualizado");
      return operacion;
    });
  }

  async function comprobarCierre(): Promise<RevisionCierreOffline> {
    const filas = await refrescar();
    return revisionCierreOffline(filas, navigator.onLine && conectado.current);
  }

  async function conCierreSeguro<T>(accion: () => Promise<T>): Promise<T> {
    return conBloqueoOffline(ambito, async () => {
      const revision = await comprobarCierre();
      if (revision.impedimento) throw new Error(revision.impedimento);
      return accion();
    });
  }

  async function refrescarEstado(): Promise<void> {
    const filas = await refrescar();
    if (hayProblema(filas)) {
      setEstado("error");
      return;
    }
    setEstado(conectado.current ? "online" : "offline");
  }

  async function reintentarOperacion(uuid: string) {
    try {
      await conBloqueoOffline(ambito, async () => {
        const fila = (await almacenColaOffline.listar(ambito)).find((candidata) => candidata.uuid === uuid);
        if (fila?.estado !== "fallida") return;
        await almacenColaOffline.guardar(programarReintentoOffline(fila));
      });
      await refrescarEstado();
      canal.current?.postMessage("actualizado");
      setError(null);
      await sincronizar();
    } catch {
      setError("No se pudo reintentar esta venta. Sigue guardada en este dispositivo.");
    }
  }

  async function descartarOperacion(uuid: string) {
    try {
      await conBloqueoOffline(ambito, async () => {
        const fila = (await almacenColaOffline.listar(ambito)).find((candidata) => candidata.uuid === uuid);
        if (fila?.estado !== "fallida") return;
        await almacenColaOffline.eliminar(ambito, uuid);
      });
      await refrescarEstado();
      canal.current?.postMessage("actualizado");
    } catch {
      setError("No se pudo descartar la venta. Sigue guardada en este dispositivo.");
    }
  }

  async function reintentar() {
    try {
      await conBloqueoOffline(ambito, async () => {
        for (const operacion of await almacenColaOffline.listar(ambito)) {
          if (operacion.estado !== "sincronizada") {
            await almacenColaOffline.guardar(programarReintentoOffline(operacion));
          }
        }
      });
      setError(null);
      await sincronizar();
    } catch {
      setError("No se pudo reintentar. Los datos siguen pendientes en este dispositivo.");
    }
  }

  return (
    <Contexto.Provider
      value={{
        ambito,
        estado,
        pendientes,
        porSubir,
        fallidas,
        operaciones,
        error,
        preparado,
        abrirPanel: () => setPanel(true),
        encolar,
        reintentarOperacion,
        descartarOperacion,
        comprobarCierre,
        conCierreSeguro,
      }}
    >
      {children}
      <Dialog open={panel} onOpenChange={setPanel}>
        <DialogContent className="border-pos-linea dark:bg-card max-h-[85dvh] overflow-y-auto bg-white sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle className="text-pos-texto">Sincronización del POS</DialogTitle>
            <DialogDescription>
              {`${porSubir} por subir · ${fallidas} ${fallidas === 1 ? "venta con problema" : "ventas con problema"}. No borres los datos del navegador.`}
            </DialogDescription>
          </DialogHeader>

          {porSubir > 0 ? (
            <p className="text-destructive text-sm font-medium">
              {`Conéctate para subir ${porSubir} ventas antes de cerrar el turno.`}
            </p>
          ) : null}

          {fallidas > 0 ? (
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <h3 className="text-pos-texto text-sm font-semibold">Ventas con problema</h3>
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                  {fallidas}
                </Badge>
              </div>
              <p className="text-pos-texto-suave text-xs">
                El servidor rechazó estas ventas. Puedes reintentarlas o descartarlas; no bloquean el cierre del turno.
              </p>
              <ul className="flex flex-col gap-2">
                {operaciones
                  .filter((operacion) => operacion.estado === "fallida")
                  .map((operacion) => (
                    <li
                      key={operacion.uuid}
                      className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-1">
                        <p className="text-pos-texto text-sm font-semibold">
                          {resumenSnapshotOffline(operacion.snapshot) ?? capitalizarTipo(operacion.tipo)}
                        </p>
                        <span className="text-pos-texto-suave text-xs">
                          {operacion.intentos} {operacion.intentos === 1 ? "intento" : "intentos"}
                        </span>
                      </div>
                      <p className="text-pos-texto-suave text-xs break-all">Folio: {operacion.folio}</p>
                      {operacion.error ? (
                        <p role="alert" className="text-destructive text-sm font-medium">
                          {operacion.error}
                        </p>
                      ) : null}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          className="bg-pos-primario hover:bg-pos-primario-hover h-11 flex-1 text-white"
                          disabled={estado === "offline" || estado === "sincronizando"}
                          onClick={() => void reintentarOperacion(operacion.uuid)}
                        >
                          <RefreshCw aria-hidden="true" />
                          Reintentar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-pos-linea text-destructive h-11 flex-1"
                          onClick={() => setDescartando(operacion)}
                        >
                          <Trash2 aria-hidden="true" />
                          Descartar
                        </Button>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <p className="text-pos-texto-suave text-xs">
            {recargaLista
              ? "Recarga offline preparada para esta sesión (máximo 8 horas)."
              : "Mantén esta pestaña abierta: recarga offline todavía no confirmada."}
          </p>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <div>
            <Button
              type="button"
              variant="outline"
              className="border-pos-linea text-pos-texto h-11"
              onClick={() => void reintentar()}
              disabled={estado === "offline" || estado === "sincronizando" || pendientes === 0}
            >
              <RefreshCw aria-hidden="true" />
              Reintentar todo
            </Button>
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="text-pos-texto text-sm font-semibold">Cola de este dispositivo</h3>
            {operaciones.filter((operacion) => operacion.estado === "pendiente").length === 0 ? (
              <p className="text-pos-texto-suave text-sm">No hay ventas esperando para subir.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {operaciones
                  .filter((operacion) => operacion.estado === "pendiente")
                  .map((operacion) => (
                    <li key={operacion.uuid} className="border-pos-linea text-pos-texto rounded-xl border p-3">
                      <p className="font-medium">
                        {resumenSnapshotOffline(operacion.snapshot) ?? capitalizarTipo(operacion.tipo)}
                      </p>
                      <p className="text-pos-texto-suave text-xs break-all">
                        Folio: {operacion.folio} · {operacion.intentos}{" "}
                        {operacion.intentos === 1 ? "intento" : "intentos"}
                      </p>
                      {operacion.error ? (
                        <p role="alert" className="text-destructive text-sm">
                          {operacion.error}
                        </p>
                      ) : (
                        <p className="text-pos-texto-suave text-xs">Se reintenta automáticamente.</p>
                      )}
                    </li>
                  ))}
              </ul>
            )}
            <p className="text-pos-texto-suave text-xs">
              {`${operaciones.filter((operacion) => operacion.estado === "sincronizada").length} operaciones ya subidas en este dispositivo.`}
            </p>
            {operaciones.some((operacion) => operacion.estado === "sincronizada") ? (
              <details className="text-pos-texto text-sm">
                <summary className="text-pos-texto-suave cursor-pointer text-xs">Ver ventas ya subidas</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {operaciones
                    .filter((operacion) => operacion.estado === "sincronizada")
                    .map((operacion) => (
                      <li key={operacion.uuid} className="text-pos-texto-suave text-xs">
                        {resumenSnapshotOffline(operacion.snapshot) ?? capitalizarTipo(operacion.tipo)} ·{" "}
                        {resumenConfirmacionOffline(operacion.resultado) ?? "Subida"}
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}
          </section>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={descartando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setDescartando(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar esta venta?</AlertDialogTitle>
            <AlertDialogDescription>
              {descartando
                ? `${resumenSnapshotOffline(descartando.snapshot) ?? capitalizarTipo(descartando.tipo)} (folio ${descartando.folio}) no se enviará al servidor y no se podrá recuperar.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={() => {
                const uuid = descartando?.uuid;
                setDescartando(null);
                if (uuid) void descartarOperacion(uuid);
              }}
            >
              Sí, descartar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Contexto.Provider>
  );
}

function capitalizarTipo(tipo: OperacionOffline["tipo"]): string {
  return tipo === "venta" ? "Venta" : "Movimiento";
}

export function useOfflinePOS() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("Falta OfflinePosProvider.");
  return contexto;
}

function textoEstadoOffline({
  error,
  estado,
  porSubir,
  fallidas,
}: {
  error: string | null;
  estado: EstadoConexion;
  porSubir: number;
  fallidas: number;
}): string {
  if (error) return "Error al subir — revisar";
  if (fallidas > 0) {
    const etiqueta = fallidas === 1 ? "venta con problema" : "ventas con problema";
    return `${fallidas} ${etiqueta}${porSubir > 0 ? ` · ${porSubir} por subir` : ""}`;
  }
  if (estado === "sincronizando") return `Subiendo ventas… ${porSubir} por subir`;
  if (estado === "offline") return `Sin conexión — ${porSubir} ventas por subir`;
  if (estado === "error") return `Error al subir — ${porSubir} por subir`;
  return `${porSubir} operaciones por subir · En línea`;
}

export function EstadoOfflinePOS() {
  const { estado, porSubir, fallidas, abrirPanel, error } = useOfflinePOS();
  const texto = textoEstadoOffline({ error, estado, porSubir, fallidas });
  return (
    <button
      type="button"
      onClick={abrirPanel}
      className="text-pos-texto-suave hover:text-pos-primario min-w-0 cursor-pointer truncate px-2 text-xs"
      aria-live="polite"
    >
      {texto}
    </button>
  );
}
