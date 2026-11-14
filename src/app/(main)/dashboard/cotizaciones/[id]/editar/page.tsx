import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { DocumentoVentaForm } from "@/components/documento-venta/documento-venta-form";
import { conContactoActual, prellenarDocumento } from "@/components/documento-venta/prellenado";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { editarCotizacion } from "@/lib/cotizaciones/acciones";
import { getDocumentoVista } from "@/lib/cotizaciones/consultas";
import type { DocumentoVista } from "@/lib/cotizaciones/tipos";
import { getContactosClientes, getEmpresa, getProductosActivos } from "@/lib/facturacion/consultas";
import { hoyRD } from "@/lib/facturacion/formato";
import { getPlantillaImpresion } from "@/lib/plantillas-impresion/consultas";
import { getVendedoresActivos } from "@/lib/vendedores/consultas";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const vista = await getDocumentoVista("cotizacion", id);
  if (!vista) notFound();
  if (vista.documento.estado !== "abierta") redirect(`/dashboard/cotizaciones/${id}`);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href={`/dashboard/cotizaciones/${id}`} />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Editar cotización</h1>
      </div>

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes editar cotizaciones.</AlertDescription>
        </Alert>
      ) : (
        <CotizacionContenido id={id} vista={vista} />
      )}
    </div>
  );
}

async function CotizacionContenido({ id, vista }: { id: string; vista: DocumentoVista }) {
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
      contactos={conContactoActual(contactos, vista.contacto)}
      productos={productos}
      vendedores={vendedores}
      centrosCosto={centrosCosto}
      mostrarLogo={plantilla.mostrarLogo}
      fechaHoy={hoyRD()}
      titulo="Información de la cotización"
      etiquetaNumero="Cotización No."
      conTerminos
      numeroActual={String(vista.documento.numero)}
      textoGuardar="Guardar cambios"
      rutaCancelar={`/dashboard/cotizaciones/${id}`}
      rutaDestino="/dashboard/cotizaciones"
      accion={editarCotizacion.bind(null, id)}
      valoresIniciales={prellenarDocumento({ ...vista.documento, lineas: vista.lineas }, hoyRD(), {
        conservarFechas: true,
      })}
    />
  );
}
