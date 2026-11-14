import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarCategorias, listarListasPreciosActivas } from "@/lib/inventario/consultas";
import { listarProductos } from "@/lib/productos/consultas";

import { ProductosCliente } from "./_components/productos-cliente";

export default async function Page() {
  const [rol, productos, categorias, listasPrecios] = await Promise.all([
    getRol(),
    listarProductos(),
    listarCategorias(),
    listarListasPreciosActivas(),
  ]);
  if (rol === null) redirect("/unauthorized");

  return (
    <ProductosCliente
      productos={productos}
      categorias={categorias}
      listasPrecios={listasPrecios}
      puedeEditar={rol !== "lector"}
    />
  );
}
