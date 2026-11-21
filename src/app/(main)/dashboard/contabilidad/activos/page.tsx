import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { Plus } from "@/components/icons";
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
import { getActivosLista } from "@/lib/activos-fijos/consultas";
import { type ActivoLista, ETIQUETAS_TIPO_ACTIVO, type TipoActivo } from "@/lib/activos-fijos/tipos";
import { getPerfil } from "@/lib/auth/rol";
import { formatoDia } from "@/lib/formato";
import { leerOpcionesLista, type OpcionesLista, type ParametrosLista, TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

const RUTA = "/dashboard/contabilidad/activos";

function depreciadoTotal(activo: ActivoLista): boolean {
  const montoCentavos = centavos(activo.monto_total);
  const residualCentavos = centavos(activo.valor_residual);
  const depreciadoCentavos = centavos(activo.depreciado);
  return depreciadoCentavos >= montoCentavos - residualCentavos;
}

const columnas: readonly ColumnaLista<ActivoLista>[] = [
  {
    clave: "activo",
    encabezado: "Activo",
    celda: (activo) => (
      <span className="flex flex-col">
        <Link className="font-medium hover:underline" href={`/dashboard/contabilidad/activos/${activo.id}`}>
          {activo.nombre}
        </Link>
        <span className="text-muted-foreground text-xs">
          {ETIQUETAS_TIPO_ACTIVO[activo.tipo_activo as TipoActivo] ?? activo.tipo_activo}
          {activo.referencia ? ` · ${activo.referencia}` : ""}
        </span>
      </span>
    ),
  },
  {
    clave: "adquisicion",
    encabezado: "Adquisición",
    celda: (activo) => formatoDia(activo.fecha_adquisicion),
  },
  {
    clave: "monto",
    encabezado: "Monto total",
    alineacion: "derecha",
    celda: (activo) => formatearRd(centavos(activo.monto_total)),
  },
  {
    clave: "depreciado",
    encabezado: "Depreciado",
    alineacion: "derecha",
    celda: (activo) => formatearRd(centavos(activo.depreciado)),
  },
  {
    clave: "valorActual",
    encabezado: "Valor actual",
    alineacion: "derecha",
    celda: (activo) => formatearRd(centavos(activo.monto_total) - centavos(activo.depreciado)),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (activo) => (
      <PillEstado tono={depreciadoTotal(activo) ? "neutro" : "pendiente"}>
        {depreciadoTotal(activo) ? "Totalmente depreciado" : "En curso"}
      </PillEstado>
    ),
  },
];

async function TablaActivos({
  opciones,
  params,
}: {
  readonly opciones: OpcionesLista;
  readonly params: ParametrosLista;
}) {
  const { filas: activos, resumen } = await getActivosLista(opciones);

  return (
    <>
      <TablaLista
        columnas={columnas}
        filas={activos}
        claveFila={(activo) => activo.id}
        filaHref={(activo) => `/dashboard/contabilidad/activos/${activo.id}`}
        vacio={{
          filtrada: Boolean(opciones.q),
          titulo: opciones.q ? "Sin resultados" : "¡Aún no tienes activos fijos!",
          descripcion: opciones.q
            ? "No se encontraron activos con esa búsqueda."
            : "Registra un vehículo, equipo o inmueble para empezar a depreciarlo.",
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
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Activos fijos"
        subtitulo="Bienes de la empresa, su valor actual y la depreciación mes a mes."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
          { etiqueta: "Activos fijos" },
        ]}
        acciones={
          perfil.rol !== "lector" ? (
            <Button render={<Link href="/dashboard/contabilidad/activos/nuevo" />}>
              <Plus />
              Nuevo activo
            </Button>
          ) : undefined
        }
      />

      <TarjetaLista data-lista="contabilidad-activos">
        <BarraLista>
          <BuscadorLista
            base={RUTA}
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por nombre o referencia…"
            ariaLabel="Buscar activos fijos"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
        </BarraLista>

        <Suspense fallback={<EsqueletoTabla filas={8} columnas={6} className="rounded-none bg-transparent ring-0" />}>
          <TablaActivos opciones={opciones} params={params} />
        </Suspense>
      </TarjetaLista>
    </ContenedorLista>
  );
}
