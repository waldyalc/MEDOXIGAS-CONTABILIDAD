import { redirect } from "next/navigation";

import { leerPagina, leerTamano, leerTexto, resumirPagina } from "@/lib/listas/parametros";
import { getResumenTurno } from "@/lib/pos/consultas";

import { DevolucionesPos } from "../_components/devoluciones/devoluciones-pos";
import { hoyRD, primerDiaMesRD } from "../_components/formato-pos";
import { getContextoPOS, getCuentasPOS, getDevolucionesPOS } from "../_components/servidor";

const ESTADOS = new Set(["activa", "anulada"]);

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
  const limpio = leerTexto(params, "limpio") === "1";
  const desdeParam = leerTexto(params, "desde");
  const hastaParam = leerTexto(params, "hasta");
  const desde = desdeParam || (limpio ? "" : primerDiaMesRD());
  const hasta = hastaParam || (limpio ? "" : hoyRD());
  const estadoTexto = leerTexto(params, "estado");
  const estado = ESTADOS.has(estadoTexto) ? (estadoTexto as "activa" | "anulada") : undefined;
  const q = leerTexto(params, "q");
  const facturaInicial = leerTexto(params, "factura");

  const cuentas = await getCuentasPOS().catch(() => [] as Awaited<ReturnType<typeof getCuentasPOS>>);
  let devoluciones = {
    filas: [] as Awaited<ReturnType<typeof getDevolucionesPOS>>["filas"],
    resumen: resumirPagina(leerPagina(params), leerTamano(params), 0),
  };
  let error: string | null = null;

  try {
    devoluciones = await getDevolucionesPOS({
      q,
      desde: desde || undefined,
      hasta: hasta || undefined,
      estado,
      pagina: leerPagina(params),
      tamano: leerTamano(params),
    });
  } catch {
    error = "No se pudieron cargar las devoluciones. Revisa tu conexión e inténtalo de nuevo.";
  }

  const resumenTurno = contexto.turno ? await getResumenTurno(contexto.turno.id).catch(() => null) : null;

  const cuentaEfectivoNombre =
    cuentas.find((cuenta) => cuenta.id === terminal.cuenta_efectivo_id)?.nombre ?? terminal.nombre;
  const sinCaja = !cuentas.some((cuenta) => cuenta.id === terminal.cuenta_efectivo_id);

  return (
    <DevolucionesPos
      filas={devoluciones.filas}
      resumen={devoluciones.resumen}
      params={params}
      desde={desde}
      hasta={hasta}
      terminal={{
        id: terminal.id,
        nombre: terminal.nombre,
        cuenta_efectivo_id: terminal.cuenta_efectivo_id,
      }}
      cuentaEfectivoNombre={cuentaEfectivoNombre}
      sinCaja={sinCaja}
      turno={contexto.turno ? { id: contexto.turno.id, numero: contexto.turno.numero } : null}
      efectivoEsperado={resumenTurno?.resumen.efectivo.efectivo_esperado ?? "0.00"}
      facturaInicial={facturaInicial || null}
      plantilla={terminal.plantilla_ticket}
      puedeEscribir={contexto.perfil.rol !== "lector"}
      hayFiltros={Boolean(q || estadoTexto || desdeParam || hastaParam || limpio)}
      error={error}
    />
  );
}
