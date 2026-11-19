import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Landmark } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
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
    <ContenedorDetalle>
      <EncabezadoPagina
        titulo={`Conciliación · ${detalle.cuenta.nombre}`}
        subtitulo="Revisa los movimientos contra el saldo del extracto."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Bancos", href: "/dashboard/bancos" },
          { etiqueta: "Conciliaciones", href: "/dashboard/bancos/conciliaciones" },
          { etiqueta: "Conciliación" },
        ]}
        acciones={
          <Button variant="outline" render={<Link href={rutaBanco(detalle.cuenta.id)} prefetch={false} />}>
            <Landmark />
            Ver cuenta
          </Button>
        }
      />

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
    </ContenedorDetalle>
  );
}
