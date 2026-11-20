import { formatoMoneda } from "@/lib/facturacion/formato";
import type { Empresa } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";
import type { Empleado, PeriodoNomina, ReciboConLineas } from "@/lib/nomina/tipos";

import {
  etiquetaFrecuencia,
  etiquetaPeriodo,
  formatoDias,
  formatoPorcentajeNomina,
} from "../../../../periodos/_components/comun-nomina";

interface Props {
  empresa: Empresa | null;
  periodo: PeriodoNomina;
  empleado: Empleado;
  recibo: ReciboConLineas;
  asientoCodigo: string | null;
}

const CELDA = "px-[5pt] py-[2.5pt] align-top";
const CELDA_MONTO = "px-[5pt] py-[2.5pt] align-top text-right whitespace-nowrap tabular-nums";

function nombreEmpresa(empresa: Empresa | null): string {
  return empresa?.nombre?.trim() || "MEDOXIGAS ALC, SRL";
}

function etiquetaMetodo(metodo: Empleado["metodo_pago"]): string {
  if (metodo === "efectivo") return "Efectivo";
  if (metodo === "cheque") return "Cheque";
  return "Transferencia";
}

export function ColillaPapel({ empresa, periodo, empleado, recibo, asientoCodigo }: Props) {
  const nombre = nombreEmpresa(empresa);
  const logo = empresa?.logo_url?.trim() || "/marca/logo-medoxigas.png";
  const ingresos = recibo.lineas.filter((linea) => linea.clase === "ingreso");
  const deducciones = recibo.lineas.filter((linea) => linea.clase === "deduccion");

  return (
    <article className="documento-papel mx-auto flex min-h-[10.98in] w-full flex-col bg-white px-[16pt] pt-[28pt] pb-[3pt] [font-family:var(--font-inter)] text-[10pt] leading-[12.1pt] text-[#0a2352]">
      <header className="flex items-start justify-between gap-[24pt]">
        <div className="flex min-w-0 flex-col">
          {/* biome-ignore lint/performance/noImgElement: logo configurable de la empresa */}
          <img src={logo} alt={nombre} className="h-[44pt] w-auto max-w-[150pt] object-contain" />
          <p className="mt-[3pt] text-[13pt] leading-[13.5pt] font-semibold">{nombre}</p>
          {empresa?.rnc?.trim() ? <p>RNC: {empresa.rnc}</p> : null}
          {empresa?.direccion?.trim() ? <p>{empresa.direccion}</p> : null}
          {empresa?.correo?.trim() ? <p>{empresa.correo}</p> : null}
          {empresa?.telefono?.trim() ? <p>Teléfono: {empresa.telefono}</p> : null}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[13pt] leading-[16pt] font-semibold">Colilla de pago</p>
          <p>Periodo {etiquetaPeriodo(periodo.fecha_inicio, periodo.fecha_fin, true)}</p>
          <p className="font-mono text-[9pt]">{periodo.codigo}</p>
        </div>
      </header>

      <section className="mt-[16pt] flex justify-between gap-[20pt] bg-[#f7f8fa] px-[5pt] py-[4pt]">
        <div className="flex min-w-0 flex-col">
          <p>
            <span className="font-semibold">Empleado:</span> {empleado.nombre_completo}
          </p>
          <p>
            <span className="font-semibold">Identificación:</span> {empleado.identificacion}
          </p>
          <p>
            <span className="font-semibold">Cargo:</span> {empleado.cargo ?? "—"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          {empleado.clave_tss ? (
            <p>
              <span className="font-semibold">Clave TSS:</span> <span className="font-mono">{empleado.clave_tss}</span>
            </p>
          ) : null}
          <p>
            <span className="font-semibold">Frecuencia:</span> {etiquetaFrecuencia(empleado.frecuencia_pago)}
          </p>
          <p>
            <span className="font-semibold">Método de pago:</span> {etiquetaMetodo(empleado.metodo_pago)}
          </p>
        </div>
      </section>

      <section className="mt-[10pt] grid grid-cols-4 gap-[6pt] border-y border-[#d7dce3] py-[4pt] text-[8.5pt] leading-[10pt]">
        <div>
          <p className="font-semibold">Fecha de ingreso</p>
          <p>{formatoDia(empleado.fecha_ingreso)}</p>
        </div>
        <div>
          <p className="font-semibold">Días trabajados</p>
          <p className="tabular-nums">{formatoDias(recibo.dias_trabajados)}</p>
        </div>
        <div>
          <p className="font-semibold">Fecha de pago</p>
          <p>{recibo.fecha_pagado ? formatoDia(recibo.fecha_pagado) : "Pendiente de pago"}</p>
        </div>
        <div>
          <p className="font-semibold">Comprobante NO</p>
          <p className="font-mono">{asientoCodigo ?? "—"}</p>
        </div>
      </section>

      <TablaColilla titulo="Ingresos" lineas={ingresos} conCantidad />
      <TablaColilla titulo="Deducciones" lineas={deducciones} conCantidad={false} />

      <div className="flex justify-end">
        <div className="mt-[10pt] w-[220pt] text-[9pt] leading-[13pt]">
          <div className="flex justify-between gap-[12pt]">
            <span>Total de ingresos</span>
            <span className="tabular-nums">{formatoMoneda(recibo.total_ingresos)}</span>
          </div>
          <div className="flex justify-between gap-[12pt]">
            <span>Total de deducciones</span>
            <span className="tabular-nums">{formatoMoneda(recibo.total_deducciones)}</span>
          </div>
          <div className="mt-[4pt] flex justify-between gap-[12pt] border-t border-[#0a2352] pt-[3pt] text-[13pt] font-semibold">
            <span>Neto a pagar</span>
            <span className="tabular-nums">{formatoMoneda(recibo.neto_pagar)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <section className="mt-[14pt] flex flex-col gap-[4pt] text-[8.5pt] leading-[10.5pt]">
        <p>
          Se liquidan únicamente los días trabajados dentro del periodo. Las deducciones de SFS, AFP e ISR corresponden
          a los aportes de ley.
        </p>
        <p>Documento informativo; no sustituye el comprobante fiscal.</p>
      </section>

      <footer className="mt-[16pt]">
        <p className="text-center text-[6pt]">Generado con Medoxigas Contabilidad</p>
        <p className="mt-[4pt] text-[8pt]">Página 1 de 1</p>
      </footer>
    </article>
  );
}

function valorCantidad(linea: ReciboConLineas["lineas"][number], conCantidad: boolean): string {
  if (conCantidad) return formatoDias(linea.cantidad);
  if (linea.porcentaje) return formatoPorcentajeNomina(linea.porcentaje);
  return "—";
}

function TablaColilla({
  titulo,
  lineas,
  conCantidad,
}: {
  titulo: string;
  lineas: ReciboConLineas["lineas"];
  conCantidad: boolean;
}) {
  return (
    <section className="mt-[12pt]">
      <p className="bg-[#eef0f3] px-[5pt] py-[2.5pt] text-[9pt] font-bold">{titulo}</p>
      <table className="w-full table-fixed border-collapse text-left text-[9pt]">
        <colgroup>
          <col />
          <col className="w-[70pt]" />
          <col className="w-[90pt]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[#c9d0da] text-[7.5pt]">
            <th className="px-[5pt] py-[2pt] font-semibold">Concepto</th>
            <th className="px-[5pt] py-[2pt] text-right font-semibold">{conCantidad ? "Cantidad" : "% / Base"}</th>
            <th className="px-[5pt] py-[2pt] text-right font-semibold">Monto</th>
          </tr>
        </thead>
        <tbody>
          {lineas.length === 0 ? (
            <tr>
              <td className={CELDA} colSpan={3}>
                Sin {titulo.toLowerCase()}.
              </td>
            </tr>
          ) : (
            lineas.map((linea) => (
              <tr key={linea.id} className="border-b border-[#e2e5ea]">
                <td className={CELDA}>{linea.concepto_nombre}</td>
                <td className={CELDA_MONTO}>{valorCantidad(linea, conCantidad)}</td>
                <td className={CELDA_MONTO}>{formatoMoneda(linea.monto)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
