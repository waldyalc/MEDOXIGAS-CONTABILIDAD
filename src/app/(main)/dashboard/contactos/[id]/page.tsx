import { notFound, redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { obtenerFichaContacto } from "@/lib/contactos/ficha-consultas";

import { FichaContacto } from "./_components/ficha-contacto";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rol, datos] = await Promise.all([getRol(), obtenerFichaContacto(id)]);
  if (rol == null) redirect("/unauthorized");
  if (!datos) notFound();

  return <FichaContacto datos={datos} puedeCrear={rol !== "lector"} />;
}
