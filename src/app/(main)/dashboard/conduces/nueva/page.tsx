import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { DocumentoVentaForm } from "@/components/documento-venta/documento-venta-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { crearRemision } from "@/lib/conduces/acciones";
import { getContactosClientes, getEmpresa, getProductosActivos } from "@/lib/facturacion/consultas";
import { hoyRD } from "@/lib/facturacion/formato";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/conduces" />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Nuevo conduce</h1>
      </div>

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear conduces.</AlertDescription>
        </Alert>
      ) : (
        <ConduceContenido />
      )}
    </div>
  );
}

async function ConduceContenido() {
  const [empresa, contactos, productos] = await Promise.all([
    getEmpresa(),
    getContactosClientes(),
    getProductosActivos(),
  ]);

  return (
    <DocumentoVentaForm
      empresa={empresa}
      contactos={contactos}
      productos={productos}
      fechaHoy={hoyRD()}
      titulo="Información del conduce"
      etiquetaNumero="Conduce No."
      textoGuardar="Guardar conduce"
      rutaCancelar="/dashboard/conduces"
      rutaDestino="/dashboard/conduces"
      accion={crearRemision}
    />
  );
}
