"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { PaginadorLista } from "@/components/listas/paginador-lista";
import { ContenedorLista } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { Empresa } from "@/lib/facturacion/tipos";
import { leerTamano, type ParametrosLista, type ResumenPagina } from "@/lib/listas/parametros";
import { armarTicketFactura } from "@/lib/pos/impresion";
import type { HistorialPOSFila, PlantillaTicket, VentaPOSResultado } from "@/lib/pos/tipos";

import { ticketVentaPOS } from "../acciones-pos";
import { capitalizar } from "../formato-pos";
import { DetalleVentaPos } from "./detalle-venta-pos";
import { FiltrosHistorial } from "./filtros-historial";
import { TablaVentasPos } from "./tabla-ventas-pos";

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
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [imprimiendo, setImprimiendo] = useState<string | null>(null);
  const [trabajo, setTrabajo] = useState<VentaPOSResultado | null>(null);

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

  return (
    <ContenedorLista className="p-4 md:p-6">
      <EncabezadoPagina
        titulo="Historial de ventas del POS"
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
        <TablaVentasPos
          filas={filas}
          barra={<FiltrosHistorial params={params} desde={desde} hasta={hasta} terminales={terminales} />}
          vacio={
            hayFiltros
              ? {
                  titulo: "Sin resultados.",
                  descripcion: "No hay ventas que coincidan con los filtros.",
                  filtrada: true,
                }
              : {
                  titulo: "Aún no hay ventas del POS.",
                  descripcion: "Las ventas que cobres en el punto de venta aparecerán aquí.",
                  accion: (
                    <Button className="h-10" render={<a href="/pos" />}>
                      Ir a Vender
                    </Button>
                  ),
                }
          }
          onVer={(fila) => setDetalleId(fila.id)}
          onImprimir={(fila) => void imprimir(fila)}
        />
      )}

      <PaginadorLista
        base="/pos/historial"
        params={params}
        resumen={resumen}
        opciones={[25, 50, 100]}
        tamano={leerTamano(params)}
      />

      {imprimiendo ? <p className="text-muted-foreground text-xs">Preparando impresión…</p> : null}

      <DetalleVentaPos
        facturaId={detalleId}
        onCerrar={() => setDetalleId(null)}
        empresa={empresa}
        plantillaTicket={plantillaTicket}
        plantillaFactura={plantillaFactura}
        puedeEscribir={puedeEscribir}
      />

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
