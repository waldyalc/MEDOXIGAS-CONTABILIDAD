import { redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { getNotasCreditoLista } from "@/lib/notas-credito/consultas";

import { NotasCreditoTabla } from "./_components/notas-credito-tabla";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const notas = await getNotasCreditoLista();

  return <NotasCreditoTabla notas={notas} />;
}
