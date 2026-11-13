import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { datosFormularioTransferencia } from "@/lib/inventario/consultas";

import { TransferenciaForm } from "./_components/transferencia-form";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");
  if (rol === "lector") redirect("/dashboard/inventario/transferencias");

  const datos = await datosFormularioTransferencia();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/inventario/transferencias" />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Nueva transferencia</h1>
      </div>

      <TransferenciaForm {...datos} fechaHoy={hoyRD()} />
    </div>
  );
}
