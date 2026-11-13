import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getDatosFormularioGasto } from "@/lib/gastos/consultas";

import { GastoForm } from "./_components/gasto-form";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/gastos" />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Nuevo gasto menor</h1>
      </div>

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear gastos.</AlertDescription>
        </Alert>
      ) : (
        <GastoContenido />
      )}
    </div>
  );
}

async function GastoContenido() {
  const datos = await getDatosFormularioGasto();

  return (
    <GastoForm
      cuentas={datos.cuentas}
      cuentasCajaBanco={datos.cuentasCajaBanco}
      proveedores={datos.proveedores}
      cuentaPorDefecto={datos.cuentaPorDefecto}
      cuentaPagoPorDefecto={datos.cuentaPagoPorDefecto}
      fechaHoy={hoyRD()}
    />
  );
}
