import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { hoyEnRd } from "@/lib/compras/fechas";
import { getDatosFormularioNotaCompra } from "@/lib/compras/notas-credito/consultas";

import { NotaCreditoCompraForm } from "./_components/nota-credito-form";

interface Props {
  searchParams: Promise<{ factura?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const datos = params.factura ? await getDatosFormularioNotaCompra(params.factura) : null;
  const volver = datos ? `/dashboard/compras/${datos.factura.id}` : "/dashboard/compras/notas-credito";

  let contenido = (
    <Alert>
      <AlertDescription>
        Abre una factura de proveedor desde <Enlace href="/dashboard/compras">Compras</Enlace> y usa «Nota de crédito»
        para crearla.
      </AlertDescription>
    </Alert>
  );

  if (perfil.rol === "lector") {
    contenido = (
      <Alert variant="destructive">
        <AlertDescription>Tu rol es de solo lectura. No puedes crear notas de crédito.</AlertDescription>
      </Alert>
    );
  } else if (datos?.factura.estado === "anulada") {
    contenido = (
      <Alert variant="destructive">
        <AlertDescription>
          La factura de proveedor #{datos.factura.numero} está anulada y no admite notas de crédito.
        </AlertDescription>
      </Alert>
    );
  } else if (datos?.lineas.every((linea) => linea.pendiente <= 0)) {
    contenido = (
      <Alert>
        <AlertDescription>
          La factura de proveedor #{datos.factura.numero} no tiene líneas pendientes por acreditar.
        </AlertDescription>
      </Alert>
    );
  } else if (datos) {
    contenido = <NotaCreditoCompraForm datos={datos} fechaHoy={hoyEnRd()} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href={volver} prefetch={false} />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Nueva nota de crédito en compras</h1>
      </div>

      {contenido}
    </div>
  );
}
