"use client";

import { type FormEvent, useState } from "react";

import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function FiltroFechas({ desde, hasta }: { desde: string; hasta: string }) {
  const router = useRouter();
  const [fechaDesde, setFechaDesde] = useState(desde);
  const [fechaHasta, setFechaHasta] = useState(hasta);

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const parametros = new URLSearchParams();
    if (fechaDesde) parametros.set("desde", fechaDesde);
    if (fechaHasta) parametros.set("hasta", fechaHasta);
    const consulta = parametros.toString();
    router.push(consulta ? `?${consulta}` : "?");
  }

  function limpiar() {
    setFechaDesde("");
    setFechaHasta("");
    router.push("?");
  }

  return (
    <form onSubmit={aplicar} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="banco-desde">Desde</Label>
        <DatePicker id="banco-desde" value={fechaDesde} onChange={setFechaDesde} className="w-44" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="banco-hasta">Hasta</Label>
        <DatePicker id="banco-hasta" value={fechaHasta} onChange={setFechaHasta} className="w-44" />
      </div>
      <Button type="submit" variant="secondary">
        Filtrar
      </Button>
      <Button type="button" variant="ghost" onClick={limpiar}>
        Limpiar
      </Button>
    </form>
  );
}
