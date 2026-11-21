import { redirect } from "next/navigation";

import { TriangleAlert } from "@/components/icons";
import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getRol } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import {
  leerOpcionesLista,
  leerTexto,
  type ParametrosLista,
  rangoPagina,
  resumirPagina,
} from "@/lib/listas/parametros";
import { getConfigNomina, getPeriodos } from "@/lib/nomina/consultas";
import { ESTADOS_NOMINA, type EstadoNomina, FRECUENCIAS_PAGO, type FrecuenciaPago } from "@/lib/nomina/tipos";

import { BotonReintentar } from "./_components/boton-reintentar";
import { MIGAS_BASE } from "./_components/comun-nomina";
import { getAniosConParametros, getConteosRecibos } from "./_components/datos";
import { PeriodosCliente } from "./_components/periodos-cliente";

function anioDeHoy(): number {
  return Number(hoyRD().slice(0, 4));
}

function leerAnio(params: ParametrosLista, defecto: number): number {
  const numero = Number(leerTexto(params, "anio"));
  return Number.isInteger(numero) && numero >= 2000 && numero <= 2100 ? numero : defecto;
}

function leerFrecuencia(params: ParametrosLista): FrecuenciaPago | "" {
  const valor = leerTexto(params, "frecuencia");
  return FRECUENCIAS_PAGO.find((frecuencia) => frecuencia === valor) ?? "";
}

function leerEstado(params: ParametrosLista): EstadoNomina | "" {
  const valor = leerTexto(params, "estado");
  return ESTADOS_NOMINA.find((estado) => estado === valor) ?? "";
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const anioActual = anioDeHoy();
  const filtros = {
    anio: leerAnio(params, anioActual),
    frecuencia: leerFrecuencia(params),
    estado: leerEstado(params),
  };

  try {
    const [todos, aniosConParametros, config] = await Promise.all([
      getPeriodos({
        anio: filtros.anio,
        ...(filtros.frecuencia ? { frecuencia: filtros.frecuencia } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
      }),
      getAniosConParametros(),
      getConfigNomina().catch(() => null),
    ]);

    const resumen = resumirPagina(opciones.pagina, opciones.tamano, todos.length);
    const { desde, hasta } = rangoPagina(resumen.pagina, opciones.tamano);
    const periodos = todos.slice(desde, hasta + 1);
    const conteos = await getConteosRecibos(periodos.map((periodo) => periodo.id));

    return (
      <PeriodosCliente
        periodos={periodos}
        conteos={Object.fromEntries(conteos)}
        resumen={resumen}
        params={params}
        tamano={opciones.tamano}
        filtros={filtros}
        anioActual={anioActual}
        aniosConParametros={aniosConParametros}
        frecuenciaDefecto={config?.frecuencia_defecto ?? "quincenal"}
        puedeEscribir={rol !== "lector"}
      />
    );
  } catch (error) {
    return (
      <ContenedorLista>
        <EncabezadoPagina
          titulo="Periodos y cálculo"
          subtitulo="Crea el periodo, revisa las novedades y calcula los recibos."
          migas={[...MIGAS_BASE, { etiqueta: "Periodos y cálculo" }]}
          acciones={<BotonReintentar />}
        />
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo cargar la lista de periodos</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Intenta de nuevo."}</AlertDescription>
        </Alert>
      </ContenedorLista>
    );
  }
}
