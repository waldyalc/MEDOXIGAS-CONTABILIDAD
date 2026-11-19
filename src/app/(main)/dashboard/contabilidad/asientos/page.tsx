import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

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
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAsientosLista, normalizarFecha } from "@/lib/asientos/consultas";
import type { AsientoLista } from "@/lib/asientos/tipos";
import { getPerfil } from "@/lib/auth/rol";
import { rutaAsiento, rutaOrigenAsiento } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";

const RUTA = "/dashboard/contabilidad/asientos";

const ORIGENES: Record<string, string> = {
  factura: "Factura",
  pago_recibido: "Pago recibido",
  factura_proveedor: "Compra",
  pago_proveedor: "Pago a proveedor",
  gasto_menor: "Gasto",
  manual: "Manual",
  saldo_inicial: "Saldos iniciales",
  anulacion: "Anulación",
};

interface Props {
  searchParams: Promise<ParametrosLista>;
}

const columnas: readonly ColumnaLista<AsientoLista>[] = [
  {
    clave: "numero",
    encabezado: "Código",
    className: "w-24",
    celda: (asiento) => (
      <Link className="hover:underline" href={rutaAsiento(asiento.id)} prefetch={false}>
        {asiento.codigo ?? `#${asiento.numero}`}
      </Link>
    ),
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (asiento) => formatoDia(asiento.fecha),
  },
  {
    clave: "descripcion",
    encabezado: "Descripción",
    celda: (asiento) => <span className="whitespace-normal">{asiento.descripcion}</span>,
  },
  {
    clave: "origen",
    encabezado: "Origen",
    celda: (asiento) => {
      const hrefOrigen = rutaOrigenAsiento(asiento.origen_tipo, asiento.origen_id, asiento.id);
      const etiquetaOrigen = ORIGENES[asiento.origen_tipo] ?? asiento.origen_tipo;
      return hrefOrigen ? <Enlace href={hrefOrigen}>{etiquetaOrigen}</Enlace> : etiquetaOrigen;
    },
  },
  {
    clave: "total",
    encabezado: "Total",
    alineacion: "derecha",
    celda: (asiento) => <span className="font-medium">{formatoMoneda(asiento.total)}</span>,
  },
];

async function TablaAsientos({
  opciones,
  params,
  desde,
  hasta,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
  readonly desde?: string;
  readonly hasta?: string;
}) {
  const { filas: asientos, resumen } = await getAsientosLista(opciones, desde, hasta);

  return (
    <>
      <TablaLista
        columnas={columnas}
        filas={asientos}
        claveFila={(asiento) => asiento.id}
        filaHref={(asiento) => rutaAsiento(asiento.id)}
        vacio={{
          filtrada: opciones.q !== "" || Boolean(desde) || Boolean(hasta),
          titulo: opciones.q ? "Sin resultados" : "¡Aún no tienes asientos!",
          descripcion: opciones.q
            ? "No se encontraron asientos con esa búsqueda."
            : "No hay asientos en el período seleccionado.",
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

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const desde = normalizarFecha(typeof params.desde === "string" ? params.desde : undefined);
  const hasta = normalizarFecha(typeof params.hasta === "string" ? params.hasta : undefined);
  const puedeEscribir = perfil.rol !== "lector";

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Asientos contables"
        subtitulo="Movimientos del libro diario, con o sin documento de origen."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
          { etiqueta: "Asientos contables" },
        ]}
        acciones={
          puedeEscribir ? (
            <Button render={<Link href="/dashboard/contabilidad/asientos/nuevo" />}>
              <Plus />
              Nuevo asiento
            </Button>
          ) : undefined
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde ?? ""} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta ?? ""} className="w-40" />
        </div>
        {opciones.q ? <input type="hidden" name="q" value={opciones.q} /> : null}
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {desde || hasta || opciones.q ? (
          <Button type="button" variant="ghost" render={<Link href={RUTA} />}>
            Limpiar
          </Button>
        ) : null}
      </form>

      <TarjetaLista data-lista="contabilidad-asientos">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por número o descripción…"
            ariaLabel="Buscar asientos"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={5} className="rounded-none bg-transparent ring-0" />}>
          <TablaAsientos opciones={opciones} params={params} desde={desde} hasta={hasta} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
