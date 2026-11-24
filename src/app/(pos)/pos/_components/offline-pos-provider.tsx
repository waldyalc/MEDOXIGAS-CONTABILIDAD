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
import {
  almacenColaOffline,
  conBloqueoOffline,
  leerOffline,
  siguienteSecuenciaOffline,
} from "@/lib/pos/almacen-offline";
import {
  ErrorImpedimentoCierreOffline,
  MENSAJE_SINCRONIZAR_ANTES_DE_CERRAR,
  nuevaOperacionOffline,
  type OperacionOffline,
  programarReintentoOffline,
  type RevisionCierreOffline,
  resumenConfirmacionOffline,
  resumenSnapshotOffline,
  revisionCierreOffline,
  sincronizarColaOffline,
} from "@/lib/pos/cola-offline";
import {
  type EstadoConexion,
  estadoTrasSondeo,
  RUTA_SONDEO,
  registrarOfflineInmediato,
  registrarSondeo,
  SALUD_CONEXION_INICIAL,
  type SaludConexion,
  textoEstadoOffline,
} from "@/lib/pos/conexion-offline";
import { transportarOperacionOffline } from "@/lib/pos/transporte-offline";
import { createClient } from "@/lib/supabase/client";

type EstadoCachePOS = "al-dia" | "sincronizando" | "pendiente" | "error";

/**
 * Las cachés locales de productos y clientes se guardan en IndexedDB por
 * ámbito (`usuario/terminal`). Basta con que exista una entrada del ámbito para
 * que el popover de sincronización pinte la fila como al día sin conexión.
 */
async function hayCacheDelAmbito(store: "catalogo" | "contactos", ambito: string): Promise<boolean> {
  try {
    for (const clave of [`${ambito}/${store}`, ambito]) {
      if ((await leerOffline<unknown>(store, clave)) !== undefined) return true;
    }
    return false;
  } catch {
    return false;
  }
}

