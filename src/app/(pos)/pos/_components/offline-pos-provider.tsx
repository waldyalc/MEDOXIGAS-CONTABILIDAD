"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { almacenColaOffline, conBloqueoOffline, siguienteSecuenciaOffline } from "@/lib/pos/almacen-offline";
import {
  nuevaOperacionOffline,
  type OperacionOffline,
  resumenConfirmacionOffline,
  resumenSnapshotOffline,
  sincronizarColaOffline,
} from "@/lib/pos/cola-offline";
import { transportarOperacionOffline } from "@/lib/pos/transporte-offline";
import { createClient } from "@/lib/supabase/client";

type EstadoConexion = "online" | "offline" | "sincronizando" | "error";

interface ContextoOffline {
  ambito: string;
  estado: EstadoConexion;
  pendientes: number;
  operaciones: OperacionOffline[];
  error: string | null;
  preparado: boolean;
  abrirPanel: () => void;
  encolar: (tipo: OperacionOffline["tipo"], payload: unknown, snapshot: unknown) => Promise<OperacionOffline>;
  comprobarCierre: () => Promise<string | null>;
  conCierreSeguro: <T>(accion: () => Promise<T>) => Promise<T>;
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
        const conError = (actuales: OperacionOffline[]) =>
          actuales.some((fila) => fila.estado === "fallida" || (fila.estado === "pendiente" && fila.error !== null));
        if (!filas.some((fila) => fila.estado === "pendiente")) {
          setEstado(conError(filas) ? "error" : "online");
          return;
        }
        setEstado("sincronizando");
        await sincronizarColaOffline(almacenColaOffline, ambito, (operacion) =>
          transportarOperacionOffline(operacion, terminalId),
        );
        const actuales = await refrescar();
        setEstado(conError(actuales) ? "error" : "online");
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

  async function comprobarCierre() {
    const filas = await refrescar();
    const cantidad = filas.filter((fila) => fila.estado !== "sincronizada").length;
    if (!navigator.onLine || !conectado.current) {
      return cantidad > 0
        ? `Conéctate para subir ${cantidad} ventas antes de cerrar.`
        : "Conéctate a internet para cerrar el turno.";
    }
    if (cantidad > 0) return `Conéctate para subir ${cantidad} ventas antes de cerrar.`;
    return null;
  }

  async function conCierreSeguro<T>(accion: () => Promise<T>): Promise<T> {
    return conBloqueoOffline(ambito, async () => {
      const impedimento = await comprobarCierre();
      if (impedimento) throw new Error(impedimento);
      return accion();
    });
  }

  async function reintentar() {
    try {
      await conBloqueoOffline(ambito, async () => {
        for (const operacion of await almacenColaOffline.listar(ambito)) {
          if (operacion.estado !== "sincronizada") {
            await almacenColaOffline.guardar({ ...operacion, estado: "pendiente", error: null, proximoIntento: 0 });
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
        operaciones,
        error,
        preparado,
        abrirPanel: () => setPanel(true),
        encolar,
        comprobarCierre,
        conCierreSeguro,
      }}
    >
      {children}
      <Dialog open={panel} onOpenChange={setPanel}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Sincronización del POS</DialogTitle>
            <DialogDescription>
              {pendientes} operaciones pendientes en este dispositivo. No borres los datos del navegador.
            </DialogDescription>
          </DialogHeader>
          {pendientes > 0 ? (
            <p className="text-destructive text-sm font-medium">
              {`Conéctate para subir ${pendientes} ventas antes de cerrar el turno.`}
            </p>
          ) : null}
          <p className="text-sm">
            {recargaLista
              ? "Recarga offline preparada para esta sesión (máximo 8 horas)."
              : "Mantén esta pestaña abierta: recarga offline todavía no confirmada."}
          </p>
          {error ? <p role="alert">{error}</p> : null}
          <Button
            variant="outline"
            onClick={() => void reintentar()}
            disabled={estado === "offline" || estado === "sincronizando"}
          >
            Reintentar pendientes
          </Button>
          <ul className="space-y-3 text-sm">
            {operaciones.map((operacion) => (
              <li key={operacion.uuid} className="space-y-1 rounded border p-3">
                <p className="break-all font-medium">Folio: {operacion.folio}</p>
                <p>
                  {operacion.tipo} · {operacion.estado} · {operacion.intentos} intentos
                </p>
                {resumenSnapshotOffline(operacion.snapshot) ? (
                  <p className="text-muted-foreground">Cobrado: {resumenSnapshotOffline(operacion.snapshot)}</p>
                ) : null}
                {operacion.estado === "sincronizada" ? <p>{resumenConfirmacionOffline(operacion.resultado)}</p> : null}
                {operacion.error ? <p role="alert">{operacion.error}</p> : null}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </Contexto.Provider>
  );
}

export function useOfflinePOS() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("Falta OfflinePosProvider.");
  return contexto;
}

export function EstadoOfflinePOS() {
  const { estado, pendientes, abrirPanel, error } = useOfflinePOS();
  const texto =
    error || estado === "error"
      ? "Error al subir — reintentar"
      : estado === "sincronizando"
        ? `Subiendo ventas… ${pendientes} restantes`
        : estado === "offline"
          ? `Sin conexión — ${pendientes} ventas pendientes de subir`
          : `${pendientes} operaciones pendientes · En línea`;
  return (
    <button
      type="button"
      onClick={abrirPanel}
      className="text-pos-texto-suave min-w-0 truncate px-2 text-xs"
      aria-live="polite"
    >
      {texto}
    </button>
  );
}
