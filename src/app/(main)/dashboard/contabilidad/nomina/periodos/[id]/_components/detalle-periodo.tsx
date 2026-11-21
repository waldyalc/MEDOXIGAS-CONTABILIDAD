"use client";

import { useState } from "react";

import Link from "next/link";

import { AvatarInicial } from "@/components/avatar-inicial";
import { Enlace } from "@/components/enlace";
import { CircleCheck, CircleSlash, Eye, Info, MoreVertical, Plus, Send, TriangleAlert } from "@/components/icons";
import { type ColumnaLista, ContenedorLista, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { CuentaCajaBanco } from "@/lib/facturacion/tipos";
import type { ConfigNomina, PeriodoNomina, ResumenPeriodo } from "@/lib/nomina/tipos";

import {
  EstadoNominaPill,
  etiquetaFrecuencia,
  etiquetaPeriodo,
  formatoDias,
  MIGAS_BASE,
  RUTA_ASIENTOS,
  RUTA_CONFIG_LABORAL,
  RUTA_ENVIOS,
  RUTA_PERIODOS,
  rutaAsientoNomina,
  rutaPagosNomina,
  rutaReciboNomina,
  sumarMontos,
  TarjetaResumenNomina,
} from "../../_components/comun-nomina";
import { DialogoCalcularPeriodo } from "../../_components/dialogo-calcular-periodo";
import { DialogoContabilizarPeriodo } from "../../_components/dialogo-contabilizar-periodo";
import { DialogoPagarPeriodo } from "../../_components/dialogo-pagar-periodo";
import { DialogoAgregarEmpleados } from "./dialogo-agregar-empleados";

interface Props {
  readonly periodo: PeriodoNomina;
  readonly filas: ResumenPeriodo[];
  readonly asientos: Record<string, string>;
  readonly cuentas: CuentaCajaBanco[];
  readonly config: ConfigNomina | null;
  readonly puedeEscribir: boolean;
}

function porcentaje(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((parte / total) * 100);
}

export function DetallePeriodoCliente({ periodo, filas, asientos, cuentas, config, puedeEscribir }: Props) {
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const [calcularAbierto, setCalcularAbierto] = useState(false);
  const [contabilizarAbierto, setContabilizarAbierto] = useState(false);
  const [pagarAbierto, setPagarAbierto] = useState(false);

  const noAnulados = filas.filter((fila) => fila.estado !== "anulado");
  const anulados = filas.length - noAnulados.length;
  const borradores = noAnulados.filter((fila) => fila.estado === "borrador");
  const calculados = noAnulados.filter((fila) => fila.estado === "calculado");
  const contabilizados = noAnulados.filter((fila) => fila.estado === "contabilizado");
  const pagados = noAnulados.filter((fila) => fila.estado === "pagado");
  const calculables = borradores.length + calculados.length;
  const alMenosCalculados = calculados.length + contabilizados.length + pagados.length;
  const enviables = noAnulados.filter((fila) => fila.estado !== "borrador");

  const todosAlMenosCalculados = noAnulados.length > 0 && borradores.length === 0;
  const todosContabilizados =
    noAnulados.length > 0 && noAnulados.every((fila) => fila.estado === "contabilizado" || fila.estado === "pagado");
  const periodoBloqueado =
    periodo.estado === "contabilizado" || periodo.estado === "pagado" || periodo.estado === "anulado";
  const cuentaDefecto = config?.cuenta_pago_defecto_id ?? null;
  const faltaCuentaSalarios = config != null && config.cuenta_salarios_por_pagar_id == null;
  const puedeCalcular = puedeEscribir && !periodoBloqueado && calculables > 0;
  const puedeContabilizar =
    puedeEscribir &&
    periodo.estado !== "anulado" &&
    todosAlMenosCalculados &&
    calculados.length > 0 &&
    config != null &&
    !faltaCuentaSalarios;
  const puedePagar =
    puedeEscribir && contabilizados.length > 0 && todosContabilizados && cuentas.length > 0 && config != null;
  const puedeEnviar = enviables.some((fila) => !fila.colilla_enviada_en);
  // La RPC también acepta el periodo anulado: agregar revive sus recibos a borrador.
  const puedeAgregarEmpleados = puedeEscribir && periodo.estado !== "contabilizado" && periodo.estado !== "pagado";

  const totalIngresos = sumarMontos(noAnulados.map((fila) => fila.total_ingresos));
  const totalDeducciones = sumarMontos(noAnulados.map((fila) => fila.total_deducciones));
  const totalNeto = sumarMontos(noAnulados.map((fila) => fila.neto_pagar));
  const totalCosto = sumarMontos(noAnulados.map((fila) => fila.costo_total_empresa));
  const totalPorPagar = sumarMontos(contabilizados.map((fila) => fila.neto_pagar));
  const totalPorContabilizar = sumarMontos(calculados.map((fila) => fila.costo_total_empresa));
  const conNetoCero = contabilizados.filter((fila) => Number(fila.neto_pagar) === 0).length;

  const columnas: readonly ColumnaLista<ResumenPeriodo>[] = [
    {
      clave: "empleado",
      encabezado: "Empleado",
      celda: (fila) => (
        <div className="flex items-center gap-2.5">
          <AvatarInicial nombre={fila.empleado_nombre} size="sm" />
          <div className="flex flex-col">
            <span className="font-medium">{fila.empleado_nombre}</span>
            <span className="text-muted-foreground text-xs">{fila.cargo ?? "Sin cargo"}</span>
          </div>
        </div>
      ),
    },
    {
      clave: "dias",
      encabezado: "Días",
      alineacion: "derecha",
      className: "hidden md:table-cell",
      celda: (fila) => formatoDias(fila.dias_trabajados),
    },
    {
      clave: "salario",
      encabezado: "Salario base",
      alineacion: "derecha",
      className: "hidden lg:table-cell",
      celda: (fila) => formatoMoneda(fila.salario_base),
    },
    {
      clave: "ingresos",
      encabezado: "Ingresos",
      alineacion: "derecha",
      celda: (fila) => (
        <span className={fila.estado === "anulado" ? "text-muted-foreground" : undefined}>
          {formatoMoneda(fila.total_ingresos)}
        </span>
      ),
    },
    {
      clave: "deducciones",
      encabezado: "Deducciones",
      alineacion: "derecha",
      celda: (fila) => (
        <span className={fila.estado === "anulado" ? "text-muted-foreground" : undefined}>
          {formatoMoneda(fila.total_deducciones)}
        </span>
      ),
    },
    {
      clave: "neto",
      encabezado: "Neto",
      alineacion: "derecha",
      celda: (fila) => (
        <span className={fila.estado === "anulado" ? "text-muted-foreground font-normal" : "font-semibold"}>
          {formatoMoneda(fila.neto_pagar)}
        </span>
      ),
    },
    {
      clave: "costo",
      encabezado: "Costo empresa",
      alineacion: "derecha",
      className: "hidden xl:table-cell",
      celda: (fila) => (
        <span className={fila.estado === "anulado" ? "text-muted-foreground" : undefined}>
          {formatoMoneda(fila.costo_total_empresa)}
        </span>
      ),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (fila) => <EstadoNominaPill estado={fila.estado} />,
    },
    {
      clave: "comprobante",
      encabezado: "Comprobante",
      className: "hidden md:table-cell",
      celda: (fila) => {
        if (!fila.asiento_codigo) return <span className="text-muted-foreground">—</span>;
        const asientoId = asientos[fila.recibo_id];
        return asientoId ? (
          <Enlace href={rutaAsientoNomina(asientoId)} className="font-mono text-xs">
            {fila.asiento_codigo}
          </Enlace>
        ) : (
          <span className="font-mono text-xs">{fila.asiento_codigo}</span>
        );
      },
    },
  ];

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            Periodo {etiquetaPeriodo(periodo.fecha_inicio, periodo.fecha_fin, true)}
            <EstadoNominaPill estado={periodo.estado} />
          </span>
        }
        subtitulo={`${etiquetaFrecuencia(periodo.frecuencia)} · Código ${periodo.codigo} · Pago previsto ${
          periodo.fecha_pago ? periodo.fecha_pago.split("-").reverse().join("/") : "—"
        }`}
        migas={[
          ...MIGAS_BASE,
          { etiqueta: "Periodos y cálculo", href: RUTA_PERIODOS },
          { etiqueta: etiquetaPeriodo(periodo.fecha_inicio, periodo.fecha_fin) },
        ]}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {puedeAgregarEmpleados ? (
              <Button type="button" variant="outline" onClick={() => setAgregarAbierto(true)}>
                <Plus />
                Agregar empleados
              </Button>
            ) : null}

            {puedeCalcular ? (
              <Button
                type="button"
                variant={borradores.length > 0 ? "default" : "outline"}
                onClick={() => setCalcularAbierto(true)}
              >
                Calcular nómina
              </Button>
            ) : null}

            {puedeContabilizar ? (
              <Button
                type="button"
                variant={borradores.length === 0 ? "default" : "outline"}
                onClick={() => setContabilizarAbierto(true)}
              >
                Contabilizar
              </Button>
            ) : null}

            {puedePagar ? (
              <Button type="button" onClick={() => setPagarAbierto(true)}>
                Pagar
              </Button>
            ) : null}

            {puedeEnviar ? (
              <Button type="button" variant="outline" render={<Link href={RUTA_ENVIOS} prefetch={false} />}>
                <Send />
                Enviar recibos
              </Button>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Más acciones" />}>
                <MoreVertical />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem render={<Link href={rutaPagosNomina(periodo.id)} prefetch={false} />}>
                  Ver pagos del periodo
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href={RUTA_ASIENTOS} prefetch={false} />}>
                  Ver asientos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <Card className="border-border bg-card gap-0 rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Cálculo</span>
              <span className="font-medium tabular-nums">
                {alMenosCalculados}/{noAnulados.length}
              </span>
            </div>
            <Progress value={porcentaje(alMenosCalculados, noAnulados.length)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Contabilización</span>
              <span className="font-medium tabular-nums">
                {contabilizados.length + pagados.length}/{noAnulados.length}
              </span>
            </div>
            <Progress value={porcentaje(contabilizados.length + pagados.length, noAnulados.length)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <TarjetaResumenNomina
          etiqueta="Empleados"
          valor={noAnulados.length}
          ayuda={anulados > 0 ? `${anulados} anulados` : undefined}
        />
        <TarjetaResumenNomina etiqueta="Total ingresos" valor={formatoMoneda(totalIngresos)} />
        <TarjetaResumenNomina etiqueta="Total deducciones" valor={formatoMoneda(totalDeducciones)} />
        <TarjetaResumenNomina etiqueta="Total a pagar" valor={formatoMoneda(totalNeto)} enfasis />
        <TarjetaResumenNomina etiqueta="Costo de la empresa" valor={formatoMoneda(totalCosto)} />
      </div>

      <Alert>
        <IconoEstado estado={periodo.estado} />
        <AlertTitle>Estado del periodo</AlertTitle>
        <AlertDescription>{mensajeEstado(periodo.estado)}</AlertDescription>
      </Alert>

      {config == null ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Falta la configuración de la empresa para la nómina</AlertTitle>
          <AlertDescription>
            Sin la fila de configuración no se puede contabilizar ni pagar.{" "}
            <Link href={RUTA_CONFIG_LABORAL} className="text-primary underline-offset-4 hover:underline">
              Revisar Configuración · Nómina
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      {faltaCuentaSalarios ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Falta la cuenta de salarios por pagar</AlertTitle>
          <AlertDescription>
            Sin esa cuenta no se puede contabilizar la nómina.{" "}
            <Link href={RUTA_CONFIG_LABORAL} className="text-primary underline-offset-4 hover:underline">
              Revisar Configuración · Nómina
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <TarjetaLista data-lista="recibos-periodo">
        <TablaLista
          columnas={columnas}
          filas={filas}
          claveFila={(fila) => fila.recibo_id}
          filaHref={(fila) => rutaReciboNomina(fila.recibo_id)}
          acciones={(fila) => (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Ver recibo de ${fila.empleado_nombre}`}
              render={<Link href={rutaReciboNomina(fila.recibo_id)} prefetch={false} />}
            >
              <Eye />
            </Button>
          )}
          vacio={{
            titulo: "Sin recibos en este periodo.",
            descripcion: `Agrega empleados activos de la frecuencia ${etiquetaFrecuencia(periodo.frecuencia).toLowerCase()}.`,
            accion: puedeAgregarEmpleados ? (
              <Button type="button" variant="outline" onClick={() => setAgregarAbierto(true)}>
                <Plus />
                Agregar empleados
              </Button>
            ) : undefined,
          }}
          pie={
            filas.length > 0 ? (
              <TableRow className="h-14">
                <TableCell colSpan={3} className="px-5 pl-6 font-medium">
                  Totales del periodo
                </TableCell>
                <TableCell className="px-5 text-right font-medium tabular-nums">
                  {formatoMoneda(totalIngresos)}
                </TableCell>
                <TableCell className="px-5 text-right font-medium tabular-nums">
                  {formatoMoneda(totalDeducciones)}
                </TableCell>
                <TableCell className="px-5 text-right font-semibold tabular-nums">{formatoMoneda(totalNeto)}</TableCell>
                <TableCell className="hidden px-5 text-right font-medium tabular-nums xl:table-cell">
                  {formatoMoneda(totalCosto)}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            ) : undefined
          }
        />
      </TarjetaLista>

      <DialogoAgregarEmpleados abierto={agregarAbierto} onOpenChange={setAgregarAbierto} periodo={periodo} />

      <DialogoCalcularPeriodo
        abierto={calcularAbierto}
        onOpenChange={setCalcularAbierto}
        periodoId={periodo.id}
        periodoCodigo={periodo.codigo}
        recibos={calculables}
        provisiones={config?.registrar_provisiones ?? false}
      />

      <DialogoContabilizarPeriodo
        abierto={contabilizarAbierto}
        onOpenChange={setContabilizarAbierto}
        periodoId={periodo.id}
        periodoCodigo={periodo.codigo}
        fecha={periodo.fecha_fin}
        recibos={calculados.length}
        total={totalPorContabilizar.toFixed(2)}
      />

      <DialogoPagarPeriodo
        abierto={pagarAbierto}
        onOpenChange={setPagarAbierto}
        periodoId={periodo.id}
        periodoCodigo={periodo.codigo}
        recibos={contabilizados.length}
        total={totalPorPagar.toFixed(2)}
        cuentas={cuentas}
        cuentaDefecto={cuentaDefecto}
        conNetoCero={conNetoCero}
      />
    </ContenedorLista>
  );
}

function IconoEstado({ estado }: { estado: PeriodoNomina["estado"] }) {
  if (estado === "pagado") return <CircleCheck />;
  if (estado === "anulado") return <CircleSlash />;
  return <Info />;
}

function mensajeEstado(estado: PeriodoNomina["estado"]): string {
  if (estado === "calculado") return "Nómina calculada. Revisa los recibos y contabiliza cuando estén listos.";
  if (estado === "contabilizado") return "Comprobantes NO generados. El pago está habilitado.";
  if (estado === "pagado") return "Nómina pagada. Puedes enviar las colillas o consultar los asientos.";
  if (estado === "anulado") return "Todos los recibos están anulados.";
  return "Los recibos están en borrador. Revisa las novedades y calcula la nómina; los montos aún no son definitivos.";
}