interface ContextoOffline {
  ambito: string;
  estado: EstadoConexion;
  pendientes: number;
  porSubir: number;
  fallidas: number;
  operaciones: OperacionOffline[];
  error: string | null;
  preparado: boolean;
  estadoProductos: EstadoCachePOS;
  estadoClientes: EstadoCachePOS;
  marcarCacheProductos: (estado: EstadoCachePOS) => void;
  marcarCacheClientes: (estado: EstadoCachePOS) => void;
  tokenRecargaCache: number;
  recargarManual: () => Promise<void>;
  abrirPanel: () => void;
  encolar: (tipo: OperacionOffline["tipo"], payload: unknown, snapshot: unknown) => Promise<OperacionOffline>;
  reintentarOperacion: (uuid: string) => Promise<void>;
  descartarOperacion: (uuid: string) => Promise<void>;
  comprobarCierre: () => Promise<RevisionCierreOffline>;
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
  const [avisoRecarga, setAvisoRecarga] = useState<string | null>(null);
  const [preparado, setPreparado] = useState(false);
  const [panel, setPanel] = useState(false);
  const [descartando, setDescartando] = useState<OperacionOffline | null>(null);
  const [recargaLista, setRecargaLista] = useState(false);
  const [estadoProductos, setEstadoProductos] = useState<EstadoCachePOS>("al-dia");
  const [estadoClientes, setEstadoClientes] = useState<EstadoCachePOS>("al-dia");
  const [tokenRecargaCache, setTokenRecargaCache] = useState(0);
  const salud = useRef<SaludConexion>(SALUD_CONEXION_INICIAL);
  const ocupado = useRef(false);
  const canal = useRef<BroadcastChannel | null>(null);
  const turnoVigente = useRef<string | null>(turnoId);
  const turnoCacheado = useRef<string | null>(null);
  const turnoSolicitado = useRef<string | null>(null);
  const preparandoWorker = useRef(false);
  const prepararWorkerRef = useRef<(() => Promise<void>) | null>(null);
  const sondearRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    turnoVigente.current = turnoId;
  }, [turnoId]);

  const marcarCacheProductos = useCallback((nuevo: EstadoCachePOS) => setEstadoProductos(nuevo), []);
  const marcarCacheClientes = useCallback((nuevo: EstadoCachePOS) => setEstadoClientes(nuevo), []);

  const refrescar = useCallback(async () => {
    const filas = await almacenColaOffline.listar(ambito);
    setOperaciones(filas.sort((a, b) => a.secuencia - b.secuencia));
    setPreparado(true);
    return filas;
  }, [ambito]);

  const sincronizar = useCallback(async () => {
    if (ocupado.current || !salud.current.conectado) return;
    ocupado.current = true;
    try {
      await conBloqueoOffline(ambito, async () => {
        const filas = await refrescar();
        // La cola local respondió: cualquier aviso de almacenamiento quedó atrás.
        setError(null);
        if (!filas.some((fila) => fila.estado === "pendiente")) {
          setEstado(salud.current.conectado ? "online" : "offline");
          return;
        }
        setEstado("sincronizando");
        await sincronizarColaOffline(almacenColaOffline, ambito, (operacion) =>
          transportarOperacionOffline(operacion, terminalId),
        );
        await refrescar();
        setEstado(salud.current.conectado ? "online" : "offline");
        canal.current?.postMessage("actualizado");
      });
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo leer la cola local.");
      setEstado(salud.current.conectado ? "online" : "offline");
    } finally {
      ocupado.current = false;
    }
  }, [ambito, refrescar, terminalId]);

  useEffect(() => {
    let vigente = true;
    let ultimoSondeo = 0;
    const controlador = new AbortController();

    function aplicarOfflineInmediato() {
      salud.current = registrarOfflineInmediato();
      setEstado((actual) => estadoTrasSondeo(actual, false));
    }

    function aplicarSondeo(respondio: boolean): boolean {
      const estabaConectado = salud.current.conectado;
      salud.current = registrarSondeo(salud.current, respondio);
      const conectado = salud.current.conectado;
      setEstado((actual) => estadoTrasSondeo(actual, conectado));
      // Si vuelve la red y el worker quedó con el HTML de otro turno, se re-cachea.
      if (conectado && !estabaConectado && turnoCacheado.current !== turnoVigente.current) {
        void prepararWorkerRef.current?.();
      }
      return conectado;
    }

    async function consultarConexion(): Promise<boolean> {
      if (!navigator.onLine) return false;
      const respuesta = await fetch(RUTA_SONDEO, {
        method: "HEAD",
        cache: "no-store",
        signal: AbortSignal.any([controlador.signal, AbortSignal.timeout(5_000)]),
      });
      return respuesta.ok;
    }

    async function sondear() {
      const orden = ++ultimoSondeo;
      let respondio = false;
      try {
        respondio = await consultarConexion();
      } catch {
        respondio = false;
      }
      if (!vigente || orden !== ultimoSondeo) return;
      if (!aplicarSondeo(respondio)) return;
      await sincronizar();
    }

    function alVolverOnline() {
      if (turnoCacheado.current !== turnoVigente.current) void prepararWorkerRef.current?.();
      void sondear();
    }

    function alPerderConexion() {
      aplicarOfflineInmediato();
      void sondear();
    }

    // El navegador ya sabe que está sin red: «Sin conexión» sale de inmediato.
    if (!navigator.onLine) aplicarOfflineInmediato();
    sondearRef.current = sondear;
    void refrescar().catch(() => {
      setError("No se puede guardar en este navegador. No cobres offline hasta habilitar IndexedDB.");
    });
    void sondear();
    const intervalo = window.setInterval(() => void sondear(), 15_000);
    window.addEventListener("online", alVolverOnline);
    window.addEventListener("offline", alPerderConexion);
    // Al volver a la pestaña se sondea de inmediato: si el navegador la frenó
    // en segundo plano, el pie no se queda pegado en «Sin conexión».
    const alCambiarVisibilidad = () => {
      if (!document.hidden) void sondear();
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    const broadcast = new BroadcastChannel(`pos-offline:${ambito}`);
    canal.current = broadcast;
    broadcast.onmessage = () => void refrescar().catch(() => setError("No se pudo leer la cola local."));
    return () => {
      vigente = false;
      controlador.abort();
      window.clearInterval(intervalo);
      window.removeEventListener("online", alVolverOnline);
      window.removeEventListener("offline", alPerderConexion);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      broadcast.close();
      canal.current = null;
      sondearRef.current = null;
    };
  }, [ambito, refrescar, sincronizar]);

  // Estado inicial de las cachés de productos y clientes: sin conexión se
  // revisa IndexedDB; en línea quedan «al día» hasta que la descarga marque otra cosa.
  useEffect(() => {
    let vigente = true;
    async function revisarCache() {
      if (navigator.onLine) return;
      const [productos, clientes] = await Promise.all([
        hayCacheDelAmbito("catalogo", ambito),
        hayCacheDelAmbito("contactos", ambito),
      ]);
      if (!vigente) return;
      setEstadoProductos(productos ? "al-dia" : "pendiente");
      setEstadoClientes(clientes ? "al-dia" : "pendiente");
    }
    void revisarCache();
    return () => {
      vigente = false;
    };
  }, [ambito]);

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
      if (evento.data.tipo === "POS_CACHE_LISTO") {
        // El worker acaba de cachear /pos: queda atado al turno que se le pidió.
        turnoCacheado.current = turnoSolicitado.current;
        setRecargaLista(true);
        setAvisoRecarga(null);
      }
      if (evento.data.tipo === "POS_CACHE_ERROR") {
        setRecargaLista(false);
        setAvisoRecarga("La recarga offline no está preparada. Mantén esta pestaña abierta hasta recuperar conexión.");
      }
    }
    navigator.serviceWorker.addEventListener("message", recibir);
    async function prepararWorker() {
      if (preparandoWorker.current) return;
      preparandoWorker.current = true;
      try {
        if (!navigator.onLine) {
          turnoSolicitado.current = null;
          navigator.serviceWorker.controller?.postMessage({ tipo: "COMPROBAR", ambito });
          return;
        }
        await navigator.serviceWorker.register("/pos-sw.js", { scope: "/pos" });
        const registro = await navigator.serviceWorker.ready;
        if (!vigente) return;
        turnoSolicitado.current = turnoId;
        registro.active?.postMessage({
          tipo: "PREPARAR",
          ambito,
          recursos: [
            ...performance.getEntriesByType("resource").map((recurso) => recurso.name),
            ...Array.from(document.scripts, (script) => script.src),
          ],
        });
      } finally {
        preparandoWorker.current = false;
      }
    }
    prepararWorkerRef.current = prepararWorker;
    void prepararWorker().catch(() =>
      setAvisoRecarga("No se pudo preparar la recarga offline. Mantén esta pestaña abierta."),
    );
    const { data } = createClient().auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") navigator.serviceWorker.controller?.postMessage({ tipo: "LIMPIAR" });
    });
    return () => {
      vigente = false;
      prepararWorkerRef.current = null;
      navigator.serviceWorker.removeEventListener("message", recibir);
      data.subscription.unsubscribe();
    };
    // turnoId: al abrir o cambiar de turno sin recargar, /pos se vuelve a cachear
    // con el turno nuevo para que la recarga offline no restaure uno viejo.
  }, [ambito, turnoId]);

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
    return revisionCierreOffline(filas, navigator.onLine && salud.current.conectado);
  }

  async function conCierreSeguro<T>(accion: () => Promise<T>): Promise<T> {
    return conBloqueoOffline(ambito, async () => {
      const revision = await comprobarCierre();
      if (revision.impedimento) throw new ErrorImpedimentoCierreOffline(revision.impedimento);
      return accion();
    });
  }

  async function refrescarEstado(): Promise<void> {
    await refrescar();
    setEstado(salud.current.conectado ? "online" : "offline");
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

  /**
   * Botón «Sincronizar ahora» del popover: reintenta la cola (incluidas las
   * fallidas), vuelve a sondear la conexión y pide refrescar las cachés de
   * productos y clientes subiendo `tokenRecargaCache`.
   */
  async function recargarManual(): Promise<void> {
    setTokenRecargaCache((token) => token + 1);
    if (!navigator.onLine) {
      salud.current = registrarOfflineInmediato();
      setEstado((actual) => estadoTrasSondeo(actual, false));
      return;
    }
    await reintentar();
    await sondearRef.current?.();
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
        estadoProductos,
        estadoClientes,
        marcarCacheProductos,
        marcarCacheClientes,
        tokenRecargaCache,
        recargarManual,
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

          {porSubir > 0 || fallidas > 0 ? (
            <p className="text-destructive text-sm font-medium">
              {`${MENSAJE_SINCRONIZAR_ANTES_DE_CERRAR}. Reintenta o descarta las ventas con problema y sube las pendientes.`}
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
                El servidor rechazó estas ventas. Debes reintentarlas o descartarlas antes de cerrar el turno.
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
          {avisoRecarga ? <p className="text-pos-texto-suave text-xs">{avisoRecarga}</p> : null}
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

export function EstadoOfflinePOS() {
  const { estado, porSubir, fallidas, preparado, error, abrirPanel } = useOfflinePOS();
  const texto = textoEstadoOffline({ estado, porSubir, fallidas, preparado, error });
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
