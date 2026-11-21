import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { getConfigNomina } from "@/lib/nomina/consultas";
import type { ConfigNomina } from "@/lib/nomina/tipos";

import { ErrorCarga } from "../_components/error-carga";
import { MarcoNomina } from "../_components/marco-nomina";
import { AvisoSoloLectura } from "../_components/solo-lectura";
import { type ContactoNomina, type CuentaNomina, getContactosNomina, getCuentasNomina } from "../_datos/consultas";
import { LaboralForm } from "./_components/laboral-form";

function opcionesCuentas(cuentas: readonly CuentaNomina[], filtro: (cuenta: CuentaNomina) => boolean) {
  return cuentas
    .filter((cuenta) => cuenta.activa && cuenta.acepta_movimientos && filtro(cuenta))
    .map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} — ${cuenta.nombre}` }));
}

function opcionesContactos(contactos: readonly ContactoNomina[]) {
  return contactos.map((contacto) => ({
    value: contacto.id,
    label: contacto.rnc_cedula ? `${contacto.nombre} — ${contacto.rnc_cedula}` : contacto.nombre,
  }));
}

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  let config: ConfigNomina | null = null;
  let empresa: Awaited<ReturnType<typeof getEmpresa>> = null;
  let cuentas: CuentaNomina[] = [];
  let contactos: ContactoNomina[] = [];
  let errorCarga: string | null = null;

  try {
    [config, empresa, cuentas, contactos] = await Promise.all([
      getConfigNomina(),
      getEmpresa(),
      getCuentasNomina(),
      getContactosNomina(),
    ]);
  } catch (fallo) {
    errorCarga = fallo instanceof Error ? fallo.message : "No se pudo leer la configuración de nómina.";
  }

  const puedeEditar = rol === "admin" || rol === "contador";

  return (
    <MarcoNomina
      pagina="Datos laborales"
      descripcion="Riesgo SRL, categoría, cuentas por defecto, contactos de ley y provisiones."
      aviso={puedeEditar ? undefined : <AvisoSoloLectura />}
    >
      {errorCarga ? (
        <ErrorCarga titulo="No se pudo cargar la configuración de nómina" mensaje={errorCarga} />
      ) : (
        <LaboralForm
          config={config}
          empresa={empresa}
          cuentasCajaBanco={opcionesCuentas(cuentas, (cuenta) => cuenta.es_caja_banco)}
          cuentasSalarios={opcionesCuentas(cuentas, (cuenta) => cuenta.tipo === "pasivo" || cuenta.tipo === "activo")}
          contactos={opcionesContactos(contactos)}
          puedeEditar={puedeEditar}
        />
      )}
    </MarcoNomina>
  );
}
