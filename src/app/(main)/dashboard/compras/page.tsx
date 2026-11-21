import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { Enlace } from "@/components/enlace";
import { Plus, ShoppingCart } from "@/components/icons";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import {
  BarraLista,
  type ColumnaLista,
  ContenedorLista,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getRol } from "@/lib/auth/rol";
import { aNumero } from "@/lib/compras/calculo";
import { listarFacturasProveedor } from "@/lib/compras/consultas";
import { formatoMoneda } from "@/lib/compras/formato";
import type { FacturaLista } from "@/lib/compras/tipos";
import { rutaCompra, rutaContacto } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";

import { EstadoBadge } from "./_components/estado-badge";

const RUTA = "/dashboard/compras";

const columnas: readonly ColumnaLista<FacturaLista>[] = [
  {
    clave: "numero",
    encabezado: "Número",
    celda: (factura) => <Enlace href={rutaCompra(factura.id)}>#{factura.numero}</Enlace>,
  },
  {
    clave: "ncf",
    encabezado: "No. / NCF",
    celda: (factura) =>
      factura.ncf ? (
        <Enlace href={rutaCompra(factura.id)}>
          <span className="font-mono text-xs">{factura.ncf}</span>
        </Enlace>
      ) : (
        "—"
      ),
  },
  {
    clave: "proveedor",
    encabezado: "Proveedor",
    celda: (factura) =>
      factura.contactos ? <Enlace href={rutaContacto(factura.contacto_id)}>{factura.contactos.nombre}</Enlace> : "—",
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (factura) => formatoDia(factura.fecha),
  },
  {
    clave: "vencimiento",
    encabezado: "Vencimiento",
    celda: (factura) => formatoDia(factura.vencimiento),
  },
  {
    clave: "total",
    encabezado: "Total",
    alineacion: "derecha",
    celda: (factura) => formatoMoneda(aNumero(factura.total)),
  },
  {
    clave: "pagado",
    encabezado: "Pagado",
    alineacion: "derecha",
    celda: (factura) => formatoMoneda(aNumero(factura.pagado)),
  },
  {
    clave: "porPagar",
    encabezado: "Por pagar",
    alineacion: "derecha",
    celda: (factura) =>
      formatoMoneda(
        aNumero(factura.total) - aNumero(factura.pagado) - aNumero(factura.credito) - aNumero(factura.retenido),
      ),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (factura) => <EstadoBadge estado={factura.estado} />,
  },
];

async function AccionesCompra() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" render={<Link href="/dashboard/compras/pagos" />}>
        Pagos a proveedores
      </Button>
      <Button variant="outline" render={<Link href="/dashboard/compras/notas-credito" />}>
        Notas de crédito
      </Button>
      {rol !== "lector" ? (
        <Button render={<Link href="/dashboard/compras/nueva" />}>
          <Plus data-icon="inline-start" />
          Nueva factura de proveedor
        </Button>
      ) : null}
    </div>
  );
}

async function TablaCompras({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: facturas, resumen } = await listarFacturasProveedor(opciones);

  return (
    <>
      <TablaLista
        columnas={columnas}
        filas={facturas}
        claveFila={(factura) => factura.id}
        filaHref={(factura) => rutaCompra(factura.id)}
        vacio={{
          filtrada: Boolean(opciones.q),
          titulo: opciones.q ? "Sin resultados" : "¡Aún no tienes compras!",
          descripcion: opciones.q
            ? "La búsqueda no arrojó compras."
            : "Registra tu primera factura de proveedor para empezar.",
          icono: <ShoppingCart className="size-10" />,
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

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Compras"
        subtitulo="Facturas de proveedores, cuentas por pagar y sus pagos."
        migas={[{ etiqueta: "Compras" }, { etiqueta: "Facturas de proveedor" }]}
        acciones={
          <Suspense
            fallback={
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-52" />
              </div>
            }
          >
            <AccionesCompra />
          </Suspense>
        }
      />

      <TarjetaLista data-lista="compras">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número, NCF o proveedor…"
            ariaLabel="Buscar compras"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={9} className="rounded-none bg-transparent ring-0" />}>
          <TablaCompras opciones={opciones} params={params} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
