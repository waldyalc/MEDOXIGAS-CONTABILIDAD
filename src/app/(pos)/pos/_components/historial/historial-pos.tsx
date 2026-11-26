"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";

import { ArrowLeft, Loader2, ReceiptText, Search } from "@/components/icons";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { BarraLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { ContenedorLista } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { Empresa } from "@/lib/facturacion/tipos";
import { leerPagina, leerTamano, leerTexto, type ParametrosLista, type ResumenPagina } from "@/lib/listas/parametros";
import {
  filtrarFilasHistorialLocal,
  guardarDetalleVentaOffline,
  guardarVistaHistorialOffline,
  leerDetalleVentaOffline,
  leerMapaDetallesVentaOffline,
  leerVistaHistorialOffline,
  MAX_PREDESCARGAS_HISTORIAL,
  TAMANO_LOTE_PREDESCARGA,
} from "@/lib/pos/cache-vistas-offline";
import {
  combinarHistorialPOS,
  idDeItemHistorial,
  proyectarVentasLocales,
  type VentaLocalHistorial,
} from "@/lib/pos/historial-offline";
import { armarTicketFactura } from "@/lib/pos/impresion";
import type { HistorialPOSFila, PlantillaTicket, VentaPOSResultado } from "@/lib/pos/tipos";

import { detalleVentaPOS, ticketVentaPOS } from "../acciones-pos";
import { useCarritoPOS } from "../carrito-pos-provider";
import { capitalizar } from "../formato-pos";
import { useOfflinePOS } from "../offline-pos-provider";
import { DetalleVentaOffline } from "./detalle-venta-offline";
import { DetalleVentaPos } from "./detalle-venta-pos";
import { FiltrosHistorial } from "./filtros-historial";
import { ListaVentas } from "./lista-ventas";

export function HistorialPos({
  filas,
  resumen,
  params,
  terminales,
  desde,
  hasta,
  empresa,
  plantillaTicket,
  plantillaFactura,
  puedeEscribir,
  hayFiltros,
  error,
}: {
  filas: HistorialPOSFila[];
  resumen: ResumenPagina;
  params: ParametrosLista;
  terminales: { id: string; nombre: string }[];
  desde: string;
  hasta: string;
  empresa: Empresa | null;
  plantillaTicket: PlantillaTicket;
  plantillaFactura: { mostrarLogo: boolean; notas: string; terminos: string };
  puedeEscribir: boolean;
  hayFiltros: boolean;
  error?: string | null;
}) {
  const router = useRouter();
  const offline = useOfflinePOS();
  const carrito = useCarritoPOS();
  const [detalleId, setDetalleId] = useState<string | null>(() => filas[0]?.id ?? null);
  const [detalleMovil, setDetalleMovil] = useState(false);
  const [imprimiendo, setImprimiendo] = useState<string | null>(null);
  const [trabajo, setTrabajo] = useState<VentaPOSResultado | null>(null);
  const [filasCache, setFilasCache] = useState<HistorialPOSFila[]>([]);
  const [cacheListo, setCacheListo] = useState(false);
  const [qLocal, setQLocal] = useState(() => leerTexto(params, "q"));

  // Sin red (o con el servidor caído) se pinta la última página guardada en
  // este dispositivo; nunca un error falso de conexión si hay caché.
  const sinConexion = offline.estado === "offline";
  const debeHidratar = sinConexion || (Boolean(error) && filas.length === 0);

  useEffect(() => {
    if (!debeHidratar) return;
    let vigente = true;
    setCacheListo(false);
    void leerVistaHistorialOffline(offline.ambito)
      .then((vista) => {
        if (vigente) setFilasCache(vista?.filas ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (vigente) setCacheListo(true);
      });
    return () => {
      vigente = false;
    };
  }, [debeHidratar, offline.ambito]);

  // En línea con datos reales, el historial se guarda para la próxima caída.
  useEffect(() => {
    if (offline.estado === "offline" || error || filas.length === 0) return;
    if (!navigator.onLine) return;
    void guardarVistaHistorialOffline(offline.ambito, filas).catch(() => undefined);
  }, [error, filas, offline.ambito, offline.estado]);

  // Las primeras ventas de la página se pre-descargan (detalle + ticket) de 3
  // en 3 para poder abrirlas y reimprimirlas sin internet.
  useEffect(() => {
    if (offline.estado === "offline" || !navigator.onLine || filas.length === 0) return;
    let cancelada = false;

    async function predescargar() {
      const mapa = await leerMapaDetallesVentaOffline(offline.ambito).catch(() => undefined);
      if (!mapa) return;
      const pendientes = filas.filter((fila) => mapa[fila.id] === undefined).slice(0, MAX_PREDESCARGAS_HISTORIAL);

      for (let inicio = 0; inicio < pendientes.length; inicio += TAMANO_LOTE_PREDESCARGA) {
        if (cancelada || !navigator.onLine) return;
        const lote = pendientes.slice(inicio, inicio + TAMANO_LOTE_PREDESCARGA);
        await Promise.all(
          lote.map(async (fila) => {
            const detalle = await detalleVentaPOS(fila.id).catch(() => null);
            if (cancelada || !detalle?.ok || !detalle.data) return;
            const ticket = await ticketVentaPOS(fila.id).catch(() => null);
            if (cancelada || !ticket?.ok || !ticket.data) return;
            await guardarDetalleVentaOffline(offline.ambito, fila.id, {
              detalle: detalle.data,
              ticket: ticket.data,
            }).catch(() => undefined);
          }),
        );
      }
    }

    void predescargar().catch(() => undefined);
    return () => {
      cancelada = true;
    };
  }, [filas, offline.ambito, offline.estado]);

  const filasBase = filas.length > 0 ? filas : filasCache;
  const filasVisibles = useMemo(
    () =>
      debeHidratar ? filtrarFilasHistorialLocal(filasBase, { q: qLocal, estado: leerTexto(params, "estado") }) : filas,
    [debeHidratar, filas, filasBase, params, qLocal],
  );

  // Las ventas guardadas en este dispositivo se suman en la página 1 respetando
  // los mismos filtros del historial, sin duplicar las que ya están en el servidor.
  const filtrosLocales = useMemo(
    () => ({
      q: debeHidratar ? qLocal : leerTexto(params, "q"),
      desde,
      hasta,
      estado: leerTexto(params, "estado"),
      terminalId: leerTexto(params, "terminal"),
      pagina: leerPagina(params),
    }),
    [debeHidratar, desde, hasta, params, qLocal],
  );
  const ventasLocales = useMemo(
    () => proyectarVentasLocales(offline.operaciones, filasVisibles, filtrosLocales),
    [filasVisibles, filtrosLocales, offline.operaciones],
  );
  const items = useMemo(() => combinarHistorialPOS(filasVisibles, ventasLocales), [filasVisibles, ventasLocales]);
  const seleccion = items.find((item) => idDeItemHistorial(item) === detalleId) ?? null;
  const cargandoCache = debeHidratar && !cacheListo && filas.length === 0;
  const errorVisible = error && !(debeHidratar && filasCache.length > 0) ? error : null;

  // Si llegamos desde «Revisar pendientes» o sin filas del servidor, selecciona
  // automáticamente la primera venta visible para mostrar su detalle y acciones.
  useEffect(() => {
    if (detalleId !== null || items.length === 0) return;
    const primero = items[0];
    if (primero) setDetalleId(idDeItemHistorial(primero));
  }, [detalleId, items]);

  const sincronizadas = offline.operaciones.filter(
    (operacion) => operacion.tipo === "venta" && operacion.estado === "sincronizada",
  ).length;
  const sincronizadasPrevias = useRef(sincronizadas);

  // Cuando una venta sube, se recarga la factura real con su NCF definitivo.
  useEffect(() => {
    if (sincronizadas > sincronizadasPrevias.current) router.refresh();
    sincronizadasPrevias.current = sincronizadas;
  }, [router, sincronizadas]);

  async function imprimir(fila: HistorialPOSFila) {
    setImprimiendo(fila.id);
    try {
      let mensaje: string | null = null;
      if (offline.estado !== "offline" && navigator.onLine) {
        try {
          const resultado = await ticketVentaPOS(fila.id);
          if (resultado.ok && resultado.data) {
            setTrabajo(resultado.data);
            return;
          }
          mensaje = resultado.ok ? "No se pudo cargar la venta." : capitalizar(resultado.error);
        } catch {
          mensaje = "No se pudo conectar con el servidor.";
        }
      }

      // Sin red (o si el servidor falló), se reimprime el ticket guardado.
      const cache = await leerDetalleVentaOffline(offline.ambito, fila.id).catch(() => undefined);
      if (cache) {
        setTrabajo(cache.ticket);
        return;
      }

      toast.add({
        type: "error",
        title: "No se pudo preparar el ticket",
        description:
          mensaje ?? "Esta venta no está guardada en este dispositivo. Conéctate a internet para imprimirla.",
      });
    } finally {
      setImprimiendo(null);
    }
  }

  function seleccionar(id: string) {
    setDetalleId(id);
    setDetalleMovil(true);
  }

  /** Devuelve la venta al carrito; solo borra la copia fallida si la carga tuvo éxito. */
  async function editarVentaLocal(venta: VentaLocalHistorial) {
    const cargada = carrito.cargarVentaOffline(venta.pestana);
    if (!cargada) {
      toast.add({
        type: "error",
        title: "No se pudo cargar la venta para editar",
        description: "Cierra una pestaña de venta o revisa la copia local; no se borró nada.",
      });
      return;
    }
    if (venta.estado === "error") await offline.descartarOperacion(venta.uuid);
    router.push("/pos");
  }

  return (
    <ContenedorLista className="p-4 md:p-6">
      <EncabezadoPagina
        titulo="Ventas"
        subtitulo="Facturas cobradas desde el punto de venta."
        acciones={
          <Button variant="outline" className="h-10" render={<a href="/pos" />}>
            Ir a Vender
          </Button>
        }
      />

      {errorVisible ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {errorVisible}
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {errorVisible === null && debeHidratar ? (
        <Alert>
          <AlertDescription>
            Mostrando las ventas guardadas en este dispositivo. Se actualizarán al recuperar la conexión.
          </AlertDescription>
        </Alert>
      ) : null}

      {!errorVisible ? (
        <TarjetaLista className="flex flex-col" data-lista="pos-historial">
          <BarraLista className="h-auto flex-wrap py-2">
            {debeHidratar ? (
              <div className="relative w-full sm:max-w-sm">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  value={qLocal}
                  onChange={(evento) => setQLocal(evento.target.value)}
                  placeholder="Buscar en las ventas guardadas…"
                  aria-label="Buscar ventas guardadas en este dispositivo"
                  className="pl-8"
                />
              </div>
            ) : (
              <FiltrosHistorial params={params} desde={desde} hasta={hasta} terminales={terminales} />
            )}
          </BarraLista>

          {items.length === 0 ? (
            cargandoCache ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 px-4 py-16 text-sm">
                <Loader2 className="animate-spin" aria-hidden="true" />
                Cargando las ventas guardadas…
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                <ReceiptText className="text-muted-foreground size-8" aria-hidden="true" />
                {hayFiltros || (debeHidratar && qLocal.trim() !== "") ? (
                  <>
                    <p className="text-lg font-semibold">Sin resultados.</p>
                    <p className="text-muted-foreground text-sm">No hay ventas que coincidan con los filtros.</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold">
                      {debeHidratar ? "No hay ventas guardadas en este dispositivo." : "Aún no hay ventas del POS."}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {debeHidratar
                        ? "Conéctate a internet para consultar el historial completo."
                        : "Las ventas que cobres en el punto de venta aparecerán aquí."}
                    </p>
                    {debeHidratar ? null : (
                      <Button className="mt-2 h-10" render={<a href="/pos" />}>
                        Ir a Vender
                      </Button>
                    )}
                  </>
                )}
              </div>
            )
          ) : (
            <div className="lg:flex">
              <div
                className={cn(
                  "border-border w-full shrink-0 flex-col lg:flex lg:w-[330px] lg:border-r",
                  detalleMovil ? "hidden" : "flex",
                )}
              >
                <ListaVentas
                  items={items}
                  seleccionado={detalleId}
                  imprimiendo={imprimiendo}
                  onSeleccionar={seleccionar}
                  onImprimir={(fila) => void imprimir(fila)}
                />
                <div className="border-border mt-auto border-t px-3 py-2">
                  {debeHidratar ? null : (
                    <PaginadorLista
                      base="/pos/historial"
                      params={params}
                      resumen={resumen}
                      opciones={[25, 50, 100]}
                      tamano={leerTamano(params)}
                      botonesExtremos={false}
                      className="text-xs"
                    />
                  )}
                </div>
              </div>

              <div className={cn("min-w-0 flex-1", detalleMovil ? "block" : "hidden lg:block")}>
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    className="m-2 h-8 w-fit gap-1 px-2 lg:hidden"
                    onClick={() => setDetalleMovil(false)}
                  >
                    <ArrowLeft aria-hidden="true" />
                    Ventas
                  </Button>
                  {seleccion?.origen === "local" ? (
                    <DetalleVentaOffline
                      venta={seleccion.venta}
                      empresa={empresa}
                      plantillaTicket={plantillaTicket}
                      estado={offline.estado}
                      onReintentar={() => void offline.reintentarOperacion(seleccion.venta.uuid)}
                      onEditar={() => void editarVentaLocal(seleccion.venta)}
                      onDescartar={() => void offline.descartarOperacion(seleccion.venta.uuid)}
                    />
                  ) : (
                    <DetalleVentaPos
                      facturaId={seleccion?.origen === "servidor" ? seleccion.fila.id : null}
                      onCerrar={() => {
                        setDetalleId(null);
                        setDetalleMovil(false);
                      }}
                      empresa={empresa}
                      plantillaTicket={plantillaTicket}
                      plantillaFactura={plantillaFactura}
                      puedeEscribir={puedeEscribir}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </TarjetaLista>
      ) : null}

      {imprimiendo ? <p className="text-muted-foreground text-xs">Preparando impresión…</p> : null}

      {trabajo ? (
        <ImpresionPos
          titulo={`factura-${trabajo.factura.ncf ?? trabajo.factura.numero}`}
          ancho={plantillaTicket.ancho_mm}
          onCerrar={() => setTrabajo(null)}
        >
          <TicketPos payload={armarTicketFactura(trabajo, plantillaTicket)} />
        </ImpresionPos>
      ) : null}

      <p className="text-muted-foreground text-xs">
        {filasVisibles.length === 0
          ? ""
          : filasVisibles.length === 1
            ? "1 venta en esta página"
            : `${filasVisibles.length} ventas en esta página`}
      </p>
    </ContenedorLista>
  );
}
