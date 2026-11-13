import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getDatosFormularioNota } from "@/lib/notas-credito/consultas";

import { NotaCreditoForm } from "./_components/nota-credito-form";

interface Props {
  searchParams: Promise<{ factura?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const datos = params.factura ? await getDatosFormularioNota(params.factura) : null;
  const volver = datos ? `/dashboard/facturacion/${datos.factura.id}` : "/dashboard/notas-credito";

  let contenido = (
    <Alert>
      <AlertDescription>
        Selecciona una factura para crear su nota de crédito desde{" "}
        <Enlace href="/dashboard/facturacion">Facturación</Enlace>.
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
          La factura #{datos.factura.numero} está anulada y no admite notas de crédito.
        </AlertDescription>
      </Alert>
    );
  } else if (datos?.lineas.every((linea) => linea.pendiente <= 0)) {
    contenido = (
      <Alert>
        <AlertDescription>
          La factura #{datos.factura.numero} no tiene líneas pendientes por acreditar.
        </AlertDescription>
      </Alert>
    );
  } else if (datos) {
    contenido = <NotaCreditoForm datos={datos} fechaHoy={hoyRD()} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href={volver} />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Nueva nota de crédito</h1>
      </div>

      {contenido}
    </div>
  );
}
