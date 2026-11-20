import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getDatosFormularioAsiento } from "@/lib/asientos/consultas";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";

import { AsientoForm } from "./_components/asiento-form";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nuevo asiento"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
          { etiqueta: "Asientos contables", href: "/dashboard/contabilidad/asientos" },
          { etiqueta: "Nuevo asiento" },
        ]}
      />

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear asientos.</AlertDescription>
        </Alert>
      ) : (
        <AsientoContenido />
      )}
    </ContenedorFormulario>
  );
}

async function AsientoContenido() {
  const datos = await getDatosFormularioAsiento();

  return (
    <AsientoForm
      cuentas={datos.cuentas}
      contactos={datos.contactos}
      centrosCosto={datos.centrosCosto}
      tiposEntrada={datos.tiposEntrada}
      fechaHoy={hoyRD()}
    />
  );
}
