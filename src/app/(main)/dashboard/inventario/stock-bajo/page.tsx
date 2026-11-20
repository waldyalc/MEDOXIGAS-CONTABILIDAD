import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { getRol } from "@/lib/auth/rol";
import { listarAlmacenesActivos } from "@/lib/inventario/consultas";
import { listarStockBajo } from "@/lib/inventario/ferreteria/consultas";

import { StockBajoCliente } from "./_components/stock-bajo-cliente";
import { cargarDetallesProductos } from "./_lib/consultas";
import type { FilaStockBajo } from "./_lib/stock-bajo";

interface Props {
  searchParams: Promise<{ almacen?: string | string[] }>;
}

export default async function Page({ searchParams }: Props) {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const params = await searchParams;
  const solicitado = typeof params.almacen === "string" ? params.almacen : null;

  const almacenes = await listarAlmacenesActivos();
  const almacen =
    almacenes.find((candidato) => candidato.id === solicitado) ??
    almacenes.find((candidato) => candidato.es_principal) ??
    almacenes[0] ??
    null;

  let filas: FilaStockBajo[] = [];
  let error: string | null = null;

  try {
    const productos = await listarStockBajo(almacen?.id ?? null);
    const detalles = await cargarDetallesProductos(productos.map((producto) => producto.producto_id));

    filas = productos.map((producto) => ({
      ...producto,
      categoria: detalles.get(producto.producto_id)?.categoria ?? null,
      codigos: detalles.get(producto.producto_id)?.codigos ?? [],
    }));
  } catch (fallo) {
    error = fallo instanceof Error ? fallo.message : "No se pudo consultar el reporte de stock bajo.";
  }

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Stock bajo"
        subtitulo="Productos por debajo de su mínimo, del más crítico al menos."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Inventario", href: "/dashboard/inventario" },
          { etiqueta: "Stock bajo" },
        ]}
      />

      <StockBajoCliente
        filas={filas}
        almacenes={almacenes}
        almacenId={almacen?.id ?? ""}
        almacenNombre={almacen?.nombre ?? ""}
        error={error}
      />
    </ContenedorLista>
  );
}
