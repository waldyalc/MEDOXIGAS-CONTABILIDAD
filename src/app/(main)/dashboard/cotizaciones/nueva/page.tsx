import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { DocumentoVentaForm } from "@/components/documento-venta/documento-venta-form";
import { conContactoActual, prellenarDocumento } from "@/components/documento-venta/prellenado";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { crearCotizacion } from "@/lib/cotizaciones/acciones";
import { getDocumentoVista, getProximoNumero } from "@/lib/cotizaciones/consultas";
import { getContactosClientes, getEmpresa, getProductosActivos } from "@/lib/facturacion/consultas";
import { hoyRD } from "@/lib/facturacion/formato";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { getPlantillaImpresion } from "@/lib/plantillas-impresion/consultas";
import { getVendedoresActivos } from "@/lib/vendedores/consultas";

export default async function Page({ searchParams }: { searchParams: Promise<{ clonar?: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { clonar } = await searchParams;

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
        <CotizacionContenido clonar={clonar} />
      )}
    </div>
  );
}

async function CotizacionContenido({ clonar }: { clonar?: string }) {
  const [empresa, contactos, productos, vendedores, centrosCosto, plantilla, vista, impuestos, vistaNumero] =
    await Promise.all([
      getEmpresa(),
      getContactosClientes(),
      getProductosActivos(),
      getVendedoresActivos(),
      getCentrosCostoActivos(),
      getPlantillaImpresion("cotizacion"),
      clonar ? getDocumentoVista("cotizacion", clonar) : Promise.resolve(null),
      getImpuestosActivos(),
      getProximoNumero("cotizacion"),
    ]);

  const hoy = hoyRD();
  const contactosFormulario = vista ? conContactoActual(contactos, vista.contacto) : contactos;

  return (
    <DocumentoVentaForm
      empresa={empresa}
      contactos={contactosFormulario}
      productos={productos}
      vendedores={vendedores}
      centrosCosto={centrosCosto}
      impuestos={impuestos}
      notasIniciales={plantilla.notas}
      terminosIniciales={plantilla.terminos}
      mostrarLogo={plantilla.mostrarLogo}
      fechaHoy={hoy}
      titulo="Información de la cotización"
      etiquetaNumero="Cotización No."
      vistaNumero={vistaNumero}
      conTerminos
      textoGuardar="Guardar cotización"
      rutaCancelar="/dashboard/cotizaciones"
      rutaDestino="/dashboard/cotizaciones"
      accion={crearCotizacion}
      {...(vista ? { valoresIniciales: prellenarDocumento({ ...vista.documento, lineas: vista.lineas }, hoy) } : {})}
    />
  );
}
