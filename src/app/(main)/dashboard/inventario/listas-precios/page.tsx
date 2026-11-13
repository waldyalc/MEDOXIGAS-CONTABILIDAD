import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarListasPrecios } from "@/lib/inventario/consultas";

import { ListasPreciosCliente } from "./_components/listas-precios-cliente";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const listas = await listarListasPrecios();

  return <ListasPreciosCliente listas={listas} puedeEditar={rol !== "lector"} />;
}
