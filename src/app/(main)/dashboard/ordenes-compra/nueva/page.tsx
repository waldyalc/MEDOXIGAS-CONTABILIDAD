import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { getRol } from "@/lib/auth/rol";
import { cargarOpcionesOrden } from "@/lib/ordenes-compra/consultas";

import { FormularioOrden } from "./_components/formulario-orden";

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");
  if (rol === "lector") redirect("/dashboard/ordenes-compra");

  const opciones = await cargarOpcionesOrden();

  return (
    <ContenedorFormulario>
      <FormularioOrden {...opciones} />
    </ContenedorFormulario>
  );
}
