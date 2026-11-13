import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getDatosFormularioNotaDebito } from "@/lib/notas-debito/consultas";

import { NotaDebitoForm } from "./_components/nota-debito-form";

interface Props {
  searchParams: Promise<{ factura?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const datos = await getDatosFormularioNotaDebito();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/notas-debito" />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Nueva nota de débito</h1>
      </div>

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear notas de débito.</AlertDescription>
        </Alert>
      ) : (
        <NotaDebitoForm datos={datos} fechaHoy={hoyRD()} facturaInicial={params.factura} />
      )}
    </div>
  );
}
