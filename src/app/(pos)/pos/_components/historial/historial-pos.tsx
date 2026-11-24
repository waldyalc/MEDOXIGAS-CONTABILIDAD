"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";

import { ArrowLeft, ReceiptText } from "@/components/icons";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { BarraLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { ContenedorLista } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { Empresa } from "@/lib/facturacion/tipos";
import { leerTamano, type ParametrosLista, type ResumenPagina } from "@/lib/listas/parametros";
import {
  combinarHistorialPOS,
  idDeItemHistorial,
  proyectarVentasLocales,
  type VentaLocalHistorial,
} from "@/lib/pos/historial-offline";
import { armarTicketFactura } from "@/lib/pos/impresion";
import type { HistorialPOSFila, PlantillaTicket, VentaPOSResultado } from "@/lib/pos/tipos";

import { ticketVentaPOS } from "../acciones-pos";
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

  // Las ventas guardadas en este dispositivo se suman a las del servidor sin
  // duplicar las que ya subieron.
  const ventasLocales = useMemo(() => proyectarVentasLocales(offline.operaciones, filas), [filas, offline.operaciones]);
  const items = useMemo(() => combinarHistorialPOS(filas, ventasLocales), [filas, ventasLocales]);
  const seleccion = items.find((item) => idDeItemHistorial(item) === detalleId) ?? null;

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
      const resultado = await ticketVentaPOS(fila.id);
      if (!resultado.ok || !resultado.data) {
        toast.add({
          type: "error",
          title: "No se pudo preparar el ticket",
          description: resultado.ok ? "No se pudo cargar la venta." : capitalizar(resultado.error),
        });
        return;
      }
      setTrabajo(resultado.data);
    } finally {
      setImprimiendo(null);
    }
  }

  function seleccionar(id: string) {
    setDetalleId(id);
    setDetalleMovil(true);
  }

  /** Devuelve la venta al carrito, borra la copia fallida y abre el POS para recobrarla. */
  async function editarVentaLocal(venta: VentaLocalHistorial) {
    carrito.cargarVentaOffline(venta.pestana);
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

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {error}
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <TarjetaLista className="flex flex-col" data-lista="pos-historial">
          <BarraLista className="h-auto flex-wrap py-2">
            <FiltrosHistorial params={params} desde={desde} hasta={hasta} terminales={terminales} />
          </BarraLista>

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <ReceiptText className="text-muted-foreground size-8" aria-hidden="true" />
              {hayFiltros ? (
                <>
                  <p className="text-lg font-semibold">Sin resultados.</p>
                  <p className="text-muted-foreground text-sm">No hay ventas que coincidan con los filtros.</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold">Aún no hay ventas del POS.</p>
                  <p className="text-muted-foreground text-sm">
                    Las ventas que cobres en el punto de venta aparecerán aquí.
                  </p>
                  <Button className="mt-2 h-10" render={<a href="/pos" />}>
                    Ir a Vender
                  </Button>
                </>
              )}
            </div>
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
                  <PaginadorLista
                    base="/pos/historial"
                    params={params}
                    resumen={resumen}
                    opciones={[25, 50, 100]}
                    tamano={leerTamano(params)}
                    botonesExtremos={false}
                    className="text-xs"
                  />
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
      )}

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
        {filas.length === 0
          ? ""
          : filas.length === 1
            ? "1 venta en esta página"
            : `${filas.length} ventas en esta página`}
      </p>
    </ContenedorLista>
  );
}
