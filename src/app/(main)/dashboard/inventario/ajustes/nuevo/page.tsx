import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getRol } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { datosFormularioAjuste } from "@/lib/inventario/consultas";

import { AjusteForm } from "../_components/ajuste-form";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nuevo ajuste de inventario"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Inventario" },
          { etiqueta: "Ajustes de inventario", href: "/dashboard/inventario/ajustes" },
          { etiqueta: "Nuevo ajuste de inventario" },
        ]}
      />

      {rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear ajustes de inventario.</AlertDescription>
        </Alert>
      ) : (
        <AjusteContenido />
      )}
    </ContenedorFormulario>
  );
}

async function AjusteContenido() {
  const datos = await datosFormularioAjuste();

  return (
    <AjusteForm
      almacenes={datos.almacenes}
      productos={datos.productos}
      almacenPorDefecto={datos.almacenPorDefecto}
      fechaHoy={hoyRD()}
    />
  );
}
