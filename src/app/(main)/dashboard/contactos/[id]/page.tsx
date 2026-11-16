import { notFound, redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { obtenerContacto } from "@/lib/contactos/consultas";
import { obtenerFichaContacto } from "@/lib/contactos/ficha-consultas";
import { listarListasPreciosActivas } from "@/lib/inventario/consultas";

import { FichaContacto } from "./_components/ficha-contacto";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rol, datos, contactoEditable, listasPrecios] = await Promise.all([
    getRol(),
    obtenerFichaContacto(id),
    obtenerContacto(id),
    listarListasPreciosActivas(),
  ]);
  if (rol == null) redirect("/unauthorized");
  if (!datos) notFound();

  return (
    <FichaContacto
      datos={datos}
      puedeCrear={rol !== "lector"}
      contactoEditable={contactoEditable}
      listasPrecios={listasPrecios}
    />
  );
}
