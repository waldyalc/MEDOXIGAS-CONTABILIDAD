"use client";

import { useEffect, useState } from "react";

import { createPortal } from "react-dom";

import type { FilaEstadoCuenta, TotalesEstadoCuenta } from "@/lib/contactos/estado-cuenta";
import { formatoDia } from "@/lib/formato";

import { TablaEstadoCuenta } from "./tabla-estado-cuenta";

interface Props {
  contactoNombre: string;
  corte: string;
  filas: FilaEstadoCuenta[];
  totales: TotalesEstadoCuenta;
}

export function EstadoCuentaImpresion({ contactoNombre, corte, filas, totales }: Props) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  if (!montado) return null;

  return createPortal(
    <div data-print-root>
      <div data-print-paper className="bg-white text-black">
        <div className="mb-4 flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Estado de cuenta</h1>
          <p className="text-sm">{contactoNombre}</p>
          <p className="text-sm">Fecha de corte: {formatoDia(corte)}</p>
        </div>
        <TablaEstadoCuenta filas={filas} totales={totales} />
      </div>
    </div>,
    document.body,
  );
}
