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
import { getPeriodos } from "@/lib/nomina/consultas";

import { BotonReintentar } from "../periodos/_components/boton-reintentar";
import { MIGAS_BASE } from "../periodos/_components/comun-nomina";
import { getConteosRecibos } from "../periodos/_components/datos";
import { EnviosCliente, type EstadoEnvio, type FilaEnvio } from "./_components/envios-cliente";

const ESTADOS: readonly EstadoEnvio[] = ["pendiente", "parcial", "enviado"];

function anioDeHoy(): number {
  return Number(hoyRD().slice(0, 4));
}

function leerAnio(params: ParametrosLista, defecto: number): number {
  const numero = Number(leerTexto(params, "anio"));
  return Number.isInteger(numero) && numero >= 2000 && numero <= 2100 ? numero : defecto;
}

function leerEstado(params: ParametrosLista): EstadoEnvio | "" {
  const valor = leerTexto(params, "estado_envio");
  return ESTADOS.find((estado) => estado === valor) ?? "";
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const anioActual = anioDeHoy();
  const anio = leerAnio(params, anioActual);
  const estado = leerEstado(params);

  try {
    const periodos = await getPeriodos({ anio });
    const conteos = await getConteosRecibos(periodos.map((periodo) => periodo.id));

    const todas: FilaEnvio[] = periodos.map((periodo) => {
      const conteo = conteos.get(periodo.id);
      const empleados = conteo?.enviables ?? 0;
      const enviados = conteo?.enviados ?? 0;

      let estadoEnvio: EstadoEnvio = "pendiente";
      if (empleados > 0 && enviados >= empleados) estadoEnvio = "enviado";
      else if (enviados > 0) estadoEnvio = "parcial";

      return {
        periodo,
        empleados,
        enviados,
        estado: estadoEnvio,
        ultimoEnvio: conteo?.ultimoEnvio ?? null,
      };
    });

    const filtradas = estado ? todas.filter((fila) => fila.estado === estado) : todas;
    const resumen = resumirPagina(opciones.pagina, opciones.tamano, filtradas.length);
    const { desde, hasta } = rangoPagina(resumen.pagina, opciones.tamano);

    return (
      <EnviosCliente
        filas={filtradas.slice(desde, hasta + 1)}
        resumen={resumen}
        params={params}
        tamano={opciones.tamano}
        anio={anio}
        estado={estado}
        anioActual={anioActual}
        puedeEscribir={rol !== "lector"}
      />
    );
  } catch (error) {
    return (
      <ContenedorLista>
        <EncabezadoPagina
          titulo="Envíos de colillas"
          subtitulo="Consulta y registra la entrega de las colillas de pago."
          migas={[...MIGAS_BASE, { etiqueta: "Envíos" }]}
          acciones={<BotonReintentar />}
        />
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo cargar la lista de envíos</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Intenta de nuevo."}</AlertDescription>
        </Alert>
      </ContenedorLista>
    );
  }
}
