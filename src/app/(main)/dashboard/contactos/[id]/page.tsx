import { notFound, redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarContactos } from "@/lib/contactos/consultas";
import { obtenerFichaContacto } from "@/lib/contactos/ficha-consultas";
import { listarListasPreciosActivas } from "@/lib/inventario/consultas";

import { FichaContacto } from "./_components/ficha-contacto";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rol, datos, contactos, listasPrecios] = await Promise.all([
    getRol(),
    obtenerFichaContacto(id),
    listarContactos(),
    listarListasPreciosActivas(),
  ]);
  if (rol == null) redirect("/unauthorized");
  if (!datos) notFound();

  const contactoEditable = contactos.find((contacto) => contacto.id === id) ?? null;

  return (
    <FichaContacto
      datos={datos}
      puedeCrear={rol !== "lector"}
      contactoEditable={contactoEditable}
      listasPrecios={listasPrecios}
    />
  );
}
