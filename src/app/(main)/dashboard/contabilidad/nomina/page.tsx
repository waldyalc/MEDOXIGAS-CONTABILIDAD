import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { getRol } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getConfigNomina, getEmpleados, getParametrosNomina, getPeriodos, getRecibos } from "@/lib/nomina/consultas";
import type { EstadoNomina, PeriodoNomina } from "@/lib/nomina/tipos";

import { ErrorCarga } from "./_components/error-carga";
import { type DatosInicioNomina, InicioNomina } from "./_components/inicio-nomina";
import { periodosQueSeCruzan, sugerirPeriodo } from "./empleados/_components/formato-nomina";

export const dynamic = "force-dynamic";

function conteoPorEstado(periodos: readonly PeriodoNomina[]): Record<EstadoNomina, number> {
  const conteo: Record<EstadoNomina, number> = {
    borrador: 0,
    calculado: 0,
    contabilizado: 0,
    pagado: 0,
    anulado: 0,
  };
  for (const periodo of periodos) conteo[periodo.estado] += 1;
  return conteo;
}

async function cargar(): Promise<DatosInicioNomina> {
  const hoy = hoyRD();
  const anio = Number(hoy.slice(0, 4));

  const [empleados, periodos, recibos, config, parametros] = await Promise.all([
    getEmpleados(),
    getPeriodos(),
    getRecibos(),
    getConfigNomina(),
    getParametrosNomina(anio),
  ]);

  const activos = empleados.filter((empleado) => empleado.estado === "activo").length;
  const suspendidos = empleados.filter((empleado) => empleado.estado === "suspendido").length;
  const ultimoPeriodo = periodos.find((periodo) => periodo.estado !== "anulado") ?? null;

  const recibosUltimo = ultimoPeriodo
    ? recibos.filter((recibo) => recibo.periodo_id === ultimoPeriodo.id && recibo.estado !== "anulado")
    : [];

  const sugerido = sugerirPeriodo(config?.frecuencia_defecto ?? "quincenal", hoy);
  const existentes = periodosQueSeCruzan(periodos, sugerido);
  const empleadosElegibles = empleados.filter(
    (empleado) => empleado.estado === "activo" && empleado.frecuencia_pago === sugerido.frecuencia,
  ).length;

  const ultimosPeriodos = periodos.slice(0, 5).map((periodo) => ({
    periodo,
    empleados: recibos.filter((recibo) => recibo.periodo_id === periodo.id && recibo.estado !== "anulado").length,
  }));

  return {
    anio,
    activos,
    suspendidos,
    parametros,
    config,
    sugerido,
    periodoExistente: existentes[0] ?? null,
    empleadosElegibles,
    ultimoPeriodo,
    colillasEnviadas: recibosUltimo.filter((recibo) => recibo.colilla_enviada_en !== null).length,
    colillasTotales: recibosUltimo.length,
    ultimosPeriodos,
    conteoEstados: conteoPorEstado(periodos),
  };
}

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  try {
    const datos = await cargar();
    return <InicioNomina datos={datos} puedeEscribir={rol !== "lector"} />;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Ocurrió un error inesperado al leer los datos de nómina.";
    return (
      <ContenedorLista>
        <EncabezadoPagina
          titulo="Nómina"
          subtitulo="Empleados, periodos y aportes de ley en un solo lugar."
          migas={[
            { etiqueta: "Inicio", href: "/dashboard" },
            { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
            { etiqueta: "Nómina" },
          ]}
        />
        <ErrorCarga titulo="No se pudo cargar el inicio de nómina" mensaje={mensaje} />
      </ContenedorLista>
    );
  }
}
