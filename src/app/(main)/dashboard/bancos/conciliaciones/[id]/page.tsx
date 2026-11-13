import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, Landmark } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { getDetalleConciliacion } from "@/lib/bancos/conciliaciones";
import { rutaBanco } from "@/lib/enlaces";

import { PanelConciliacion } from "./_components/panel-conciliacion";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const detalle = await getDetalleConciliacion(id);
  if (!detalle) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/bancos/conciliaciones" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Conciliaciones
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl tracking-tight">Conciliación · {detalle.cuenta.nombre}</h1>
            <p className="text-muted-foreground text-sm">Revisa los movimientos contra el saldo del extracto.</p>
          </div>
          <Button variant="outline" render={<Link href={rutaBanco(detalle.cuenta.id)} prefetch={false} />}>
            <Landmark />
            Ver cuenta
          </Button>
        </div>
      </div>

      <PanelConciliacion
        conciliacionId={detalle.id}
        cuentaId={detalle.cuenta.id}
        fechaDesde={detalle.fechaDesde}
        fechaHasta={detalle.fechaHasta}
        saldoCentavos={detalle.saldoCentavos}
        gastosCentavos={detalle.gastosCentavos}
        entradasBancariasCentavos={detalle.entradasBancariasCentavos}
        estado={detalle.estado}
        movimientos={detalle.movimientos}
        seleccionados={detalle.seleccionados}
        bloqueados={detalle.bloqueados}
        saldoAnteriorCentavos={detalle.saldoAnteriorCentavos}
        asientoId={detalle.asientoId}
        asientoNumero={detalle.asientoNumero}
        conciliadoEn={detalle.conciliadoEn}
        soloLectura={rol === "lector"}
      />

      <p className="text-muted-foreground text-sm">
        <Enlace href={rutaBanco(detalle.cuenta.id)}>{detalle.cuenta.nombre}</Enlace> · Cuenta contable{" "}
        {detalle.cuenta.codigo}
      </p>
    </div>
  );
}
