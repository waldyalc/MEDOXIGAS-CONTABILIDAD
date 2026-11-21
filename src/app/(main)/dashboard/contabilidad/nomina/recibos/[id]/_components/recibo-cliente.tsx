"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { AvatarInicial } from "@/components/avatar-inicial";
import {
  Calculator,
  ChevronDown,
  Info,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  Trash2,
  TriangleAlert,
} from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { CuentaCajaBanco } from "@/lib/facturacion/tipos";
import { eliminarNovedadRecibo } from "@/lib/nomina/acciones";
import type {
  ConceptoNomina,
  ConfigNomina,
  Empleado,
  LineaRecibo,
  ParametrosRD,
  PeriodoNomina,
  ReciboConLineas,
} from "@/lib/nomina/tipos";

import {
  EstadoNominaPill,
  etiquetaOrigen,
  etiquetaPeriodo,
  FilaDefinicion,
  formatoDias,
  formatoPorcentajeNomina,
  MIGAS_BASE,
  RUTA_PERIODOS,
  rutaAsientoNomina,
  rutaColillaNomina,
  rutaPeriodoNomina,
  TarjetaResumenNomina,
} from "../../../periodos/_components/comun-nomina";
import { DialogoAnularPago, DialogoAnularRecibo } from "./dialogo-anular";
import { DialogoCalcularRecibo } from "./dialogo-calcular-recibo";
import { DialogoContabilizarRecibo } from "./dialogo-contabilizar-recibo";
import { DialogoNovedadRecibo } from "./dialogo-novedad-recibo";
import { DialogoPagarRecibo } from "./dialogo-pagar-recibo";

interface Props {
  readonly recibo: ReciboConLineas;
  readonly periodo: PeriodoNomina;
  readonly empleado: Empleado;
  readonly conceptos: ConceptoNomina[];
  readonly cuentas: CuentaCajaBanco[];
  readonly config: ConfigNomina | null;
  readonly parametros: ParametrosRD | null;
  readonly asientoCodigo: string | null;
  readonly puedeEscribir: boolean;
}

type ClaseNovedad = "ingreso" | "deduccion";

interface NovedadAbierta {
  clase: ClaseNovedad;
  linea: LineaRecibo | null;
}

function baseDeLinea(linea: LineaRecibo, recibo: ReciboConLineas): string {
  if (linea.concepto_codigo === "SFS_EMPLEADOR") return recibo.base_sfs;
  if (linea.concepto_codigo === "AFP_EMPLEADOR") return recibo.base_afp;
  if (linea.concepto_codigo === "SRL") return recibo.base_srl;
  if (linea.concepto_codigo === "INFOTEP") return recibo.base_infotep;
  return recibo.base_tss;
}

