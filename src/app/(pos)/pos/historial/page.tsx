import { redirect } from "next/navigation";

import { getEmpresa } from "@/lib/facturacion/consultas";
import { leerPagina, leerTamano, leerTexto, type ResultadoPagina, resumirPagina } from "@/lib/listas/parametros";
import { getPlantillaImpresion } from "@/lib/plantillas-impresion/consultas";
import { getHistorialPOS } from "@/lib/pos/consultas";
import type { HistorialPOSFila } from "@/lib/pos/tipos";

import { hoyRD, primerDiaMesRD } from "../_components/formato-pos";
import { HistorialPos } from "../_components/historial/historial-pos";
import { HidratadorSnapshotPos } from "../_components/pos-spa-shell";
import { getContextoPOS, getTerminalesSeguro } from "../_components/servidor";

const ESTADOS = new Set(["pagada", "abierta", "anulada"]);

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
  const q = leerTexto(params, "q");
  const estadoTexto = leerTexto(params, "estado");
  const terminalParam = leerTexto(params, "terminal");
  const estado = ESTADOS.has(estadoTexto) ? (estadoTexto as "pagada" | "abierta" | "anulada") : undefined;
  const pagina = leerPagina(params);
  const tamano = leerTamano(params);

  const [terminales, empresa, plantillaFactura] = await Promise.all([
    getTerminalesSeguro(),
    getEmpresa(),
    getPlantillaImpresion("factura"),
  ]);

  let historial: ResultadoPagina<HistorialPOSFila> = {
    filas: [],
    resumen: resumirPagina(pagina, tamano, 0),
  };
  let error: string | null = null;

  try {
    historial = await getHistorialPOS({
      q,
      desde: desde || undefined,
      hasta: hasta || undefined,
      estado,
      terminal_id: terminalParam || undefined,
      pagina,
      tamano,
    });
  } catch {
    error = "No se pudo cargar el historial. Revisa tu conexión e inténtalo de nuevo.";
  }

  const props = {
    filas: historial.filas,
    resumen: historial.resumen,
    params,
    terminales: terminales.map((candidata) => ({ id: candidata.id, nombre: candidata.nombre })),
    desde,
    hasta,
    empresa,
    plantillaTicket: terminal.plantilla_ticket,
    plantillaFactura,
    puedeEscribir: contexto.perfil.rol !== "lector",
    hayFiltros: Boolean(q || estadoTexto || terminalParam || desdeParam || hastaParam || limpio),
    error,
  };

  return (
    <>
      <HidratadorSnapshotPos vista="historial" datos={{ ...props, actualizadoEn: Date.now() }} />
      <HistorialPos {...props} />
    </>
  );
}
