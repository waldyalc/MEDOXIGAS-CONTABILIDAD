import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, Scale } from "lucide-react";

import { Enlace } from "@/components/enlace";
import {
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { getDetalleCuentaBanco, normalizarFecha } from "@/lib/bancos/consultas";
import { tipoCuenta } from "@/lib/bancos/formato";
import type { MovimientoBanco } from "@/lib/bancos/movimientos";
import { rutaAsiento, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";

import { FiltroFechas } from "./_components/filtro-fechas";

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
        <Enlace href={rutaAsiento(movimiento.asientoId)} className="text-muted-foreground text-xs">
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

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { id } = await params;
  const busqueda = await searchParams;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const desde = normalizarFecha(busqueda.desde);
  const hasta = normalizarFecha(busqueda.hasta);
  const detalle = await getDetalleCuentaBanco(id, desde, hasta);
  if (!detalle) notFound();

  const { cuenta } = detalle;
  const puedeEscribir = rol !== "lector";

  return (
    <ContenedorLista>
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/bancos" prefetch={false} />}>
          <ArrowLeft data-icon="inline-start" />
          Bancos
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl tracking-tight">{cuenta.nombre}</h1>
              <PillEstado tono="neutro">{tipoCuenta(cuenta.nombre, cuenta.tipoBanco)}</PillEstado>
            </div>
            <p className="text-muted-foreground text-sm">
              <Enlace href={rutaCuenta(cuenta.id)}>Cuenta contable {cuenta.codigo}</Enlace>
              {cuenta.numeroCuenta ? ` · N.º ${cuenta.numeroCuenta}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs">Saldo actual</span>
            <span
              className={`text-2xl font-semibold tabular-nums ${
                detalle.saldoActualCentavos < 0 ? "text-destructive" : ""
              }`}
            >
              {formatearRd(detalle.saldoActualCentavos)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltroFechas desde={desde ?? ""} hasta={hasta ?? ""} />
        {puedeEscribir ? (
          <Button
            variant="outline"
            render={<Link href={`/dashboard/bancos/conciliaciones/nueva?cuenta=${cuenta.id}`} prefetch={false} />}
          >
            <Scale />
            Conciliar
          </Button>
        ) : null}
      </div>

      <TarjetaLista data-lista="banco-movimientos">
        <TablaLista
          columnas={columnas}
          filas={detalle.movimientos}
          claveFila={(movimiento) => movimiento.id}
          vacio={{
            filtrada: true,
            titulo: "Sin movimientos",
            descripcion: "La cuenta no tiene movimientos en el período seleccionado.",
          }}
          pie={
            <TableRow>
              <TableCell colSpan={3} className="text-right">
                Totales
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(detalle.totalEntradasCentavos)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(detalle.totalSalidasCentavos)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatearRd(detalle.saldoCentavos)}</TableCell>
            </TableRow>
          }
        />
      </TarjetaLista>

      {cuenta.descripcion ? <p className="text-muted-foreground text-sm">{cuenta.descripcion}</p> : null}
    </ContenedorLista>
  );
}
