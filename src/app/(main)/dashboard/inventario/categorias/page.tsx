import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarCategorias } from "@/lib/inventario/consultas";

import { CategoriasCliente } from "./_components/categorias-cliente";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const categorias = await listarCategorias();

  return <CategoriasCliente categorias={categorias} puedeEditar={rol !== "lector"} />;
}
