import { notFound, redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { listarCategorias, listarListasPreciosActivas } from "@/lib/inventario/consultas";
import { obtenerProducto } from "@/lib/productos/consultas";
import { obtenerFichaProducto } from "@/lib/productos/ficha-consultas";

import { FichaProducto } from "./_components/ficha-producto";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [rol, ficha, productoEditable, categorias, listasPrecios, impuestos] = await Promise.all([
    getRol(),
    obtenerFichaProducto(id),
    obtenerProducto(id),
    listarCategorias(),
    listarListasPreciosActivas(),
    getImpuestosActivos(),
  ]);
  if (rol == null) redirect("/unauthorized");
  if (!ficha) notFound();

  return (
    <FichaProducto
      ficha={ficha}
      puedeEscribir={rol !== "lector"}
      productoEditable={productoEditable}
      categorias={categorias}
      listasPrecios={listasPrecios}
      impuestos={impuestos}
    />
  );
}
