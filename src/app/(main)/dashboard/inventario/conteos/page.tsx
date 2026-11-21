import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "@/components/icons";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { ContenedorLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { listarConteos } from "@/lib/inventario/ferreteria/consultas";
import {
  leerOpcionesLista,
  type ParametrosLista,
  type ResumenPagina,
  resumirPagina,
  TAMANOS_PAGINA,
} from "@/lib/listas/parametros";

import { ConteosTabla } from "./_components/conteos-tabla";
import { type ConteoLista, enriquecerConteos } from "./_components/datos-conteos";

const RUTA = "/dashboard/inventario/conteos";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const params = await searchParams;
  const opciones = leerOpcionesLista(params);

  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const puedeEscribir = rol !== "lector";
  let conteos: ConteoLista[] = [];
  let resumen: ResumenPagina = resumirPagina(opciones.pagina, opciones.tamano, 0);
  let error: string | null = null;

  try {
    const todos = await listarConteos();
    resumen = resumirPagina(opciones.pagina, opciones.tamano, todos.length);

    const desde = (resumen.pagina - 1) * opciones.tamano;
    conteos = await enriquecerConteos(todos.slice(desde, desde + opciones.tamano));
  } catch {
    error = "No se pudieron cargar los conteos de inventario. Intenta de nuevo.";
  }

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Conteos físicos"
        subtitulo="Toma física del inventario: cuenta, revisa la diferencia y genera el ajuste."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Inventario", href: "/dashboard/inventario" },
          { etiqueta: "Conteos físicos" },
        ]}
        acciones={
          puedeEscribir ? (
            <Button render={<Link href={`${RUTA}/nuevo`} />}>
              <Plus />
              Nuevo conteo
            </Button>
          ) : null
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" nativeButton={false} render={<Link href={RUTA} />}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <TarjetaLista data-lista="inventario-conteos">
          <ConteosTabla conteos={conteos} puedeEscribir={puedeEscribir} />
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
      )}
    </ContenedorLista>
  );
}
