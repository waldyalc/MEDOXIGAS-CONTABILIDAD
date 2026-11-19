"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Package, Pencil, Plus, Upload } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import {
  BarraLista,
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { rutaEditarProducto, rutaNuevoProducto, rutaProducto } from "@/lib/enlaces";
import type { CategoriaProducto } from "@/lib/inventario/tipos";
import { type OpcionesLista, type ParametrosLista, type ResumenPagina, TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { etiquetaTasaItbis, formatoCantidad, formatoMoneda, type Producto } from "@/lib/productos/productos";

import { EditarSeleccionadosDialogo } from "./editar-seleccionados-dialogo";
import { ImportarProductosDialogo } from "./importar-productos-dialogo";

function muestraInventario(producto: Producto) {
  return producto.tipo === "producto" && producto.inventariable;
}

function columnasProductos(): readonly ColumnaLista<Producto>[] {
  return [
    {
      clave: "nombre",
      encabezado: "Nombre",
      celda: (producto) => (
        <Enlace href={rutaProducto(producto.id)} className="font-medium">
          {producto.nombre}
        </Enlace>
      ),
    },
    {
      clave: "referencia",
      encabezado: "Referencia",
      celda: (producto) => <span className="text-muted-foreground">{producto.referencia?.trim() || "—"}</span>,
    },
    {
      clave: "precio",
      encabezado: "Precio",
      alineacion: "derecha",
      celda: (producto) => formatoMoneda(producto.precio),
    },
    {
      clave: "itbis",
      encabezado: "ITBIS",
      alineacion: "derecha",
      celda: (producto) => etiquetaTasaItbis(producto.itbis_tasa),
    },
    {
      clave: "existencia",
      encabezado: "Existencia",
      alineacion: "derecha",
      celda: (producto) => (muestraInventario(producto) ? formatoCantidad(producto.cantidad) : "—"),
    },
    {
      clave: "costo",
      encabezado: "Costo",
      alineacion: "derecha",
      celda: (producto) => (muestraInventario(producto) ? formatoMoneda(producto.costo) : "—"),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (producto) => (
        <PillEstado tono={producto.activo ? "exito" : "neutro"}>{producto.activo ? "Activo" : "Inactivo"}</PillEstado>
      ),
    },
  ];
}

export function ProductosCliente({
  productos,
  resumen,
  params,
  opciones,
  categorias,
  puedeEditar,
}: {
  readonly productos: Producto[];
  readonly resumen: ResumenPagina;
  readonly params: ParametrosLista;
  readonly opciones: OpcionesLista;
  readonly categorias: CategoriaProducto[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [edicionMasivaAbierta, setEdicionMasivaAbierta] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(() => new Set());
  const [productosConocidos, setProductosConocidos] = useState<Record<string, Producto>>(() =>
    Object.fromEntries(productos.map((producto) => [producto.id, producto])),
  );

  useEffect(() => {
    setProductosConocidos((actuales) => {
      const siguiente = { ...actuales };
      for (const producto of productos) siguiente[producto.id] = producto;
      return siguiente;
    });
  }, [productos]);

  const productosSeleccionados = [...seleccionados].flatMap((id) =>
    productosConocidos[id] ? [productosConocidos[id]] : [],
  );
  const todosVisiblesSeleccionados =
    productos.length > 0 && productos.every((producto) => seleccionados.has(producto.id));

  function alternarSeleccion(id: string, marcado: boolean) {
    setSeleccionados((anterior) => {
      const siguiente = new Set(anterior);
      if (marcado) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  function alternarTodosVisibles(marcado: boolean) {
    setSeleccionados((anterior) => {
      const siguiente = new Set(anterior);
      for (const producto of productos) {
        if (marcado) siguiente.add(producto.id);
        else siguiente.delete(producto.id);
      }
      return siguiente;
    });
  }

  function terminarEdicionMasiva() {
    setEdicionMasivaAbierta(false);
    setSeleccionados(new Set());
    router.refresh();
  }

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Productos"
        subtitulo="Administra los productos y servicios que vendes."
        migas={[{ etiqueta: "Productos" }]}
        acciones={
          puedeEditar ? (
            <>
              <Button type="button" variant="outline" onClick={() => setImportarAbierto(true)}>
                <Upload />
                Importar
              </Button>
              <Button nativeButton={false} render={<Link href={rutaNuevoProducto()} prefetch={false} />}>
                <Plus />
                Nuevo producto
              </Button>
            </>
          ) : undefined
        }
      />

      <TarjetaLista data-lista="productos">
        <BarraLista>
          <BuscadorLista
            base="/dashboard/productos"
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por nombre o referencia…"
            ariaLabel="Buscar productos"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
          {puedeEditar ? (
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              disabled={seleccionados.size === 0}
              onClick={() => setEdicionMasivaAbierta(true)}
            >
              <Pencil />
              Editar seleccionados{seleccionados.size > 0 ? ` (${seleccionados.size})` : ""}
            </Button>
          ) : null}
        </BarraLista>

        <TablaLista
          columnas={columnasProductos()}
          filas={productos}
          claveFila={(producto) => producto.id}
          filaHref={(producto) => rutaProducto(producto.id)}
          seleccion={
            puedeEditar
              ? {
                  cabecera: (
                    <Checkbox
                      checked={todosVisiblesSeleccionados}
                      onCheckedChange={(valor) => alternarTodosVisibles(valor === true)}
                      aria-label="Seleccionar todos los productos visibles"
                    />
                  ),
                  celda: (producto) => (
                    <Checkbox
                      checked={seleccionados.has(producto.id)}
                      onCheckedChange={(valor) => alternarSeleccion(producto.id, valor === true)}
                      aria-label={`Seleccionar ${producto.nombre}`}
                    />
                  ),
                }
              : undefined
          }
          acciones={
            puedeEditar
              ? (producto) => (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    aria-label={`Editar ${producto.nombre}`}
                    render={<Link href={rutaEditarProducto(producto.id)} prefetch={false} />}
                  >
                    <Pencil />
                  </Button>
                )
              : undefined
          }
          vacio={{
            filtrada: Boolean(opciones.q),
            titulo: opciones.q ? "Sin resultados" : "¡Aún no tienes productos!",
            descripcion: opciones.q
              ? "La búsqueda no arrojó productos."
              : "Crea tu primer producto o servicio para empezar.",
            icono: <Package className="size-10" />,
            accion: puedeEditar ? (
              <Button nativeButton={false} render={<Link href={rutaNuevoProducto()} prefetch={false} />}>
                <Plus />
                Nuevo producto
              </Button>
            ) : undefined,
          }}
        />

        <PaginadorLista
          base="/dashboard/productos"
          params={params}
          resumen={resumen}
          etiqueta="Ítems por página"
          tamano={opciones.tamano}
          opciones={TAMANOS_PAGINA}
          mostrarEnVacio
          botonesExtremos={false}
          className="border-border h-14 border-t px-4 text-slate-700 dark:text-slate-300"
        />
      </TarjetaLista>

      <ImportarProductosDialogo
        abierto={importarAbierto}
        categorias={categorias}
        onCambiarAbierto={setImportarAbierto}
      />

      <EditarSeleccionadosDialogo
        abierto={edicionMasivaAbierta}
        productos={productosSeleccionados}
        categorias={categorias}
        onCambiarAbierto={setEdicionMasivaAbierta}
        onTerminado={terminarEdicionMasiva}
      />
    </ContenedorLista>
  );
}
