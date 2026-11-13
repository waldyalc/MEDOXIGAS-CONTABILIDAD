import { redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { getNotasDebitoLista } from "@/lib/notas-debito/consultas";

import { NotasDebitoTabla } from "./_components/notas-debito-tabla";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const notas = await getNotasDebitoLista();

  return <NotasDebitoTabla notas={notas} puedeEscribir={perfil.rol !== "lector"} />;
}
