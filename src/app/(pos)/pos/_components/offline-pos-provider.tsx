"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

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
import type { Numeracion } from "@/lib/numeraciones/tipos";
import {
  almacenColaOffline,
  conBloqueoOffline,
  existeClaveOfflinePorPrefijo,
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
import { registrarNcfConfirmadoLocal, reservarNcfLocal } from "@/lib/pos/ncf-local";
import { type ResultadoTransporteOffline, transportarOperacionOffline } from "@/lib/pos/transporte-offline";
import { createClient } from "@/lib/supabase/client";

type EstadoCachePOS = "al-dia" | "sincronizando" | "pendiente" | "error";

export interface OpcionesEncolarOffline {
  folio?: string;
  numeracion?: Pick<Numeracion, "id" | "prefijo" | "siguiente" | "hasta" | "vence" | "activa">;
  fecha?: string;
}

export type SnapshotEncolarOffline =
  | Record<string, unknown>
  | ((contexto: { uuid: string; folio: string }) => Record<string, unknown>);

function datosNcfConfirmado(
  operacion: OperacionOffline,
): { numeracionId: string; prefijo: string; ncf: string } | null {
  const resultado = operacion.resultado;
  if (typeof resultado !== "object" || resultado === null || !("factura" in resultado)) return null;
  const factura = resultado.factura;
  if (typeof factura !== "object" || factura === null || !("ncf" in factura) || typeof factura.ncf !== "string") {
    return null;
  }
  const snapshot = operacion.snapshot;
  if (typeof snapshot !== "object" || snapshot === null || !("numeracion" in snapshot)) return null;
  const num = snapshot.numeracion;
  if (
    typeof num !== "object" ||
    num === null ||
    !("id" in num) ||
    !("prefijo" in num) ||
    typeof num.id !== "string" ||
    typeof num.prefijo !== "string"
  ) {
    return null;
  }
  return { numeracionId: num.id, prefijo: num.prefijo, ncf: factura.ncf };
}

/**
 * Las cachés locales de productos (`ambito/listaPrecioId`, incluso `ambito/` para
 * precio base) y clientes (`ambito`) se comprueban por prefijo para que el
 * popover pinte «Al día» al recargar sin conexión.
 */
async function hayCacheDelAmbito(store: "catalogo" | "contactos", ambito: string): Promise<boolean> {
  try {
    return await existeClaveOfflinePorPrefijo(store, ambito);
  } catch {
    return false;
  }
}

/**
 * El aviso de sesión vencida se enciende con un `sesionRequerida` real de la
 * subida y solo se apaga cuando una pasada completa termina sin ese error
 * (`null` deja el aviso como estaba). Nada se pierde: la cola espera al login.
 */
function resolucionSesionRequerida(sesionEnPasada: boolean, intentos: number, transitorio: boolean): boolean | null {
  if (sesionEnPasada) return true;
  if (intentos > 0 && !transitorio) return false;
  return null;
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
  /** La sesión venció: la cola sube al volver a iniciar sesión, nada se pierde. */
  sesionRequerida: boolean;
  estadoProductos: EstadoCachePOS;
  estadoClientes: EstadoCachePOS;
  marcarCacheProductos: (estado: EstadoCachePOS) => void;
  marcarCacheClientes: (estado: EstadoCachePOS) => void;
  tokenRecargaCache: number;
  recargarManual: () => Promise<void>;
  abrirPanel: () => void;
  encolar: (
    tipo: OperacionOffline["tipo"],
    payload: unknown,
    snapshot: SnapshotEncolarOffline,
    opciones?: OpcionesEncolarOffline,
  ) => Promise<OperacionOffline>;
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
  logoUrl = null,
  children,
}: {
  ambito: string;
  terminalId: string;
  turnoId: string | null;
  logoUrl?: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoConexion>("online");
  const [operaciones, setOperaciones] = useState<OperacionOffline[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [avisoRecarga, setAvisoRecarga] = useState<string | null>(null);
  const [preparado, setPreparado] = useState(false);
  const [panel, setPanel] = useState(false);
  const [descartando, setDescartando] = useState<OperacionOffline | null>(null);
  const [recargaLista, setRecargaLista] = useState(false);
  const [sesionRequerida, setSesionRequerida] = useState(false);
  const [estadoProductos, setEstadoProductos] = useState<EstadoCachePOS>("al-dia");
  const [estadoClientes, setEstadoClientes] = useState<EstadoCachePOS>("al-dia");
  const [tokenRecargaCache, setTokenRecargaCache] = useState(0);
  const salud = useRef<SaludConexion>(SALUD_CONEXION_INICIAL);
  const ocupado = useRef(false);
  const canal = useRef<BroadcastChannel | null>(null);
  const turnoVigente = useRef<string | null>(turnoId);
  const turnoCacheado = useRef<string | null>(null);
  const logoVigente = useRef<string | null>(logoUrl);
  const preparandoWorker = useRef(false);
  const reprepararPendiente = useRef(false);
  const prepararWorkerRef = useRef<(() => Promise<void>) | null>(null);
  const sondearRef = useRef<(() => Promise<void>) | null>(null);
  const aplicarSondeoRef = useRef<((respondio: boolean) => boolean) | null>(null);

  useEffect(() => {
    turnoVigente.current = turnoId;
  }, [turnoId]);

  useEffect(() => {
    logoVigente.current = logoUrl;
  }, [logoUrl]);

  // Una vez por sesión y en silencio: sin esto el navegador puede borrar la cola
  // de ventas por falta de espacio justo cuando no hay internet.
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined);
  }, []);

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
    let huboTransitorio = false;
    let huboConfirmada = false;
    let intentosEnvio = 0;
    let sesionEnPasada = false;
    async function enviar(operacion: OperacionOffline): Promise<ResultadoTransporteOffline> {
      const resultado = await transportarOperacionOffline(operacion, terminalId);
      intentosEnvio += 1;
      if (resultado.sesionRequerida) sesionEnPasada = true;
      return resultado;
    }
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
        const resumen = await sincronizarColaOffline(almacenColaOffline, ambito, enviar);
        for (const confirmada of resumen.confirmadas) {
          const datos = datosNcfConfirmado(confirmada);
          if (datos) {
            await registrarNcfConfirmadoLocal(ambito, datos.numeracionId, datos.prefijo, datos.ncf).catch(
              () => undefined,
            );
          }
        }
        huboConfirmada = resumen.confirmadas.length > 0;
        huboTransitorio = resumen.transitorios > 0;
        // El aviso de sesión vencida manda mientras no haya un envío limpio: al
        // volver a entrar, la cola se sube sola y el aviso desaparece.
        const sesion = resolucionSesionRequerida(sesionEnPasada, intentosEnvio, huboTransitorio);
        if (sesion !== null) setSesionRequerida(sesion);
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
    if (huboConfirmada && navigator.onLine) {
      router.refresh();
    }
    if (huboTransitorio) {
      // Un fallo/timeout al subir cuenta como señal de red degradada y dispara
      // sondeo inmediato para pasar a «Sin conexión» en ~15 s si la red murió.
      aplicarSondeoRef.current?.(false);
      void sondearRef.current?.();
    }
  }, [ambito, refrescar, router, terminalId]);

  useEffect(() => {
    let vigente = true;
    let ultimoSondeo = 0;
    const controlador = new AbortController();

    function aplicarOfflineInmediato() {
      salud.current = registrarOfflineInmediato();
      // Forzar transición inmediata incluso si había una subida en curso.
      setEstado((actual) => estadoTrasSondeo(actual, false, true));
    }

    function aplicarSondeo(respondio: boolean): boolean {
      const estabaConectado = salud.current.conectado;
      salud.current = registrarSondeo(salud.current, respondio, !navigator.onLine);
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
    aplicarSondeoRef.current = aplicarSondeo;
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
      aplicarSondeoRef.current = null;
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

  // Mientras haya ventas pendientes por subir, sondea/reintenta cada 5 s para
  // que un corte breve (5 s de internet malo) se recupere casi al instante y un
  // corte real pase a «Sin conexión» en ~15 s sin esperar 45 s.
  useEffect(() => {
    if (porSubir === 0) return;
    const id = window.setInterval(() => {
      if (!navigator.onLine) return;
      if (salud.current.conectado) void sincronizar();
      else void sondearRef.current?.();
    }, 5_000);
    return () => window.clearInterval(id);
  }, [porSubir, sincronizar]);

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
      const turnoRespuesta: string | null = evento.data.turnoId ?? null;
      if (evento.data.tipo === "POS_CACHE_LISTO") {
        // Solo aceptamos el listo si corresponde al turno actualmente vigente.
        if (turnoRespuesta !== turnoVigente.current && navigator.onLine) return;
        turnoCacheado.current = turnoRespuesta;
        setRecargaLista(true);
        setAvisoRecarga(null);
      }
      if (evento.data.tipo === "POS_CACHE_ERROR") {
        if (turnoRespuesta !== turnoVigente.current) return;
        setRecargaLista(false);
        setAvisoRecarga("La recarga offline no está preparada. Mantén esta pestaña abierta hasta recuperar conexión.");
      }
    }
    navigator.serviceWorker.addEventListener("message", recibir);
    async function prepararWorker() {
      if (preparandoWorker.current) {
        reprepararPendiente.current = true;
        return;
      }
      preparandoWorker.current = true;
      reprepararPendiente.current = false;
      try {
        const turnoObjetivo = turnoId;
        if (!navigator.onLine) {
          navigator.serviceWorker.controller?.postMessage({ tipo: "COMPROBAR", ambito });
          return;
        }
        await navigator.serviceWorker.register("/pos-sw.js", { scope: "/pos" });
        const registro = await navigator.serviceWorker.ready;
        if (!vigente) return;
        registro.active?.postMessage({
          tipo: "PREPARAR",
          ambito,
          turnoId: turnoObjetivo,
          logoUrl: logoVigente.current,
          recursos: [
            ...performance.getEntriesByType("resource").map((recurso) => recurso.name),
            ...Array.from(document.scripts, (script) => script.src),
          ],
        });
      } finally {
        preparandoWorker.current = false;
        if (vigente && reprepararPendiente.current) {
          reprepararPendiente.current = false;
          void prepararWorker();
        }
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

  async function encolar(
    tipo: OperacionOffline["tipo"],
    payload: unknown,
    snapshot: SnapshotEncolarOffline,
    opciones?: OpcionesEncolarOffline,
  ) {
    if (!turnoId) throw new Error("Abre un turno antes de registrar la operación.");
    const operacion = await conBloqueoOffline(ambito, async () => {
      const uuid = crypto.randomUUID();
      let folio = opciones?.folio;
      if (opciones?.numeracion) {
        const reserva = await reservarNcfLocal(
          ambito,
          opciones.numeracion,
          opciones.fecha ?? new Date().toISOString().slice(0, 10),
        );
        folio = reserva.ncf;
      }
      const folioFinal = folio && folio.trim() !== "" ? folio.trim() : `POS-LOCAL-${uuid}`;
      const snapshotFinal = typeof snapshot === "function" ? snapshot({ uuid, folio: folioFinal }) : snapshot;
      const creada = nuevaOperacionOffline(
        {
          ambito,
          turnoId,
          tipo,
          payload,
          snapshot: snapshotFinal,
          secuencia: await siguienteSecuenciaOffline(ambito),
        },
        uuid,
        folioFinal,
      );
      await almacenColaOffline.guardar(creada);
      setOperaciones((actuales) => [...actuales.filter((fila) => fila.uuid !== creada.uuid), creada]);
      setPreparado(true);
      canal.current?.postMessage("actualizado");
      return creada;
    });
    // Local-first (Opción A): dispara la subida al servidor en segundo plano sin
    // hacer esperar el cobro ni la impresión.
    if (navigator.onLine && salud.current.conectado) {
      void sincronizar();
    }
    return operacion;
  }

  async function comprobarCierre(): Promise<RevisionCierreOffline> {
    const filas = await refrescar();
    return revisionCierreOffline(filas, navigator.onLine && salud.current.conectado);
  }

  async function conCierreSeguro<T>(accion: () => Promise<T>): Promise<T> {
    let revision: RevisionCierreOffline;
    try {
      revision = await conBloqueoOffline(ambito, () => comprobarCierre());
    } catch {
      throw new ErrorImpedimentoCierreOffline("No se pudo verificar la cola local antes de cerrar el turno.");
    }
    if (revision.impedimento) throw new ErrorImpedimentoCierreOffline(revision.impedimento);
    return conBloqueoOffline(ambito, async () => {
      const revalidacion = await comprobarCierre().catch(() => {
        throw new ErrorImpedimentoCierreOffline("No se pudo verificar la cola local antes de cerrar el turno.");
      });
      if (revalidacion.impedimento) throw new ErrorImpedimentoCierreOffline(revalidacion.impedimento);
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
      setEstado((actual) => estadoTrasSondeo(actual, false, true));
      return;
    }
    // Sondear primero actualiza `salud.current.conectado` si acabamos de volver
    // en línea, para que `reintentar()` no salga temprano por `!conectado`.
    await sondearRef.current?.();
    await reintentar();
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
        sesionRequerida,
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
      className="text-pos-texto-suave hover:text-pos-primario hidden min-w-0 cursor-pointer items-center truncate px-2 text-xs sm:inline-flex"
      aria-live="polite"
    >
      {texto}
    </button>
  );
}
