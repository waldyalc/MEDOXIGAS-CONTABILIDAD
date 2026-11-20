import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { getMapeoContable } from "@/lib/nomina/consultas";
import type { MapeoContable } from "@/lib/nomina/tipos";

import { ErrorCarga } from "../_components/error-carga";
import { MarcoNomina } from "../_components/marco-nomina";
import { AvisoSoloLectura } from "../_components/solo-lectura";
import { type CuentaNomina, getCuentasNomina } from "../_datos/consultas";
import { MapeoCliente } from "./_components/mapeo-cliente";

function opcionesCuentas(cuentas: readonly CuentaNomina[], filtro: (cuenta: CuentaNomina) => boolean) {
  return cuentas
    .filter((cuenta) => cuenta.activa && cuenta.acepta_movimientos && filtro(cuenta))
    .map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} — ${cuenta.nombre}` }));
}

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  let mapeos: MapeoContable[] = [];
  let cuentas: CuentaNomina[] = [];
  let errorCarga: string | null = null;

  try {
    [mapeos, cuentas] = await Promise.all([getMapeoContable(), getCuentasNomina()]);
  } catch (fallo) {
    errorCarga = fallo instanceof Error ? fallo.message : "No se pudo leer el mapeo contable.";
  }

  const puedeEditar = rol === "admin" || rol === "contador";

  return (
    <MarcoNomina
      pagina="Mapeo contable"
      descripcion="Cuentas de gasto y de pasivo por concepto y segmento contable."
      aviso={puedeEditar ? undefined : <AvisoSoloLectura />}
    >
      {errorCarga ? (
        <ErrorCarga titulo="No se pudo cargar el mapeo contable" mensaje={errorCarga} />
      ) : (
        <MapeoCliente
          mapeos={mapeos}
          cuentasGasto={opcionesCuentas(cuentas, (cuenta) => cuenta.tipo === "gasto" || cuenta.tipo === "costo")}
          cuentasPasivo={opcionesCuentas(cuentas, (cuenta) => cuenta.tipo === "pasivo")}
          puedeEditar={puedeEditar}
        />
      )}
    </MarcoNomina>
  );
}
