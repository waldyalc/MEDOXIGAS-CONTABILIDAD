import { notFound, redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarCuentasMovimiento } from "@/lib/contabilidad/consultas";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { listarCategorias, listarExistenciasProducto, listarListasPreciosActivas } from "@/lib/inventario/consultas";
import { obtenerProductoEditable } from "@/lib/productos/consultas";

import { PantallaEditarProducto } from "./_components/pantalla-editar-producto";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [rol, producto, categorias, listasPrecios, impuestos, cuentas, existencias] = await Promise.all([
    getRol(),
    obtenerProductoEditable(id),
    listarCategorias(),
    listarListasPreciosActivas(),
    getImpuestosActivos(),
    listarCuentasMovimiento(),
    listarExistenciasProducto(id),
  ]);

  if (rol === null) redirect("/unauthorized");
  if (!producto) notFound();
  if (rol === "lector") redirect(`/dashboard/productos/${encodeURIComponent(id)}`);

  return (
    <PantallaEditarProducto
      key={producto.id}
      producto={producto}
      categorias={categorias}
      listasPrecios={listasPrecios}
      impuestos={impuestos}
      cuentas={cuentas}
      existencias={existencias}
    />
  );
}
