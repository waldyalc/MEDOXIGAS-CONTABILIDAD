import Link from "next/link";
import { redirect } from "next/navigation";

import { FileMinus, Plus } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { formatoMoneda } from "@/lib/compras/formato";
import { getNotasCreditoCompraLista } from "@/lib/compras/notas-credito/consultas";
import type { NotaCreditoCompraLista } from "@/lib/compras/notas-credito/tipos";
import { rutaCompra, rutaContacto, rutaNotaCreditoCompra } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";

const RUTA = "/dashboard/compras/notas-credito";

const columnas: readonly ColumnaLista<NotaCreditoCompraLista>[] = [
  {
    clave: "numero",
    encabezado: "Número",
    celda: (nota) => <Enlace href={rutaNotaCreditoCompra(nota.id)}>#{nota.numero}</Enlace>,
  },
  {
    clave: "ncf",
    encabezado: "NCF",
    celda: (nota) =>
      nota.ncf ? (
        <Enlace href={rutaNotaCreditoCompra(nota.id)}>
          <span className="font-mono text-xs">{nota.ncf}</span>
        </Enlace>
      ) : (
        "—"
      ),
  },
  {
    clave: "factura",
    encabezado: "Factura de proveedor",
    celda: (nota) => (
      <Enlace href={rutaCompra(nota.factura_proveedor_id)}>
        #{nota.factura_numero}
        {nota.factura_ncf ? ` — ${nota.factura_ncf}` : ""}
      </Enlace>
    ),
  },
  {
    clave: "proveedor",
    encabezado: "Proveedor",
    celda: (nota) => <Enlace href={rutaContacto(nota.contacto_id)}>{nota.proveedor_nombre}</Enlace>,
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (nota) => formatoDia(nota.fecha),
  },
  {
    clave: "total",
    encabezado: "Total",
    alineacion: "derecha",
    celda: (nota) => <span className="font-medium">{formatoMoneda(nota.total)}</span>,
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (nota) => (
      <PillEstado tono={nota.estado === "anulada" ? "peligro" : "exito"}>
        {nota.estado === "anulada" ? "Anulada" : "Activa"}
      </PillEstado>
    ),
  },
];

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const { filas: notas, resumen } = await getNotasCreditoCompraLista(opciones);
  const puedeCrear = rol !== "lector";

  return (
    <ContenedorLista>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Notas de crédito en compras</h1>
          <p className="text-muted-foreground text-sm">
            Devoluciones a proveedores ligadas a una factura de proveedor (NCF del proveedor, B04).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/dashboard/compras" prefetch={false} />}>
            Compras
          </Button>
          {puedeCrear ? (
            <Button render={<Link href="/dashboard/compras/notas-credito/nueva" prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nueva nota de crédito
            </Button>
          ) : null}
        </div>
      </div>

      <TarjetaLista data-lista="compras-notas-credito">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número, NCF o proveedor…"
            ariaLabel="Buscar notas de crédito de compras"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <TablaLista
          columnas={columnas}
          filas={notas}
          claveFila={(nota) => nota.id}
          vacio={{
            filtrada: Boolean(opciones.q),
            titulo: opciones.q ? "Sin resultados" : "¡Aún no tienes notas de crédito en compras!",
            descripcion: opciones.q
              ? "La búsqueda no arrojó notas de crédito."
              : "Se crean desde una factura de proveedor; aquí verás su historial.",
            icono: <FileMinus className="size-10" />,
            accion: puedeCrear ? (
              <Button render={<Link href="/dashboard/compras/notas-credito/nueva" prefetch={false} />}>
                <Plus />
                Nueva nota de crédito
              </Button>
            ) : undefined,
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
      </TarjetaLista>
    </ContenedorLista>
  );
}
