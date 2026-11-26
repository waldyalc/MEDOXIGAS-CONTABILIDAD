import { redirect } from "next/navigation";

import { PaginadorLista } from "@/components/listas/paginador-lista";
import { BarraLista, ContenedorLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { consultarAuditoria } from "@/lib/auditoria/consultas";
import { getRol } from "@/lib/auth/rol";
import {
  leerOpcionesLista,
  leerTexto,
  type ParametrosLista,
  resumirPagina,
  TAMANOS_PAGINA,
} from "@/lib/listas/parametros";

import { AuditoriaTabla } from "./_components/auditoria-tabla";
import { FiltroAuditoria } from "./_components/filtro-auditoria";

const RUTA = "/dashboard/configuracion/auditoria";

/**
 * Auditoría del sistema: quién creó, modificó o anuló cada documento. Todos
 * los roles con perfil pueden consultarla (es de solo lectura); los filtros
 * van por URL para que el paginador los conserve.
 */
export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const [params, rol] = await Promise.all([searchParams, getRol()]);
  if (rol == null) redirect("/unauthorized");

  const entidad = leerTexto(params, "entidad");
  const usuario = leerTexto(params, "usuario");
  const accion = leerTexto(params, "accion");
  const desde = leerTexto(params, "desde");
  const hasta = leerTexto(params, "hasta");
  const { pagina, tamano } = leerOpcionesLista(params);

  const respuesta = await consultarAuditoria({
    entidad,
    usuarioId: usuario,
    accion,
    desde,
    hasta,
    limite: tamano,
    desplazamiento: (pagina - 1) * tamano,
    usuarios: true,
  });

  const resumen = resumirPagina(pagina, tamano, respuesta?.total ?? 0);
  const filtrada = entidad !== "" || usuario !== "" || accion !== "" || desde !== "" || hasta !== "";

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Auditoría"
        subtitulo="Quién creó, modificó o anuló cada documento del sistema."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Configuración", href: "/dashboard/configuracion" },
          { etiqueta: "Auditoría" },
        ]}
      />

      <TarjetaLista data-lista="auditoria">
        <BarraLista className="h-auto flex-wrap py-3">
          <FiltroAuditoria
            entidad={entidad}
            usuario={usuario}
            accion={accion}
            desde={desde}
            hasta={hasta}
            usuarios={respuesta?.usuarios ?? []}
          />
        </BarraLista>

        {respuesta == null ? (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-semibold">No se pudo cargar la auditoría</p>
            <p className="text-muted-foreground text-sm">Recarga la página e inténtalo de nuevo.</p>
          </div>
        ) : (
          <>
            <AuditoriaTabla entradas={respuesta.entradas} filtrada={filtrada} />

            <PaginadorLista
              base={RUTA}
              params={params}
              resumen={resumen}
              tamano={tamano}
              opciones={TAMANOS_PAGINA}
              mostrarEnVacio
              botonesExtremos={false}
            />
          </>
        )}
      </TarjetaLista>
    </ContenedorLista>
  );
}
