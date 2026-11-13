import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarCategorias } from "@/lib/inventario/consultas";
import { listarProductos } from "@/lib/productos/consultas";

import { ProductosCliente } from "./_components/productos-cliente";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const [productos, categorias] = await Promise.all([listarProductos(), listarCategorias()]);

  return <ProductosCliente productos={productos} categorias={categorias} puedeEditar={rol !== "lector"} />;
}
