import { redirect } from "next/navigation";

import { TriangleAlert } from "lucide-react";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getRol } from "@/lib/auth/rol";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { hoyRD } from "@/lib/facturacion/formato";
import { leerTexto, type ParametrosLista } from "@/lib/listas/parametros";
import { getReporteTSS } from "@/lib/nomina/consultas";
import type { FilaTSS } from "@/lib/nomina/tipos";

import { BotonReintentar } from "../periodos/_components/boton-reintentar";
import { MIGAS_BASE } from "../periodos/_components/comun-nomina";
import { ReporteCliente } from "./_components/reporte-cliente";

function leerAnio(params: ParametrosLista, defecto: number): number {
  const numero = Number(leerTexto(params, "anio"));
  return Number.isInteger(numero) && numero >= 2000 && numero <= 2100 ? numero : defecto;
}

function leerMes(params: ParametrosLista, defecto: number): number {
  const numero = Number(leerTexto(params, "mes"));
  return Number.isInteger(numero) && numero >= 1 && numero <= 12 ? numero : defecto;
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const hoy = hoyRD();
  const anioActual = Number(hoy.slice(0, 4));
  const anio = leerAnio(params, anioActual);
  const mes = leerMes(params, Number(hoy.slice(5, 7)));
  const anios = Array.from({ length: 4 }, (_, indice) => anioActual - 2 + indice);

  let filas: FilaTSS[] = [];
  let empresa: { nombre: string; rnc: string | null; direccion: string | null } | null = null;
  let error: string | null = null;

  try {
    [filas, empresa] = await Promise.all([
      getReporteTSS({ anio, mes }),
      getEmpresa()
        .then((datos) => (datos ? { nombre: datos.nombre, rnc: datos.rnc, direccion: datos.direccion } : null))
        .catch(() => null),
    ]);
  } catch (fallo) {
    error = fallo instanceof Error ? fallo.message : "Intenta de nuevo.";
  }

  if (error) {
    return (
      <ContenedorLista>
        <EncabezadoPagina
          titulo="Reporte TSS"
          subtitulo="Resumen mensual por empleado para SUIRPlus e IR-3."
          migas={[...MIGAS_BASE, { etiqueta: "Reporte TSS" }]}
          acciones={<BotonReintentar />}
        />
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo generar el reporte TSS</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </ContenedorLista>
    );
  }

  return <ReporteCliente filas={filas} anio={anio} mes={mes} anios={anios} empresa={empresa} params={params} />;
}
