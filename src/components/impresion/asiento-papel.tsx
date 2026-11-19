import { cn } from "cn";

import { FilaDato, Firmas, HojaImpresion } from "@/components/impresion/hoja-impresion";
import { valorACentavos } from "@/lib/facturacion/calculo";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { Empresa } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

/** Papel de impresión del asiento contable (entrada de diario). */

const CELDA = "px-[5pt] py-[2.5pt] align-top";
const CELDA_DATO = "px-[5pt] py-[2.5pt] align-top text-[10pt] leading-[12.1pt] font-semibold";
const CELDA_MONTO = "px-[3pt] py-[2.5pt] align-top text-right whitespace-nowrap tabular-nums";
const ENCABEZADO_TABLA = "border-y border-[#d7dce3] bg-[#f7f8fa] px-[5pt] py-[2.5pt] text-[7.5pt] font-semibold";
const FILA_TABLA = "border-b border-[#e2e5ea]";

interface LineaAsientoPapel {
  id: string;
  descripcion: string | null;
  debito: number;
  credito: number;
  cuenta: { codigo: string; nombre: string } | null;
}

export function AsientoPapel({
  asiento,
  empresa,
  classNameBoton,
}: {
  asiento: {
    numero: number;
    fecha: string;
    descripcion: string;
    origen: { etiqueta: string };
    lineas: LineaAsientoPapel[];
  };
  empresa: Empresa | null;
  classNameBoton?: string;
}) {
  const debitos = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.debito), 0);
  const creditos = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.credito), 0);
  const cuadrado = debitos === creditos;

  return (
    <HojaImpresion
      titulo="ENTRADA DE DIARIO"
      empresa={empresa}
      numero={`No. ${asiento.numero}`}
      fecha={asiento.fecha}
      classNameBoton={classNameBoton}
    >
      <section className="mt-[18pt] flex justify-between gap-[20pt] bg-[#f7f8fa] px-[5pt] py-[3pt]">
        <div className="flex min-w-0 flex-col">
          <p className="whitespace-pre-line">
            <span className="font-semibold">Descripción:</span> {asiento.descripcion || "—"}
          </p>
          <FilaDato etiqueta="Origen" valor={asiento.origen.etiqueta} />
        </div>

        <div className="flex shrink-0 flex-col items-end text-right">
          <FilaDato etiqueta="Fecha" valor={formatoDia(asiento.fecha)} />
          <p>
            <span className="font-semibold">Estado:</span>{" "}
            <span className={cuadrado ? "font-semibold" : "font-bold text-red-600"}>
              {cuadrado ? "Cuadrado" : "Descuadrado"}
            </span>
          </p>
        </div>
      </section>

      {asiento.lineas.length === 0 ? (
        <p className="mt-[12pt]">El asiento no tiene líneas.</p>
      ) : (
        <table className="mt-[12pt] w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[150pt]" />
            <col />
            <col className="w-[90pt]" />
            <col className="w-[90pt]" />
          </colgroup>
          <thead>
            <tr>
              <th className={ENCABEZADO_TABLA}>Cuenta</th>
              <th className={ENCABEZADO_TABLA}>Descripción</th>
              <th className={cn(ENCABEZADO_TABLA, "text-right")}>Débito</th>
              <th className={cn(ENCABEZADO_TABLA, "text-right")}>Crédito</th>
            </tr>
          </thead>
          <tbody>
            {asiento.lineas.map((linea) => (
              <tr key={linea.id} className={FILA_TABLA}>
                <td className={CELDA_DATO}>{linea.cuenta ? `${linea.cuenta.codigo} · ${linea.cuenta.nombre}` : "—"}</td>
                <td className={CELDA}>{linea.descripcion || "—"}</td>
                <td className={CELDA_MONTO}>{linea.debito === 0 ? "—" : formatoMoneda(linea.debito)}</td>
                <td className={CELDA_MONTO}>{linea.credito === 0 ? "—" : formatoMoneda(linea.credito)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#0a2352] font-semibold">
              <td className="px-[5pt] py-[2.5pt] text-right" colSpan={2}>
                Totales
              </td>
              <td className={CELDA_MONTO}>{formatoMoneda(debitos / 100)}</td>
              <td className={CELDA_MONTO}>{formatoMoneda(creditos / 100)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      <div className="flex-1" />

      <Firmas etiquetas={["CONTADOR"]} />
    </HojaImpresion>
  );
}
