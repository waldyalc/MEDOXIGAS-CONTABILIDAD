"use client";

import { type ReactNode, useState } from "react";

import Link from "next/link";

import { AvatarInicial } from "@/components/avatar-inicial";
import { usePagina } from "@/components/ficha/ficha-ui";
import { Eye, Undo2, Wallet } from "@/components/icons";
import { PaginadorLocal } from "@/components/listas/paginador-local";
import {
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { CuentaCajaBanco } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";
import { TAMANOS_PAGINA } from "@/lib/listas/parametros";
import type { ConfigNomina, PeriodoNomina, ReciboNomina } from "@/lib/nomina/tipos";

import {
  EstadoNominaPill,
  etiquetaPeriodo,
  MIGAS_BASE,
  RUTA_PERIODOS,
  rutaAsientoNomina,
  rutaPeriodoNomina,
  sumarMontos,
  TarjetaResumenNomina,
} from "../../../periodos/_components/comun-nomina";
import { DialogoPagarPeriodo } from "../../../periodos/_components/dialogo-pagar-periodo";
import { DialogoAnularPago } from "../../../recibos/[id]/_components/dialogo-anular";
import { DialogoPagarRecibo } from "../../../recibos/[id]/_components/dialogo-pagar-recibo";

interface Props {
  readonly periodo: PeriodoNomina;
  readonly recibos: ReciboNomina[];
  readonly cargos: Record<string, string>;
  readonly cuentas: CuentaCajaBanco[];
  readonly config: ConfigNomina | null;
  readonly puedeEscribir: boolean;
}

export function LoteCliente({ periodo, recibos, cargos, cuentas, config, puedeEscribir }: Props) {
  const { pagina, setPagina, porPagina, setPorPagina } = usePagina(recibos.length, 25);
  const [pagarTodoAbierto, setPagarTodoAbierto] = useState(false);
  const [reciboPagar, setReciboPagar] = useState<ReciboNomina | null>(null);
  const [reciboAnular, setReciboAnular] = useState<ReciboNomina | null>(null);

  const activos = recibos.filter((recibo) => recibo.estado !== "anulado");
  const pagados = activos.filter((recibo) => recibo.estado === "pagado");
  const pendientes = activos.filter((recibo) => recibo.estado === "contabilizado");
  const anulados = recibos.length - activos.length;
  const totalPagado = sumarMontos(pagados.map((recibo) => recibo.neto_pagar));
  const totalNeto = sumarMontos(activos.map((recibo) => recibo.neto_pagar));
  const totalPendiente = sumarMontos(pendientes.map((recibo) => recibo.neto_pagar));
  const todosPagados = activos.length > 0 && pagados.length === activos.length;
  const todosListos =
    activos.length > 0 && activos.every((recibo) => recibo.estado === "contabilizado" || recibo.estado === "pagado");
  const puedePagarTodo = puedeEscribir && pendientes.length > 0 && todosListos && cuentas.length > 0 && config != null;
  const porcentaje = activos.length === 0 ? 0 : Math.round((pagados.length / activos.length) * 100);

  const visibles = recibos.slice(pagina * porPagina, (pagina + 1) * porPagina);

  const columnas: readonly ColumnaLista<ReciboNomina>[] = [
    {
      clave: "empleado",
      encabezado: "Empleado",
      celda: (recibo) => (
        <div className="flex items-center gap-2.5">
          <AvatarInicial nombre={recibo.empleado_nombre} size="sm" />
          <div className="flex flex-col">
            <span className="font-medium">{recibo.empleado_nombre}</span>
            <span className="text-muted-foreground text-xs">{cargos[recibo.id] ?? "Sin cargo"}</span>
          </div>
        </div>
      ),
    },
    {
      clave: "neto",
      encabezado: "Neto",
      alineacion: "derecha",
      celda: (recibo) => <span className="font-semibold">{formatoMoneda(recibo.neto_pagar)}</span>,
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (recibo) => <EstadoNominaPill estado={recibo.estado} />,
    },
    {
      clave: "fecha",
      encabezado: "Fecha de pago",
      celda: (recibo) => (recibo.fecha_pagado ? formatoDia(recibo.fecha_pagado) : "—"),
    },
    {
      clave: "asiento",
      encabezado: "Asiento de pago",
      celda: (recibo) => {
        if (recibo.pago_asiento_id) {
          return (
            <Link
              href={rutaAsientoNomina(recibo.pago_asiento_id)}
              className="text-primary text-xs underline-offset-4 hover:underline"
            >
              Ver asiento
            </Link>
          );
        }
        if (recibo.estado === "pagado")
          return <span className="text-muted-foreground text-xs">Sin asiento (neto 0)</span>;
        return <span className="text-muted-foreground">—</span>;
      },
    },
  ];

  let accionPagar: ReactNode = null;
  if (puedeEscribir && !todosPagados && activos.length > 0 && periodo.estado !== "anulado") {
    accionPagar = puedePagarTodo ? (
      <Button type="button" onClick={() => setPagarTodoAbierto(true)}>
        <Wallet />
        {pagados.length > 0 ? "Pagar pendientes" : "Pagar todo"}
      </Button>
    ) : (
      <Button type="button" disabled title="Contabiliza el periodo antes de pagar.">
        <Wallet />
        Pagar todo
      </Button>
    );
  }

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo={`Pagos del periodo ${etiquetaPeriodo(periodo.fecha_inicio, periodo.fecha_fin, true)}`}
        subtitulo={`${pagados.length} de ${activos.length} recibos pagados · Total pagado ${formatoMoneda(totalPagado)}.`}
        migas={[
          ...MIGAS_BASE,
          { etiqueta: "Pagos", href: "/dashboard/contabilidad/nomina/pagos" },
          { etiqueta: etiquetaPeriodo(periodo.fecha_inicio, periodo.fecha_fin) },
        ]}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {accionPagar}
            <Button variant="outline" render={<Link href={rutaPeriodoNomina(periodo.id)} prefetch={false} />}>
              Volver al periodo
            </Button>
          </div>
        }
      />

      <Card className="border-border bg-card gap-0 rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              Pagos {pagados.length}/{activos.length}
            </span>
            <span className="text-muted-foreground tabular-nums">{porcentaje} %</span>
          </div>
          <Progress value={porcentaje} />
          <div className="flex flex-wrap items-center gap-2">
            <PillEstado tono="pendiente">Pendientes {pendientes.length}</PillEstado>
            <PillEstado tono="exito">Pagados {pagados.length}</PillEstado>
            <PillEstado tono="peligro">Anulados {anulados}</PillEstado>
          </div>
          {!todosListos && activos.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              Contabiliza el periodo antes de pagar.{" "}
              <Link href={rutaPeriodoNomina(periodo.id)} className="text-primary underline-offset-4 hover:underline">
                Ir al periodo
              </Link>
              .
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaResumenNomina etiqueta="Recibos activos" valor={activos.length} ayuda={`${anulados} anulados`} />
        <TarjetaResumenNomina etiqueta="Total a pagar" valor={formatoMoneda(totalNeto)} />
        <TarjetaResumenNomina etiqueta="Pagado" valor={formatoMoneda(totalPagado)} />
        <TarjetaResumenNomina etiqueta="Pendiente de pago" valor={formatoMoneda(totalPendiente)} enfasis />
      </div>

      <TarjetaLista data-lista="pagos-periodo">
        <TablaLista
          columnas={columnas}
          filas={visibles}
          claveFila={(recibo) => recibo.id}
          acciones={
            puedeEscribir
              ? (recibo) => {
                  if (recibo.estado === "contabilizado" && cuentas.length > 0 && config != null) {
                    return (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReciboPagar(recibo)}
                        aria-label={`Pagar el recibo de ${recibo.empleado_nombre}`}
                      >
                        Pagar
                      </Button>
                    );
                  }
                  if (recibo.estado === "pagado") {
                    return (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setReciboAnular(recibo)}
                        aria-label={`Anular el pago de ${recibo.empleado_nombre}`}
                      >
                        <Undo2 />
                      </Button>
                    );
                  }
                  return <span className="text-muted-foreground">—</span>;
                }
              : undefined
          }
          vacio={{
            titulo: "Sin recibos para pagar.",
            descripcion: "Este periodo no tiene recibos no anulados.",
            accion: (
              <Button variant="outline" render={<Link href={rutaPeriodoNomina(periodo.id)} prefetch={false} />}>
                <Eye />
                Ver el periodo
              </Button>
            ),
          }}
          pie={
            activos.length > 0 ? (
              <TableRow className="h-14">
                <TableCell className="px-5 pl-6 font-medium">Total del periodo</TableCell>
                <TableCell className="px-5 text-right font-semibold tabular-nums">{formatoMoneda(totalNeto)}</TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            ) : undefined
          }
        />
        <PaginadorLocal
          total={recibos.length}
          pagina={pagina}
          setPagina={setPagina}
          porPagina={porPagina}
          opciones={TAMANOS_PAGINA}
          onCambiarPorPagina={setPorPagina}
          etiqueta="recibos"
        />
      </TarjetaLista>

      <p className="text-muted-foreground text-right text-xs">
        <Link href={RUTA_PERIODOS} className="text-primary underline-offset-4 hover:underline">
          Ver todos los periodos
        </Link>
      </p>

      {puedePagarTodo ? (
        <DialogoPagarPeriodo
          abierto={pagarTodoAbierto}
          onOpenChange={setPagarTodoAbierto}
          periodoId={periodo.id}
          periodoCodigo={periodo.codigo}
          recibos={pendientes.length}
          total={totalPendiente.toFixed(2)}
          cuentas={cuentas}
          cuentaDefecto={config?.cuenta_pago_defecto_id ?? null}
          conNetoCero={pendientes.filter((recibo) => Number(recibo.neto_pagar) === 0).length}
        />
      ) : null}

      {reciboPagar ? (
        <DialogoPagarRecibo
          abierto
          onOpenChange={(abierto) => {
            if (!abierto) setReciboPagar(null);
          }}
          reciboId={reciboPagar.id}
          nombre={reciboPagar.empleado_nombre}
          neto={reciboPagar.neto_pagar}
          cuentas={cuentas}
          cuentaDefecto={config?.cuenta_pago_defecto_id ?? null}
          cuentaSalarios={
            config != null && config.cuenta_salarios_por_pagar_id === reciboPagar.cuenta_salarios_por_pagar_id
              ? config.cuenta_salarios_por_pagar_nombre
              : null
          }
        />
      ) : null}

      {reciboAnular ? (
        <DialogoAnularPago
          abierto
          onOpenChange={(abierto) => {
            if (!abierto) setReciboAnular(null);
          }}
          reciboId={reciboAnular.id}
          nombre={reciboAnular.empleado_nombre}
        />
      ) : null}
    </ContenedorLista>
  );
}
