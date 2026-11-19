"use client";

import { type ReactNode, useState } from "react";

import Link from "next/link";

import { ChevronDown, ChevronRight } from "lucide-react";

import { FilaNavegable } from "@/components/listas/fila-navegable";
import { TableBody, TableCell } from "@/components/ui/table";
import type { NodoIngresoCompra } from "@/lib/reportes/administrativos/e/ingresos-compras";
import { urlMovimientosCuenta } from "@/lib/reportes/administrativos/e/urls";
import { formatearRd } from "@/lib/reportes/dinero";

interface Props {
  ingresos: readonly NodoIngresoCompra[];
  costos: readonly NodoIngresoCompra[];
  gastos: readonly NodoIngresoCompra[];
  desde: string;
  hasta: string;
}

interface PropsFilaCuenta {
  nodo: NodoIngresoCompra;
  nivel: number;
  colapsado: boolean;
  desde: string;
  hasta: string;
  onAlternar: (id: string) => void;
}

function FilaCuenta({ nodo, nivel, colapsado, desde, hasta, onAlternar }: PropsFilaCuenta) {
  const tieneHijos = nodo.hijos.length > 0;

  return (
    <FilaNavegable
      href={urlMovimientosCuenta(nodo.codigo, desde, hasta)}
      className={tieneHijos ? "font-medium" : undefined}
    >
      <TableCell>
        <div className="flex items-center gap-1" style={{ paddingLeft: `${nivel * 1.25}rem` }}>
          {tieneHijos ? (
            <button
              type="button"
              onClick={() => onAlternar(nodo.id)}
              aria-expanded={!colapsado}
              aria-label={colapsado ? `Expandir ${nodo.nombre}` : `Contraer ${nodo.nombre}`}
              className="text-muted-foreground hover:text-foreground flex size-5 shrink-0 items-center justify-center"
            >
              {colapsado ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          ) : (
            <span className="size-5 shrink-0" aria-hidden="true" />
          )}
          <span className="text-muted-foreground">{nodo.codigo}</span>
          <Link href={urlMovimientosCuenta(nodo.codigo, desde, hasta)} className="hover:underline">
            {nodo.nombre}
          </Link>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatearRd(nodo.monto)}</TableCell>
    </FilaNavegable>
  );
}

export function ArbolCuentas({ ingresos, costos, gastos, desde, hasta }: Props) {
  const [colapsados, setColapsados] = useState<Set<string>>(() => new Set());

  function alternar(id: string): void {
    setColapsados((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  }

  function filas(nodos: readonly NodoIngresoCompra[], nivel: number): ReactNode[] {
    const resultado: ReactNode[] = [];

    for (const nodo of nodos) {
      const colapsado = colapsados.has(nodo.id);

      resultado.push(
        <FilaCuenta
          key={nodo.id}
          nodo={nodo}
          nivel={nivel}
          colapsado={colapsado}
          desde={desde}
          hasta={hasta}
          onAlternar={alternar}
        />,
      );

      if (!colapsado) resultado.push(...filas(nodo.hijos, nivel + 1));
    }

    return resultado;
  }

  return (
    <TableBody>
      {filas(ingresos, 0)}
      {filas(costos, 0)}
      {filas(gastos, 0)}
    </TableBody>
  );
}
