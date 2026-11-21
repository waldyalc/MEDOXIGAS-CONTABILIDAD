import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getConfigNomina, getParametrosNomina } from "@/lib/nomina/consultas";
import { anioSchema } from "@/lib/nomina/esquemas";
import type { ConfigNomina, ParametrosRD } from "@/lib/nomina/tipos";

import { ErrorCarga } from "../_components/error-carga";
import { MarcoNomina } from "../_components/marco-nomina";
import { AvisoSoloLectura } from "../_components/solo-lectura";
import { ParametrosCliente } from "./_components/parametros-cliente";

interface Props {
  searchParams: Promise<{ anio?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const anioActual = Number(hoyRD().slice(0, 4));
  const validado = anioSchema.safeParse(params.anio ?? anioActual);
  const anio = validado.success ? validado.data : anioActual;

  let parametros: ParametrosRD | null = null;
  let anterior: ParametrosRD | null = null;
  let config: ConfigNomina | null = null;
  let errorCarga: string | null = null;

  try {
    const [delAnio, delConfig, previos] = await Promise.all([
      getParametrosNomina(anio),
      getConfigNomina(),
      anio > 2000 ? getParametrosNomina(anio - 1) : Promise.resolve(null),
    ]);

    parametros = delAnio;
    config = delConfig;
    anterior = delAnio ? null : previos;
  } catch (fallo) {
    errorCarga = fallo instanceof Error ? fallo.message : "No se pudieron leer los parámetros legales.";
  }

  const puedeEditar = rol === "admin" || rol === "contador";

  return (
    <MarcoNomina
      pagina="Parámetros legales"
      descripcion="Salario mínimo, tasas, topes, jornada y escala de ISR por año fiscal."
      aviso={puedeEditar ? undefined : <AvisoSoloLectura />}
    >
      {errorCarga ? (
        <ErrorCarga titulo="No se pudieron cargar los parámetros legales" mensaje={errorCarga} />
      ) : (
        <ParametrosCliente
          key={anio}
          anio={anio}
          anioActual={anioActual}
          parametros={parametros}
          anterior={anterior}
          riesgo={config?.riesgo_laboral ?? "tipo_1"}
          puedeEditar={puedeEditar}
        />
      )}
    </MarcoNomina>
  );
}
