"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BotonImprimir } from "@/components/boton-imprimir";
import { Download, FileSpreadsheet } from "@/components/icons";
import {
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { type ParametrosLista, urlLista } from "@/lib/listas/parametros";
import { csvIr3, csvSuirPlus, nombreArchivoTss, type ReporteTssExportable } from "@/lib/nomina/exportacion-tss";
import type { FilaTSS } from "@/lib/nomina/tipos";

import {
  formatoDias,
  MESES,
  MIGAS_BASE,
  RUTA_PERIODOS,
  RUTA_REPORTES,
  TarjetaResumenNomina,
} from "../../periodos/_components/comun-nomina";
import { ImpresionReporte } from "./impresion-reporte";

interface Props {
  readonly filas: FilaTSS[];
  readonly anio: number;
  readonly mes: number;
  readonly anios: readonly number[];
  readonly empresa: { nombre: string; rnc: string | null; direccion: string | null } | null;
  readonly params: ParametrosLista;
}

function suma(filas: readonly FilaTSS[], clave: (fila: FilaTSS) => string): number {
  return filas.reduce((total, fila) => total + Number(clave(fila)), 0);
}

function nombreMes(mes: number): string {
  const nombre = MESES[mes - 1] ?? "";
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

export function ReporteCliente({ filas, anio, mes, anios, empresa, params }: Props) {
  const router = useRouter();
  const [exportarAbierto, setExportarAbierto] = useState(false);
  const [tipo, setTipo] = useState<ReporteTssExportable>("suirplus");

  const totalSalario = suma(filas, (fila) => fila.salario_base);
  const totalRetenciones =
    suma(filas, (fila) => fila.sfs_empleado) +
    suma(filas, (fila) => fila.afp_empleado) +
    suma(filas, (fila) => fila.isr);
  const totalAportes =
    suma(filas, (fila) => fila.sfs_empleador) +
    suma(filas, (fila) => fila.afp_empleador) +
    suma(filas, (fila) => fila.srl) +
    suma(filas, (fila) => fila.infotep);
  const totalDeducciones = suma(filas, (fila) => fila.total_deducciones);
  const totalNeto = suma(filas, (fila) => fila.neto_pagar);
  const totalDias = suma(filas, (fila) => fila.dias_trabajados);
  const totalPeriodos = filas.reduce((total, fila) => total + fila.periodos, 0);

  function cambiar(clave: string, valor: string) {
    router.replace(urlLista(RUTA_REPORTES, params, { [clave]: valor }), { scroll: false });
  }

  function descargar() {
    if (filas.length === 0) {
      toast.add({
        type: "error",
        title: "No hay datos para exportar",
        description: `No hay filas en ${nombreMes(mes)} de ${anio}.`,
      });
      return;
    }

    const contenido = tipo === "suirplus" ? csvSuirPlus(filas) : csvIr3(filas);
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivoTss(anio, mes, tipo);
    enlace.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportarAbierto(false);
    toast.add({ type: "success", title: "Archivo generado", description: nombreArchivoTss(anio, mes, tipo) });
  }

  const columnas: readonly ColumnaLista<FilaTSS>[] = [
    {
      clave: "empleado",
      encabezado: "Empleado",
      celda: (fila) => <span className="font-medium">{fila.empleado_nombre}</span>,
    },
    {
      clave: "identificacion",
      encabezado: "Identificación",
      className: "hidden md:table-cell",
      celda: (fila) => <span className="tabular-nums">{fila.identificacion}</span>,
    },
    {
      clave: "clave",
      encabezado: "Clave TSS",
      className: "hidden lg:table-cell",
      celda: (fila) => <span className="font-mono text-xs">{fila.clave_tss ?? "—"}</span>,
    },
    {
      clave: "periodos",
      encabezado: "Periodos",
      alineacion: "derecha",
      className: "hidden lg:table-cell",
      celda: (fila) => fila.periodos,
    },
    {
      clave: "dias",
      encabezado: "Días",
      alineacion: "derecha",
      className: "hidden xl:table-cell",
      celda: (fila) => formatoDias(fila.dias_trabajados),
    },
    {
      clave: "salario",
      encabezado: "Salario base",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.salario_base),
    },
    {
      clave: "sfs",
      encabezado: "SFS empleado",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.sfs_empleado),
    },
    {
      clave: "afp",
      encabezado: "AFP empleado",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.afp_empleado),
    },
    {
      clave: "isr",
      encabezado: "ISR",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.isr),
    },
    {
      clave: "deducciones",
      encabezado: "Deducciones",
      alineacion: "derecha",
      className: "hidden lg:table-cell",
      celda: (fila) => formatoMoneda(fila.total_deducciones),
    },
    {
      clave: "neto",
      encabezado: "Neto",
      alineacion: "derecha",
      celda: (fila) => <span className="font-semibold">{formatoMoneda(fila.neto_pagar)}</span>,
    },
  ];

  const columnasBases: readonly ColumnaLista<FilaTSS>[] = [
    {
      clave: "empleado",
      encabezado: "Empleado",
      celda: (fila) => fila.empleado_nombre,
    },
    { clave: "base_sfs", encabezado: "Base SFS", alineacion: "derecha", celda: (fila) => formatoMoneda(fila.base_sfs) },
    { clave: "base_afp", encabezado: "Base AFP", alineacion: "derecha", celda: (fila) => formatoMoneda(fila.base_afp) },
    { clave: "base_srl", encabezado: "Base SRL", alineacion: "derecha", celda: (fila) => formatoMoneda(fila.base_srl) },
    {
      clave: "base_infotep",
      encabezado: "Base INFOTEP",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.base_infotep),
    },
    { clave: "base_isr", encabezado: "Base ISR", alineacion: "derecha", celda: (fila) => formatoMoneda(fila.base_isr) },
    {
      clave: "sfs_empleador",
      encabezado: "SFS empleador",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.sfs_empleador),
    },
    {
      clave: "afp_empleador",
      encabezado: "AFP empleador",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.afp_empleador),
    },
    { clave: "srl", encabezado: "SRL", alineacion: "derecha", celda: (fila) => formatoMoneda(fila.srl) },
    { clave: "infotep", encabezado: "INFOTEP", alineacion: "derecha", celda: (fila) => formatoMoneda(fila.infotep) },
  ];

  const exportables = filas.length > 0;

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Reporte TSS"
        subtitulo={`Resumen mensual por empleado para SUIRPlus e IR-3. Solo incluye periodos contabilizados o pagados. ${nombreMes(mes)} de ${anio}.`}
        migas={[...MIGAS_BASE, { etiqueta: "Reporte TSS" }]}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <BotonImprimir />
            <Button type="button" variant="outline" onClick={() => setExportarAbierto(true)}>
              <Download />
              Exportar
            </Button>
          </div>
        }
      />

      <Card className="border-border bg-card gap-0 rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex min-w-36 flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Año</span>
            <SelectCampo
              aria-label="Año del reporte"
              opciones={anios.map((valor) => ({ value: String(valor), label: String(valor) }))}
              valor={String(anio)}
              onCambio={(valor) => cambiar("anio", valor)}
            />
          </div>
          <div className="flex min-w-40 flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Mes</span>
            <SelectCampo
              aria-label="Mes del reporte"
              opciones={MESES.map((nombre, indice) => ({
                value: String(indice + 1),
                label: nombre.charAt(0).toUpperCase() + nombre.slice(1),
              }))}
              valor={String(mes)}
              onCambio={(valor) => cambiar("mes", valor)}
            />
          </div>
          <p className="text-muted-foreground ml-auto text-xs">
            Rango: {nombreMes(mes)} de {anio}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaResumenNomina etiqueta="Empleados" valor={filas.length} />
        <TarjetaResumenNomina
          etiqueta="Total salario base"
          valor={filas.length === 0 ? "—" : formatoMoneda(totalSalario)}
        />
        <TarjetaResumenNomina
          etiqueta="Total retenciones"
          valor={filas.length === 0 ? "—" : formatoMoneda(totalRetenciones)}
          ayuda="SFS + AFP + ISR del empleado"
        />
        <TarjetaResumenNomina
          etiqueta="Total aportes patronales"
          valor={filas.length === 0 ? "—" : formatoMoneda(totalAportes)}
          ayuda="SFS + AFP + SRL + INFOTEP"
        />
      </div>

      <TarjetaLista data-lista="reporte-tss">
        <TablaLista
          columnas={columnas}
          filas={filas}
          claveFila={(fila) => fila.empleado_id}
          vacio={{
            titulo: `No hay nómina contabilizada o pagada en ${nombreMes(mes).toLowerCase()} de ${anio}.`,
            descripcion:
              "Solo se incluyen periodos contabilizados o pagados. Si ya calculaste la nómina, contabilízala para verla aquí.",
            accion: (
              <Button variant="outline" render={<Link href={RUTA_PERIODOS} prefetch={false} />}>
                Ir a Periodos
              </Button>
            ),
          }}
          pie={
            filas.length > 0 ? (
              <TableRow className="h-14">
                <TableCell className="px-5 pl-6 font-medium">Totales</TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="hidden lg:table-cell" />
                <TableCell className="hidden px-5 text-right font-medium tabular-nums lg:table-cell">
                  {totalPeriodos}
                </TableCell>
                <TableCell className="hidden px-5 text-right font-medium tabular-nums xl:table-cell">
                  {formatoDias(String(totalDias))}
                </TableCell>
                <TableCell className="px-5 text-right font-medium tabular-nums">
                  {formatoMoneda(totalSalario)}
                </TableCell>
                <TableCell className="px-5 text-right font-medium tabular-nums">
                  {formatoMoneda(suma(filas, (fila) => fila.sfs_empleado))}
                </TableCell>
                <TableCell className="px-5 text-right font-medium tabular-nums">
                  {formatoMoneda(suma(filas, (fila) => fila.afp_empleado))}
                </TableCell>
                <TableCell className="px-5 text-right font-medium tabular-nums">
                  {formatoMoneda(suma(filas, (fila) => fila.isr))}
                </TableCell>
                <TableCell className="hidden px-5 text-right font-medium tabular-nums lg:table-cell">
                  {formatoMoneda(totalDeducciones)}
                </TableCell>
                <TableCell className="px-5 text-right font-semibold tabular-nums">{formatoMoneda(totalNeto)}</TableCell>
              </TableRow>
            ) : undefined
          }
        />
      </TarjetaLista>

      <Card className="border-border bg-card gap-0 rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
        <Collapsible defaultOpen>
          <CollapsibleTrigger
            render={<Button type="button" variant="ghost" className="h-auto w-full justify-between px-4 py-3" />}
          >
            <span className="text-base font-semibold">Bases y aportes patronales</span>
            <PillEstado tono="info">SUIRPlus</PillEstado>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-2 pb-2">
              <TablaLista
                densidad="compacta"
                columnas={columnasBases}
                filas={filas}
                claveFila={(fila) => fila.empleado_id}
                vacio={{ titulo: "Sin bases", descripcion: "No hay filas para el mes seleccionado." }}
                pie={
                  filas.length > 0 ? (
                    <TableRow className="h-11">
                      <TableCell className="px-4 font-medium">Totales</TableCell>
                      <TableCell className="px-4 text-right font-medium tabular-nums">
                        {formatoMoneda(suma(filas, (fila) => fila.base_sfs))}
                      </TableCell>
                      <TableCell className="px-4 text-right font-medium tabular-nums">
                        {formatoMoneda(suma(filas, (fila) => fila.base_afp))}
                      </TableCell>
                      <TableCell className="px-4 text-right font-medium tabular-nums">
                        {formatoMoneda(suma(filas, (fila) => fila.base_srl))}
                      </TableCell>
                      <TableCell className="px-4 text-right font-medium tabular-nums">
                        {formatoMoneda(suma(filas, (fila) => fila.base_infotep))}
                      </TableCell>
                      <TableCell className="px-4 text-right font-medium tabular-nums">
                        {formatoMoneda(suma(filas, (fila) => fila.base_isr))}
                      </TableCell>
                      <TableCell className="px-4 text-right font-medium tabular-nums">
                        {formatoMoneda(suma(filas, (fila) => fila.sfs_empleador))}
                      </TableCell>
                      <TableCell className="px-4 text-right font-medium tabular-nums">
                        {formatoMoneda(suma(filas, (fila) => fila.afp_empleador))}
                      </TableCell>
                      <TableCell className="px-4 text-right font-medium tabular-nums">
                        {formatoMoneda(suma(filas, (fila) => fila.srl))}
                      </TableCell>
                      <TableCell className="px-4 text-right font-medium tabular-nums">
                        {formatoMoneda(suma(filas, (fila) => fila.infotep))}
                      </TableCell>
                    </TableRow>
                  ) : undefined
                }
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <p className="text-muted-foreground text-xs">
        El CSV es la base para SUIRPlus e IR-3; el formato se valida con Contable antes de producción. Solo se incluyen
        periodos contabilizados o pagados.{" "}
        <Link href={RUTA_PERIODOS} className="text-primary underline-offset-4 hover:underline">
          Ver periodos
        </Link>
        .
      </p>

      <Dialog open={exportarAbierto} onOpenChange={setExportarAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar reporte TSS</DialogTitle>
            <DialogDescription>
              El archivo se genera con los datos que estás viendo; para otro mes cambia el filtro.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Tipo de archivo</span>
              <SelectCampo
                aria-label="Tipo de archivo"
                opciones={[
                  { value: "suirplus", label: "SUIRPlus (CSV)" },
                  { value: "ir3", label: "IR-3 (CSV)" },
                ]}
                valor={tipo}
                onCambio={(valor) => {
                  if (valor === "ir3" || valor === "suirplus") setTipo(valor);
                }}
              />
            </div>

            <div className="bg-muted/50 flex flex-col gap-1 rounded-xl px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Periodo</span>
                <span className="font-medium">
                  {nombreMes(mes)} de {anio}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Archivo</span>
                <span className="font-mono text-xs">{nombreArchivoTss(anio, mes, tipo)}</span>
              </div>
            </div>

            {!exportables ? (
              <p className="text-muted-foreground text-sm">
                No hay datos para exportar en {nombreMes(mes).toLowerCase()} de {anio}.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExportarAbierto(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!exportables} onClick={descargar}>
              <FileSpreadsheet />
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImpresionReporte
        anio={anio}
        mes={mes}
        filas={filas}
        empresa={empresa}
        totales={{
          salario: totalSalario,
          sfsEmpleado: suma(filas, (fila) => fila.sfs_empleado),
          afpEmpleado: suma(filas, (fila) => fila.afp_empleado),
          isr: suma(filas, (fila) => fila.isr),
          neto: totalNeto,
          sfsEmpleador: suma(filas, (fila) => fila.sfs_empleador),
          afpEmpleador: suma(filas, (fila) => fila.afp_empleador),
          srl: suma(filas, (fila) => fila.srl),
          infotep: suma(filas, (fila) => fila.infotep),
        }}
      />
    </ContenedorLista>
  );
}
