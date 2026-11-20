import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { getRol } from "@/lib/auth/rol";
import { leerOpcionesLista, leerTexto, type ParametrosLista, resumirPagina } from "@/lib/listas/parametros";
import { getEmpleados } from "@/lib/nomina/consultas";
import { ESTADOS_EMPLEADO, type EstadoEmpleado, FRECUENCIAS_PAGO, SEGMENTOS_CONTABLES } from "@/lib/nomina/tipos";

import { ErrorCarga } from "../_components/error-carga";
import { EmpleadosCliente } from "./_components/empleados-cliente";

export const dynamic = "force-dynamic";

function valorValido<T extends string>(valor: string, opciones: readonly T[]): T | null {
  for (const opcion of opciones) {
    if (opcion === valor) return opcion;
  }
  return null;
}

function leerEstado(valor: string): EstadoEmpleado | "todos" {
  return valorValido(valor, ESTADOS_EMPLEADO) ?? "activo";
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const estado = leerEstado(leerTexto(params, "estado"));
  const frecuencia = valorValido(leerTexto(params, "frecuencia"), FRECUENCIAS_PAGO);
  const segmento = valorValido(leerTexto(params, "segmento"), SEGMENTOS_CONTABLES);

  try {
    const empleados = await getEmpleados({
      ...(frecuencia ? { frecuencia } : {}),
      ...(segmento ? { segmento } : {}),
      ...(opciones.q ? { busqueda: opciones.q.slice(0, 80) } : {}),
    });

    const conteos = {
      activo: empleados.filter((empleado) => empleado.estado === "activo").length,
      suspendido: empleados.filter((empleado) => empleado.estado === "suspendido").length,
      inactivo: empleados.filter((empleado) => empleado.estado === "inactivo").length,
      todos: empleados.length,
    };

    const filtrados = estado === "todos" ? empleados : empleados.filter((empleado) => empleado.estado === estado);
    const resumen = resumirPagina(opciones.pagina, opciones.tamano, filtrados.length);
    const desde = (resumen.pagina - 1) * opciones.tamano;

    return (
      <EmpleadosCliente
        empleados={filtrados.slice(desde, desde + opciones.tamano)}
        resumen={resumen}
        conteos={conteos}
        params={params}
        opciones={opciones}
        estado={estado}
        frecuencia={frecuencia}
        segmento={segmento}
        puedeEscribir={rol !== "lector"}
      />
    );
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : "Ocurrió un error inesperado al leer los empleados de nómina.";
    return (
      <ContenedorLista>
        <EncabezadoPagina
          titulo="Empleados"
          subtitulo="Personas que reciben nómina en la empresa."
          migas={[
            { etiqueta: "Inicio", href: "/dashboard" },
            { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
            { etiqueta: "Nómina", href: "/dashboard/contabilidad/nomina" },
            { etiqueta: "Empleados" },
          ]}
        />
        <ErrorCarga titulo="No se pudo cargar la lista de empleados" mensaje={mensaje} />
      </ContenedorLista>
    );
  }
}
