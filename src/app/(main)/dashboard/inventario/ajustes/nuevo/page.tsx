import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { datosFormularioAjuste } from "@/lib/inventario/consultas";

import { AjusteForm } from "../_components/ajuste-form";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/inventario/ajustes" />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Nuevo ajuste de inventario</h1>
      </div>

      {rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear ajustes de inventario.</AlertDescription>
        </Alert>
      ) : (
        <AjusteContenido />
      )}
    </div>
  );
}

async function AjusteContenido() {
  const datos = await datosFormularioAjuste();

  return (
    <AjusteForm
      almacenes={datos.almacenes}
      productos={datos.productos}
      almacenPorDefecto={datos.almacenPorDefecto}
      fechaHoy={hoyRD()}
    />
  );
}
