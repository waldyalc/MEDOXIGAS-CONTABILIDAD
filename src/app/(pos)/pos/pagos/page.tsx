import { redirect } from "next/navigation";

import { leerPagina, leerTamano, leerTexto, type ResultadoPagina, resumirPagina } from "@/lib/listas/parametros";
import { getPagosPOS, getResumenTurno, type PagoPOSFila } from "@/lib/pos/consultas";
import type { ResumenTurnoVista, TipoMovimientoPOS } from "@/lib/pos/tipos";

import { PagosPos } from "../_components/pagos/pagos-pos";
import { HidratadorSnapshotPos } from "../_components/pos-spa-shell";
import { type CuentaPOS, getContextoPOS, getCuentasPOS } from "../_components/servidor";

/**
 * Registro de pagos del POS (Ingresos → Registro de pagos, C6): los recibos de
 * caja de `pos_turno_movimientos` de esta terminal. «Nuevo pago» exige turno
 * abierto — la caja es del turno — y el resumen del turno se trae junto para
 * que el diálogo calcule el efectivo esperado después.
 */
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
  const q = leerTexto(params, "q");
  const tipo: TipoMovimientoPOS = leerTexto(params, "tipo") === "retiro" ? "retiro" : "ingreso";

  let cuentas: CuentaPOS[] = [];
  try {
    cuentas = await getCuentasPOS();
  } catch {
    cuentas = [];
  }

  let vista: ResumenTurnoVista | null = null;
  let error: string | null = null;

  if (contexto.turno) {
    try {
      vista = await getResumenTurno(contexto.turno.id);
    } catch {
      error = "No se pudo cargar el turno abierto. Revisa tu conexión e inténtalo de nuevo.";
    }
  }

  let pagos: ResultadoPagina<PagoPOSFila> = { filas: [], resumen: resumirPagina(pagina, tamano, 0) };
  try {
    pagos = await getPagosPOS({ terminalId: terminal.id, tipo, q, pagina, tamano });
  } catch {
    error = error ?? "No se pudieron cargar los recibos. Revisa tu conexión e inténtalo de nuevo.";
  }

  const props = {
    terminal: {
      id: terminal.id,
      nombre: terminal.nombre,
      cuenta_efectivo_id: terminal.cuenta_efectivo_id,
      plantilla_ticket: terminal.plantilla_ticket,
    },
    turnoAbierto: contexto.turno !== null,
    vista,
    cuentas,
    filas: pagos.filas,
    resumenPagina: pagos.resumen,
    params,
    tipo,
    puedeEscribir: contexto.perfil.rol !== "lector",
    error,
  };

  return (
    <>
      <HidratadorSnapshotPos vista="pagos" datos={{ ...props, actualizadoEn: Date.now() }} />
      <PagosPos {...props} />
    </>
  );
}
