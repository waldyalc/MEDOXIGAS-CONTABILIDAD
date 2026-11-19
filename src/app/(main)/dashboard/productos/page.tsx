import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarCategorias } from "@/lib/inventario/consultas";
import { leerOpcionesLista, type ParametrosLista } from "@/lib/listas/parametros";
import { listarProductos } from "@/lib/productos/consultas";

import { ProductosCliente } from "./_components/productos-cliente";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const params = await searchParams;
  const opciones = leerOpcionesLista(params);

  const [rol, productos, categorias] = await Promise.all([getRol(), listarProductos(opciones), listarCategorias()]);
  if (rol === null) redirect("/unauthorized");

  return (
    <ProductosCliente
      productos={productos.filas}
      resumen={productos.resumen}
      params={params}
      opciones={opciones}
      categorias={categorias}
      puedeEditar={rol !== "lector"}
    />
  );
}
