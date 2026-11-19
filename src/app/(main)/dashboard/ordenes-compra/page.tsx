import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { ClipboardList, Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { Enlace } from "@/components/enlace";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import {
  BarraLista,
  type ColumnaLista,
  ContenedorLista,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { formatoMoneda } from "@/lib/compras/formato";
import { rutaCompra, rutaContacto, rutaOrdenCompra } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { listarOrdenesCompra } from "@/lib/ordenes-compra/consultas";
import type { OrdenCompraLista } from "@/lib/ordenes-compra/tipos";

import { EstadoOrdenBadge } from "./_components/estado-orden-badge";

const RUTA = "/dashboard/ordenes-compra";

const columnas: readonly ColumnaLista<OrdenCompraLista>[] = [
  {
    clave: "numero",
    encabezado: "Número",
    celda: (orden) => <Enlace href={rutaOrdenCompra(orden.id)}>#{orden.numero}</Enlace>,
  },
  {
    clave: "proveedor",
    encabezado: "Proveedor",
    celda: (orden) => <Enlace href={rutaContacto(orden.contacto_id)}>{orden.contacto_nombre}</Enlace>,
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (orden) => formatoDia(orden.fecha),
  },
  {
    clave: "entrega",
    encabezado: "Entrega",
    celda: (orden) => formatoDia(orden.fecha_entrega),
  },
  {
    clave: "total",
    encabezado: "Total",
    alineacion: "derecha",
    celda: (orden) => formatoMoneda(orden.total),
  },
  {
    clave: "factura",
    encabezado: "Factura de proveedor",
    celda: (orden) =>
      orden.factura_proveedor_id ? (
        <Enlace href={rutaCompra(orden.factura_proveedor_id)}>Ver factura</Enlace>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (orden) => <EstadoOrdenBadge estado={orden.estado} />,
  },
];

async function TablaOrdenes({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: ordenes, resumen } = await listarOrdenesCompra(opciones);

  return (
    <>
      <TablaLista
        columnas={columnas}
        filas={ordenes}
        claveFila={(orden) => orden.id}
        filaHref={(orden) => rutaOrdenCompra(orden.id)}
        vacio={{
          filtrada: Boolean(opciones.q),
          titulo: opciones.q ? "Sin resultados" : "¡Aún no tienes órdenes de compra!",
          descripcion: opciones.q
            ? "La búsqueda no arrojó órdenes de compra."
            : "Crea una orden para controlar la entrega de tu proveedor.",
          icono: <ClipboardList className="size-10" />,
        }}
      />
      <PaginadorLista
        base={RUTA}
        params={params}
        resumen={resumen}
        etiqueta="Ítems por página"
        tamano={opciones.tamano}
        opciones={TAMANOS_PAGINA}
        mostrarEnVacio
        botonesExtremos={false}
        className="border-border h-14 border-t px-4 text-slate-700 dark:text-slate-300"
      />
    </>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  return (
    <ContenedorLista>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Órdenes de compra</h1>
          <p className="text-muted-foreground text-sm">
            Documentos de control para el proveedor. No mueven inventario ni generan asiento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/dashboard/compras" prefetch={false} />}>
            Compras
          </Button>
          {rol !== "lector" ? (
            <Button render={<Link href="/dashboard/ordenes-compra/nueva" prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nueva orden
            </Button>
          ) : null}
        </div>
      </div>

      <TarjetaLista data-lista="ordenes-compra">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número o proveedor…"
            ariaLabel="Buscar órdenes de compra"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={7} className="rounded-none bg-transparent ring-0" />}>
          <TablaOrdenes opciones={opciones} params={params} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
