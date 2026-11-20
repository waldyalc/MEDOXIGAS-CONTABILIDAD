"use client";

import { useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Filtro de fechas de la ficha de cuenta: escribe `desde`/`hasta` en la URL y recarga la página. */
export function FiltroFechasCuenta({ desde, hasta }: { desde?: string; hasta?: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const [inicio, setInicio] = useState(desde ?? "");
  const [fin, setFin] = useState(hasta ?? "");
  const hayFiltro = inicio !== "" || fin !== "";

  function filtrar() {
    const parametros = new URLSearchParams();
    if (inicio) parametros.set("desde", inicio);
    if (fin) parametros.set("hasta", fin);
    const consulta = parametros.toString();
    router.push(consulta ? `${ruta}?${consulta}` : ruta);
  }

  function limpiar() {
    setInicio("");
    setFin("");
    router.push(ruta);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="desde">Desde</Label>
        <DatePicker id="desde" value={inicio} onChange={setInicio} className="w-44" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hasta">Hasta</Label>
        <DatePicker id="hasta" value={fin} onChange={setFin} className="w-44" />
      </div>
      <Button type="button" variant="secondary" onClick={filtrar}>
        Filtrar
      </Button>
      {hayFiltro ? (
        <Button type="button" variant="ghost" onClick={limpiar}>
          Limpiar
        </Button>
      ) : null}
    </div>
  );
}
