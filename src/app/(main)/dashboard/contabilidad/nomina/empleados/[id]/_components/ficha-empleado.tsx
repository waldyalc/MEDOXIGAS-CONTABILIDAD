"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import Link from "next/link";

import { ArrowLeft, Pencil, Plus } from "lucide-react";

import { AvatarInicial } from "@/components/avatar-inicial";
import { CLASE_PANEL_FICHA, GrillaKpis, ItemDato, type KpiFicha } from "@/components/ficha/ficha-ui";
import { PillEstado } from "@/components/listas/tabla-lista";
import { MigasDePan } from "@/components/migas-de-pan";
import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { ConceptoNomina, Empleado, NovedadRecurrente } from "@/lib/nomina/tipos";

import {
  diasLaboradosDesde,
  ETIQUETA_ESTADO_EMPLEADO,
  ETIQUETA_FRECUENCIA,
  ETIQUETA_METODO_PAGO,
  ETIQUETA_SEGMENTO,
  ETIQUETA_TIPO_CONTRATO,
  ETIQUETA_TIPO_CUENTA,
  ETIQUETA_TIPO_IDENTIFICACION,
  enmascararCuenta,
  formatearIdentificacion,
  formatoFecha,
  rutaEditarEmpleado,
  TONO_ESTADO_EMPLEADO,
} from "../../_components/formato-nomina";
import { AccionesEstado } from "./acciones-estado";
import { DialogoNovedad } from "./dialogo-novedad";
import { TablaNovedades } from "./tabla-novedades";
import { type FilaReciboEmpleado, TablaRecibos } from "./tabla-recibos";

type Pestana = "datos" | "novedades" | "recibos";

function SeccionFicha({
  titulo,
  hrefEditar,
  puedeEscribir,
  children,
}: {
  titulo: string;
  hrefEditar: string;
  puedeEscribir: boolean;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {puedeEscribir ? (
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={hrefEditar} prefetch={false} />}
            aria-label={`Editar ${titulo.toLowerCase()}`}
          >
            <Pencil data-icon="inline-start" />
            Editar
          </Button>
        ) : null}
      </div>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </section>
  );
}

function totalFijo(novedades: readonly NovedadRecurrente[], clase: "ingreso" | "deduccion"): string {
  const activas = novedades.filter((novedad) => novedad.activa && novedad.clase === clase);
  const suma = activas.reduce((total, novedad) => total + (novedad.monto === null ? 0 : Number(novedad.monto)), 0);
  const conPorcentaje = activas.some((novedad) => novedad.porcentaje !== null);

  if (suma === 0) return conPorcentaje ? "Solo %" : "RD$ 0.00";
  return conPorcentaje ? `${formatoMoneda(suma)} + %` : formatoMoneda(suma);
}

interface Props {
  readonly empleado: Empleado;
  readonly novedades: NovedadRecurrente[];
  readonly conceptos: ConceptoNomina[];
  readonly recibos: FilaReciboEmpleado[];
  readonly puedeEscribir: boolean;
  readonly fechaHoy: string;
}

