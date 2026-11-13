import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { getContactosClientes, getProductosActivos } from "@/lib/facturacion/consultas";
import { hoyRD } from "@/lib/facturacion/formato";

import { DocumentoForm } from "../_components/documento-form";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/cotizaciones" />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Nueva cotización</h1>
      </div>

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear cotizaciones.</AlertDescription>
        </Alert>
      ) : (
        <CotizacionContenido />
      )}
    </div>
  );
}

async function CotizacionContenido() {
  const [contactos, productos] = await Promise.all([getContactosClientes(), getProductosActivos()]);

  return <DocumentoForm tipo="cotizacion" contactos={contactos} productos={productos} fechaHoy={hoyRD()} />;
}
