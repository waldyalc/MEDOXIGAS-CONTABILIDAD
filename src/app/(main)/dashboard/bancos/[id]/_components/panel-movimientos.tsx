"use client";

import { type FormEvent, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/date-picker";
import { Enlace } from "@/components/enlace";
import { usePagina } from "@/components/ficha/ficha-ui";
import { ChevronDown, Landmark, ListFilter, RefreshCw } from "@/components/icons";
import { PaginadorLocal } from "@/components/listas/paginador-local";
import { type ColumnaLista, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import type { MovimientoBanco } from "@/lib/bancos/movimientos";
import { rutaContacto } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";

interface Props {
  cuentaId: string;
  movimientos: MovimientoBanco[];
  desde: string;
  hasta: string;
  puedeEscribir: boolean;
  totalEntradasCentavos: number;
  totalSalidasCentavos: number;
  saldoCentavos: number;
}

/** Tabla de movimientos de la ficha con barra Filtrar/Actualizar y paginación local. */
export function PanelMovimientos({
  cuentaId,
  movimientos,
  desde,
  hasta,
  puedeEscribir,
  totalEntradasCentavos,
  totalSalidasCentavos,
  saldoCentavos,
}: Props) {
  const router = useRouter();
  const [fechaDesde, setFechaDesde] = useState(desde);
  const [fechaHasta, setFechaHasta] = useState(hasta);
  const [porPagina, setPorPagina] = useState(10);
  const { pagina, setPagina } = usePagina(movimientos.length, porPagina);
  const visibles = movimientos.slice(pagina * porPagina, (pagina + 1) * porPagina);
  const hayFiltro = desde !== "" || hasta !== "";

  function enlaceAsiento(asientoId: string): string {
    const parametros = new URLSearchParams();
    if (desde) parametros.set("desde", desde);
    if (hasta) parametros.set("hasta", hasta);
    parametros.set("asiento", asientoId);
    return `?${parametros.toString()}#seccion-asiento`;
  }

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const parametros = new URLSearchParams();
    if (fechaDesde) parametros.set("desde", fechaDesde);
    if (fechaHasta) parametros.set("hasta", fechaHasta);
    const consulta = parametros.toString();
    router.push(consulta ? `?${consulta}` : "?");
  }

  function limpiar() {
    setFechaDesde("");
    setFechaHasta("");
    router.push("?");
  }

  const columnas: readonly ColumnaLista<MovimientoBanco>[] = [
    {
      clave: "fecha",
      encabezado: "Fecha",
      celda: (movimiento) => <span className="tabular-nums">{formatoDia(movimiento.fecha)}</span>,
    },
    {
      clave: "documento",
      encabezado: "Documento",
      celda: (movimiento) => (
        <span className="flex flex-col gap-0.5 whitespace-normal">
          {movimiento.documento.href ? (
            <Enlace href={movimiento.documento.href}>{movimiento.documento.etiqueta}</Enlace>
          ) : (
            <span>{movimiento.documento.etiqueta}</span>
          )}
          <Enlace href={enlaceAsiento(movimiento.asientoId)} className="text-muted-foreground text-xs">
            Asiento #{movimiento.asientoNumero}
          </Enlace>
        </span>
      ),
    },
    {
      clave: "tercero",
      encabezado: "Tercero",
      celda: (movimiento) =>
        movimiento.tercero ? (
          <Enlace href={rutaContacto(movimiento.tercero.id)}>{movimiento.tercero.nombre}</Enlace>
        ) : (
          "—"
        ),
    },
    {
      clave: "entrada",
      encabezado: "Entrada",
      alineacion: "derecha",
      celda: (movimiento) => (movimiento.entradaCentavos === 0 ? "—" : formatearRd(movimiento.entradaCentavos)),
    },
    {
      clave: "salida",
      encabezado: "Salida",
      alineacion: "derecha",
      celda: (movimiento) => (movimiento.salidaCentavos === 0 ? "—" : formatearRd(movimiento.salidaCentavos)),
    },
    {
      clave: "saldo",
      encabezado: "Saldo",
      alineacion: "derecha",
      celda: (movimiento) => formatearRd(movimiento.saldoCentavos),
    },
  ];

  return (
    <TarjetaLista data-lista="banco-movimientos">
      <Collapsible defaultOpen={hayFiltro}>
        <div className="border-border flex h-14 items-center justify-between gap-2 border-b px-4">
          <CollapsibleTrigger
            render={
              <Button variant="ghost" size="sm" className="-ml-2 gap-1.5">
                <ListFilter />
                Filtrar
                <ChevronDown className="size-3.5" />
              </Button>
            }
          />
          <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
            <RefreshCw />
            Actualizar datos
          </Button>
        </div>
        <CollapsibleContent className="border-border border-b px-4 py-3">
          <form onSubmit={aplicar} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banco-desde">Desde</Label>
              <DatePicker id="banco-desde" value={fechaDesde} onChange={setFechaDesde} className="w-44" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banco-hasta">Hasta</Label>
              <DatePicker id="banco-hasta" value={fechaHasta} onChange={setFechaHasta} className="w-44" />
            </div>
            <Button type="submit" variant="secondary">
              Filtrar
            </Button>
            <Button type="button" variant="ghost" onClick={limpiar}>
              Limpiar
            </Button>
          </form>
        </CollapsibleContent>
      </Collapsible>

      <TablaLista
        columnas={columnas}
        filas={visibles}
        claveFila={(movimiento) => movimiento.id}
        filaHref={(movimiento) => movimiento.documento.href ?? enlaceAsiento(movimiento.asientoId)}
        vacio={{
          filtrada: hayFiltro,
          icono: <Landmark className="size-14" />,
          titulo: hayFiltro ? "Sin movimientos" : "¡Crea tu primer movimiento!",
          descripcion: hayFiltro
            ? "La cuenta no tiene movimientos en el período seleccionado."
            : "Registra un pago o un ingreso para empezar a mover esta cuenta.",
          accion: puedeEscribir ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                render={<Link href={`/dashboard/compras/pagos/nuevo?cuenta=${cuentaId}`} prefetch={false} />}
              >
                Crear nuevo pago
              </Button>
              <Button
                variant="outline"
                render={<Link href={`/dashboard/pagos-recibidos/nuevo?cuenta=${cuentaId}`} prefetch={false} />}
              >
                Crear pago recibido
              </Button>
            </div>
          ) : undefined,
        }}
        pie={
          movimientos.length > 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-right">
                Totales
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(totalEntradasCentavos)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(totalSalidasCentavos)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(saldoCentavos)}</TableCell>
            </TableRow>
          ) : undefined
        }
      />

      <div className="border-border border-t px-4 py-3">
        <PaginadorLocal
          total={movimientos.length}
          pagina={pagina}
          setPagina={setPagina}
          porPagina={porPagina}
          onCambiarPorPagina={setPorPagina}
          opciones={[10, 25, 50]}
          etiqueta="movimientos"
        />
      </div>
    </TarjetaLista>
  );
}
