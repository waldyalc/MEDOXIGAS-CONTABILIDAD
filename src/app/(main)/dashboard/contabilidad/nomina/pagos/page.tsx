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
import { type EstadoPago, type FilaPago, PagosCliente } from "./_components/pagos-cliente";

const ESTADOS_PAGO: readonly EstadoPago[] = ["pendiente", "parcial", "pagado", "no-disponible"];

function anioDeHoy(): number {
  return Number(hoyRD().slice(0, 4));
}

function leerAnio(params: ParametrosLista, defecto: number): number {
  const numero = Number(leerTexto(params, "anio"));
  return Number.isInteger(numero) && numero >= 2000 && numero <= 2100 ? numero : defecto;
}

function leerEstadoPago(params: ParametrosLista): EstadoPago | "" {
  const valor = leerTexto(params, "pago");
  return ESTADOS_PAGO.find((estado) => estado === valor) ?? "";
}

function estadoPagoDe(activos: number, pagados: number, contabilizados: number): EstadoPago {
  if (activos <= 0) return "no-disponible";
  if (pagados >= activos) return "pagado";
  if (pagados > 0) return "parcial";
  if (contabilizados > 0) return "pendiente";
  return "no-disponible";
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const anioActual = anioDeHoy();
  const anio = leerAnio(params, anioActual);
  const estado = leerEstadoPago(params);

  try {
    const periodos = await getPeriodos({ anio });
    const conteos = await getConteosRecibos(periodos.map((periodo) => periodo.id));

    const todas: FilaPago[] = periodos.map((periodo) => {
      const conteo = conteos.get(periodo.id);
      const empleados = conteo?.activos ?? 0;
      const pagados = conteo?.pagados ?? 0;
      const estadoPago = estadoPagoDe(empleados, pagados, conteo?.contabilizados ?? 0);

      return {
        periodo,
        empleados,
        pagados,
        estado: estadoPago,
        fechaPago: estadoPago === "pagado" ? (conteo?.ultimaFechaPago ?? null) : null,
      };
    });

    const filtradas = estado ? todas.filter((fila) => fila.estado === estado) : todas;
    const resumen = resumirPagina(opciones.pagina, opciones.tamano, filtradas.length);
    const { desde, hasta } = rangoPagina(resumen.pagina, opciones.tamano);

    return (
      <PagosCliente
        filas={filtradas.slice(desde, hasta + 1)}
        resumen={resumen}
        params={params}
        tamano={opciones.tamano}
        anio={anio}
        estado={estado}
        anioActual={anioActual}
      />
    );
  } catch (error) {
    return (
      <ContenedorLista>
        <EncabezadoPagina
          titulo="Pagos de nómina"
          subtitulo="Registra la salida de caja o banco de los recibos contabilizados."
          migas={[...MIGAS_BASE, { etiqueta: "Pagos" }]}
          acciones={<BotonReintentar />}
        />
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo cargar la lista de pagos</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Intenta de nuevo."}</AlertDescription>
        </Alert>
      </ContenedorLista>
    );
  }
}