export function ReciboCliente({
  recibo,
  periodo,
  empleado,
  conceptos,
  cuentas,
  config,
  parametros,
  asientoCodigo,
  puedeEscribir,
}: Props) {
  const router = useRouter();
  const [novedad, setNovedad] = useState<NovedadAbierta | null>(null);
  const [lineaQuitar, setLineaQuitar] = useState<LineaRecibo | null>(null);
  const [calcularAbierto, setCalcularAbierto] = useState(false);
  const [contabilizarAbierto, setContabilizarAbierto] = useState(false);
  const [pagarAbierto, setPagarAbierto] = useState(false);
  const [anularPagoAbierto, setAnularPagoAbierto] = useState(false);
  const [anularReciboAbierto, setAnularReciboAbierto] = useState(false);
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null);
  const [quitando, iniciarQuitar] = useTransition();

  const ingresos = recibo.lineas.filter((linea) => linea.clase === "ingreso");
  const deducciones = recibo.lineas.filter((linea) => linea.clase === "deduccion");
  const aportes = recibo.lineas.filter((linea) => linea.clase === "aporte_empleador");
  const provisiones = recibo.lineas.filter((linea) => linea.clase === "provision");
  const manuales = recibo.lineas.filter((linea) => linea.origen === "manual");
  const esBorrador = recibo.estado === "borrador";
  const esCalculado = recibo.estado === "calculado";
  const esContabilizado = recibo.estado === "contabilizado";
  const esPagado = recibo.estado === "pagado";
  const esAnulado = recibo.estado === "anulado";
  const editable = puedeEscribir && (esBorrador || esCalculado);
  const netoCero = Number(recibo.neto_pagar) === 0;
  const cuentaSalarios =
    config != null && config.cuenta_salarios_por_pagar_id === recibo.cuenta_salarios_por_pagar_id
      ? config.cuenta_salarios_por_pagar_nombre
      : null;
  const lineasConMonto = recibo.lineas.filter((linea) => Number(linea.monto) > 0).length;

  const columnasBase = (tipo: ClaseNovedad): readonly ColumnaLista<LineaRecibo>[] => {
    const columnas: ColumnaLista<LineaRecibo>[] = [
      {
        clave: "concepto",
        encabezado: "Concepto",
        celda: (linea) => (
          <div className="flex flex-col">
            <span className="font-medium">{linea.concepto_nombre}</span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-xs">{linea.concepto_codigo}</span>
              <PillEstado tono={linea.origen === "manual" ? "info" : "neutro"}>
                {etiquetaOrigen(linea.origen)}
              </PillEstado>
            </span>
          </div>
        ),
      },
    ];

    if (tipo === "ingreso") {
      columnas.push({
        clave: "cantidad",
        encabezado: "Cantidad",
        alineacion: "derecha",
        celda: (linea) => formatoDias(linea.cantidad),
      });
    }

    columnas.push(
      {
        clave: "base",
        encabezado: tipo === "ingreso" ? "Base / %" : "Porcentaje",
        alineacion: "derecha",
        celda: (linea) => (linea.porcentaje ? formatoPorcentajeNomina(linea.porcentaje) : "—"),
      },
      {
        clave: "monto",
        encabezado: "Monto",
        alineacion: "derecha",
        celda: (linea) => <span className="font-medium">{formatoMoneda(linea.monto)}</span>,
      },
    );

    return columnas;
  };

  const accionesLinea = (linea: LineaRecibo) => {
    if (!editable || linea.origen !== "manual") return <span className="text-muted-foreground">—</span>;

    return (
      <span className="inline-flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Editar ${linea.concepto_nombre}`}
          onClick={() => setNovedad({ clase: linea.clase === "deduccion" ? "deduccion" : "ingreso", linea })}
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Quitar ${linea.concepto_nombre}`}
          onClick={() => {
            setErrorQuitar(null);
            setLineaQuitar(linea);
          }}
        >
          <Trash2 />
        </Button>
      </span>
    );
  };

  const columnasLectura = (base: (linea: LineaRecibo) => string): readonly ColumnaLista<LineaRecibo>[] => [
    {
      clave: "concepto",
      encabezado: "Concepto",
      celda: (linea) => (
        <div className="flex flex-col">
          <span className="font-medium">{linea.concepto_nombre}</span>
          <span className="text-muted-foreground font-mono text-xs">{linea.concepto_codigo}</span>
        </div>
      ),
    },
    {
      clave: "base",
      encabezado: "Base",
      alineacion: "derecha",
      celda: (linea) => formatoMoneda(base(linea)),
    },
    {
      clave: "monto",
      encabezado: "Monto",
      alineacion: "derecha",
      celda: (linea) => <span className="font-medium">{formatoMoneda(linea.monto)}</span>,
    },
  ];

  function abrirNovedad(clase: ClaseNovedad) {
    setNovedad({ clase, linea: null });
  }

  function confirmarQuitar() {
    if (!lineaQuitar) return;
    setErrorQuitar(null);
    iniciarQuitar(async () => {
      const resultado = await eliminarNovedadRecibo(lineaQuitar.id);
      if (!resultado.ok) {
        setErrorQuitar(resultado.error);
        return;
      }
      setLineaQuitar(null);
      toast.add({ type: "success", title: "Novedad quitada", description: "El recibo volvió a borrador." });
      router.refresh();
    });
  }

  return (
    <ContenedorDetalle>
      <EncabezadoPagina
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            Recibo de {empleado.nombre_completo}
            <EstadoNominaPill estado={recibo.estado} />
          </span>
        }
        subtitulo={`${etiquetaPeriodo(periodo.fecha_inicio, periodo.fecha_fin)} · ${periodo.codigo} · ${
          empleado.cargo ?? "Sin cargo"
        }${asientoCodigo ? ` · Comprobante ${asientoCodigo}` : ""}`}
        migas={[
          ...MIGAS_BASE,
          { etiqueta: "Periodos y cálculo", href: RUTA_PERIODOS },
          { etiqueta: etiquetaPeriodo(periodo.fecha_inicio, periodo.fecha_fin), href: rutaPeriodoNomina(periodo.id) },
          { etiqueta: `Recibo de ${empleado.nombre_completo}` },
        ]}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" render={<Link href={rutaColillaNomina(recibo.id)} prefetch={false} />}>
              <Printer />
              Imprimir colilla
            </Button>

            {editable ? (
              <Button
                type="button"
                variant={esBorrador ? "default" : "outline"}
                onClick={() => setCalcularAbierto(true)}
              >
                <Calculator />
                {esBorrador ? "Calcular" : "Recalcular"}
              </Button>
            ) : null}

            {puedeEscribir && esCalculado ? (
              <Button type="button" onClick={() => setContabilizarAbierto(true)}>
                Contabilizar
              </Button>
            ) : null}

            {puedeEscribir && esContabilizado && cuentas.length > 0 && config != null ? (
              <Button type="button" onClick={() => setPagarAbierto(true)}>
                Pagar
              </Button>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Más acciones" />}>
                <MoreVertical />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {recibo.asiento_id ? (
                  <DropdownMenuItem render={<Link href={rutaAsientoNomina(recibo.asiento_id)} prefetch={false} />}>
                    Ver comprobante NO
                  </DropdownMenuItem>
                ) : null}
                {recibo.pago_asiento_id ? (
                  <DropdownMenuItem render={<Link href={rutaAsientoNomina(recibo.pago_asiento_id)} prefetch={false} />}>
                    Ver asiento de pago
                  </DropdownMenuItem>
                ) : null}
                {puedeEscribir && !esAnulado ? <DropdownMenuSeparator /> : null}
                {puedeEscribir && esPagado ? (
                  <DropdownMenuItem variant="destructive" onClick={() => setAnularPagoAbierto(true)}>
                    Anular pago
                  </DropdownMenuItem>
                ) : null}
                {puedeEscribir && !esPagado && !esAnulado ? (
                  <DropdownMenuItem variant="destructive" onClick={() => setAnularReciboAbierto(true)}>
                    Anular recibo
                  </DropdownMenuItem>
                ) : null}
                {puedeEscribir && esPagado ? (
                  <DropdownMenuItem disabled>Anular recibo (anula primero el pago)</DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {esBorrador && recibo.lineas.length > 0 ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Hay cambios sin recalcular</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            Los totales no son definitivos.
            {editable ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setCalcularAbierto(true)}>
                Recalcular ahora
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {esAnulado ? (
        <Alert>
          <Info />
          <AlertTitle>Recibo anulado</AlertTitle>
          <AlertDescription>
            Su asiento original se conserva como traza y la reversa está en el libro. No se puede editar ni pagar.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaResumenNomina etiqueta="Días trabajados" valor={formatoDias(recibo.dias_trabajados)} />
        <TarjetaResumenNomina etiqueta="Total ingresos" valor={formatoMoneda(recibo.total_ingresos)} />
        <TarjetaResumenNomina etiqueta="Total deducciones" valor={formatoMoneda(recibo.total_deducciones)} />
        <TarjetaResumenNomina etiqueta="Neto a pagar" valor={formatoMoneda(recibo.neto_pagar)} enfasis />
      </div>

      <Card className="border-border bg-card gap-0 rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
        <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">Costo total de la empresa</span>
            <span className="text-xl font-semibold tabular-nums">{formatoMoneda(recibo.costo_total_empresa)}</span>
          </div>
          <p className="text-muted-foreground max-w-xl text-xs">
            Ingresos + aportes patronales + provisiones. No es el desembolso de caja: las retenciones del empleado se
            enteran a TSS/DGII o al empleado.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border bg-card gap-0 rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-base font-semibold">Ingresos</h2>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {formatoMoneda(recibo.total_ingresos)}
                </span>
              </div>
              {editable ? (
                <Button type="button" variant="outline" size="sm" onClick={() => abrirNovedad("ingreso")}>
                  <Plus />
                  Agregar ingreso
                </Button>
              ) : null}
            </div>
            <TablaLista
              densidad="compacta"
              columnas={columnasBase("ingreso")}
              filas={ingresos}
              claveFila={(linea) => linea.id}
              acciones={accionesLinea}
              vacio={{
                titulo: "Sin ingresos",
                descripcion: "El cálculo agrega el salario del periodo y las novedades vigentes.",
              }}
            />
          </CardContent>
        </Card>

        <Card className="border-border bg-card gap-0 rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-base font-semibold">Deducciones</h2>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {formatoMoneda(recibo.total_deducciones)}
                </span>
              </div>
              {editable ? (
                <Button type="button" variant="outline" size="sm" onClick={() => abrirNovedad("deduccion")}>
                  <Plus />
                  Agregar deducción
                </Button>
              ) : null}
            </div>
            <TablaLista
              densidad="compacta"
              columnas={columnasBase("deduccion")}
              filas={deducciones}
              claveFila={(linea) => linea.id}
              acciones={accionesLinea}
              vacio={{
                titulo: "Sin deducciones",
                descripcion: "SFS, AFP e ISR aparecen cuando el cálculo retiene algún monto.",
              }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border bg-card gap-0 rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-semibold">Aportes patronales</h2>
              <span className="text-muted-foreground text-sm tabular-nums">
                {formatoMoneda(recibo.total_aportes_empleador)}
              </span>
            </div>
            <TablaLista
              densidad="compacta"
              columnas={columnasLectura((linea) => baseDeLinea(linea, recibo))}
              filas={aportes}
              claveFila={(linea) => linea.id}
              vacio={{
                titulo: "Sin aportes patronales",
                descripcion: "Dependen de la configuración y de las bases TSS.",
              }}
            />
          </CardContent>
        </Card>

        <Card className="border-border bg-card gap-0 rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-semibold">Provisiones</h2>
              <span className="text-muted-foreground text-sm tabular-nums">
                {formatoMoneda(recibo.total_provisiones)}
              </span>
            </div>
            <TablaLista
              densidad="compacta"
              columnas={columnasLectura((linea) => baseDeLinea(linea, recibo))}
              filas={provisiones}
              claveFila={(linea) => linea.id}
              vacio={{ titulo: "Sin provisiones", descripcion: "Se generan si la configuración las tiene activas." }}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card gap-0 rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
        <Collapsible>
          <CollapsibleTrigger
            render={<Button type="button" variant="ghost" className="group h-auto w-full justify-between px-4 py-3" />}
          >
            <span className="text-base font-semibold">Ver bases de cálculo</span>
            <ChevronDown className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <dl className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
              <FilaDefinicion etiqueta="Base TSS" valor={formatoMoneda(recibo.base_tss)} />
              <FilaDefinicion etiqueta="Base SFS" valor={formatoMoneda(recibo.base_sfs)} />
              <FilaDefinicion etiqueta="Base AFP" valor={formatoMoneda(recibo.base_afp)} />
              <FilaDefinicion etiqueta="Base SRL" valor={formatoMoneda(recibo.base_srl)} />
              <FilaDefinicion etiqueta="Base INFOTEP" valor={formatoMoneda(recibo.base_infotep)} />
              <FilaDefinicion etiqueta="Base ISR" valor={formatoMoneda(recibo.base_isr)} />
            </dl>
            <p className="text-muted-foreground px-4 pb-4 text-xs">
              Son snapshots del cálculo; no se editan. Salario base del periodo: {formatoMoneda(recibo.salario_base)}.
            </p>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {manuales.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Las novedades manuales se conservan al recalcular. Las de origen recurrente son una vista previa de la ficha
          del empleado y se regeneran al calcular.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <AvatarInicial nombre={empleado.nombre_completo} size="sm" />
          <div className="flex flex-col">
            <span className="font-medium">{empleado.nombre_completo}</span>
            <span className="text-muted-foreground text-xs">{empleado.identificacion}</span>
          </div>
        </div>
        <Button variant="outline" render={<Link href={rutaPeriodoNomina(periodo.id)} prefetch={false} />}>
          Volver al periodo
        </Button>
      </div>

      {novedad ? (
        <DialogoNovedadRecibo
          key={`${novedad.clase}-${novedad.linea?.id ?? "nueva"}`}
          abierto
          onOpenChange={(abierto) => {
            if (!abierto) setNovedad(null);
          }}
          reciboId={recibo.id}
          estado={recibo.estado}
          clase={novedad.clase}
          conceptos={conceptos}
          lineasManuales={manuales}
          lineaEditando={novedad.linea}
          salarioMensual={empleado.salario_mensual}
          parametros={parametros}
        />
      ) : null}

      <AlertDialog
        open={lineaQuitar != null}
        onOpenChange={(abierto) => {
          if (!abierto && !quitando) setLineaQuitar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar esta novedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará {lineaQuitar?.concepto_nombre ?? "la novedad"} del recibo. El recibo vuelve a borrador y debes
              recalcular para actualizar los totales.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {errorQuitar ? (
            <Alert variant="destructive">
              <AlertDescription>{errorQuitar}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={quitando}>Cancelar</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={quitando} onClick={confirmarQuitar}>
              {quitando ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Quitar novedad
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DialogoCalcularRecibo
        abierto={calcularAbierto}
        onOpenChange={setCalcularAbierto}
        reciboId={recibo.id}
        nombre={empleado.nombre_completo}
        recalcular={esCalculado}
      />

      <DialogoContabilizarRecibo
        abierto={contabilizarAbierto}
        onOpenChange={setContabilizarAbierto}
        reciboId={recibo.id}
        nombre={empleado.nombre_completo}
        periodo={periodo.codigo}
        fecha={periodo.fecha_fin}
        lineas={lineasConMonto}
        ingresos={recibo.total_ingresos}
        aportes={recibo.total_aportes_empleador}
        provisiones={recibo.total_provisiones}
        total={recibo.costo_total_empresa}
      />

      <DialogoPagarRecibo
        abierto={pagarAbierto}
        onOpenChange={setPagarAbierto}
        reciboId={recibo.id}
        nombre={empleado.nombre_completo}
        neto={recibo.neto_pagar}
        cuentas={cuentas}
        cuentaDefecto={config?.cuenta_pago_defecto_id ?? null}
        cuentaSalarios={cuentaSalarios}
      />

      <DialogoAnularPago
        abierto={anularPagoAbierto}
        onOpenChange={setAnularPagoAbierto}
        reciboId={recibo.id}
        nombre={empleado.nombre_completo}
      />

      <DialogoAnularRecibo
        abierto={anularReciboAbierto}
        onOpenChange={setAnularReciboAbierto}
        reciboId={recibo.id}
        nombre={empleado.nombre_completo}
        codigoAsiento={asientoCodigo}
      />

      {netoCero && esContabilizado ? (
        <p className="text-muted-foreground text-center text-xs">
          El neto es 0: al pagar no se crea asiento de pago, pero el recibo queda pagado.
        </p>
      ) : null}

      <div className="sr-only" aria-live="polite">
        Recibo de {empleado.nombre_completo}: neto {formatoMoneda(recibo.neto_pagar)}.
      </div>
    </ContenedorDetalle>
  );
}
