import Link from "next/link";

import { ArrowLeftRight } from "@/components/icons";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaCuenta, rutaGasto, rutaPagoProveedor, rutaPagoRecibido } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { leerTamanoConDefecto, resumirPagina, TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { obtenerTransacciones } from "@/lib/reportes/administrativos/e/consultas";
import { tablaTransacciones } from "@/lib/reportes/administrativos/e/tablas";
import {
  type FiltrosTransacciones as Filtros,
  filtrarTransacciones,
  type MovimientoTransaccion,
  paginarTransacciones,
  totalesTransacciones,
} from "@/lib/reportes/administrativos/e/transacciones";
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
  if (movimiento.origen === "pago_recibido") return rutaPagoRecibido(movimiento.id);
  if (movimiento.origen === "pago_proveedor") return rutaPagoProveedor(movimiento.id);
  return rutaGasto(movimiento.id);
}

function FilaTransaccion({ movimiento }: { movimiento: MovimientoTransaccion }) {
  return (
    <FilaNavegable href={urlMovimiento(movimiento)}>
      <TableCell>
        <Link href={urlMovimiento(movimiento)} className="font-medium hover:underline">
          {movimiento.comprobante}
        </Link>
      </TableCell>
      <TableCell>{formatoDia(movimiento.fecha)}</TableCell>
      <TableCell>
        <Link href={rutaCuenta(movimiento.cuentaId)} className="hover:underline">
          {movimiento.cuenta}
        </Link>
      </TableCell>
      <TableCell>
        {movimiento.contactoId ? (
          <Link href={rutaContacto(movimiento.contactoId)} className="hover:underline">
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
    </FilaNavegable>
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
  const tamano = leerTamanoConDefecto(parametros, 25);

  const { movimientos, error } = await obtenerTransacciones(desde, hasta);
  const filtradas = filtrarTransacciones(movimientos, { comprobante, fecha, estado, tipo, valorCentavos });
  const totales = totalesTransacciones(filtradas);
  const { filas, pagina: paginaActual, total } = paginarTransacciones(filtradas, pagina, tamano);
  const resumenPagina = resumirPagina(paginaActual, tamano, total);
  const tabla = tablaTransacciones(filtradas, totales, desde, hasta);

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
              <PaginadorLista
                base="/dashboard/reportes/transacciones"
                params={parametros}
                resumen={resumenPagina}
                tamano={tamano}
                opciones={TAMANOS_PAGINA}
                className="print:hidden"
              />
            </CardContent>
          </Card>

          <p className="text-muted-foreground text-sm">No incluye transferencias entre bancos.</p>
        </div>
      )}
    </div>
  );
}
