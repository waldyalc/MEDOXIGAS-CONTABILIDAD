"use client";

import { useEffect, useState } from "react";

import { createPortal } from "react-dom";

import { formatoMoneda, hoyRD } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { FilaTSS } from "@/lib/nomina/tipos";

import { formatoDias, MESES } from "../../periodos/_components/comun-nomina";

interface Totales {
  salario: number;
  sfsEmpleado: number;
  afpEmpleado: number;
  isr: number;
  neto: number;
  sfsEmpleador: number;
  afpEmpleador: number;
  srl: number;
  infotep: number;
}

interface Props {
  anio: number;
  mes: number;
  filas: readonly FilaTSS[];
  empresa: { nombre: string; rnc: string | null; direccion: string | null } | null;
  totales: Totales;
}

function nombreMes(mes: number): string {
  const nombre = MESES[mes - 1] ?? "";
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

export function ImpresionReporte({ anio, mes, filas, empresa, totales }: Props) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  if (!montado) return null;

  return createPortal(
    <div data-print-root>
      <div data-print-paper>
        <article className="bg-white px-8 py-6 text-[9px] leading-[12px] text-slate-900">
          <header className="flex items-start justify-between gap-8 border-b-2 border-slate-800 pb-3">
            <div>
              <p className="text-[14px] font-bold">{empresa?.nombre ?? "MEDOXIGAS ALC, SRL"}</p>
              {empresa?.rnc ? <p>RNC: {empresa.rnc}</p> : null}
              {empresa?.direccion ? <p>{empresa.direccion}</p> : null}
            </div>
            <div className="text-right">
              <p className="text-[13px] font-bold">Reporte TSS</p>
              <p>
                {nombreMes(mes)} de {anio}
              </p>
              <p>Generado el {formatoDia(hoyRD())}</p>
            </div>
          </header>

          <h2 className="mt-4 text-[11px] font-bold">Resumen por empleado</h2>
          <table className="mt-1 w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-slate-400 bg-slate-100 text-left">
                <th className="px-1 py-1">Empleado</th>
                <th className="px-1 py-1">Identificación</th>
                <th className="px-1 py-1 text-right">Salario base</th>
                <th className="px-1 py-1 text-right">SFS</th>
                <th className="px-1 py-1 text-right">AFP</th>
                <th className="px-1 py-1 text-right">ISR</th>
                <th className="px-1 py-1 text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.empleado_id} className="border-b border-slate-200">
                  <td className="px-1 py-0.5">{fila.empleado_nombre}</td>
                  <td className="px-1 py-0.5 tabular-nums">{fila.identificacion}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.salario_base)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.sfs_empleado)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.afp_empleado)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.isr)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.neto_pagar)}</td>
                </tr>
              ))}
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-1 py-3 text-center">
                    Sin nómina contabilizada o pagada en {nombreMes(mes).toLowerCase()} de {anio}.
                  </td>
                </tr>
              ) : (
                <tr className="border-t border-slate-800 font-bold">
                  <td className="px-1 py-1" colSpan={2}>
                    Totales
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums">{formatoMoneda(totales.salario)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{formatoMoneda(totales.sfsEmpleado)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{formatoMoneda(totales.afpEmpleado)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{formatoMoneda(totales.isr)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{formatoMoneda(totales.neto)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <h2 className="mt-5 text-[11px] font-bold">Bases y aportes patronales (SUIRPlus)</h2>
          <table className="mt-1 w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-slate-400 bg-slate-100 text-left">
                <th className="px-1 py-1">Empleado</th>
                <th className="px-1 py-1 text-right">Días</th>
                <th className="px-1 py-1 text-right">Base SFS</th>
                <th className="px-1 py-1 text-right">Base AFP</th>
                <th className="px-1 py-1 text-right">Base SRL</th>
                <th className="px-1 py-1 text-right">Base INFOTEP</th>
                <th className="px-1 py-1 text-right">SFS empleador</th>
                <th className="px-1 py-1 text-right">AFP empleador</th>
                <th className="px-1 py-1 text-right">SRL</th>
                <th className="px-1 py-1 text-right">INFOTEP</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.empleado_id} className="border-b border-slate-200">
                  <td className="px-1 py-0.5">{fila.empleado_nombre}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoDias(fila.dias_trabajados)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.base_sfs)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.base_afp)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.base_srl)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.base_infotep)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.sfs_empleador)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.afp_empleador)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.srl)}</td>
                  <td className="px-1 py-0.5 text-right tabular-nums">{formatoMoneda(fila.infotep)}</td>
                </tr>
              ))}
              {filas.length > 0 ? (
                <tr className="border-t border-slate-800 font-bold">
                  <td className="px-1 py-1" colSpan={6}>
                    Totales
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums">{formatoMoneda(totales.sfsEmpleador)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{formatoMoneda(totales.afpEmpleador)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{formatoMoneda(totales.srl)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{formatoMoneda(totales.infotep)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <footer className="mt-6 border-t border-slate-300 pt-2 text-center text-[7px]">
            Generado con Medoxigas Contabilidad · Página 1 de 1
          </footer>
        </article>
      </div>
    </div>,
    document.body,
  );
}
