import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getDatosFormularioRecurrente } from "@/lib/facturas-recurrentes/consultas";

import { FacturaRecurrenteForm } from "./_components/factura-recurrente-form";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const datos = await getDatosFormularioRecurrente();

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nueva factura recurrente"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Ingresos" },
          { etiqueta: "Facturas recurrentes", href: "/dashboard/facturas-recurrentes" },
          { etiqueta: "Nueva factura recurrente" },
        ]}
      />

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear facturas recurrentes.</AlertDescription>
        </Alert>
      ) : (
        <FacturaRecurrenteForm datos={datos} fechaHoy={hoyRD()} />
      )}
    </ContenedorFormulario>
  );
}
