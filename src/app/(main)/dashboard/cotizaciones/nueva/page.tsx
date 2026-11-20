import { redirect } from "next/navigation";

import { DocumentoVentaForm } from "@/components/documento-venta/documento-venta-form";
import { conContactoActual, prellenarDocumento } from "@/components/documento-venta/prellenado";
import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nueva cotización"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Ingresos" },
          { etiqueta: "Cotizaciones", href: "/dashboard/cotizaciones" },
          { etiqueta: "Nueva cotización" },
        ]}
      />

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear cotizaciones.</AlertDescription>
        </Alert>
      ) : (
        <CotizacionContenido clonar={clonar} />
      )}
    </ContenedorFormulario>
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
