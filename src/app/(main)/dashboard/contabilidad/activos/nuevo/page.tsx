import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getDatosFormularioActivo } from "@/lib/activos-fijos/consultas";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";

import { ActivoForm } from "./_components/activo-form";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nuevo activo fijo"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
          { etiqueta: "Activos fijos", href: "/dashboard/contabilidad/activos" },
          { etiqueta: "Nuevo activo fijo" },
        ]}
      />

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear activos fijos.</AlertDescription>
        </Alert>
      ) : (
        <Contenido />
      )}
    </ContenedorFormulario>
  );
}

async function Contenido() {
  const datos = await getDatosFormularioActivo();
  return <ActivoForm datos={datos} fechaHoy={hoyRD()} />;
}
