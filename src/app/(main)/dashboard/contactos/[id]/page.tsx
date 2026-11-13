import { notFound, redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { obtenerFichaContacto } from "@/lib/contactos/ficha-consultas";

import { FichaContacto } from "./_components/ficha-contacto";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const { id } = await params;
  const datos = await obtenerFichaContacto(id);
  if (!datos) notFound();

  return <FichaContacto datos={datos} puedeCrear={rol !== "lector"} />;
}
