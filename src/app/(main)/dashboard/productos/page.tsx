import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarProductos } from "@/lib/productos/consultas";

import { ProductosCliente } from "./_components/productos-cliente";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const productos = await listarProductos();

  return <ProductosCliente productos={productos} puedeEditar={rol !== "lector"} />;
}