export function FichaEmpleado({ empleado, novedades, conceptos, recibos, puedeEscribir, fechaHoy }: Props) {
  const [pestana, setPestana] = useState<Pestana>("datos");
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [novedadEditando, setNovedadEditando] = useState<NovedadRecurrente | null>(null);
  const [claseDialogo, setClaseDialogo] = useState<"ingreso" | "deduccion">("ingreso");

  const hrefEditar = rutaEditarEmpleado(empleado.id);

  const kpis: KpiFicha[] = [
    { etiqueta: "Salario mensual", valor: formatoMoneda(empleado.salario_mensual), tono: "normal" },
    { etiqueta: "Frecuencia", valor: ETIQUETA_FRECUENCIA[empleado.frecuencia_pago], tono: "normal" },
    {
      etiqueta: "Tiempo laborado",
      valor: `${diasLaboradosDesde(empleado.fecha_ingreso, empleado.fecha_fin, fechaHoy)} días`,
      tono: "normal",
    },
    {
      etiqueta: "Segmento / Centro de costo",
      valor: `${ETIQUETA_SEGMENTO[empleado.segmento_contable]}${empleado.centro_costo_nombre ? ` · ${empleado.centro_costo_nombre}` : ""}`,
      tono: "normal",
    },
  ];

  function abrirNueva(clase: "ingreso" | "deduccion") {
    setNovedadEditando(null);
    setClaseDialogo(clase);
    setDialogoAbierto(true);
  }

  function abrirEditar(novedad: NovedadRecurrente) {
    setNovedadEditando(novedad);
    setClaseDialogo(novedad.clase === "deduccion" ? "deduccion" : "ingreso");
    setDialogoAbierto(true);
  }

  function cambiarDialogo(abierto: boolean) {
    setDialogoAbierto(abierto);
    if (!abierto) setNovedadEditando(null);
  }

  return (
    <ContenedorDetalle>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MigasDePan
          items={[
            { etiqueta: "Inicio", href: "/dashboard" },
            { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
            { etiqueta: "Nómina", href: "/dashboard/contabilidad/nomina" },
            { etiqueta: "Empleados", href: "/dashboard/contabilidad/nomina/empleados" },
            { etiqueta: empleado.nombre_completo },
          ]}
        />
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/contabilidad/nomina/empleados" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Empleados
        </Button>
      </div>

      <div className={CLASE_PANEL_FICHA}>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <AvatarInicial nombre={empleado.nombre_completo} correo={empleado.correo} size="lg" />
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">{empleado.nombre_completo}</h1>
                <PillEstado tono={TONO_ESTADO_EMPLEADO[empleado.estado]}>
                  {ETIQUETA_ESTADO_EMPLEADO[empleado.estado]}
                </PillEstado>
              </div>
              <p className="text-muted-foreground text-sm">
                {empleado.cargo ?? "Sin cargo"} · {ETIQUETA_SEGMENTO[empleado.segmento_contable]} · Ingreso{" "}
                {formatoFecha(empleado.fecha_ingreso)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {puedeEscribir ? (
              <>
                <Button type="button" onClick={() => abrirNueva("ingreso")}>
                  <Plus data-icon="inline-start" />
                  Nueva novedad
                </Button>
                <Button variant="outline" render={<Link href={hrefEditar} prefetch={false} />}>
                  <Pencil data-icon="inline-start" />
                  Editar
                </Button>
                <AccionesEstado empleado={empleado} />
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-5 px-5 pb-5">
          <GrillaKpis kpis={kpis} />
        </div>

        <Tabs value={pestana} onValueChange={(valor) => setPestana(valor as Pestana)} className="gap-0">
          <div className="border-border border-b px-2 sm:px-4">
            <TabsList variant="line" className="h-11">
              <TabsTrigger value="datos">Datos</TabsTrigger>
              <TabsTrigger value="novedades">Novedades recurrentes</TabsTrigger>
              <TabsTrigger value="recibos">Recibos</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="datos" className="p-4 sm:p-5">
            <div className="flex flex-col gap-8">
              <SeccionFicha titulo="Datos personales" hrefEditar={hrefEditar} puedeEscribir={puedeEscribir}>
                <ItemDato etiqueta="Tipo de identificación">
                  {ETIQUETA_TIPO_IDENTIFICACION[empleado.tipo_identificacion]}
                </ItemDato>
                <ItemDato etiqueta="Número de identificación">
                  <span className="tabular-nums">
                    {formatearIdentificacion(empleado.tipo_identificacion, empleado.identificacion)}
                  </span>
                </ItemDato>
                <ItemDato etiqueta="Nombres">
                  {[empleado.primer_nombre, empleado.segundo_nombre].filter(Boolean).join(" ")}
                </ItemDato>
                <ItemDato etiqueta="Apellidos">
                  {[empleado.primer_apellido, empleado.segundo_apellido].filter(Boolean).join(" ")}
                </ItemDato>
                <ItemDato etiqueta="Municipio">{empleado.municipio ?? "—"}</ItemDato>
                <ItemDato etiqueta="Dirección">{empleado.direccion ?? "—"}</ItemDato>
                <ItemDato etiqueta="Teléfono">
                  <span className="tabular-nums">{empleado.telefono ?? "—"}</span>
                </ItemDato>
                <ItemDato etiqueta="Correo">{empleado.correo ?? "—"}</ItemDato>
                <ItemDato etiqueta="Contacto">
                  <Link
                    href={`/dashboard/contactos/${empleado.contacto_id}`}
                    prefetch={false}
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    Ver contacto
                  </Link>
                </ItemDato>
              </SeccionFicha>

              <SeccionFicha titulo="Datos laborales" hrefEditar={hrefEditar} puedeEscribir={puedeEscribir}>
                <ItemDato etiqueta="Tipo de contrato">{ETIQUETA_TIPO_CONTRATO[empleado.tipo_contrato]}</ItemDato>
                <ItemDato etiqueta="Fecha de ingreso">{formatoFecha(empleado.fecha_ingreso)}</ItemDato>
                <ItemDato etiqueta="Fecha de fin">{formatoFecha(empleado.fecha_fin)}</ItemDato>
                <ItemDato etiqueta="Frecuencia de pago">{ETIQUETA_FRECUENCIA[empleado.frecuencia_pago]}</ItemDato>
                <ItemDato etiqueta="Salario mensual">
                  <span className="tabular-nums">{formatoMoneda(empleado.salario_mensual)}</span>
                </ItemDato>
                <ItemDato etiqueta="Cargo">{empleado.cargo ?? "—"}</ItemDato>
                <ItemDato etiqueta="Área">{empleado.area ?? "—"}</ItemDato>
                <ItemDato etiqueta="Segmento contable">{ETIQUETA_SEGMENTO[empleado.segmento_contable]}</ItemDato>
                <ItemDato etiqueta="Centro de costo">{empleado.centro_costo_nombre ?? "Sin centro"}</ItemDato>
                <ItemDato etiqueta="Clave TSS">
                  <span className="font-mono">{empleado.clave_tss ?? "—"}</span>
                </ItemDato>
              </SeccionFicha>

              <SeccionFicha titulo="Pago" hrefEditar={hrefEditar} puedeEscribir={puedeEscribir}>
                <ItemDato etiqueta="Método de pago">{ETIQUETA_METODO_PAGO[empleado.metodo_pago]}</ItemDato>
                <ItemDato etiqueta="Banco">{empleado.banco_nombre ?? "—"}</ItemDato>
                <ItemDato etiqueta="Tipo de cuenta">
                  {empleado.tipo_cuenta_banco ? ETIQUETA_TIPO_CUENTA[empleado.tipo_cuenta_banco] : "—"}
                </ItemDato>
                <ItemDato etiqueta="Número de cuenta">
                  <span className="tabular-nums">{enmascararCuenta(empleado.numero_cuenta_banco)}</span>
                </ItemDato>
                <ItemDato etiqueta="Estado">{ETIQUETA_ESTADO_EMPLEADO[empleado.estado]}</ItemDato>
              </SeccionFicha>
            </div>
          </TabsContent>

          <TabsContent value="novedades" className="p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span className="bg-muted rounded-md px-2.5 py-1 text-xs">
                    Ingresos fijos: <span className="tabular-nums">{totalFijo(novedades, "ingreso")}</span>
                  </span>
                  <span className="bg-muted rounded-md px-2.5 py-1 text-xs">
                    Deducciones fijas: <span className="tabular-nums">{totalFijo(novedades, "deduccion")}</span>
                  </span>
                </div>
                {puedeEscribir ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" type="button" onClick={() => abrirNueva("ingreso")}>
                      <Plus data-icon="inline-start" />
                      Agregar ingreso
                    </Button>
                    <Button size="sm" type="button" variant="outline" onClick={() => abrirNueva("deduccion")}>
                      <Plus data-icon="inline-start" />
                      Agregar deducción
                    </Button>
                  </div>
                ) : null}
              </div>

              <TablaNovedades novedades={novedades} puedeEscribir={puedeEscribir} onEditar={abrirEditar} />
            </div>
          </TabsContent>

          <TabsContent value="recibos" className="p-4 sm:p-5">
            <TablaRecibos filas={recibos} puedeEscribir={puedeEscribir} />
          </TabsContent>
        </Tabs>
      </div>

      <DialogoNovedad
        abierto={dialogoAbierto}
        onAbiertoChange={cambiarDialogo}
        empleadoId={empleado.id}
        conceptos={conceptos}
        clase={claseDialogo}
        novedad={novedadEditando}
        fechaHoy={fechaHoy}
      />
    </ContenedorDetalle>
  );
}
