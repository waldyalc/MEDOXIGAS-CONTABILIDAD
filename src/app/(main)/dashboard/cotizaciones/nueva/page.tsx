import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { DocumentoVentaForm } from "@/components/documento-venta/documento-venta-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { crearCotizacion } from "@/lib/cotizaciones/acciones";
import { getContactosClientes, getEmpresa, getProductosActivos } from "@/lib/facturacion/consultas";
import { hoyRD } from "@/lib/facturacion/formato";
import { getPlantillaImpresion } from "@/lib/plantillas-impresion/consultas";
import { getVendedoresActivos } from "@/lib/vendedores/consultas";

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
  const [empresa, contactos, productos, vendedores, centrosCosto, plantilla] = await Promise.all([
    getEmpresa(),
    getContactosClientes(),
    getProductosActivos(),
    getVendedoresActivos(),
    getCentrosCostoActivos(),
    getPlantillaImpresion("cotizacion"),
  ]);

  return (
    <DocumentoVentaForm
      empresa={empresa}
      contactos={contactos}
      productos={productos}
      vendedores={vendedores}
      centrosCosto={centrosCosto}
      notasIniciales={plantilla.notas}
      terminosIniciales={plantilla.terminos}
      mostrarLogo={plantilla.mostrarLogo}
      fechaHoy={hoyRD()}
      titulo="Información de la cotización"
      etiquetaNumero="Cotización No."
      textoGuardar="Guardar cotización"
      rutaCancelar="/dashboard/cotizaciones"
      rutaDestino="/dashboard/cotizaciones"
      accion={crearCotizacion}
    />
  );
}
