import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, Pencil } from "lucide-react";

import { EditarCuenta } from "@/components/contabilidad/cuenta-formulario";
import { ContenedorLista, PillEstado } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRol } from "@/lib/auth/rol";
import {
  getCuentasCajaBanco,
  getDetalleCuentaBanco,
  normalizarFecha,
  resolverAsientoCuenta,
} from "@/lib/bancos/consultas";
import { numeroEnmascarado, tipoCuenta } from "@/lib/bancos/formato";
import { listarOpcionesCuenta } from "@/lib/contabilidad/consultas";
import type { CuentaEditable } from "@/lib/contabilidad/validacion";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { hoyRD } from "@/lib/facturacion/formato";
import { formatearRd } from "@/lib/reportes/dinero";

import { AccionesCuenta } from "./_components/acciones-cuenta";
import { PanelMovimientos } from "./_components/panel-movimientos";
import { SeccionAsiento } from "./_components/seccion-asiento";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; asiento?: string }>;
}) {
  const { id } = await params;
  const busqueda = await searchParams;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const desde = normalizarFecha(busqueda.desde);
  const hasta = normalizarFecha(busqueda.hasta);
  const [detalle, empresa, opciones, cuentasCajaBanco] = await Promise.all([
    getDetalleCuentaBanco(id, desde, hasta),
    getEmpresa(),
    listarOpcionesCuenta(),
    getCuentasCajaBanco(),
  ]);
  if (!detalle) notFound();

  const { cuenta } = detalle;
  const puedeEscribir = rol !== "lector";

  // Asiento del movimiento elegido en la tabla (?asiento=) o del último del período.
  const ultimo = detalle.movimientos[detalle.movimientos.length - 1] ?? null;
  const asiento = await resolverAsientoCuenta(detalle.movimientos, cuenta.id, busqueda.asiento);
  const movimientoAsiento = detalle.movimientos.find((movimiento) => movimiento.asientoId === asiento?.id) ?? ultimo;

  const editable: CuentaEditable = {
    id: cuenta.id,
    codigo: cuenta.codigo,
    nombre: cuenta.nombre,
    tipo: cuenta.tipo,
    naturaleza: cuenta.naturaleza,
    padre_id: cuenta.padreId,
    acepta_movimientos: cuenta.aceptaMovimientos,
    es_caja_banco: true,
    activa: cuenta.activa,
  };
  const numero = numeroEnmascarado(cuenta.numeroCuenta);

  return (
    <ContenedorLista>
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/bancos" prefetch={false} />}>
          <ArrowLeft data-icon="inline-start" />
          Bancos y cajas
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl tracking-tight">{cuenta.nombre}</h1>
              {cuenta.activa ? null : <PillEstado tono="neutro">Inactiva</PillEstado>}
            </div>
            <p className="text-muted-foreground text-sm">
              Conoce y administra toda la información de tu cuenta bancaria
            </p>
          </div>
          <AccionesCuenta
            cuenta={editable}
            cuentasCajaBanco={cuentasCajaBanco}
            puedeEscribir={puedeEscribir}
            fechaHoy={hoyRD()}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{cuenta.nombre}</span>
              {puedeEscribir ? (
                <EditarCuenta
                  cuenta={editable}
                  cuentas={opciones}
                  bloquearCodigoTipoNaturaleza={detalle.tieneMovimientos}
                  trigger={
                    <Button variant="ghost" size="icon-xs" aria-label="Editar cuenta">
                      <Pencil />
                    </Button>
                  }
                />
              ) : null}
            </div>
            <span className="text-muted-foreground text-sm">
              Tipo de cuenta: {tipoCuenta(cuenta.nombre, cuenta.tipoBanco)}
            </span>
            <span className="text-muted-foreground text-sm tabular-nums">{numero ?? "Sin número"}</span>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <span className="text-muted-foreground text-xs">Saldo en Medoxigas</span>
            <span
              className={`text-2xl font-semibold tabular-nums ${
                detalle.saldoActualCentavos < 0 ? "text-destructive" : "text-primary"
              }`}
            >
              {formatearRd(detalle.saldoActualCentavos)}
            </span>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">Descripción</span>
            <p className="text-sm whitespace-pre-line">{cuenta.descripcion ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <PanelMovimientos
        cuentaId={cuenta.id}
        movimientos={detalle.movimientos}
        desde={desde ?? ""}
        hasta={hasta ?? ""}
        puedeEscribir={puedeEscribir}
        totalEntradasCentavos={detalle.totalEntradasCentavos}
        totalSalidasCentavos={detalle.totalSalidasCentavos}
        saldoCentavos={detalle.saldoCentavos}
      />

      {asiento ? (
        <SeccionAsiento
          asiento={asiento}
          empresa={empresa}
          origenEtiqueta={movimientoAsiento?.documento.etiqueta ?? "Movimiento"}
        />
      ) : null}
    </ContenedorLista>
  );
}
