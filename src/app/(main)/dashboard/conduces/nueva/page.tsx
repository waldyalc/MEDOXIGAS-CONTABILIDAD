import { redirect } from "next/navigation";

import { DocumentoVentaForm } from "@/components/documento-venta/documento-venta-form";
import { conContactoActual, prellenarDocumento } from "@/components/documento-venta/prellenado";
import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getPerfil } from "@/lib/auth/rol";
import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { crearRemision } from "@/lib/conduces/acciones";
import { getDocumentoVista, getProximoNumero } from "@/lib/cotizaciones/consultas";
import { getContactosClientes, getEmpresa, getProductosActivos } from "@/lib/facturacion/consultas";
import { hoyRD } from "@/lib/facturacion/formato";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { getPlantillaImpresion } from "@/lib/plantillas-impresion/consultas";
import { getVendedoresActivos } from "@/lib/vendedores/consultas";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ clonar?: string; cotizacion?: string }>;
}) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { clonar, cotizacion } = await searchParams;

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nuevo conduce"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Ingresos" },
          { etiqueta: "Conduces", href: "/dashboard/conduces" },
          { etiqueta: "Nuevo conduce" },
        ]}
      />

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear conduces.</AlertDescription>
        </Alert>
      ) : (
        <ConduceContenido clonar={clonar} cotizacion={cotizacion} />
      )}
    </ContenedorFormulario>
  );
}

async function ConduceContenido({ clonar, cotizacion }: { clonar?: string; cotizacion?: string }) {
  const [empresa, contactos, productos, vendedores, centrosCosto, plantilla, clon, origen, impuestos, vistaNumero] =
    await Promise.all([
      getEmpresa(),
      getContactosClientes(),
      getProductosActivos(),
      getVendedoresActivos(),
      getCentrosCostoActivos(),
      getPlantillaImpresion("conduce"),
      clonar ? getDocumentoVista("remision", clonar) : Promise.resolve(null),
      cotizacion ? getDocumentoVista("cotizacion", cotizacion) : Promise.resolve(null),
      getImpuestosActivos(),
      getProximoNumero("remision"),
    ]);

  const hoy = hoyRD();
  const base = clon ?? (origen?.documento.estado === "abierta" ? origen : null);
  const contactosFormulario = base ? conContactoActual(contactos, base.contacto) : contactos;

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
      titulo="Información del conduce"
      etiquetaNumero="Conduce No."
      vistaNumero={vistaNumero}
      conTerminos
      textoGuardar="Guardar conduce"
      rutaCancelar="/dashboard/conduces"
      rutaDestino="/dashboard/conduces"
      accion={crearRemision}
      {...(base ? { valoresIniciales: prellenarDocumento({ ...base.documento, lineas: base.lineas }, hoy) } : {})}
      {...(origen && base === origen ? { cotizacionOrigenId: origen.documento.id } : {})}
    />
  );
}
