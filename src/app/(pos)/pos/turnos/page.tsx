import { redirect } from "next/navigation";

import { leerPagina, leerTamano, leerTexto, type ResultadoPagina, resumirPagina } from "@/lib/listas/parametros";
import { getResumenTurno } from "@/lib/pos/consultas";
import type { ResumenTurnoVista, TurnoPOS } from "@/lib/pos/tipos";

import { HidratadorSnapshotPos } from "../_components/pos-spa-shell";
import {
  type CuentaPOS,
  getCierresPOS,
  getContextoPOS,
  getCuentasPOS,
  getTerminalesSeguro,
  getUltimoTurno,
} from "../_components/servidor";
import { TurnosPos } from "../_components/turnos/turnos-pos";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contexto = await getContextoPOS();
  if (!contexto.perfil) redirect("/login");
  if (!contexto.terminal) return null;

  const params = await searchParams;
  const terminal = contexto.terminal;
  const pagina = leerPagina(params);
  const tamano = leerTamano(params);
  const todas = leerTexto(params, "todas") === "1";

  let cuentas: CuentaPOS[] = [];
  try {
    cuentas = await getCuentasPOS();
  } catch {
    cuentas = [];
  }

  const terminales = await getTerminalesSeguro();

  let cierres: ResultadoPagina<TurnoPOS> = { filas: [], resumen: resumirPagina(pagina, tamano, 0) };
  let vista: ResumenTurnoVista | null = null;
  let error: string | null = null;

  try {
    cierres = await getCierresPOS({ terminalId: terminal.id, todas, pagina, tamano });
  } catch {
    error = "No se pudieron cargar los cierres. Revisa tu conexión e inténtalo de nuevo.";
  }

  try {
    const vistaActual = contexto.turno ? await getResumenTurno(contexto.turno.id) : null;
    const ultimo = vistaActual ? null : await getUltimoTurno(terminal.id);
    vista = vistaActual ?? (ultimo ? await getResumenTurno(ultimo.id) : null);
  } catch {
    error = error ?? "No se pudo cargar el turno. Revisa tu conexión e inténtalo de nuevo.";
  }

  const props = {
    terminal: {
      id: terminal.id,
      nombre: terminal.nombre,
      cuenta_efectivo_id: terminal.cuenta_efectivo_id,
      plantilla_ticket: terminal.plantilla_ticket,
    },
    vistaInicial: vista,
    turnoAbierto: contexto.turno !== null,
    cuentas,
    cierres: cierres.filas,
    resumenPagina: cierres.resumen,
    terminales: terminales.map((candidata) => ({
      id: candidata.id,
      nombre: candidata.nombre,
      cuenta_tarjeta_debito_id: candidata.cuenta_tarjeta_debito_id,
      cuenta_tarjeta_credito_id: candidata.cuenta_tarjeta_credito_id,
    })),
    todas,
    params,
    puedeEscribir: contexto.perfil.rol !== "lector",
    error,
  };

  return (
    <>
      <HidratadorSnapshotPos vista="turnos" datos={{ ...props, actualizadoEn: Date.now() }} />
      <TurnosPos {...props} />
    </>
  );
}
