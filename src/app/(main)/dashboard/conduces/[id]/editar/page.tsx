import { notFound, redirect } from "next/navigation";

import { DocumentoVentaForm } from "@/components/documento-venta/documento-venta-form";
import { conContactoActual, prellenarDocumento } from "@/components/documento-venta/prellenado";
import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getPerfil } from "@/lib/auth/rol";
import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { editarRemision } from "@/lib/conduces/acciones";
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
  const vista = await getDocumentoVista("remision", id);
  if (!vista) notFound();
  if (vista.documento.estado !== "abierta") redirect(`/dashboard/conduces/${id}`);

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Editar conduce"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Ingresos" },
          { etiqueta: "Conduces", href: "/dashboard/conduces" },
          { etiqueta: "Editar conduce" },
        ]}
      />

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes editar conduces.</AlertDescription>
        </Alert>
      ) : (
        <ConduceContenido id={id} vista={vista} />
      )}
    </ContenedorFormulario>
  );
}

async function ConduceContenido({ id, vista }: { id: string; vista: DocumentoVista }) {
  const [empresa, contactos, productos, vendedores, centrosCosto, plantilla] = await Promise.all([
    getEmpresa(),
    getContactosClientes(),
    getProductosActivos(),
    getVendedoresActivos(),
    getCentrosCostoActivos(),
    getPlantillaImpresion("conduce"),
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
      titulo="Información del conduce"
      etiquetaNumero="Conduce No."
      conTerminos
      numeroActual={String(vista.documento.numero)}
      textoGuardar="Guardar cambios"
      rutaCancelar={`/dashboard/conduces/${id}`}
      rutaDestino="/dashboard/conduces"
      accion={editarRemision.bind(null, id)}
      valoresIniciales={prellenarDocumento({ ...vista.documento, lineas: vista.lineas }, hoyRD(), {
        conservarFechas: true,
      })}
    />
  );
}
