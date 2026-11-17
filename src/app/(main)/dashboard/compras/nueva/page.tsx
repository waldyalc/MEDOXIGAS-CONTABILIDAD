import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { cargarOpcionesFactura } from "@/lib/compras/consultas";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { getOrdenParaFactura } from "@/lib/ordenes-compra/consultas";

import { FormularioFactura } from "../_components/formulario-factura";

interface Props {
  searchParams: Promise<{ orden?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");
  if (rol === "lector") redirect("/dashboard/compras");

  const params = await searchParams;
  const [opciones, desdeOrden, empresa] = await Promise.all([
    cargarOpcionesFactura(),
    params.orden ? getOrdenParaFactura(params.orden) : Promise.resolve(null),
    getEmpresa(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/compras" prefetch={false} />}>
            <ArrowLeft />
            <span className="sr-only">Volver</span>
          </Button>
          <h1 className="text-2xl tracking-tight">Nueva factura de proveedor</h1>
        </div>
        <Button variant="outline" render={<Link href="/dashboard/compras/pagos" prefetch={false} />}>
          Pagos
        </Button>
      </div>

      <FormularioFactura
        {...opciones}
        empresa={empresa}
        {...(desdeOrden
          ? { inicial: desdeOrden.inicial, ordenId: desdeOrden.ordenId, numeroOrden: desdeOrden.numero }
          : {})}
      />
    </div>
  );
}
