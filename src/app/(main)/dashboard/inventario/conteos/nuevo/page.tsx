import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getRol } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { listarAlmacenesActivos } from "@/lib/inventario/consultas";

import { FormularioConteo } from "../_components/formulario-conteo";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const almacenes = rol === "lector" ? [] : await listarAlmacenesActivos();
  const principal = almacenes.find((almacen) => almacen.es_principal) ?? almacenes[0] ?? null;

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nuevo conteo físico"
        subtitulo="Registra lo contado en el almacén; la cantidad del sistema la calcula la app."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Inventario", href: "/dashboard/inventario" },
          { etiqueta: "Conteos físicos", href: "/dashboard/inventario/conteos" },
          { etiqueta: "Nuevo conteo" },
        ]}
      />

      {rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear conteos físicos.</AlertDescription>
        </Alert>
      ) : (
        <FormularioConteo almacenes={almacenes} almacenPorDefecto={principal?.id ?? ""} fechaHoy={hoyRD()} />
      )}
    </ContenedorFormulario>
  );
}
