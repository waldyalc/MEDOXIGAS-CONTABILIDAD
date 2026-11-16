import { notFound, redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { obtenerFichaProducto } from "@/lib/productos/ficha-consultas";

import { FichaProducto } from "./_components/ficha-producto";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [rol, ficha] = await Promise.all([getRol(), obtenerFichaProducto(id)]);
  if (rol == null) redirect("/unauthorized");
  if (!ficha) notFound();

  return <FichaProducto ficha={ficha} puedeEscribir={rol !== "lector"} />;
}
