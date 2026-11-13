import Link from "next/link";

import { ArrowLeftRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoDia } from "@/lib/formato";
import { obtenerTransacciones } from "@/lib/reportes/administrativos/e/consultas";
import { tablaTransacciones } from "@/lib/reportes/administrativos/e/tablas";
import {
  type FiltrosTransacciones as Filtros,
  filtrarTransacciones,
  type MovimientoTransaccion,
  paginarTransacciones,
  totalesTransacciones,
} from "@/lib/reportes/administrativos/e/transacciones";
import { urlContacto, urlGastoMenor, urlPagoProveedor, urlPagoRecibido } from "@/lib/reportes/administrativos/e/urls";
import { centavos, formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltrosTransacciones } from "./_components/filtros-transacciones";

function leerParametro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

function urlMovimiento(movimiento: MovimientoTransaccion): string {
  if (movimiento.origen === "pago_recibido") return urlPagoRecibido(movimiento.id);
  if (movimiento.origen === "pago_proveedor") return urlPagoProveedor(movimiento.id);
  return urlGastoMenor(movimiento.id);
}

function urlPagina(pagina: number, filtros: Record<string, string>): string {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== "") parametros.set(clave, valor);
  }
  parametros.set("pagina", String(pagina));
  return `/dashboard/reportes/transacciones?${parametros.toString()}`;
}

function FilaTransaccion({ movimiento }: { movimiento: MovimientoTransaccion }) {
  return (
    <TableRow>
      <TableCell>
        <Link href={urlMovimiento(movimiento)} className="font-medium hover:underline">
          {movimiento.comprobante}
        </Link>
      </TableCell>
      <TableCell>{formatoDia(movimiento.fecha)}</TableCell>
      <TableCell>{movimiento.cuenta}</TableCell>
      <TableCell>
        {movimiento.contactoId ? (
          <Link href={urlContacto(movimiento.contactoId)} className="hover:underline">
            {movimiento.contactoNombre ?? "—"}
          </Link>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>{movimiento.detalle}</TableCell>
      <TableCell className="text-right tabular-nums">
        {movimiento.entradas > 0 ? formatearRd(movimiento.entradas) : ""}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {movimiento.salidas > 0 ? formatearRd(movimiento.salidas) : ""}
      </TableCell>
    </TableRow>
  );
}

interface PaginacionProps {
  pagina: number;
  totalPaginas: number;
  filtros: Record<string, string>;
}

function PaginacionTransacciones({ pagina, totalPaginas, filtros }: PaginacionProps) {
  const hayAnterior = pagina > 1;
  const haySiguiente = pagina < totalPaginas;

  return (
    <Pagination className="print:hidden">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={hayAnterior ? urlPagina(pagina - 1, filtros) : undefined}
            aria-disabled={!hayAnterior}
            tabIndex={hayAnterior ? undefined : -1}
            className={hayAnterior ? undefined : "pointer-events-none opacity-50"}
          />
        </PaginationItem>
        <PaginationItem>
          <span className="text-muted-foreground px-3 text-sm tabular-nums">
            Página {pagina} de {totalPaginas}
          </span>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href={haySiguiente ? urlPagina(pagina + 1, filtros) : undefined}
            aria-disabled={!haySiguiente}
            tabIndex={haySiguiente ? undefined : -1}
            className={haySiguiente ? undefined : "pointer-events-none opacity-50"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const parametros = await searchParams;
  const { desde, hasta } = parsearRango(parametros);
  const comprobante = leerParametro(parametros.comprobante);
  const fecha = leerParametro(parametros.fecha);
  const estado = leerParametro(parametros.estado);
  const tipoTexto = leerParametro(parametros.tipo);
  const tipo: Filtros["tipo"] = tipoTexto === "entrada" || tipoTexto === "salida" ? tipoTexto : "";
  const valor = leerParametro(parametros.valor);
  const valorCentavos = valor === "" ? null : centavos(valor);
  const pagina = Number.parseInt(leerParametro(parametros.pagina), 10) || 1;

  const { movimientos, error } = await obtenerTransacciones(desde, hasta);
  const filtradas = filtrarTransacciones(movimientos, { comprobante, fecha, estado, tipo, valorCentavos });
  const totales = totalesTransacciones(filtradas);
  const { filas, pagina: paginaActual, totalPaginas, total } = paginarTransacciones(filtradas, pagina);
  const tabla = tablaTransacciones(filtradas, totales, desde, hasta);
  const filtrosUrl: Record<string, string> = { desde, hasta, comprobante, fecha, estado, tipo, valor };

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Transacciones"
        descripcion="Entradas y salidas por pagos recibidos, pagos a proveedores y gastos menores."
        desde={desde}
        hasta={hasta}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltrosTransacciones
          desde={desde}
          hasta={hasta}
          comprobante={comprobante}
          fecha={fecha}
          estado={estado}
          tipo={tipo}
          valor={valor}
        />
        <BotonDescargar tabla={tabla} nombreArchivo={`transacciones-${desde}-${hasta}`} />
      </div>

      {error ? <AlertaError mensaje={error} /> : null}

      {filas.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArrowLeftRight />
            </EmptyMedia>
            <EmptyTitle>Sin transacciones</EmptyTitle>
            <EmptyDescription>No hay pagos ni gastos en el período y filtros seleccionados.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          <Card className="py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comprobante</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Salidas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((movimiento) => (
                    <FilaTransaccion key={`${movimiento.origen}-${movimiento.id}`} movimiento={movimiento} />
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5}>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(totales.entradas)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(totales.salidas)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <p className="text-muted-foreground text-sm">No incluye transferencias entre bancos.</p>

          {total > 0 ? (
            <PaginacionTransacciones pagina={paginaActual} totalPaginas={totalPaginas} filtros={filtrosUrl} />
          ) : null}
        </div>
      )}
    </div>
  );
}
