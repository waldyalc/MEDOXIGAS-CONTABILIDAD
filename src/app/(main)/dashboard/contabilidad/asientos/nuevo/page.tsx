import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getDatosFormularioAsiento } from "@/lib/asientos/consultas";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";

import { AsientoForm } from "./_components/asiento-form";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/contabilidad/asientos" />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Nuevo asiento</h1>
      </div>

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear asientos.</AlertDescription>
        </Alert>
      ) : (
        <AsientoContenido />
      )}
    </div>
  );
}

async function AsientoContenido() {
  const datos = await getDatosFormularioAsiento();

  return (
    <AsientoForm
      cuentas={datos.cuentas}
      contactos={datos.contactos}
      centrosCosto={datos.centrosCosto}
      tiposEntrada={datos.tiposEntrada}
      fechaHoy={hoyRD()}
    />
  );
}
